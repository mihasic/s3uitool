# CLAUDE.md

## Project Overview

S3UITool is a single-container web application for managing S3 and SQS resources. It provides an S3 browser with in-place editing, syntax highlighting, image/PDF/DOCX preview, and an SQS queue manager with send/receive/purge capabilities.

## Architecture

Full-stack monorepo with two layers:

- **Frontend** (`app/`): React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend** (`api/`): TypeScript + Hono on Bun + AWS SDK v3
- **E2E Tests** (`e2e/`): Playwright

The backend was ported from Python/FastAPI in 2026-08 (see git history for the
comparison). The API does not aim for FastAPI wire-compatibility — the frontend in
`app/` is the only client, so the two evolve together.

The frontend proxies `/api` requests to the backend during development. In production, both are served from a single Docker container (the Hono app serves the built frontend as static files).

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Radix UI, TanStack Query v5, Monaco Editor |
| Backend | Bun, Hono 4, AWS SDK v3 (`@aws-sdk/client-s3`, `client-sqs`, `lib-storage`), zod, fflate |
| Tooling | Bun (runtime + package manager + workspace + test runner), Biome (lint+format), TypeScript (type checking). One `biome.json` and one `tsconfig.json` at the root cover every workspace. |
| Testing | `bun test` (API integration), Playwright (E2E) |
| CI | GitHub Actions |

## Common Commands

### Development

```bash
# Start both frontend and backend concurrently
bun run dev

# Start pointed at local emulators (RustFS S3 :9000 + ElasticMQ SQS :9324)
bun run dev:local

# Start only frontend (port 5173)
bun run dev:app

# Start only backend (port 8000)
bun run dev:api

# Seed test data into local S3/SQS
bun run seed
```

### Linting & Formatting

```bash
bun run lint        # Biome lint, whole repo
bun run fix         # Biome lint + format, writes
bun run check       # Biome CI check, no writes
bun run typecheck   # tsc -b across app and api
```

### Testing

```bash
# API integration tests (requires running docker-compose services)
bun run test:api

# E2E tests (requires full stack running)
bun run test:e2e

# E2E tests with UI
bun run test:e2e:ui
```

### Building

```bash
# Build frontend
bun run build

# Docker build
docker compose up -d --build
```

## Project Structure

```
/
├── api/                        # TypeScript Hono backend (Bun runtime)
│   ├── src/
│   │   ├── index.ts            # Bun.serve entry (port, body cap, idle timeout)
│   │   ├── app.ts              # Hono app: CORS, routes, static serving, 404/405
│   │   ├── config.ts           # Env settings
│   │   ├── aws.ts              # Cached SDK v3 clients (env credentials, path-style S3)
│   │   ├── errors.ts           # AWS error → HTTP mapping, `{error: ...}` responses
│   │   ├── model.ts            # zod helpers + respondWith()
│   │   ├── cors.ts             # CORS incl. Chrome private-network preflight
│   │   ├── zip.ts              # Streaming zip (fflate container + native deflate)
│   │   ├── static.ts           # Static file resolution with traversal guard
│   │   ├── s3.ts               # S3 API endpoints
│   │   └── sqs.ts              # SQS API endpoints
│   ├── tests/                  # `bun test` integration tests against local emulators
│   ├── scripts/seed-data.ts    # Seed script
│   └── package.json            # Deps + scripts
│
├── app/                        # React/Vite frontend
│   ├── src/
│   │   ├── pages/              # Route page components (BucketList, ObjectBrowser, QueueList, MessageList)
│   │   ├── components/         # Feature components (modals, toolbar, file preview, tables)
│   │   │   └── ui/             # Primitive UI components (shadcn/ui style)
│   │   ├── hooks/              # Custom hooks (useApi, useObjectBrowser, useDebounce)
│   │   ├── lib/                # Utilities (api client, config, file-utils)
│   │   ├── types/              # TypeScript interfaces (s3.ts, config.ts)
│   │   └── contexts/           # React Context providers (ConfigContext)
│   ├── tsconfig.json           # TypeScript config (strict mode)
│   └── vite.config.ts          # Vite config (proxy, React compiler, Tailwind)
│
├── e2e/                        # Playwright E2E tests
│   ├── tests/
│   └── playwright.config.ts
│
├── biome.json                  # Single Biome config for every workspace
├── tsconfig.json               # Solution file referencing app/ and api/
├── docker-compose.yml          # Local dev stack (RustFS + ElasticMQ + app)
├── Dockerfile                  # Multi-stage build (shared deps → frontend + bundle → bun:1-slim)
├── .husky/pre-commit           # Pre-commit: lint-staged + tsc (app) + tsc (api)
└── .lintstagedrc.json          # Biome for all JS/TS/CSS/JSON
```

## Code Conventions

### Frontend (TypeScript/React)

- **Components**: PascalCase filenames (`ObjectBrowser.tsx`)
- **Hooks**: `use*` prefix, camelCase files (`useObjectBrowser.ts`)
- **Utilities**: kebab-case files (`file-utils.ts`)
- **Imports**: Use `@/` path alias (maps to `app/src/`)
- **Formatter**: Biome with 2-space indent, 120 line width, double quotes
- **State**: TanStack Query for server state, React hooks for UI state, localStorage for preferences
- **Error handling**: Custom `ApiError` class in `lib/api.ts`, toast notifications via `sonner`
- **Strict TypeScript**: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`

### Backend (TypeScript/Hono)

- **Formatter**: Biome, one root config (2-space, 120 width, double quotes)
- **Type checking**: `tsc -b` in strict mode, `noUnusedLocals`/`noUnusedParameters`/`erasableSyntaxOnly`
- **Routes**: one `Hono()` sub-app per service, mounted at `/api/s3` and `/api/sqs`
- **Path params spanning slashes**: `:key{.+}` (Hono decodes `%2F` like Starlette's `:path`)
- **Responses**: build them with `respondWith(someZodSchema, {...})` from `model.ts`, never
  `c.json(sdkResponse)` — zod drops unknown keys, applies defaults and types the input
- **Imports**: no `.ts` extension on relative imports
- **Errors**: throw; `onError` maps AWS SDK exceptions to `{error: "<sentence>"}` with 404/502.
  The frontend's `ApiError` reads that `error` field, so keep it a complete sentence
- **Config**: `src/config.ts` reads env vars only; the dev script passes `--env-file=../.env`
- **AWS clients**: always go through `getS3Client()` / `getSqsClient()` — they pin env
  credentials (the JS chain would otherwise prefer `AWS_PROFILE`) and force path-style S3
- **Zip**: `zip.ts` compresses with Bun's native `CompressionStream` (fflate writes only
  the container) and is driven from `pull`. Both matter: fflate's JS deflate stalled the
  event loop and buffering objects peaked at 2.9 GB RSS for one 200 MiB file. `client-zip`
  was evaluated and rejected — it never compresses

## Pre-commit Hooks

The pre-commit hook runs:
1. **lint-staged**: Biome auto-fix on JS/TS/CSS/JSON files
2. **TypeScript check**: `tsc -b` at the root, covering both workspaces

All checks must pass before a commit is accepted.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AWS_S3_ENDPOINT_URL` | S3-specific endpoint (e.g., RustFS, MinIO, LocalStack) |
| `AWS_SQS_ENDPOINT_URL` | SQS-specific endpoint (e.g., ElasticMQ, LocalStack) |
| `AWS_ENDPOINT_URL` | Shared fallback for both S3 and SQS |
| `AWS_DEFAULT_REGION` | AWS region |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `ENABLE_S3` | Toggle S3 features (default: `true`) |
| `ENABLE_SQS` | Toggle SQS features (default: `true`) |
| `MAX_UPLOAD_MB` | Max multipart upload size, also the per-upload memory bound (default: `512`) |
| `STATIC_DIR` | Directory holding the built frontend (default: `/app/static`) |

Endpoint precedence: service-specific (`AWS_S3_ENDPOINT_URL` / `AWS_SQS_ENDPOINT_URL`) > shared (`AWS_ENDPOINT_URL`).

## Testing Requirements

- **API tests** need RustFS on port 9000 and ElasticMQ on port 9324 (use `docker compose up rustfs elasticmq`)
- **E2E tests** need the full stack running; Playwright is configured for Chromium only
- `api/tests/setup.ts` (a `bun test` preload) sets the endpoint env vars and creates buckets (`test-bucket-1`, `test-bucket-2`) and queues (`test-queue-1`, `test-queue-2`) automatically

## CI Pipeline

GitHub Actions runs on push/PR to `main`:
1. **build**: Biome check, `tsc -b`, unit tests, API tests against RustFS + ElasticMQ, Vite build, dependency audit
2. **e2e**: Docker compose up, wait for health, seed, Playwright tests

## Release Process

Manual dispatch via GitHub Actions "Release" workflow. Builds multi-arch Docker image (amd64 + arm64) and pushes to `ghcr.io/mihasic/s3uitool`.
