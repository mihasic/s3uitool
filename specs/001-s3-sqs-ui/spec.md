# Feature Specification: S3 & SQS UI for LocalStack

**Feature Branch**: `001-s3-sqs-ui`
**Created**: 2025-12-27
**Status**: Draft
**Input**: User description: "Build an application that is a frontend for s3 and sqs services..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - S3 Browser & Viewer (Priority: P1)

As a developer using LocalStack, I want to browse S3 buckets and view file contents/metadata so that I can verify my application's data state without using the CLI.

**Why this priority**: This is the fundamental read capability required to understand the state of the local environment.

**Independent Test**: Can connect to a LocalStack instance, list buckets, navigate folder structures, and view the content of a JSON file in a modal.

**Acceptance Scenarios**:

1.  **Given** a LocalStack instance with buckets, **When** I load the app, **Then** I see a list of all S3 buckets.
2.  **Given** I am in a bucket, **When** I click a folder, **Then** the view updates to show objects within that prefix.
3.  **Given** a JSON file in the list, **When** I select "View/Edit" (or press Enter), **Then** a modal opens displaying the syntax-highlighted JSON content.
4.  **Given** a file in the list, **When** I look at the columns, **Then** I see the Last Modified date and ETag.
5.  **Given** a binary file, **When** I select it, **Then** I see an option to download it.

---

### User Story 2 - S3 File Management (Priority: P1)

As a developer, I want to edit, move, copy, and delete S3 objects directly in the UI so that I can quickly manipulate test data.

**Why this priority**: Enables the "write" aspect of the management tool, crucial for setting up or fixing test scenarios.

**Independent Test**: Can modify a file's content, move a file to a new location, and recursively delete a folder.

**Acceptance Scenarios**:

1.  **Given** an open file editor modal, **When** I change the content and click "Save", **Then** the object is updated in S3.
2.  **Given** a selected file, **When** I choose "Copy" or "Move", **Then** I am prompted to edit the destination path (pre-filled with current).
3.  **Given** I try to Move a file to an existing path, **When** I submit, **Then** I am asked for confirmation to overwrite.
4.  **Given** a folder (prefix) with multiple files, **When** I select "Delete", **Then** all objects under that prefix are deleted after confirmation.
5.  **Given** a selected file, **When** I press the Delete key, **Then** a deletion confirmation dialog appears.

---

### User Story 3 - SQS Queue Management (Priority: P2)

As a developer, I want to view SQS queues and messages so that I can debug asynchronous workflows.

**Why this priority**: Secondary to S3 but essential for full LocalStack workflow visibility.

**Independent Test**: Can list queues, view messages in a queue, and perform basic message operations.

**Acceptance Scenarios**:

1.  **Given** a LocalStack instance with queues, **When** I navigate to the SQS tab, **Then** I see a list of queues.
2.  **Given** a selected queue, **When** I view it, **Then** I see a list of available messages.
3.  **Given** a message in the list, **When** I select it, **Then** I can view its body and attributes.
4.  **Given** a message, **When** I choose "Delete", **Then** the message is removed from the queue.
5.  **Given** a queue, **When** I choose "Purge", **Then** all messages are removed.

## Functional Requirements

### General
*   **Connection**: Application must connect to S3 and SQS services (defaulting to standard LocalStack endpoints/region).
*   **Deployment**: Must run as a single Docker container serving the frontend and backend.
*   **Navigation**: Keyboard navigation support for lists (Up/Down arrows) and actions (Enter to view, Del to delete).

### S3 Module
*   **Listing**: Support listing buckets and objects with delimiter-based "folder" simulation.
*   **Metadata**: Display Key, Last Modified, Size, and ETag for objects.
*   **Editor**: Code editor with syntax highlighting for common text formats (JSON, XML, YAML, TXT).
*   **File Ops**:
    *   Download object.
    *   Delete object (single).
    *   Delete prefix (recursive delete of all objects starting with prefix).
    *   Copy object (Source -> Destination).
    *   Move object (Copy + Delete Source).
*   **Conflict Handling**: Prompt user when Copy/Move destination already exists.

### SQS Module
*   **Listing**: List all available queues.
*   **Messages**: Poll/Receive messages from a selected queue.
*   **Message Ops**:
    *   View message body and attributes.
    *   Delete individual message.
    *   Purge entire queue.
    *   Send new message (basic text body).

## Success Criteria

1.  **Performance**: Bucket listing with < 1000 items renders in under 1 second.
2.  **Efficiency**: Docker image size is optimized (target < 500MB uncompressed).
3.  **Usability**: A user can navigate from bucket list to editing a specific file using only the keyboard.
4.  **Reliability**: Recursive delete correctly removes all nested objects in a "folder".
5.  **Compatibility**: Works seamlessly with `localstack/localstack` and `gresau/localstack-persist`.

## Assumptions

*   The application runs in a trusted environment (dev/local); strict IAM role management is not a primary concern for the UI itself (uses provided credentials).
*   LocalStack is accessible via network (e.g., `http://localstack:4566` or configured URL).
*   Large files (> 10MB) do not need to be editable in the browser; download is sufficient.
*   "Recursive delete" is a client-side or backend-orchestrated operation (listing all objects and deleting them), as S3 has no native "delete folder" API.

## Key Entities

### S3
*   **Bucket**: Name, CreationDate.
*   **S3Object**: Key, Size, LastModified, ETag, ContentType, Content.
*   **Prefix**: Virtual folder path.

### SQS
*   **Queue**: Url, Name, Attributes (ApproximateNumberOfMessages, etc.).
*   **Message**: MessageId, ReceiptHandle, Body, MD5OfBody, Attributes.
