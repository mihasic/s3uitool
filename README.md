# S3 & SQS UI for RustFS and ElasticMQ

A single-container web application to manage S3 and SQS resources.
S3 browser supports in-place editor with syntax highlighting for known textual formats and image viewer.

![Playwright S3 Screenshots](./assets/pw-bucket.gif)
![Playwright SQS Screenshots](./assets/pw-queues.gif)

## Features

- **S3 Browser**: Browse buckets, view file contents (JSON, XML, YAML, etc.).
- **S3 Management**: Edit, copy, move, and recursively delete files/folders.
- **SQS Management**: View queues, send/receive/purge messages.
- **Single Container**: Frontend and Backend served from one Docker image.

## Usage

Add the following service to your `docker-compose.yml`:

```yaml
services:
  rustfs:
    image: rustfs/rustfs:latest
    environment:
      - RUSTFS_ACCESS_KEY=test
      - RUSTFS_SECRET_KEY=test
    ports:
      - "9000:9000"

  elasticmq:
    image: softwaremill/elasticmq-native:latest
    ports:
      - "9324:9324"

  s3uitool:
    image: ghcr.io/mihasic/s3uitool:latest
    ports:
      - "8000:8000"
    environment:
      - AWS_S3_ENDPOINT_URL=http://rustfs:9000
      - AWS_SQS_ENDPOINT_URL=http://elasticmq:9324
      - AWS_DEFAULT_REGION=us-east-1
      - AWS_ACCESS_KEY_ID=test
      - AWS_SECRET_ACCESS_KEY=test
    depends_on:
      - rustfs
      - elasticmq
```

### Running with Local AWS Credentials

If you want to run the container using your local AWS CLI credentials (including SSO), copy the content of the `scripts/` directory (including `docker-compose.yml`) to your local machine and run:

**Linux / macOS:**
```bash
./start.sh
```

**Windows:**
```powershell
.\start.ps1
```

These scripts automatically export your current AWS session credentials and pass them to the container.

### Configuration

| Environment Variable | Default | Description |
|----------------------|---------|-------------|
| `AWS_S3_ENDPOINT_URL` | `http://localhost:9000` | URL of the S3 endpoint (e.g., RustFS). |
| `AWS_SQS_ENDPOINT_URL` | `http://localhost:9324` | URL of the SQS endpoint (e.g., ElasticMQ). |
| `AWS_ENDPOINT_URL` | `None` | Legacy shared endpoint (backward compatibility). Used for both services only when service-specific endpoints are not set. |
| `AWS_DEFAULT_REGION` | `us-east-1` | AWS Region. |
| `AWS_ACCESS_KEY_ID` | `test` | AWS Access Key ID. |
| `AWS_SECRET_ACCESS_KEY` | `test` | AWS Secret Access Key. |
| `ENABLE_S3` | `true` | Enable S3 features. |
| `ENABLE_SQS` | `true` | Enable SQS features. |
| `MAX_UPLOAD_MB` | `512` | Maximum multipart upload size. Bun buffers the body in memory, so this also bounds per-upload memory. |

Endpoint precedence:
1. `AWS_S3_ENDPOINT_URL` for S3 and `AWS_SQS_ENDPOINT_URL` for SQS
2. `AWS_ENDPOINT_URL` as a shared fallback for both services

## Development

### Prerequisites

- Docker
- Docker Compose
- Bun (for local frontend and backend dev)

### Local Configuration (.env)

Create a `.env` file in the project root to configure local S3/SQS endpoints for development
(the `dev:api` and `seed` scripts load it):

```dotenv
AWS_S3_ENDPOINT_URL=http://localhost:9000
AWS_SQS_ENDPOINT_URL=http://localhost:9324
AWS_DEFAULT_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

### Project Structure

- `api/`: TypeScript Hono backend (runs on Bun)
- `app/`: React/Vite frontend
- `e2e/`: Playwright End-to-End tests

### Backend

```bash
bun install
bun run dev:api            # http://localhost:8000, hot reload
```

### Frontend

```bash
bun install
bun run dev:app            # http://localhost:5173, proxies /api to :8000
```

### Both at once

```bash
bun run dev
bun run dev:local          # same, but pointed at the local RustFS/ElasticMQ emulators
```

### Testing

#### API Integration Tests

Needs the emulators running (`docker compose up -d rustfs elasticmq`):

```bash
bun run test:api
```

#### End-to-End Tests

Requires backend and frontend to be running (or configured in `playwright.config.ts`).
The default config starts the frontend automatically but expects the backend to be running on port 8000.

1. Start Backend:
   ```bash
   bun run dev:api
   ```
2. Run Tests (from `e2e` directory):
   ```bash
   cd e2e
   bunx playwright test
   ```

Alternatively, point Playwright straight at the built container and skip Vite:

```bash
docker compose up -d --build
bun run seed
cd e2e && APP_PORT=8000 bunx playwright test
```

## Release

To release a new version:

1. Go to the "Actions" tab in GitHub.
2. Select the "Release" workflow.
3. Click "Run workflow".
4. Enter the version tag (e.g., `0.1.0`).
5. The workflow will build the Docker image and push it to GHCR.

## License

MIT

