# Research: Production Readiness

**Feature**: Production Readiness
**Date**: 2025-12-28

## 1. Project Restructuring

### Decision
- Rename `backend` to `api`.
- Rename `frontend` to `app`.

### Rationale
- **Semantic Clarity**: `api` clearly indicates the backend service, and `app` indicates the client application. This is a common convention in modern web development.
- **Standardization**: Aligns with the user's request and general industry practices.

### Alternatives Considered
- **Keep as is**: Rejected because the user explicitly requested the change.
- **`server` / `client`**: Also valid, but `api` / `app` was requested.

## 2. API Integration Testing

### Decision
- Use `pytest` for integration tests.
- Use `localstack` running in Docker for AWS emulation.
- Configure tests to connect to `localstack` via environment variables.

### Rationale
- **Reliability**: Testing against a real (emulated) AWS service is more reliable than mocking boto3 calls.
- **Cost**: Localstack is free for basic services (S3, SQS) and runs locally.
- **Isolation**: Docker ensures a consistent environment.

### Implementation Details
- **Test Setup**: Use a `conftest.py` to initialize S3 buckets and SQS queues in Localstack before tests run.
- **Configuration**: Ensure `AWS_ENDPOINT_URL` points to the Localstack container (or localhost if running tests from host).

## 3. End-to-End (E2E) Testing

### Decision
- Use **Playwright** for E2E testing.
- Create a dedicated `e2e` directory at the project root.
- Use `webServer` in `playwright.config.ts` to start the frontend (`app`).
- Assume backend (`api`) and `localstack` are running via `docker-compose`.

### Rationale
- **Modern Tooling**: Playwright is fast, reliable, and has excellent developer experience.
- **Full Stack Verification**: E2E tests verify the integration of `app`, `api`, and `localstack`.
- **Separation of Concerns**: Keeping `e2e` separate from `app` avoids circular dependencies and keeps the frontend build clean.

### Configuration Snippet
```typescript
// playwright.config.ts
webServer: {
  command: 'cd app && bun run dev',
  url: 'http://localhost:5173',
  reuseExistingServer: !process.env.CI,
}
```

## 4. On-Demand Release Workflow

### Decision
- Use GitHub Actions with `workflow_dispatch` trigger.
- Inputs: `version` (string, required).
- Steps:
    1.  Checkout code.
    2.  Login to GHCR.
    3.  Build and push Docker image.
    4.  Create and push git tag.

### Rationale
- **Control**: Manual trigger allows release managers to decide exactly when to release.
- **Automation**: Automates the tedious and error-prone steps of tagging and pushing images.
- **Integration**: GHCR is built into GitHub, making it a natural choice.

### Permissions
- `contents: write` (for tagging)
- `packages: write` (for pushing image)

## 5. Documentation

### Decision
- Update `README.md` with:
    - "Getting Started" section.
    - Prerequisites (Docker, Bun, Python).
    - Screenshots (placeholders or instructions on how to add them).
    - Usage instructions.

### Rationale
- **Onboarding**: Essential for new developers and users.
- **Clarity**: Screenshots provide immediate visual context.
