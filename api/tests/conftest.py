import os
from collections.abc import Generator
from typing import Any

import boto3
import pytest
from fastapi.testclient import TestClient

# Default to local S3/SQS emulators, but let the environment (e.g. CI) override.
# This must run before importing the app so its boto3 clients pick up the endpoints.
os.environ.setdefault("AWS_S3_ENDPOINT_URL", "http://localhost:9000")
os.environ.setdefault("AWS_SQS_ENDPOINT_URL", "http://localhost:9324")
os.environ.setdefault("AWS_DEFAULT_REGION", "eu-west-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "test")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "test")

from src.main import app  # noqa: E402


@pytest.fixture(scope="session")
def s3_client() -> Generator[Any]:
    client = boto3.client(
        "s3",
        endpoint_url=os.environ.get("AWS_S3_ENDPOINT_URL") or os.environ.get("AWS_ENDPOINT_URL"),
        region_name=os.environ["AWS_DEFAULT_REGION"],
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )
    yield client


@pytest.fixture(scope="session")
def sqs_client() -> Generator[Any]:
    client = boto3.client(
        "sqs",
        endpoint_url=os.environ.get("AWS_SQS_ENDPOINT_URL") or os.environ.get("AWS_ENDPOINT_URL"),
        region_name=os.environ["AWS_DEFAULT_REGION"],
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )
    yield client


@pytest.fixture(scope="module")
def test_client() -> Generator[TestClient]:
    with TestClient(app) as client:
        yield client


@pytest.fixture(autouse=True)
def setup_infrastructure(s3_client: Any, sqs_client: Any) -> None:
    """Ensure buckets and queues exist before each test module runs."""
    # S3 Setup
    buckets = ["test-bucket-1", "test-bucket-2"]
    for bucket in buckets:
        try:
            if os.environ["AWS_DEFAULT_REGION"] == "us-east-1":
                s3_client.create_bucket(Bucket=bucket)
            else:
                s3_client.create_bucket(
                    Bucket=bucket, CreateBucketConfiguration={"LocationConstraint": os.environ["AWS_DEFAULT_REGION"]}
                )
        except Exception:
            pass  # Bucket might exist

    # SQS Setup
    queues = ["test-queue-1", "test-queue-2"]
    for queue in queues:
        try:
            sqs_client.create_queue(QueueName=queue)
        except Exception:
            pass  # Queue might exist
