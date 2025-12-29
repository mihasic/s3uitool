# Stage 1: Frontend Builder
FROM oven/bun:1 AS frontend-builder
WORKDIR /app
COPY package.json bun.lock ./
COPY app/package.json ./app/
COPY e2e/package.json ./e2e/
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN bun install --filter app --frozen-lockfile
COPY app ./app
RUN bun run build

# Stage 2: Backend Builder
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim AS backend-builder
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
COPY api/pyproject.toml api/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-editable

# Stage 3: Final Runtime
FROM python:3.14-slim-bookworm
WORKDIR /app

# Copy virtual environment from backend builder
COPY --from=backend-builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

# Copy frontend static assets
COPY --from=frontend-builder /app/app/dist /app/static

# Copy backend source code
COPY api/src /app/src

# Environment variables
ENV ENABLE_S3=true
ENV ENABLE_SQS=true

# Expose port
EXPOSE 8000

# Run application
CMD ["fastapi", "run", "src/main.py", "--port", "8000", "--host", "0.0.0.0"]
