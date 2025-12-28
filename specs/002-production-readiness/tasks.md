# Implementation Tasks: Production Readiness

**Feature Branch**: `002-production-readiness`
**Spec**: [specs/002-production-readiness/spec.md](specs/002-production-readiness/spec.md)
**Plan**: [specs/002-production-readiness/plan.md](specs/002-production-readiness/plan.md)

## Phase 1: Setup

*Goal: Initialize the feature branch and prepare for implementation.*

- [ ] T001 Create feature branch `002-production-readiness` (Already done)
- [ ] T002 Verify development environment (Docker, Bun, Python)

## Phase 2: Foundational

*Goal: Establish core infrastructure required for all user stories.*

- [ ] T003 [P] Ensure Localstack is running and accessible via `docker-compose`

## Phase 3: User Story 1 - Project Restructuring (P1)

*Goal: Rename directories to `api` and `app` and update all configuration files.*

**Independent Test**: `docker-compose up --build` starts the application successfully.

- [ ] T004 [US1] Rename `backend` directory to `api`
- [ ] T005 [US1] Rename `frontend` directory to `app`
- [ ] T006 [US1] Update `docker-compose.yml` to reference new paths
- [ ] T007 [US1] Update `Dockerfile` to reference new paths
- [ ] T008 [US1] Update `.vscode/launch.json` to reference new paths
- [ ] T009 [US1] Update `api/pyproject.toml` (if it contains path references)
- [ ] T010 [US1] Update `app/package.json` and `app/vite.config.ts` (if they contain path references)
- [ ] T011 [US1] Update `.github/agents/copilot-instructions.md` with new paths

## Phase 4: User Story 2 - API Integration Testing (P1)

*Goal: Implement integration tests for the API using Localstack.*

**Independent Test**: `cd api && uv run pytest` passes all tests.

- [ ] T012 [US2] Add `pytest` and `pytest-asyncio` to `api/pyproject.toml`
- [ ] T013 [US2] Create `api/tests/conftest.py` with Localstack fixtures (S3/SQS setup)
- [ ] T014 [P] [US2] Create `api/tests/integration/test_s3_routes.py` (Bucket list, object upload)
- [ ] T015 [P] [US2] Create `api/tests/integration/test_sqs_routes.py` (Queue list, send/receive message)
- [ ] T016 [US2] Create `api/Makefile` or script for easy test execution

## Phase 5: User Story 3 - End-to-End Testing (P2)

*Goal: Implement E2E tests using Playwright.*

**Independent Test**: `npx playwright test` passes.

- [ ] T017 [US3] Initialize Playwright project in `e2e/` directory
- [ ] T018 [US3] Configure `e2e/playwright.config.ts` (webServer, baseURL)
- [ ] T019 [P] [US3] Create `e2e/tests/buckets.spec.ts` (List buckets, view objects)
- [ ] T020 [P] [US3] Create `e2e/tests/queues.spec.ts` (List queues, send message)
- [ ] T021 [US3] Add `test:e2e` script to root `package.json` (if exists) or document command

## Phase 6: User Story 4 - On-Demand Release Workflow (P2)

*Goal: Create GitHub Action for manual releases.*

**Independent Test**: Workflow runs successfully in GitHub Actions (simulated or dry-run).

- [ ] T022 [US4] Create `.github/workflows/release.yml` with `workflow_dispatch` trigger
- [ ] T023 [US4] Configure Docker build and push step to GHCR
- [ ] T024 [US4] Configure Git tagging step

## Phase 7: User Story 5 - Improved Documentation (P3)

*Goal: Update README with usage instructions and screenshots.*

**Independent Test**: README is readable and instructions work.

- [ ] T025 [US5] Update `README.md` with "Getting Started" from `quickstart.md`
- [ ] T026 [US5] Add "User Guide" for Docker image usage to `README.md`
- [ ] T027 [US5] Capture and add screenshots to `README.md` (or `docs/images/`)

## Final Phase: Polish

*Goal: Final verification and cleanup.*

- [ ] T028 Run full test suite (API + E2E)
- [ ] T029 Verify all linting passes (`ruff`, `biome`)
- [ ] T030 Clean up any temporary files

## Dependencies

1.  **Restructuring (US1)** must be done first as it changes file paths for all other tasks.
2.  **API Tests (US2)** and **E2E Tests (US3)** can be done in parallel after US1.
3.  **Release Workflow (US4)** and **Documentation (US5)** can be done in parallel after US1.

## Implementation Strategy

1.  **Stop the World**: Perform the renaming (US1) immediately to settle the structure.
2.  **Backend Stability**: Secure the API with tests (US2).
3.  **Frontend Integration**: Verify the full flow with E2E (US3).
4.  **Delivery**: Enable releases (US4) and documentation (US5).
