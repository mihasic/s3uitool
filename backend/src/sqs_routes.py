
import boto3
from fastapi import APIRouter

from .config import settings

router = APIRouter(prefix="/sqs", tags=["sqs"])

def get_sqs_client():
    return boto3.client(
        "sqs",
        endpoint_url=settings.aws_endpoint_url,
        region_name=settings.aws_default_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )

@router.get("/queues")
def list_queues():
    sqs = get_sqs_client()
    response = sqs.list_queues()
    return response.get("QueueUrls", [])
