# Research: S3 & SQS UI for LocalStack

**Feature**: `001-s3-sqs-ui`
**Status**: Complete

## 1. Single Container Architecture

**Decision**: Serve React SPA static assets directly via FastAPI.
**Rationale**: Adheres to **KISS** principle. Avoids complexity of Nginx and process managers (supervisord) within a single container.
**Implementation**:
*   **Build**: Multi-stage Dockerfile (Stage 1: Bun build, Stage 2: Python runtime).
*   **Serving**: FastAPI `StaticFiles` mounted to `/assets`.
*   **Routing**: Catch-all route `/{full_path:path}` returning `index.html` to support React Router (SPA).

## 2. S3 Recursive Delete

**Decision**: Use `boto3.resource` high-level abstraction.
**Rationale**: `boto3.resource` automatically handles pagination (`ListObjectsV2`) and batch deletion (`DeleteObjects` in chunks of 1000), reducing boilerplate and error potential.
**Code Pattern**:
```python
s3 = boto3.resource('s3')
bucket = s3.Bucket('my-bucket')
bucket.objects.filter(Prefix='my-folder/').delete()
```

## 3. Code Editor Component

**Decision**: Use `@monaco-editor/react`.
**Rationale**: Industry standard wrapper, compatible with Vite/Bun.
**Integration**:
*   Sync theme with Shadcn (pass `vs-dark` or `light` based on app theme).
*   Lazy load to optimize bundle size.

## 4. SQS Polling Strategy

**Decision**: Periodic Short Polling (Interval).
**Rationale**:
*   **Context**: LocalStack runs locally (zero latency).
*   **Backend**: `receive_message` with `WaitTimeSeconds=1` prevents tight loops but returns quickly, avoiding worker starvation in synchronous FastAPI endpoints (unless `aioboto3` is used, but standard `boto3` is simpler for this scope).
*   **Frontend**: TanStack Query with `refetchInterval: 3000` (3 seconds).

## 5. Docker Optimization & Stack Integration

**Stack**: Backend (`uv` + FastAPI), Frontend (`Bun` + React), Deployment (Single Container).

### Backend (`uv` + FastAPI)
*   **Project Structure**: Standard `uv` layout.
    *   `pyproject.toml`, `uv.lock` at root.
    *   Source code in `app/` or `src/`.
*   **Docker Strategy**:
    *   **Base Image**: Use `ghcr.io/astral-sh/uv:python3.12-bookworm-slim` (or latest stable Python) for the builder stage.
    *   **Dependency Installation**:
        *   Copy `pyproject.toml` and `uv.lock`.
        *   Run `uv sync --locked --no-install-project --no-editable`.
        *   **Caching**: Use `RUN --mount=type=cache,target=/root/.cache/uv` to speed up builds.
        *   **Optimization**: Set `ENV UV_COMPILE_BYTECODE=1` to compile Python bytecode during install.
    *   **Final Runtime**:
        *   Copy the virtual environment: `COPY --from=builder /app/.venv /app/.venv`.
        *   Add to PATH: `ENV PATH="/app/.venv/bin:$PATH"`.
        *   This allows using a smaller base image (e.g., `python:3.12-slim-bookworm`) without `uv` installed in the final stage.

### Frontend (`Bun` + React)
*   **Build Strategy**: Multi-stage Docker build.
    *   **Base**: `oven/bun:1`.
    *   **Install**: Copy `package.json`, `bun.lockb`. Run `bun install --frozen-lockfile`.
    *   **Build**: Copy source code. Run `bun run build`.
*   **Caching**: Docker layer caching works automatically if `package.json`/`bun.lockb` are copied separately before the source code.

### Single Container Integration (Multi-Stage Pattern)
**Goal**: Minimal image size, single entry point.

1.  **Stage 1: Frontend Builder (`bun`)**
    *   Builds React app to `/app/dist`.
2.  **Stage 2: Backend Builder (`uv`)**
    *   Installs Python dependencies to `/app/.venv`.
3.  **Stage 3: Final Runtime (`python:slim`)**
    *   **Base**: `python:3.12-slim-bookworm` (Small, secure).
    *   **Copy**:
        *   `--from=backend-builder /app/.venv /app/.venv`
        *   `--from=frontend-builder /app/dist /app/static` (Serve these via FastAPI).
        *   Backend source code.
    *   **Env**: `PATH="/app/.venv/bin:$PATH"`.
    *   **CMD**: `fastapi run app/main.py --port 80`.

**Python Version Note**: `uv` provides images for specific Python versions (e.g., `uv:python3.13-bookworm-slim`). Use the latest stable (3.12 or 3.13) for production stability. 3.14 is supported in `uv` image tags if/when available.
