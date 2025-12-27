---
description: "Task list for S3 & SQS UI implementation"
---

# Tasks: S3 & SQS UI for LocalStack

**Input**: Design documents from `/specs/001-s3-sqs-ui/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/`
- **Frontend**: `frontend/src/`

## Phase 1: Setup (Shared Infrastructure & DX)

**Purpose**: Project initialization, standards, and developer experience

- [ ] T001 Initialize backend with `uv` in `backend/` (configure `ruff` for linting/formatting, `mypy` for types)
- [ ] T002 Initialize frontend with `bun create vite` in `frontend/` (configure `biome` for linting/formatting)
- [ ] T003 Create `Dockerfile` in root with multi-stage build (Bun -> uv -> Python)
- [ ] T004 Create `docker-compose.yml` in root with LocalStack, App service, and environment variables
- [ ] T005 Create `README.md` with developer documentation (setup, running, linting commands)
- [ ] T006 Create `.vscode/launch.json` with configurations for Backend (FastAPI), Frontend (Chrome), and Compound launch
- [ ] T007 Create `.github/workflows/ci.yml` for build verification and linting checks (Ruff/Biome)
- [ ] T008 Implement `backend/src/config.py` for environment variables (AWS credentials, region)
- [ ] T009 Implement `backend/src/main.py` with FastAPI app and StaticFiles mounting
- [ ] T010 [P] Setup Shadcn UI in `frontend/` (init, theme, basic components)
- [ ] T011 [P] Create `frontend/src/lib/api.ts` with Axios/Fetch client base configuration

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core connectivity and shared components

- [ ] T012 Implement `backend/src/s3.py` with Boto3 client initialization
- [ ] T013 Implement `backend/src/sqs.py` with Boto3 client initialization
- [ ] T014 [P] Create `frontend/src/components/Layout.tsx` (Sidebar/Header structure)
- [ ] T015 [P] Setup React Router in `frontend/src/App.tsx` with routes for S3 and SQS

## Phase 3: User Story 1 - S3 Browser & Viewer (Priority: P1)

**Goal**: Browse buckets and view file contents.
**Independent Test**: Can list buckets, navigate folders, and view JSON content.

- [ ] T016 [US1] Implement `GET /api/s3/buckets` in `backend/src/s3.py`
- [ ] T017 [US1] Implement `GET /api/s3/buckets/{bucket}/objects` in `backend/src/s3.py` (with prefix support)
- [ ] T018 [US1] Implement `GET /api/s3/buckets/{bucket}/objects/{key}` in `backend/src/s3.py`
- [ ] T019 [P] [US1] Create `frontend/src/pages/BucketList.tsx` to display buckets
- [ ] T020 [P] [US1] Create `frontend/src/pages/ObjectBrowser.tsx` with folder navigation logic
- [ ] T021 [US1] Integrate `@monaco-editor/react` in `frontend/src/components/FileViewer.tsx`
- [ ] T022 [US1] Implement "View/Edit" modal in `frontend/src/pages/ObjectBrowser.tsx` connecting to FileViewer
- [ ] T023 [US1] Implement file download logic in `frontend/src/pages/ObjectBrowser.tsx`

## Phase 4: User Story 2 - S3 File Management (Priority: P1)

**Goal**: Edit, copy, move, and delete files/folders.
**Independent Test**: Can modify content, move files, and recursively delete folders.

- [ ] T024 [US2] Implement `PUT /api/s3/buckets/{bucket}/objects/{key}` in `backend/src/s3.py`
- [ ] T025 [US2] Implement `DELETE /api/s3/buckets/{bucket}/objects/{key}` in `backend/src/s3.py`
- [ ] T026 [US2] Implement `POST /api/s3/buckets/{bucket}/delete-prefix` in `backend/src/s3.py` (Recursive delete)
- [ ] T027 [US2] Implement `POST /api/s3/copy` in `backend/src/s3.py` (Copy/Move logic)
- [ ] T028 [P] [US2] Add "Save" functionality to `frontend/src/components/FileViewer.tsx`
- [ ] T029 [P] [US2] Implement "Delete" action (single & recursive) in `frontend/src/pages/ObjectBrowser.tsx`
- [ ] T030 [US2] Create `frontend/src/components/CopyMoveModal.tsx` with destination input
- [ ] T031 [US2] Integrate Copy/Move logic in `frontend/src/pages/ObjectBrowser.tsx` with conflict prompt

## Phase 5: User Story 3 - SQS Queue Management (Priority: P2)

**Goal**: View queues and manage messages.
**Independent Test**: Can list queues, view messages, and purge queues.

- [ ] T032 [US3] Implement `GET /api/sqs/queues` in `backend/src/sqs.py`
- [ ] T033 [US3] Implement `GET /api/sqs/queues/{queue_name}/messages` in `backend/src/sqs.py` (Short polling)
- [ ] T034 [US3] Implement `POST /api/sqs/queues/{queue_name}/messages` in `backend/src/sqs.py` (Send)
- [ ] T035 [US3] Implement `DELETE /api/sqs/queues/{queue_name}/messages/{receipt_handle}` in `backend/src/sqs.py`
- [ ] T036 [US3] Implement `POST /api/sqs/queues/{queue_name}/purge` in `backend/src/sqs.py`
- [ ] T037 [P] [US3] Create `frontend/src/pages/QueueList.tsx`
- [ ] T038 [P] [US3] Create `frontend/src/pages/MessageList.tsx` with polling interval
- [ ] T039 [US3] Create `frontend/src/components/SendMessageModal.tsx`
- [ ] T040 [US3] Implement Message Detail view modal in `frontend/src/pages/MessageList.tsx`

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: UX refinements and error handling

- [ ] T041 Implement global error handling (Toasts) in `frontend/src/App.tsx`
- [ ] T042 Implement keyboard navigation (Arrow keys, Enter, Del) in `frontend/src/pages/ObjectBrowser.tsx`
- [ ] T043 Verify Docker build size and startup time

## Dependencies

1.  **Setup** -> **Foundational**
2.  **Foundational** -> **US1**
3.  **US1** -> **US2** (File management builds on browser)
4.  **Foundational** -> **US3** (SQS is independent of S3 stories)

## Implementation Strategy

*   **MVP**: Complete Phase 1, 2, and 3 (Read-only S3 Browser).
*   **Increment 1**: Add Phase 4 (S3 Management).
*   **Increment 2**: Add Phase 5 (SQS Management).
