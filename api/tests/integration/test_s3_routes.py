from fastapi.testclient import TestClient

def test_list_buckets(test_client: TestClient):
    response = test_client.get("/s3/buckets")
    assert response.status_code == 200
    buckets = response.json()
    assert isinstance(buckets, list)
    # We expect at least the test buckets created in conftest
    bucket_names = [b["Name"] for b in buckets]
    assert "test-bucket-1" in bucket_names

def test_upload_and_list_objects(test_client: TestClient, s3_client):
    bucket_name = "test-bucket-1"
    file_content = b"Hello World"
    file_name = "hello.txt"

    # Upload via API
    files = {"file": (file_name, file_content, "text/plain")}
    # The API uses PUT /buckets/{bucket}/objects/{key}
    response = test_client.put(f"/s3/buckets/{bucket_name}/objects/{file_name}", files=files)
    assert response.status_code == 200
    assert response.json()["message"] == "File uploaded successfully"

    # Verify via API
    response = test_client.get(f"/s3/buckets/{bucket_name}/objects")
    assert response.status_code == 200
    data = response.json()
    objects = data.get("Objects", [])
    assert any(obj["Key"] == file_name for obj in objects)

    # Verify content via API
    response = test_client.get(f"/s3/buckets/{bucket_name}/objects/{file_name}")
    assert response.status_code == 200
    # The API returns JSON with metadata and content
    assert response.json()["Content"] == file_content.decode("utf-8")
