<!--
Sync Impact Report:
- Version change: New -> 1.0.0
- Added Principles:
  - I. Code Quality & Modern Standards
  - II. YAGNI
  - III. KISS
  - IV. User Experience Consistency
  - V. Performance & Efficiency
- Added Sections:
  - Technology Stack
  - Development Workflow
- Templates requiring updates:
  - .specify/templates/plan-template.md (✅ updated to reflect stack)
  - .specify/templates/spec-template.md (✅ checked)
  - .specify/templates/tasks-template.md (✅ checked)
-->
# S3UITool Constitution

## Core Principles

### I. Code Quality & Modern Standards
**Strict Linting, Formatting, and Type Safety are mandatory.**
*   **Frontend**: Must use **Biome** for linting and formatting. **TypeScript** strict mode is required.
*   **Backend**: Must use **Ruff** for linting and formatting. **Mypy** strict type checking is required.
*   **General**: Code must be clean, readable, and maintainable. No "any" types unless absolutely necessary and documented.

### II. YAGNI (You Aren't Gonna Need It)
**Do not implement features until they are actually needed.**
*   Avoid over-engineering or speculative generality.
*   Implement the simplest solution that satisfies the current requirements.
*   Dead code must be removed immediately.

### III. KISS (Keep It Simple, Stupid)
**Prefer simple solutions over complex ones.**
*   Complexity must be justified by a specific requirement.
*   If a solution is hard to explain, it is likely wrong.
*   Avoid unnecessary abstractions and layers of indirection.

### IV. User Experience Consistency
**Frontend must provide a consistent and predictable user experience.**
*   **UI Components**: Must use **Shadcn** and **Tailwindcss** for all UI elements.
*   **Interactions**: UI interactions should be predictable, responsive, and accessible.
*   **Design**: Follow the established design system and patterns.

### V. Performance & Efficiency
**The application must be performant and resource-efficient.**
*   **Delivery**: The application is delivered as a single optimized **Docker** image.
*   **Frontend**: Assets must be bundled efficiently using **Bun**.
*   **Backend**: Must be performant, utilizing **Python 3.14** and **FastAPI**.
*   **Optimization**: Premature optimization is the root of all evil, but performance regressions are not acceptable.

## Technology Stack

### Frontend
*   **Runtime/Bundler**: Bun
*   **Framework**: React
*   **Language**: TypeScript
*   **Styling**: Tailwindcss
*   **Components**: Shadcn UI
*   **Linting/Formatting**: Biome

### Backend
*   **Runtime**: Python 3.14
*   **Package Manager**: uv
*   **Framework**: FastAPI
*   **Validation**: Pydantic
*   **AWS SDK**: Boto3
*   **Linting/Formatting**: Ruff
*   **Type Checking**: Mypy

### Deployment
*   **Container**: Single Docker image hosting both web server and app.

## Development Workflow

*   **Pre-commit**: All code changes must pass linting (Biome/Ruff) and type checking (TSC/Mypy) before commit.
*   **Testing**: Tests must be written for new features.
*   **Review**: Code reviews must verify compliance with these principles.

## Governance

*   **Supremacy**: This constitution supersedes all other practices and guidelines.
*   **Amendments**: Amendments require documentation, approval, and a migration plan.
*   **Compliance**: All PRs and reviews must verify compliance with these principles.
*   **Versioning**: Semantic versioning (MAJOR.MINOR.PATCH) applies to this constitution.

**Version**: 1.0.0 | **Ratified**: 2025-12-27 | **Last Amended**: 2025-12-27
