# Data Model: S3 & SQS UI

## S3 Entities

### Bucket
*   **Name**: `str` (ID)
*   **CreationDate**: `datetime`

### S3Object
*   **Key**: `str` (ID)
*   **LastModified**: `datetime`
*   **ETag**: `str`
*   **Size**: `int`
*   **StorageClass**: `str`
*   **Owner**: `Optional[dict]`

### S3ObjectContent (Extends S3Object)
*   **ContentType**: `str`
*   **Content**: `str` (for text) or `bytes` (for binary - handled via stream/download)
*   **Metadata**: `Dict[str, str]`

### FileOperation
*   **SourceBucket**: `str`
*   **SourceKey**: `str`
*   **DestinationBucket**: `str`
*   **DestinationKey**: `str`
*   **Operation**: `Literal["copy", "move"]`
*   **Overwrite**: `bool`

## SQS Entities

### Queue
*   **Url**: `str` (ID)
*   **Name**: `str`
*   **Attributes**: `Dict[str, str]` (ApproximateNumberOfMessages, etc.)

### Message
*   **MessageId**: `str` (ID)
*   **ReceiptHandle**: `str`
*   **Body**: `str`
*   **MD5OfBody**: `str`
*   **Attributes**: `Dict[str, str]`
*   **MessageAttributes**: `Dict[str, dict]`

### SendMessageRequest
*   **Body**: `str`
*   **DelaySeconds**: `int`
