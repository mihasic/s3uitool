# Data Model & Project Structure: Production Readiness

**Feature**: Production Readiness
**Date**: 2025-12-28

## Project Structure Changes

The primary "data model" change for this feature is the physical organization of the codebase.

### Directory Renaming

| Old Name | New Name | Description |
| :--- | :--- | :--- |
| `backend/` | `api/` | Contains the FastAPI application, Python dependencies, and backend logic. |
| `frontend/` | `app/` | Contains the React application, Bun/Vite configuration, and frontend logic. |

### New Directories

| Directory | Purpose |
| :--- | :--- |
| `e2e/` | Contains Playwright End-to-End tests and configuration. |
| `api/tests/` | Contains backend integration tests (pytest). |
| `.github/workflows/` | Contains the new `release.yml` workflow file. |

## CI/CD Pipeline Data Model

The release workflow operates on the following data:

### Inputs (Workflow Dispatch)

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `version` | String | Yes | The semantic version tag to apply (e.g., `v1.0.0`). |

### Outputs (Artifacts)

| Artifact | Destination | Naming Convention |
| :--- | :--- | :--- |
| **Git Tag** | GitHub Repository | Matches input `version` (e.g., `v1.0.0`). |
| **Docker Image** | GitHub Container Registry (GHCR) | `ghcr.io/<owner>/<repo>:<version>` and `latest`. |

## Test Data Strategy

### Integration Tests (API)
- **Source**: `localstack` (ephemeral).
- **Initialization**: `conftest.py` will create required S3 buckets (`documents`, `images`, `logs`) and SQS queues (`orders-queue`, etc.) before tests run.
- **Cleanup**: Tests should clean up their own data or rely on container restart for full reset.

### E2E Tests (App)
- **Source**: `localstack` (ephemeral).
- **State**: Tests will assume a clean state or seed data as part of the `beforeAll` hook.
