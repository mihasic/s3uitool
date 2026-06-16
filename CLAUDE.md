# CLAUDE.md

## Project Overview

S3UITool is a single-container web application for managing S3 and SQS resources. It provides an S3 browser with in-place editing, syntax highlighting, image/PDF/DOCX preview, and an SQS queue manager with send/receive/purge capabilities.

## Architecture

Full-stack monorepo with two layers:

- **Frontend** (`app/`): React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend** (`api/`): Python 3.14 + FastAPI + boto3
- **E2E Tests** (`e2e/`): Playwright

The frontend proxies `/api` requests to the backend during development. In production, both are served from a single Docker container (FastAPI serves the built frontend as static files).

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Radix UI, TanStack Query v5, Monaco Editor |
| Backend | Python 3.14, FastAPI, boto3, Pydantic, uvicorn |
| Tooling | Bun (package manager + workspace), uv (Python), Biome (JS/TS lint+format), Ruff (Python lint+format), Mypy (type checking) |
| Testing | Pytest (API integration), Playwright (E2E) |
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
# Lint frontend (Biome)
bun run lint

# Lint backend (Ruff)
bun run lint:api

# Auto-fix frontend (Biome)
bun run fix:app

# Auto-fix backend (Ruff)
bun run fix:api

# Auto-fix both
bun run fix

# Type check frontend
bun run check

# Type check backend
bun run mypy
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
├── api/                        # Python FastAPI backend
│   ├── src/
│   │   ├── main.py             # App entry, middleware, route mounting, static serving
│   │   ├── config.py           # Pydantic Settings (env vars)
│   │   ├── s3_routes.py        # S3 API endpoints
│   │   └── sqs_routes.py       # SQS API endpoints
│   ├── tests/
│   │   ├── conftest.py         # Fixtures (test client, boto3 clients, infrastructure)
│   │   └── integration/        # Integration tests against local emulators
│   └── pyproject.toml          # Python deps, ruff + mypy config
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
├── docker-compose.yml          # Local dev stack (RustFS + ElasticMQ + app)
├── Dockerfile                  # Multi-stage build (Bun → uv → runtime)
├── .husky/pre-commit           # Pre-commit: lint-staged + tsc + mypy
└── .lintstagedrc.json          # Biome for JS/TS/CSS, Ruff for Python
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

### Backend (Python)

- **Formatter**: Ruff with 120 line width, targeting Python 3.14
- **Lint rules**: E, F, I, B, UP, FAST (pyflakes, pycodestyle, isort, flake8-bugbear, pyupgrade, FastAPI)
- **Type checking**: Mypy strict mode with `ignore_missing_imports`
- **Models**: Pydantic BaseModel for request/response schemas
- **Config**: Pydantic Settings loading from env vars and `.env` files
- **Routes**: FastAPI APIRouter with `/api` prefix

## Pre-commit Hooks

The pre-commit hook runs:
1. **lint-staged**: Biome auto-fix on JS/TS/CSS files, Ruff auto-fix + format on Python files
2. **TypeScript check**: `tsc -b` in `app/`
3. **Mypy check**: `mypy .` in `api/`

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

Endpoint precedence: service-specific (`AWS_S3_ENDPOINT_URL` / `AWS_SQS_ENDPOINT_URL`) > shared (`AWS_ENDPOINT_URL`).

## Testing Requirements

- **API tests** need RustFS on port 9000 and ElasticMQ on port 9324 (use `docker compose up rustfs elasticmq`)
- **E2E tests** need the full stack running; Playwright is configured for Chromium only
- Test fixtures in `api/tests/conftest.py` create buckets (`test-bucket-1`, `test-bucket-2`) and queues (`test-queue-1`, `test-queue-2`) automatically

## CI Pipeline

GitHub Actions runs on push/PR to `main`:
1. **api-check**: Ruff lint + format check, Mypy, dependency audit
2. **app-check**: Biome check, TypeScript build, dependency audit
3. **e2e-check**: Docker compose up, wait for health, Playwright tests

## Release Process

Manual dispatch via GitHub Actions "Release" workflow. Builds multi-arch Docker image (amd64 + arm64) and pushes to `ghcr.io/mihasic/s3uitool`.
