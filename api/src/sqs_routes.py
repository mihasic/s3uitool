from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from aws import get_client

router = APIRouter(prefix="/sqs", tags=["sqs"])


def get_sqs_client() -> Any:
    return get_client("sqs")


def queue_url(sqs: Any, name: str) -> str:
    return str(sqs.get_queue_url(QueueName=name)["QueueUrl"])


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
    response = sqs.list_queues()
    queue_urls = response.get("QueueUrls", [])

    queues = []
    for url in queue_urls:
        name = url.split("/")[-1]
        # Optionally fetch attributes here if needed, but keeping it simple for list
        queues.append(Queue(Url=url, Name=name))

    return queues


@router.get("/queues/{queue_name}/messages", response_model=list[Message])
def receive_messages(queue_name: str) -> list[Message]:
    sqs = get_sqs_client()
    response = sqs.receive_message(
        QueueUrl=queue_url(sqs, queue_name),
        MaxNumberOfMessages=10,
        WaitTimeSeconds=0,  # Short polling
        VisibilityTimeout=0,  # Make messages visible again immediately (peek mode)
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


@router.post("/queues/{queue_name}/messages")
def send_message(queue_name: str, request: SendMessageRequest) -> dict[str, str]:
    sqs = get_sqs_client()
    sqs.send_message(QueueUrl=queue_url(sqs, queue_name), MessageBody=request.Body, DelaySeconds=request.DelaySeconds)
    return {"message": "Message sent successfully"}


@router.delete("/queues/{queue_name}/messages/{receipt_handle:path}")
def delete_message(queue_name: str, receipt_handle: str) -> dict[str, str]:
    sqs = get_sqs_client()
    sqs.delete_message(QueueUrl=queue_url(sqs, queue_name), ReceiptHandle=receipt_handle)
    return {"message": "Message deleted successfully"}


@router.post("/queues/{queue_name}/purge")
def purge_queue(queue_name: str) -> dict[str, str]:
    sqs = get_sqs_client()
    sqs.purge_queue(QueueUrl=queue_url(sqs, queue_name))
    return {"message": "Queue purged successfully"}
