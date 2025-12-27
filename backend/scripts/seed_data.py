import boto3
import os

# Add src to path to import config if needed, or just hardcode for the seed script
# Hardcoding ensures it runs standalone easily without path manipulation issues
ENDPOINT_URL = os.getenv("AWS_ENDPOINT_URL", "http://localhost:4566")
REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID", "test")
SECRET_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "test")

def get_client(service):
    return boto3.client(
        service,
        endpoint_url=ENDPOINT_URL,
        region_name=REGION,
        aws_access_key_id=ACCESS_KEY,
        aws_secret_access_key=SECRET_KEY,
    )

def seed_s3():
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
                s3.create_bucket(
                    Bucket=bucket,
                    CreateBucketConfiguration={'LocationConstraint': REGION}
                )
            print(f"Created bucket: {bucket}")
        except Exception as e:
            print(f"Bucket {bucket} might already exist or error: {e}")

    # Upload some dummy files
    files = [
        ("documents", "welcome.txt", "Welcome to the S3 UI Tool!"),
        ("documents", "project/specs.md", "# Project Specifications\n\n1. S3 Browser\n2. SQS Viewer"),
        ("documents", "config.json", '{\n  "app_name": "S3 UI Tool",\n  "version": "1.0.0",\n  "features": ["s3", "sqs"]\n}'),
        ("documents", "users.json", '[\n  {"id": 1, "name": "Alice"},\n  {"id": 2, "name": "Bob"}\n]'),
        ("images", "logo.txt", "[Fake Image Content]"),
        ("logs", "app.log", "INFO: Application started\nINFO: User logged in"),
        ("logs", "2024/01/access.log", "127.0.0.1 - - [01/Jan/2024] GET /index.html"),
        ("logs", "metrics.json", '{\n  "cpu": 45,\n  "memory": 1024,\n  "requests": 500\n}'),
    ]

    for bucket, key, content in files:
        s3.put_object(Bucket=bucket, Key=key, Body=content)
        print(f"Uploaded {key} to {bucket}")

def seed_sqs():
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
                    sqs.send_message(
                        QueueUrl=queue_url,
                        MessageBody=f'{{"order_id": {1000+i}, "status": "pending"}}'
                    )
                print(f"Sent 5 messages to {queue_name}")
                
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
