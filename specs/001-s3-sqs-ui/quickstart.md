# Quickstart: S3 & SQS UI

## Prerequisites
*   Docker
*   Docker Compose

## Running with RustFS and ElasticMQ

1.  Create a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  rustfs:
    image: rustfs/rustfs:latest
    ports:
      - "9000:9000"
    environment:
      - RUSTFS_ACCESS_KEY=test
      - RUSTFS_SECRET_KEY=test

  elasticmq:
    image: softwaremill/elasticmq-native:latest
    ports:
      - "9324:9324"

  s3-sqs-ui:
    image: s3-sqs-ui:latest
    build: .
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
