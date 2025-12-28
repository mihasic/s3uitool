# Implementation Plan: Production Readiness

**Branch**: `002-production-readiness` | **Date**: 2025-12-28 | **Spec**: [specs/002-production-readiness/spec.md](specs/002-production-readiness/spec.md)
**Input**: Feature specification from `specs/002-production-readiness/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

The goal is to make the application production-ready by restructuring the project (renaming `backend` to `api` and `frontend` to `app`), adding comprehensive testing (API integration tests with Localstack, E2E tests), implementing an on-demand release workflow to GHCR, and improving documentation.

## Technical Context

**Language/Version**: Python 3.14 (Backend), TypeScript (Frontend)
**Primary Dependencies**: FastAPI, Pydantic, Boto3 (Backend); React, Tailwindcss, Shadcn (Frontend)
**Storage**: S3, SQS (via Localstack for dev/test)
**Testing**: pytest (Backend), Playwright (E2E)
**Target Platform**: Docker (Linux)
**Project Type**: Web Application (Single Docker Image)
**Performance Goals**: N/A
**Constraints**: Single Docker image delivery
**Scale/Scope**: Small-scale internal tool

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Code Quality & Modern Standards**: Will use Biome/Ruff/Mypy as per existing setup.
- [x] **II. YAGNI**: Only implementing requested tests and restructuring.
- [x] **III. KISS**: Simple folder rename, standard testing tools (pytest, Playwright).
- [x] **IV. User Experience Consistency**: N/A (mostly backend/infra work, but E2E ensures UI works).
- [x] **V. Performance & Efficiency**: Single Docker image constraint respected.

## Project Structure

### Documentation (this feature)

```text
specs/002-production-readiness/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
api/                    # Renamed from backend/
├── src/
│   ├── config.py
│   ├── main.py
│   ├── s3_routes.py
│   └── sqs_routes.py
└── tests/              # New integration tests
    ├── conftest.py
    └── integration/

app/                    # Renamed from frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── lib/
└── tests/              # New E2E tests (or root level e2e folder)

e2e/                    # New E2E test suite (Playwright)
├── tests/
└── playwright.config.ts

.github/
└── workflows/
    └── release.yml     # New release workflow
```

**Structure Decision**: Renaming `backend` -> `api` and `frontend` -> `app` as per requirements. Adding `e2e` folder for Playwright tests to keep them separate from unit tests.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

N/A - No violations.
