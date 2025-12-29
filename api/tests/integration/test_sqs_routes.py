from fastapi.testclient import TestClient
import time

def test_list_queues(test_client: TestClient):
    response = test_client.get("/sqs/queues")
    assert response.status_code == 200
    queues = response.json()
    assert isinstance(queues, list)
    queue_names = [q["Name"] for q in queues]
    assert "test-queue-1" in queue_names

def test_send_and_receive_message(test_client: TestClient):
    queue_name = "test-queue-1"
    message_body = "Test Message"

    # Send Message
    payload = {"Body": message_body}
    response = test_client.post(f"/sqs/queues/{queue_name}/messages", json=payload)
    assert response.status_code == 200
    assert response.json()["message"] == "Message sent successfully"

    # Receive Message
    # SQS might have slight delay, but Localstack is usually instant
    response = test_client.get(f"/sqs/queues/{queue_name}/messages")
    assert response.status_code == 200
    messages = response.json()
    assert isinstance(messages, list)
    assert len(messages) > 0
    assert any(msg["Body"] == message_body for msg in messages)
