# FastAPI → Hono experiment

Harness used to port the backend from Python 3.14 / FastAPI / boto3 to
TypeScript / Hono / Bun / AWS SDK v3, and to compare the two side by side.
Both live at `api/` — the Python one only in git history.

| File | Purpose |
|------|---------|
| `docker-compose.compare.yml` | Runs both backends against one pair of emulators. Host ports are shifted to 18xxx/19xxx — 8000/9000/9324 are used by an SSH tunnel to a real AWS account on the dev machine. |
| `parity.ts` | Fires 55 identical probes at both stacks and diffs status, headers and normalised bodies. |
| `build-bench.sh` | Cold / warm / incremental `docker build` timings and image sizes. |
| `runtime-bench.sh` | Cold start, memory and request latency for both containers. |
| `load.ts` | Minimal closed-loop load generator used by `runtime-bench.sh`. |
| `stats.sh` | Source lines, dependency counts and on-disk footprint. |
| `REPORT.md` | The write-up. |

## Reproducing

The Python backend was removed from `main` once the comparison was done. To
re-run the comparison, check the pre-swap commit out into a worktree:

```bash
git log --oneline -- api/src/main.py     # find the last commit that still had api/
git worktree add ../s3uitool-python <that-commit>
```

Then, from this directory:

```bash
docker compose -f docker-compose.compare.yml up -d rustfs elasticmq
bun run --filter api seed             # with AWS_*_ENDPOINT_URL pointed at 19000/19324
./build-bench.sh
docker compose -f docker-compose.compare.yml up -d app-python app-hono
bun parity.ts http://localhost:18000 http://localhost:18001
./runtime-bench.sh
./stats.sh
```
