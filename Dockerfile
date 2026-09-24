# Shared dependency layer: one install for both builders, so the frontend and the
# backend bundle can be produced in parallel without paying for `bun install` twice.
#
# Every builder stage is pinned to $BUILDPLATFORM: building per target architecture only
# bought a second, concurrent Vite build — and two of those deadlock each other, since
# Monaco's workers make each one spawn nested rolldown builds.
FROM --platform=$BUILDPLATFORM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY app/package.json ./app/
COPY api/package.json ./api/
COPY e2e/package.json ./e2e/
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN bun install --filter app --filter api --frozen-lockfile

# Stage 1: Frontend Builder
FROM --platform=$BUILDPLATFORM deps AS frontend-builder
COPY app ./app
RUN bun run build

# Stage 2: Backend Builder — compile the API, its dependencies and the Bun runtime into
# one executable with precompiled bytecode, so the runtime image needs neither
# node_modules nor a Bun install, and cold starts skip JS parsing. Bun cross-compiles
# from the build platform: the target runtime is fetched per $TARGETARCH.
FROM --platform=$BUILDPLATFORM deps AS backend-builder
ARG TARGETARCH
COPY api ./api
RUN cd api && bun run build \
      --target=bun-linux-$([ "$TARGETARCH" = amd64 ] && echo x64-baseline || echo "$TARGETARCH") \
      --outfile=/app/server

# Stage 3: Final Runtime — glibc + libstdc++ only, no shell. Runs as root so the
# optional ~/.aws:/root/.aws mount in docker-compose.yml keeps resolving.
FROM gcr.io/distroless/cc-debian12
WORKDIR /app

COPY --from=frontend-builder /app/app/dist /app/static
COPY --from=backend-builder /app/server /app/server

ENV NODE_ENV=production
ENV ENABLE_S3=true
ENV ENABLE_SQS=true
EXPOSE 8000

CMD ["/app/server"]
