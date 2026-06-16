from pathlib import Path

from fastapi.testclient import TestClient

from src.main import resolve_static_file


def test_list_buckets(test_client: TestClient) -> None:
    response = test_client.get("/api/s3/buckets")
    assert response.status_code == 200
    buckets = response.json()
    assert isinstance(buckets, list)
    # We expect at least the test buckets created in conftest
    bucket_names = [b["Name"] for b in buckets]
    assert "test-bucket-1" in bucket_names


def test_upload_and_list_objects(test_client: TestClient) -> None:
    bucket_name = "test-bucket-1"
    file_content = b"Hello World"
    file_name = "hello.txt"

    # Upload via API
    files = {"file": (file_name, file_content, "text/plain")}
    # The API uses PUT /buckets/{bucket}/objects/{key}
    response = test_client.put(f"/api/s3/buckets/{bucket_name}/objects/{file_name}", files=files)
    assert response.status_code == 200
    assert response.json()["message"] == "File uploaded successfully"

    # Verify via API
    response = test_client.get(f"/api/s3/buckets/{bucket_name}/objects")
    assert response.status_code == 200
    data = response.json()
    objects = data.get("Objects", [])
    assert any(obj["Key"] == file_name for obj in objects)

    # Verify content via API
    response = test_client.get(f"/api/s3/buckets/{bucket_name}/objects/{file_name}")
    assert response.status_code == 200
    # The API returns JSON with metadata and content
    assert response.json()["Content"] == file_content.decode("utf-8")


def test_get_missing_object_returns_404(test_client: TestClient) -> None:
    # A missing key should map to 404 via the central ClientError handler, not 500.
    response = test_client.get("/api/s3/buckets/test-bucket-1/objects/does-not-exist.txt")
    assert response.status_code == 404


def test_static_file_resolution_blocks_traversal(tmp_path: Path) -> None:
    base = tmp_path / "static"
    base.mkdir()
    (base / "index.html").write_text("ok")
    secret = tmp_path / "secret.txt"
    secret.write_text("top secret")

    # A real file inside the static dir resolves.
    assert resolve_static_file(base, "index.html") == (base / "index.html").resolve()
    # Traversal outside the static dir is rejected.
    assert resolve_static_file(base, "../secret.txt") is None
    assert resolve_static_file(base, "../../etc/passwd") is None
