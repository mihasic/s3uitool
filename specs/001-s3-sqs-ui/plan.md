# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a single-container web application to manage LocalStack S3 and SQS resources. The app features a React/Shadcn frontend for browsing buckets, editing files (with syntax highlighting), and managing SQS messages, backed by a FastAPI/Python 3.14 service using Boto3. Key capabilities include recursive folder deletion, file copy/move with conflict handling, and efficient keyboard navigation.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Python 3.14 (Backend), TypeScript (Frontend)
**Primary Dependencies**: FastAPI, Pydantic, Boto3 (Backend); React, Tailwindcss, shadcn/ui (Frontend)
**Storage**: S3 (LocalStack), SQS (LocalStack)
**Testing**: pytest (Backend), Vitest (Frontend)
**Target Platform**: Docker (Linux)
**Project Type**: Web Application (Single Docker Image)
**Performance Goals**: List < 1000 items in < 1s
**Constraints**: Single Docker image < 500MB
**Scale/Scope**: LocalStack environment management

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

*   **I. Code Quality**: Enforced via Biome (Frontend) and Ruff/Mypy (Backend).
*   **II. YAGNI**: Scope limited strictly to S3/SQS management for LocalStack.
*   **III. KISS**: Single container deployment, simple REST API.
*   **IV. UX Consistency**: Shadcn UI components for all interactions.
*   **V. Performance**: Bun for frontend build, Python 3.14 for backend execution.

## Project Structure

### Documentation (this feature)

```text
specs/001-s3-sqs-ui/
├── plan.md              # This file
├── research.md          # Phase 0 output (Complete)
├── data-model.md        # Phase 1 output (Complete)
├── quickstart.md        # Phase 1 output (Complete)
├── contracts/           # Phase 1 output (Complete)
│   └── openapi.yaml
└── tasks.md             # Phase 2 output (Pending)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── main.py          # Entrypoint + StaticFiles mount
│   ├── config.py        # Environment variables
│   ├── s3_router.py            # S3 routes and logic
│   └── sqs_router.py           # SQS routes and logic
├── tests/               # Unified tests (unit/integration)
├── pyproject.toml
└── Dockerfile           # Multi-stage build

frontend/
├── src/
│   ├── components/      # Shadcn UI + Feature components
│   ├── lib/             # Utils + API client
│   ├── App.tsx          # Main layout
│   └── main.tsx         # Entrypoint
├── index.html
├── package.json
├── vite.config.ts
└── bun.lockb
```

**Structure Decision**: Simplified "Backend + Frontend" structure. Backend avoids layered architecture (services/models) in favor of direct route logic (KISS). Frontend uses minimal boilerplate.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
