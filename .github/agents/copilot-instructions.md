# s3uitool Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-27

## Active Technologies
- S3, SQS (via Localstack for dev/test) (002-production-readiness)

- TypeScript everywhere + Hono on Bun, AWS SDK v3 (api); React, Tailwindcss, Shadcn (Frontend) (001-s3-sqs-ui)

## Project Structure

```text
src/
tests/
```

## Commands

- Start Full Stack: `docker-compose up --build`
- Backend Tests: `bun run test:api`
- Frontend Dev: `cd app && bun run dev`
- E2E Tests: `cd e2e && bunx playwright test`
- Lint Backend: `bun run lint:api`
- Lint Frontend: `cd app && bun run lint`

## Code Style

TypeScript everywhere: Biome formatting, strict tsc

## Recent Changes
- 003-hono-backend: Replaced the Python/FastAPI backend with TypeScript/Hono on Bun (`api/`). See `experiment/REPORT.md`.
- 002-production-readiness: Added Python 3.14 (api), TypeScript (Frontend) + FastAPI, Pydantic, Boto3 (api); React, Tailwindcss, Shadcn (Frontend)
- 001-s3-sqs-ui: Added Python 3.14 (api), TypeScript (Frontend) + FastAPI, Pydantic, Boto3 (api); React, Tailwindcss, Shadcn (Frontend)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
