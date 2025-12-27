from typing import Any

import boto3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import settings

router = APIRouter(prefix="/sqs", tags=["sqs"])


def get_sqs_client() -> Any:
    return boto3.client(
        "sqs",
        endpoint_url=settings.aws_endpoint_url,
        region_name=settings.aws_default_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )


class Queue(BaseModel):
    Url: str
    Name: str
    Attributes: dict[str, str] | None = None


class Message(BaseModel):
    MessageId: str
    ReceiptHandle: str
    Body: str
    MD5OfBody: str
    Attributes: dict[str, str] | None = None


class SendMessageRequest(BaseModel):
    Body: str
    DelaySeconds: int = 0


@router.get("/queues", response_model=list[Queue])
def list_queues() -> list[Queue]:
    sqs = get_sqs_client()
    try:
        response = sqs.list_queues()
        queue_urls = response.get("QueueUrls", [])

        queues = []
        for url in queue_urls:
            name = url.split("/")[-1]
            # Optionally fetch attributes here if needed, but keeping it simple for list
            queues.append(Queue(Url=url, Name=name))

        return queues
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/queues/{queue_name}/messages", response_model=list[Message])
def receive_messages(queue_name: str) -> list[Message]:
    sqs = get_sqs_client()
    try:
        # First get the queue URL
        queue_url_response = sqs.get_queue_url(QueueName=queue_name)
        queue_url = queue_url_response["QueueUrl"]

        response = sqs.receive_message(
            QueueUrl=queue_url,
            MaxNumberOfMessages=10,
            WaitTimeSeconds=0,  # Short polling
            AttributeNames=["All"],
            MessageAttributeNames=["All"],
        )

        messages = []
        if "Messages" in response:
            for msg in response["Messages"]:
                messages.append(
                    Message(
                        MessageId=msg["MessageId"],
                        ReceiptHandle=msg["ReceiptHandle"],
                        Body=msg["Body"],
                        MD5OfBody=msg["MD5OfBody"],
                        Attributes=msg.get("Attributes"),
                    )
                )

        return messages
    except sqs.exceptions.QueueDoesNotExist as e:
        raise HTTPException(status_code=404, detail="Queue not found") from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/queues/{queue_name}/messages")
def send_message(queue_name: str, request: SendMessageRequest) -> dict[str, str]:
    sqs = get_sqs_client()
    try:
        queue_url_response = sqs.get_queue_url(QueueName=queue_name)
        queue_url = queue_url_response["QueueUrl"]

        sqs.send_message(QueueUrl=queue_url, MessageBody=request.Body, DelaySeconds=request.DelaySeconds)
        return {"message": "Message sent successfully"}
    except sqs.exceptions.QueueDoesNotExist as e:
        raise HTTPException(status_code=404, detail="Queue not found") from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/queues/{queue_name}/messages/{receipt_handle:path}")
def delete_message(queue_name: str, receipt_handle: str) -> dict[str, str]:
    sqs = get_sqs_client()
    try:
        queue_url_response = sqs.get_queue_url(QueueName=queue_name)
        queue_url = queue_url_response["QueueUrl"]

        sqs.delete_message(QueueUrl=queue_url, ReceiptHandle=receipt_handle)
        return {"message": "Message deleted successfully"}
    except sqs.exceptions.QueueDoesNotExist as e:
        raise HTTPException(status_code=404, detail="Queue not found") from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/queues/{queue_name}/purge")
def purge_queue(queue_name: str) -> dict[str, str]:
    sqs = get_sqs_client()
    try:
        queue_url_response = sqs.get_queue_url(QueueName=queue_name)
        queue_url = queue_url_response["QueueUrl"]

        sqs.purge_queue(QueueUrl=queue_url)
        return {"message": "Queue purged successfully"}
    except sqs.exceptions.QueueDoesNotExist as e:
        raise HTTPException(status_code=404, detail="Queue not found") from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
