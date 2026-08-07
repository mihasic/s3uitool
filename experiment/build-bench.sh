#!/usr/bin/env bash
# Cold + warm docker build timings for both stacks, plus image sizes.
set -uo pipefail
cd "$(dirname "$0")/.."

# The Python backend now lives only in git history; point this at a worktree of the
# pre-swap commit (see README.md) to regenerate the Python column.
PY_ROOT=${PYTHON_WORKTREE:-../s3uitool-python}

SCRATCH_MAIN_PY=$(mktemp)
SCRATCH_APP_TS=$(mktemp)
trap '[ -s "$SCRATCH_MAIN_PY" ] && cp "$SCRATCH_MAIN_PY" "$PY_ROOT/api/src/main.py"; [ -s "$SCRATCH_APP_TS" ] && cp "$SCRATCH_APP_TS" api/src/app.ts' EXIT

now() { python3 -c 'import time; print(time.time())'; }

run() { # label context tag [extra docker build args...]
  local label=$1 context=$2 tag=$3
  shift 3
  local start end
  start=$(now)
  if ! docker build -t "$tag" "$@" "$context" >/dev/null 2>&1; then
    printf '%-22s FAILED\n' "$label"
    return 1
  fi
  end=$(now)
  awk -v l="$label" -v s="$start" -v e="$end" 'BEGIN { printf "%-22s %6.1fs\n", l, e - s }'
}

echo "== cold builds (no cache) =="
run "python (cold)" "$PY_ROOT" s3uitool-compare/python:latest --no-cache
run "hono (cold)" . s3uitool-compare/hono:latest --no-cache

echo
echo "== warm builds (full cache) =="
run "python (warm)" "$PY_ROOT" s3uitool-compare/python:latest
run "hono (warm)" . s3uitool-compare/hono:latest

echo
echo "== incremental: one line added to a backend source file =="
# Docker's COPY cache key is content-based, so the file must actually change.
cp "$PY_ROOT/api/src/main.py" "$SCRATCH_MAIN_PY"
cp api/src/app.ts "$SCRATCH_APP_TS"
printf '\n# bench marker\n' >> "$PY_ROOT/api/src/main.py"
printf '\n// bench marker\n' >> api/src/app.ts
run "python (src change)" "$PY_ROOT" s3uitool-compare/python:latest
run "hono (src change)" . s3uitool-compare/hono:latest
cp "$SCRATCH_MAIN_PY" "$PY_ROOT/api/src/main.py"
cp "$SCRATCH_APP_TS" api/src/app.ts

echo
echo "== image sizes =="
docker images --format '{{.Repository}}:{{.Tag}}  {{.Size}}' s3uitool-compare/python
docker images --format '{{.Repository}}:{{.Tag}}  {{.Size}}' s3uitool-compare/hono
echo
echo "== image layer breakdown =="
docker history --no-trunc --format '{{.Size}}\t{{.CreatedBy}}' s3uitool-compare/python | grep -v '0B' | head -8
echo "--"
docker history --no-trunc --format '{{.Size}}\t{{.CreatedBy}}' s3uitool-compare/hono | grep -v '0B' | head -8
