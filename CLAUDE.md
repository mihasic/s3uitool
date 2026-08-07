# CLAUDE.md

## Project Overview

S3UITool is a single-container web application for managing S3 and SQS resources. It provides an S3 browser with in-place editing, syntax highlighting, image/PDF/DOCX preview, and an SQS queue manager with send/receive/purge capabilities.

## Architecture

Full-stack monorepo with two layers:

- **Frontend** (`app/`): React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend** (`api/`): TypeScript + Hono on Bun + AWS SDK v3
- **E2E Tests** (`e2e/`): Playwright

The backend was ported from Python/FastAPI in 2026-08; `experiment/REPORT.md` records
the comparison and the porting gotchas (AWS credential precedence, S3 path-style
addressing, upload buffering).

The frontend proxies `/api` requests to the backend during development. In production, both are served from a single Docker container (the Hono app serves the built frontend as static files).

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Radix UI, TanStack Query v5, Monaco Editor |
| Backend | Bun, Hono 4, AWS SDK v3 (`@aws-sdk/client-s3`, `client-sqs`, `lib-storage`), fflate |
| Tooling | Bun (runtime + package manager + workspace + test runner), Biome (lint+format), TypeScript (type checking) |
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
# Lint frontend / backend (Biome)
bun run lint
bun run lint:api

# Auto-fix (Biome)
bun run fix:app
bun run fix:api
bun run fix          # both

# Biome CI check (no writes)
bun run check        # both
bun run check:app
bun run check:api

# Type check (tsc)
bun run typecheck    # both
bun run typecheck:app
bun run typecheck:api
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
│   │   ├── config.ts           # Env + .env settings
│   │   ├── aws.ts              # Cached SDK v3 clients (env credentials, path-style S3)
│   │   ├── errors.ts           # AWS error → HTTP mapping, `{detail: ...}` responses
│   │   ├── cors.ts             # Starlette-equivalent CORS middleware
│   │   ├── serialize.ts        # pydantic-compatible ISO dates, RFC 5987 filenames
│   │   ├── static.ts           # Static file resolution with traversal guard
│   │   ├── zip.ts              # Streaming zip (fflate)
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
│   ├── biome.json              # Biome lint/format config
│   ├── tsconfig.json           # TypeScript config (strict mode)
│   └── vite.config.ts          # Vite config (proxy, React compiler, Tailwind)
│
├── e2e/                        # Playwright E2E tests
│   ├── tests/
│   └── playwright.config.ts
│
├── experiment/                 # FastAPI ↔ Hono comparison harness + REPORT.md
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

- **Formatter**: Biome, same config as the frontend (2-space, 120 width, double quotes)
- **Type checking**: `tsc -b` in strict mode, `noUnusedLocals`/`noUnusedParameters`/`erasableSyntaxOnly`
- **Routes**: one `Hono()` sub-app per service, mounted at `/api/s3` and `/api/sqs`
- **Path params spanning slashes**: `:key{.+}` (Hono decodes `%2F` like Starlette's `:path`)
- **Errors**: throw; `onError` maps AWS SDK exceptions to `{detail: ...}` with 404/502
- **Config**: `src/config.ts` reads env vars and `.env` / `../.env`
- **AWS clients**: always go through `getS3Client()` / `getSqsClient()` — they pin env
  credentials (the JS chain would otherwise prefer `AWS_PROFILE`) and force path-style S3

## Pre-commit Hooks

The pre-commit hook runs:
1. **lint-staged**: Biome auto-fix on JS/TS/CSS/JSON files
2. **TypeScript check**: `tsc -b` in `app/`
3. **TypeScript check**: `tsc -b` in `api/`

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
1. **api-check**: Biome check, `tsc -b`, dependency audit
2. **api-test**: `bun test` against RustFS + ElasticMQ
3. **app-check**: Biome check, unit tests, Vite build, dependency audit
4. **e2e-check**: Docker compose up, wait for health, seed, Playwright tests

## Release Process

Manual dispatch via GitHub Actions "Release" workflow. Builds multi-arch Docker image (amd64 + arm64) and pushes to `ghcr.io/mihasic/s3uitool`.
