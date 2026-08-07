#!/usr/bin/env bash
# Cold start, idle/loaded memory and request latency for both containers.
set -uo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.compare.yml"
now() { python3 -c 'import time; print(time.time())'; }

cold_start() { # service host_port
  local service=$1 port=$2 start end
  $COMPOSE rm -sf "$service" >/dev/null 2>&1
  start=$(now)
  $COMPOSE up -d "$service" >/dev/null 2>&1
  until curl -fsS "http://localhost:${port}/api/health" >/dev/null 2>&1; do
    sleep 0.05
  done
  end=$(now)
  awk -v s="$start" -v e="$end" 'BEGIN { printf "%.2f", e - s }'
}

mem() { # container name
  docker stats --no-stream --format '{{.MemUsage}}' "$1" 2>/dev/null | awk '{print $1}'
}

echo "== cold start (docker up → first 200 on /api/health) =="
for i in 1 2 3; do
  printf 'run %d  python=%ss  hono=%ss\n' "$i" "$(cold_start app-python 18000)" "$(cold_start app-hono 18001)"
done

echo
echo "== idle memory (RSS after startup) =="
printf 'python %s\nhono   %s\n' \
  "$(mem s3uitool-compare-app-python-1)" "$(mem s3uitool-compare-app-hono-1)"

echo
echo "== latency: GET /api/health (pure framework overhead) =="
bun load.ts http://localhost:18000/api/health 3000 32
bun load.ts http://localhost:18001/api/health 3000 32

echo
echo "== latency: GET /api/s3/buckets (SDK + emulator round trip) =="
bun load.ts http://localhost:18000/api/s3/buckets 1000 16
bun load.ts http://localhost:18001/api/s3/buckets 1000 16

echo
echo "== latency: GET /api/s3/buckets/documents/objects =="
bun load.ts 'http://localhost:18000/api/s3/buckets/documents/objects?delimiter=' 1000 16
bun load.ts 'http://localhost:18001/api/s3/buckets/documents/objects?delimiter=' 1000 16

echo
echo "== latency: GET / (static index) =="
bun load.ts http://localhost:18000/ 2000 32
bun load.ts http://localhost:18001/ 2000 32

echo
echo "== memory after load =="
printf 'python %s\nhono   %s\n' \
  "$(mem s3uitool-compare-app-python-1)" "$(mem s3uitool-compare-app-hono-1)"
