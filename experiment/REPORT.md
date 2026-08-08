# FastAPI (Python 3.14) → Hono (TypeScript on Bun)

Full port of the backend, measured side by side against the same RustFS + ElasticMQ
emulators, then adopted: the Python `api/` was deleted and the TypeScript port took its place at `api/`.

> **Historical.** The parity numbers below describe the port at the moment of the
> swap. The API has since dropped FastAPI wire-compatibility on purpose — the
> frontend is its only client — so `parity.ts` will now report expected diffs
> (`{error: ...}` instead of `{detail: ...}`, plain ISO timestamps, Hono's own
> CORS defaults, no 405 emulation).

Machine: Apple Silicon, Rancher Desktop 29.6.2, Bun 1.3.14, Python 3.14.
Raw output: `results-*.txt`. Harness: see `README.md` in this directory.

---

## 1. Verdict

**Keep the Hono/Bun backend.**

The port is functionally equivalent (52/55 response probes byte-identical, the
other 3 are deliberate fixes), it halves the image, starts ~3× faster, is 2.5–11×
faster on every request path the UI actually uses, and it collapses the toolchain
from two ecosystems to one. The costs are real but small and bounded: zip
compression is ~1.8× slower, large uploads are memory- rather than disk-bound, and
request/response validation is now hand-written instead of free from Pydantic.

The single biggest non-performance argument: this repo is already a TypeScript
monorepo with a Bun workspace. The Python backend was the only reason to have
`uv`, `ruff`, `mypy`, `pytest` and a second lockfile. That is now gone.

---

## 2. Functional equivalence

`parity.ts` fires 55 identical probes (every endpoint, plus CORS, static serving,
path traversal, pagination, error paths, and a full mutate-and-clean-up sequence)
at both containers and diffs status, `Content-Type`, `Content-Disposition`, CORS
headers and normalised bodies.

```
52/55 probes identical
```

The three remaining differences are all intentional:

| Probe | Python | Hono | Why |
|-------|--------|------|-----|
| `HEAD /api/health` | 405 | 200 | FastAPI's `@app.get` does not register HEAD. Hono answers HEAD for GET routes. Strictly better. |
| `GET /api/sqs/queues/<missing>/messages` | 502 `AWS request failed: QueueDoesNotExist` | 404 `Queue not found` | **Latent bug in the Python version.** Its map only knew the legacy query-protocol code `AWS.SimpleQueueService.NonExistentQueue`; SQS now speaks the JSON protocol, which returns `QueueDoesNotExist`, so the intended 404 never fired. The port maps both. |
| `POST /api/sqs/queues/<missing>/messages` | 502 | 404 | Same cause. |

Everything else matches exactly, including things that are easy to get wrong:

- Pydantic's datetime rendering (`2026-08-08T12:00:00Z`, microseconds padded to 6
  digits, fractional part dropped when zero) — `api/src/serialize.ts:isoUtc`
- RFC 5987 `Content-Disposition` including Python's `?`-per-non-ASCII-codepoint
  ASCII fallback and `urllib.parse.quote`'s escaping of `!'()*`
- FastAPI's `{"detail": ...}` error shape, bare `application/json` (no charset)
- Starlette's `; charset=utf-8` suffix on `text/*` download responses
- Starlette's CORS behaviour: headers only when `Origin` is present, preflight
  answered with `200 OK` + `text/plain` body (Hono's built-in `cors()` returns 204
  unconditionally, so `api/src/cors.ts` reimplements Starlette's exact shape)
- 405 vs 404 for a known path with the wrong method
- `response_model` field projection and ordering
- Path traversal rejection for `../`, `%2e%2e%2f` and absolute paths

**The real UI passes too:** the full Playwright suite (16 tests: browse, filter,
paginate, upload, edit, preview, copy, delete, SQS send/receive/delete/purge) runs
green against the production container.

```
16 passed (2.3s)
```

---

## 3. Numbers

### Build

| | Python | Hono |
|---|---|---|
| cold `docker build --no-cache` | **149.6 s** | **146.2 s** |
| warm (everything cached) | 1.1 s | 0.8 s |
| one line changed in a backend source file | 0.5 s | 0.6 s |
| **image size** | **523 MB** | **278 MB** |

Cold builds are a wash — both are dominated by the Vite/Monaco frontend build.
(A naive Hono Dockerfile that ran `bun install` in two separate builder stages took
274 s; sharing one `deps` layer between the frontend and backend builders brought
it back to parity. That is the version that shipped.)

Image breakdown:

```
python 523 MB = 108 debian + 10 apt + 46 cpython + 235 .venv + 5.7 static
hono   278 MB = 108 debian + 92 bun binary +  1.5 server.js + 5.7 static + ~70 base
```

The backend ships as a **single 1.5 MB bundled `server.js`** — no `node_modules`
in the runtime image at all. Python ships a 235 MB virtualenv (boto3's botocore
data files are most of it).

### Runtime

Cold start, `docker up` → first `200` on `/api/health`, 3 runs:

| | Python | Hono |
|---|---|---|
| cold start | 0.73 / 0.74 / 0.72 s | **0.27 / 0.27 / 0.25 s** |
| idle RSS | 71.8 MiB | **36.5 MiB** |
| RSS after load | 93.0 MiB | 77.9 MiB |

Latency (closed loop, warmed):

| Endpoint | Python rps | Hono rps | Python p50 | Hono p50 |
|---|---|---|---|---|
| `/api/health` (framework only) | 7 920 | **43 198** | 3.77 ms | **0.67 ms** |
| `/api/s3/buckets` | 1 378 | **3 480** | 11.15 ms | **3.86 ms** |
| `/api/s3/buckets/documents/objects` | 747 | **1 020** | 20.76 ms | **14.82 ms** |
| `/` (static index) | 3 275 | **23 126** | 9.40 ms | **1.12 ms** |
| download 256 KiB object | 92 | **1 010** | 87.50 ms | **7.42 ms** |

The download number is the outlier worth calling out: FastAPI's sync route runs
boto3's blocking body read on Starlette's threadpool and re-streams it, which is
brutally slow. The SDK v3 path hands the response stream straight to `Response`.

Where Python wins:

| | Python | Hono |
|---|---|---|
| zip a 50 MiB prefix (200 × 256 KiB) | **0.28 s** | 0.50 s |
| 64 MiB upload, RSS @ 4 concurrent | **263 MiB** | 525 MiB |

`zipfile` uses C zlib; `fflate` was pure JS on the event loop. **Superseded:** the
zip writer now uses Bun's native `CompressionStream("deflate-raw")` with fflate
only writing the container, which is 1.8–2.5× faster than fflate, 8% smaller on
real text, and never stalls the event loop. See `results-zip-writers.txt`.

Starlette spools multipart bodies to disk above 1 MiB; Bun buffers them in memory.
`MAX_UPLOAD_MB` (default 512) now caps this so a huge upload returns 413 instead of
OOM-ing a small container.

### Code and dependencies

| | Python | Hono |
|---|---|---|
| backend source | 461 code lines (5 files) | 649 code lines (10 files) |
| tests | 115 code lines, 5 tests | 375 code lines, 27 tests |
| seed script | 123 | 115 |
| build + project config | 60 | 111 |
| direct runtime deps | 5 | 6 |
| direct dev deps | 5 | 4 |
| transitive runtime packages | 50 | 44 |
| installed runtime deps on disk | 62 MB | **24 MB** |
| shipped backend artifact | 76 KB + 235 MB venv | **1.5 MB, self-contained** |

The +188 backend source lines are honest overhead, and they are concentrated:

- ~90 lines of comments (the port documents every behavioural divergence)
- ~60 lines replacing things FastAPI/Pydantic gave for free: explicit response
  projection (`toS3Object`), `intParam`'s 422, `mapWithConcurrency` (=
  `ThreadPoolExecutor(max_workers=10)`), `cors.ts`, `isoUtc`
- ~40 lines of AWS-SDK ceremony (`new XCommand({...})` vs `s3.list_objects_v2(...)`)

Test count went 5 → 27 because the pytest suite was thin; the new suite covers
pagination, batch, copy/move/copy-prefix, zip round-trip, binary detection,
delete-prefix, 404/422 paths and the serialisation helpers.

---

## 4. Porting gotchas worth remembering

These are the things that would silently break a naive port. All are handled in
`api/src`, with comments at each site.

1. **AWS credential precedence is inverted.** botocore resolves env vars *before*
   the shared profile. `@aws-sdk/credential-provider-node` does the opposite: when
   `AWS_PROFILE` is set it skips the env provider entirely. On a developer machine
   with `AWS_PROFILE=<real account>` exported, the ported backend signed requests
   against **real AWS** instead of the local emulator. `aws.ts:envCredentials()`
   pins env credentials explicitly.
2. **S3 addressing style.** botocore switches to path-style for custom endpoints;
   the JS SDK always uses virtual-host style. Without `forcePathStyle: true`,
   every request goes to `documents.rustfs:9000` and fails DNS.
3. **Empty `AWS_SESSION_TOKEN`.** `dev:local` exports it empty. botocore ignores
   that; the JS SDK would sign with a blank `x-amz-security-token`.
4. **`head_object` error codes differ.** boto3 raises `ClientError` with code
   `"404"`; the JS SDK throws a `NotFound` exception. Both are mapped.
5. **SQS protocol codes.** `QueueDoesNotExist` vs the legacy
   `AWS.SimpleQueueService.NonExistentQueue` — see §2.
6. **`Bun.file(...).type` and `File#type`** normalise `text/*` to include
   `;charset=utf-8`, and Bun's is `;charset` (no space) where Starlette uses
   `; charset`.
7. **`mime-types` ≠ Python `mimetypes`** for two extensions used by the seed data:
   `.sass` (`text/x-sass` vs none) and `.rst` (none vs `text/x-rst`). Only affects
   the fallback guess when an object is stored as `application/octet-stream`.
8. **`CopySource` is not auto-encoded** by the JS SDK; it must be percent-encoded
   per path segment.

---

## 5. What was lost

| Lost | Impact | Mitigation |
|------|--------|------------|
| `/docs`, `/redoc`, `/openapi.json` for free | No auto API docs | `@hono/zod-openapi` if ever wanted; nothing consumes them today |
| Pydantic request/response validation | Request bodies are now `as`-cast, unvalidated | Add `zod`/`valibot` + `@hono/zod-validator` if the API ever takes untrusted input; today it is a same-origin admin UI |
| Automatic 422 with field-level errors | Only `max_keys` is validated, by hand | Same as above |
| C-speed zip | 1.8× slower | Move to a Worker if it matters |
| Disk-spooled uploads | Memory-bound | `MAX_UPLOAD_MB=512` cap |
| Python debugging story (`debugpy`) | — | Bun debugger via the VS Code `bun` launch config |

## 6. What was gained beyond the numbers

- **One toolchain.** `bun install` / `bun run check` / `bun run typecheck` /
  `bun test` cover the whole repo. Deleted: `uv`, `uv.lock`, `pyproject.toml`,
  `ruff`, `mypy`, `pytest`, `pytest-asyncio`, `httpx2`, the `api/Makefile`, and the
  Python half of the pre-commit hook and CI.
- **Real types on the AWS surface.** boto3 is `Any` end-to-end without
  `boto3-stubs`; the JS SDK ships exact input/output types, so `tsc` catches
  wrong parameter names at compile time — the routes were written and type-checked
  before ever hitting an emulator.
- **The frontend and backend can share types.** `app/src/types/s3.ts` currently
  duplicates the response shapes by hand. They can now be exported from `api/src`
  and imported directly (not done yet — deliberate follow-up).
- **Faster inner loop.** `bun test` for the whole API suite: 0.3 s.
- **Contributors need one runtime installed instead of two.**

## 7. Follow-ups

1. Export the response types from `api/src` and consume them in `app/src/types`
   so the client and server shapes cannot drift.
2. Add `zod` validation for the four JSON request bodies (`copy`, `copy-prefix`,
   `delete-prefix`, `batch`, `send message`) — cheap, and restores the one real
   safety property Pydantic provided.
3. ~~Move zip compression off the event loop.~~ Done: native `CompressionStream`.
   `client-zip` was evaluated and rejected — see `results-zip-writers.txt`.
4. Consider `oven/bun:1-distroless` for the runtime stage to shave the Debian base.
