import base64
import mimetypes
import os
from typing import Any

import boto3

# Add src to path to import config if needed, or just hardcode for the seed script
# Hardcoding ensures it runs standalone easily without path manipulation issues
ENDPOINT_URL = os.getenv("AWS_ENDPOINT_URL", "http://localhost:4566")
# Use SEED_REGION or default to us-east-1 to match docker-compose, ignoring system AWS_DEFAULT_REGION
REGION = os.getenv("SEED_REGION", "us-east-1")
ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID", "test")
SECRET_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "test")


def get_client(service: str) -> Any:
    return boto3.client(
        service,
        endpoint_url=ENDPOINT_URL,
        region_name=REGION,
        aws_access_key_id=ACCESS_KEY,
        aws_secret_access_key=SECRET_KEY,
    )


def seed_s3() -> None:
    s3 = get_client("s3")
    buckets = ["documents", "images", "logs"]

    print("--- Seeding S3 ---")
    for bucket in buckets:
        try:
            # LocalStack/S3 often requires LocationConstraint for regions other than us-east-1
            # But for us-east-1 it should be omitted.
            if REGION == "us-east-1":
                s3.create_bucket(Bucket=bucket)
            else:
                s3.create_bucket(Bucket=bucket, CreateBucketConfiguration={"LocationConstraint": REGION})
            print(f"Created bucket: {bucket}")
        except Exception as e:
            print(f"Bucket {bucket} might already exist or error: {e}")

    # Upload some dummy files
    files = [
        ("documents", "welcome.txt", "Welcome to the S3 UI Tool!"),
        ("documents", "project/specs.md", "# Project Specifications\n\n1. S3 Browser\n2. SQS Viewer"),
        (
            "documents",
            "config.json",
            '{\n  "app_name": "S3 UI Tool",\n  "version": "1.0.0",\n  "features": ["s3", "sqs"]\n}',
        ),
        ("documents", "users.json", '[\n  {"id": 1, "name": "Alice"},\n  {"id": 2, "name": "Bob"}\n]'),
        (
            "documents",
            "scripts/deploy.ps1",
            'Write-Host "Deploying application..."\nStart-Sleep -Seconds 2\nWrite-Host "Done!"',
        ),
        ("documents", "web/index.htm", "<html><body><h1>Hello World</h1></body></html>"),
        (
            "documents",
            "styles/main.sass",
            "$font-stack: Helvetica, sans-serif\n$primary-color: #333\n\nbody\n  font: 100% $font-stack\n  color: $primary-color",  # noqa: E501
        ),
        ("documents", "docs/manual.rst", "User Manual\n===========\n\nThis is a reStructuredText document."),
        (
            "documents",
            "ui/window.xaml",
            '<Window x:Class="WpfApp1.MainWindow"\n        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"\n        Title="MainWindow" Height="450" Width="800">\n    <Grid>\n        <Button Content="Click Me" />\n    </Grid>\n</Window>',  # noqa: E501
        ),
        (
            "documents",
            "src/Program.cs",
            'using System;\n\nclass Program\n{\n    static void Main()\n    {\n        Console.WriteLine("Hello C#");\n    }\n}',  # noqa: E501
        ),
        ("images", "logo.txt", "[Fake Image Content]"),
        (
            "images",
            "icon.svg",
            '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">\n  <circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" />\n</svg>',  # noqa: E501
        ),
        # Green 10x10 JPEG
        (
            "images",
            "photo.jpg",
            base64.b64decode(
                "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAKAAoDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDWooor80PyA//Z"
            ),
        ),
        # Red 5x5 PNG
        (
            "images",
            "design.png",
            base64.b64decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="
            ),
        ),
        ("logs", "app.log", "INFO: Application started\nINFO: User logged in"),
        ("logs", "2024/01/access.log", "127.0.0.1 - - [01/Jan/2024] GET /index.html"),
        ("logs", "metrics.json", '{\n  "cpu": 45,\n  "memory": 1024,\n  "requests": 500\n}'),
    ]

    for bucket, key, content in files:
        content_type, _ = mimetypes.guess_type(key)
        if not content_type:
            content_type = "application/octet-stream"

        s3.put_object(Bucket=bucket, Key=key, Body=content, ContentType=content_type)
        print(f"Uploaded {key} to {bucket} as {content_type}")


def seed_sqs() -> None:
    sqs = get_client("sqs")
    queues = ["orders-queue", "notifications-dlq", "email-jobs"]

    print("\n--- Seeding SQS ---")
    for queue_name in queues:
        try:
            response = sqs.create_queue(QueueName=queue_name)
            queue_url = response["QueueUrl"]
            print(f"Created queue: {queue_name}")

            # Send some messages
            if queue_name == "orders-queue":
                for i in range(5):
                    sqs.send_message(QueueUrl=queue_url, MessageBody=f'{{"order_id": {1000 + i}, "status": "pending"}}')
                print(f"Sent 5 messages to {queue_name}")
            elif queue_name == "notifications-dlq":
                for i in range(3):
                    sqs.send_message(
                        QueueUrl=queue_url,
                        MessageBody=f'{{"error": "Failed to send email", "retry_count": {i + 1}, "original_message_id": "msg-{i}"}}',  # noqa: E501
                    )
                print(f"Sent 3 persisted messages to {queue_name}")

        except Exception as e:
            print(f"Error creating/seeding queue {queue_name}: {e}")


if __name__ == "__main__":
    print(f"Seeding data to {ENDPOINT_URL}...")
    try:
        seed_s3()
        seed_sqs()
        print("\nSeeding complete!")
    except Exception as e:
        print(f"\nError during seeding: {e}")
