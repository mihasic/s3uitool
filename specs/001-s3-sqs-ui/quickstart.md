# Quickstart: S3 & SQS UI

## Prerequisites
*   Docker
*   Docker Compose

## Running with LocalStack

1.  Create a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  localstack:
    image: localstack/localstack
    ports:
      - "4566:4566"
    environment:
      - SERVICES=s3,sqs
      - DOCKER_HOST=unix:///var/run/docker.sock
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock"

  s3-sqs-ui:
    image: s3-sqs-ui:latest
    build: .
    ports:
      - "8000:8000"
    environment:
      - AWS_ENDPOINT_URL=http://localstack:4566
      - AWS_DEFAULT_REGION=us-east-1
      - AWS_ACCESS_KEY_ID=test
      - AWS_SECRET_ACCESS_KEY=test
    depends_on:
      - localstack
```

2.  Build and run:
    ```bash
    docker-compose up --build
    ```

3.  Access the UI at `http://localhost:8000`.

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
