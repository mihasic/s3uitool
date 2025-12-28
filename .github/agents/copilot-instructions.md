# s3uitool Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-27

## Active Technologies
- S3, SQS (via Localstack for dev/test) (002-production-readiness)

- Python 3.14 (Backend), TypeScript (Frontend) + FastAPI, Pydantic, Boto3 (Backend); React, Tailwindcss, Shadcn (Frontend) (001-s3-sqs-ui)

## Project Structure

```text
src/
tests/
```

## Commands

- Start Full Stack: `docker-compose up --build`
- Backend Tests: `cd api && uv run pytest`
- Frontend Dev: `cd app && bun run dev`
- E2E Tests: `npx playwright test`
- Lint Backend: `cd api && uv run ruff check .`
- Lint Frontend: `cd app && bun run lint`

## Code Style

Python 3.14 (Backend), TypeScript (Frontend): Follow standard conventions

## Recent Changes
- 002-production-readiness: Added Python 3.14 (Backend), TypeScript (Frontend) + FastAPI, Pydantic, Boto3 (Backend); React, Tailwindcss, Shadcn (Frontend)

- 001-s3-sqs-ui: Added Python 3.14 (Backend), TypeScript (Frontend) + FastAPI, Pydantic, Boto3 (Backend); React, Tailwindcss, Shadcn (Frontend)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
