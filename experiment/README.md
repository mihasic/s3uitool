# Backend port: FastAPI → Hono

Records and tooling from replacing the Python backend with the TypeScript one.

| File | Purpose |
|------|---------|
| `REPORT.md` | Build, image, runtime and dependency comparison. Historical: the numbers describe the port at the moment of the swap. |
| `REPORT-SOURCE.md` | Readability and complexity comparison, from matched AST metrics for both languages. |
| `complexity.py` / `complexity.ts` / `metrics.ts` | The metric collectors behind `REPORT-SOURCE.md`. Same definitions over each language's AST. |
| `load.ts` | Closed-loop load generator (throughput + latency percentiles). |
| `results-*.txt` / `results-*.md` | Raw output the reports quote. |

The Python backend only exists in git history now; the side-by-side runners were
removed with it. To regenerate the TypeScript half of the source metrics:

```bash
cd experiment && bun install
bun complexity.ts ../api/src/*.ts > /tmp/ts.json
bun metrics.ts /tmp/py.json /tmp/ts.json   # /tmp/py.json from a worktree of a pre-swap commit
```
