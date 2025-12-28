# Quickstart Guide

## Prerequisites

Ensure you have the following tools installed:

- **Docker** & **Docker Compose**: For running the application and infrastructure (Localstack).
- **Bun**: For frontend package management and running the dev server.
- **Python 3.14+** & **uv**: For backend dependency management (optional if using Docker, but recommended for dev).

## Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/mihasic/s3uitool.git
    cd s3uitool
    ```

2.  **Install Frontend Dependencies**:
    ```bash
    cd app
    bun install
    cd ..
    ```

3.  **Install Backend Dependencies** (for local dev):
    ```bash
    cd api
    uv sync
    cd ..
    ```

## Running the Application

### Option 1: Full Stack via Docker (Recommended)

This starts the API, App, and Localstack in containers.

```bash
docker-compose up --build
```

- **App**: [http://localhost:5173](http://localhost:5173) (or port 80 if production build)
- **API**: [http://localhost:8000](http://localhost:8000)
- **Localstack**: [http://localhost:4566](http://localhost:4566)

### Option 2: Hybrid Development

Run infrastructure in Docker, but App and API locally for hot-reloading.

1.  **Start Infrastructure**:
    ```bash
    docker-compose up localstack -d
    ```

2.  **Start API** (in a new terminal):
    ```bash
    cd api
    # Ensure AWS env vars point to localhost:4566 (see .env.example)
    uv run uvicorn src.main:app --reload --port 8000
    ```

3.  **Start App** (in a new terminal):
    ```bash
    cd app
    bun run dev
    ```

## Running Tests

### API Integration Tests

Requires `localstack` to be running.

```bash
cd api
uv run pytest
```

### End-to-End (E2E) Tests

Requires the full stack (API + App + Localstack) to be running.

```bash
# Install Playwright browsers first
npx playwright install

# Run tests
npx playwright test
```

## Release Workflow

To trigger a release (requires write permissions):

1.  Go to the **Actions** tab in GitHub.
2.  Select the **Release and Publish** workflow.
3.  Click **Run workflow**.
4.  Enter the version tag (e.g., `v1.0.0`).
5.  Click **Run workflow**.

## User Guide (Docker Image)

If you want to use the pre-built image in your own environment (e.g., connecting to your own Localstack or real AWS), use the following configuration.

### Docker Compose Example

```yaml
services:
  s3uitool:
    image: ghcr.io/mihasic/s3uitool:latest
    ports:
      - "8080:80"  # UI and API are served on port 80 inside the container
    environment:
      - AWS_ENDPOINT_URL=http://localstack:4566 # Optional: Remove for real AWS
      - AWS_DEFAULT_REGION=us-east-1
      - AWS_ACCESS_KEY_ID=test
      - AWS_SECRET_ACCESS_KEY=test
```

### Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `AWS_ENDPOINT_URL` | URL of the S3/SQS service (e.g., Localstack). Leave empty for real AWS. | `None` |
| `AWS_DEFAULT_REGION` | AWS Region to connect to. | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | AWS Access Key. | `test` |
| `AWS_SECRET_ACCESS_KEY` | AWS Secret Key. | `test` |
