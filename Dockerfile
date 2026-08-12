# Shared dependency layer: one install for both builders, so the frontend and the
# backend bundle can be produced in parallel without paying for `bun install` twice.
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY app/package.json ./app/
COPY api/package.json ./api/
COPY e2e/package.json ./e2e/
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN bun install --filter app --filter api --frozen-lockfile

# Stage 1: Frontend Builder
FROM deps AS frontend-builder
COPY app ./app
RUN bun run build

# Stage 2: Backend Builder — bundle the API to a single file so the runtime image
# carries no node_modules at all.
FROM deps AS backend-builder
COPY api ./api
RUN cd api && bun build src/index.ts --target=bun --outfile=/app/server.js

# Stage 3: Final Runtime
FROM oven/bun:1-slim
WORKDIR /app

# Copy frontend static assets
COPY --from=frontend-builder /app/app/dist /app/static

# Copy the bundled backend
COPY --from=backend-builder /app/server.js /app/server.js

# Environment variables
ENV ENABLE_S3=true
ENV ENABLE_SQS=true

# Expose port
EXPOSE 8000

# Run application
CMD ["bun", "run", "/app/server.js"]
