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

### Multiple AWS Profiles

The UI can switch between several AWS targets. The selected profile is part of the URL
(`/<profile>/s3/<bucket>`), so links and bookmarks stay tied to one account. Profiles are
fully isolated: separate SDK clients, separate caches, and no cross-profile copy.

Profiles come from three sources:

1. **The global `AWS_*` variables** — always present, always the default profile. This is
   the behaviour every existing deployment already has; nothing changes if you set nothing
   else. Rename it with `DEFAULT_PROFILE_ID` / `DEFAULT_PROFILE_LABEL`.
2. **Extra bindings declared as `PROFILE_<id>_*` groups**, for example a second bucket store
   or another emulator:

   ```yaml
   environment:
     - PROFILE_staging_LABEL=Staging
     - PROFILE_staging_REGION=eu-west-1
     - PROFILE_staging_ACCESS_KEY_ID=AKIA...
     - PROFILE_staging_SECRET_ACCESS_KEY=...
     # or delegate credentials to a ~/.aws profile instead of static keys:
     - PROFILE_prod_AWS_PROFILE=prod-sso
   ```

   Supported suffixes: `LABEL`, `REGION`, `ENDPOINT_URL`, `S3_ENDPOINT_URL`,
   `SQS_ENDPOINT_URL`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `SESSION_TOKEN`,
   `AWS_PROFILE`, `ENABLE_S3`, `ENABLE_SQS`. Anything omitted falls back to the global value.
3. **Profiles found in `~/.aws/config` and `~/.aws/credentials`**, including SSO,
   `credential_process` and assume-role profiles. This needs the files to be readable by the
   server, so it does nothing in the stock container unless you mount them:

   ```yaml
   volumes:
     - ~/.aws:/root/.aws:ro
   ```

> **Security**: this app has no authentication. Anyone who can reach it can use every profile
> it lists. Do not mount `~/.aws` (or set `ENABLE_PROFILE_DISCOVERY=0`) on a host reachable
> beyond localhost, and prefer `AWS_CONFIG_PROFILES` to expose only the profiles you mean to.

Profile ids are slugified for the URL, and ids that would collide with an API route or a
static asset (`api`, `s3`, `sqs`, `assets`, …) are renamed with a warning at startup.
Pre-profile URLs such as `/s3/documents?prefix=project/` redirect to the default profile,
and the unprefixed `/api/s3/...` endpoints keep working.

### Configuration

| Environment Variable | Default | Description |
|----------------------|---------|-------------|
| `AWS_S3_ENDPOINT_URL` | `http://localhost:9000` | URL of the S3 endpoint (e.g., RustFS). |
| `AWS_SQS_ENDPOINT_URL` | `http://localhost:9324` | URL of the SQS endpoint (e.g., ElasticMQ). |
| `AWS_ENDPOINT_URL` | `None` | Shared endpoint. Used for both services only when service-specific endpoints are not set. |
| `AWS_DEFAULT_REGION` | `us-east-1` | AWS Region. |
| `AWS_ACCESS_KEY_ID` | `test` | AWS Access Key ID. |
| `AWS_SECRET_ACCESS_KEY` | `test` | AWS Secret Access Key. |
| `ENABLE_S3` | `true` | Enable S3 features. Overridable per profile. |
| `ENABLE_SQS` | `true` | Enable SQS features. Overridable per profile. |
| `DEFAULT_PROFILE_ID` | `default` | URL id of the profile built from the global `AWS_*` variables. |
| `DEFAULT_PROFILE_LABEL` | `Default` | Display name of that profile in the switcher. |
| `PROFILE_<id>_*` | `None` | Declares an extra profile. See [Multiple AWS Profiles](#multiple-aws-profiles). |
| `ENABLE_PROFILE_DISCOVERY` | `true` | Read `~/.aws` for additional profiles. Set to `0` to expose only the ones you configured. |
| `AWS_CONFIG_PROFILES` | `None` | Comma-separated allowlist limiting which `~/.aws` profiles are exposed. |
| `MAX_UPLOAD_MB` | `512` | Maximum multipart upload size. Bun buffers the body in memory, so this also bounds per-upload memory. |
| `PORT` | `8000` | Port the server listens on. |
| `STATIC_DIR` | `/app/static` | Directory holding the built frontend. |

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

The default config starts the whole dev stack itself (`bun run dev`) and reuses one that
is already up:

```bash
cd e2e && bunx playwright test
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

