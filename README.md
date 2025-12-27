# S3 & SQS UI for LocalStack

A single-container web application to manage LocalStack S3 and SQS resources.

## Features

- **S3 Browser**: Browse buckets, view file contents (JSON, XML, YAML, etc.).
- **S3 Management**: Edit, copy, move, and recursively delete files/folders.
- **SQS Management**: View queues, send/receive/purge messages.
- **Single Container**: Frontend and Backend served from one Docker image.

## Prerequisites

- Docker
- Docker Compose
- Bun (for local frontend dev)
- uv (for local backend dev)

## Quick Start

1. Start the application and LocalStack:
   ```bash
   docker-compose up --build
   ```
2. Access the UI at [http://localhost:8000](http://localhost:8000).

## Development

### Backend

```bash
cd backend
uv sync
uv run fastapi dev src/main.py
```

### Frontend

```bash
cd frontend
bun install
bun run dev
```

### Quality Checks

#### Backend (Python)

Run these commands from the `backend` directory:

- **Linting**: `uv run ruff check .`
- **Formatting**: `uv run ruff format .`
- **Type Checking**: `uv run mypy .`
- **Tests**: `uv run pytest`

#### Frontend (TypeScript/React)

Run these commands from the `frontend` directory:

- **Linting & Formatting**: `bunx biome check .`
  - To apply fixes: `bunx biome check --write .`
  - To format only: `bunx biome format --write .`
- **Type Checking**: `bunx tsc --noEmit`

