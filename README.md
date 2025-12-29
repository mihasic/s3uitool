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

### Project Structure

- `api/`: Python FastAPI backend
- `app/`: React/Vite frontend
- `e2e/`: Playwright End-to-End tests

### Backend

```bash
cd api
uv sync
uv run fastapi dev src/main.py --port 8000
```

### Frontend

```bash
cd app
bun install
bun run dev
```

### Testing

#### API Integration Tests

Run from the root or `api` directory:

```bash
# From root
PYTHONPATH=api/src uv run --directory api pytest

# From api directory
cd api
PYTHONPATH=src uv run pytest
```

#### End-to-End Tests

Requires backend and frontend to be running (or configured in `playwright.config.ts`).
The default config starts the frontend automatically but expects the backend to be running on port 8000.

1. Start Backend:
   ```bash
   cd api && uv run fastapi dev src/main.py --port 8000
   ```
2. Run Tests (from `e2e` directory):
   ```bash
   cd e2e
   npx playwright test
   ```

## Release

To release a new version:

1. Go to the "Actions" tab in GitHub.
2. Select the "Release" workflow.
3. Click "Run workflow".
4. Enter the version tag (e.g., `v1.0.0`).
5. The workflow will build the Docker image and push it to GHCR.

## License

MIT

