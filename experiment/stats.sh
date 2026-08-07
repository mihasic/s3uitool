#!/usr/bin/env bash
# Source-size and dependency-footprint comparison for the two backends.
set -uo pipefail
cd "$(dirname "$0")/.."
SCRATCH=${SCRATCH:-$(mktemp -d)}
# The Python backend now lives only in git history; point this at a worktree of the
# pre-swap commit (see README.md) to regenerate the Python column.
PY_ROOT=${PYTHON_WORKTREE:-../s3uitool-python}

count() { # label files...
  local label=$1
  shift
  awk -v label="$label" '
    { total++ }
    /^[[:space:]]*$/ { blank++; next }
    /^[[:space:]]*(#|\/\/|\/\*|\*)/ { comment++; next }
    { code++ }
    END { printf "%-30s %5d total  %5d code  %5d comment  %5d blank\n", label, total, code, comment, blank }
  ' "$@"
}

echo "== source lines =="
count "python  api/src   (pre-swap)" "$PY_ROOT"/api/src/*.py
count "hono    api/src" api/src/*.ts
count "python  api/tests (pre-swap)" "$PY_ROOT"/api/tests/conftest.py "$PY_ROOT"/api/tests/integration/*.py
count "hono    api/tests" api/tests/*.ts
count "python  seed script (pre-swap)" "$PY_ROOT"/api/scripts/seed_data.py
count "hono    seed script" api/scripts/seed-data.ts
count "python  build+cfg  (pre-swap)" "$PY_ROOT"/api/pyproject.toml "$PY_ROOT"/Dockerfile
count "hono    build+project config" api/package.json api/tsconfig.json api/biome.json api/bunfig.toml Dockerfile

echo
echo "== declared direct dependencies =="
uv run --no-project python - "$PY_ROOT" <<'PY'
import json, sys, tomllib
root = sys.argv[1]
py = tomllib.load(open(f"{root}/api/pyproject.toml", "rb"))["project"]["dependencies"]
pydev = tomllib.load(open(f"{root}/api/pyproject.toml", "rb"))["dependency-groups"]["dev"]
ts = json.load(open("api/package.json"))
print(f"python runtime ({len(py)}):")
for d in py: print("   ", d)
print(f"python dev ({len(pydev)}):", ", ".join(pydev))
print(f"hono runtime ({len(ts['dependencies'])}):")
for k, v in ts["dependencies"].items(): print(f"    {k} {v}")
print(f"hono dev ({len(ts['devDependencies'])}):", ", ".join(ts["devDependencies"]))
PY

echo
echo "== transitive runtime dependencies (isolated install of runtime deps only) =="
rm -rf "$SCRATCH/py" "$SCRATCH/ts"
mkdir -p "$SCRATCH/py" "$SCRATCH/ts"

(cd "$PY_ROOT/api" && uv export --no-dev --no-hashes --format requirements.txt 2>/dev/null) > "$SCRATCH/py/requirements.txt"
printf 'python packages: %s\n' "$(grep -cE '^[a-zA-Z0-9]' "$SCRATCH/py/requirements.txt")"

python3 - "$SCRATCH/ts" <<'PY'
import json, pathlib, sys, subprocess
dest = pathlib.Path(sys.argv[1])
pkg = json.load(open("api/package.json"))
(dest / "package.json").write_text(json.dumps({"name": "probe", "dependencies": pkg["dependencies"]}))
subprocess.run(["bun", "install", "--no-save"], cwd=dest, check=False, capture_output=True)
PY
printf 'hono   packages: %s\n' "$(find "$SCRATCH/ts/node_modules" -maxdepth 3 -name package.json -not -path '*/node_modules/*/node_modules/*' 2>/dev/null | wc -l | tr -d ' ')"

echo
echo "== installed runtime footprint on disk =="
(cd "$PY_ROOT/api" && UV_PROJECT_ENVIRONMENT="$SCRATCH/py/.venv" uv sync --frozen --no-dev --quiet 2>/dev/null)
printf 'python .venv (runtime only)  %s\n' "$(du -sh "$SCRATCH/py/.venv" 2>/dev/null | cut -f1)"
printf 'python .venv (with dev)      %s\n' "$(du -sh "$PY_ROOT/api/.venv" 2>/dev/null | cut -f1)"
printf 'hono node_modules (runtime)  %s\n' "$(du -sh "$SCRATCH/ts/node_modules" 2>/dev/null | cut -f1)"

echo
echo "== shipped backend artifact =="
printf 'python src (+ venv in image)  %s\n' "$(du -sh "$PY_ROOT/api/src" | cut -f1)"
bun build api/src/index.ts --target=bun --outfile="$SCRATCH/server.js" >/dev/null 2>&1
printf 'hono single-file bundle       %s\n' "$(du -sh "$SCRATCH/server.js" 2>/dev/null | cut -f1)"
