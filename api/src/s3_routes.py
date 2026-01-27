import mimetypes
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Annotated, Any

import boto3
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import settings

S3_DELETE_BATCH_SIZE = 1000

router = APIRouter(prefix="/s3", tags=["s3"])


def get_s3_client() -> Any:
    return boto3.client(
        "s3",
        endpoint_url=settings.aws_endpoint_url,
        region_name=settings.aws_default_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )


class Bucket(BaseModel):
    Name: str
    CreationDate: datetime


class S3Object(BaseModel):
    Key: str
    LastModified: datetime
    ETag: str
    Size: int
    StorageClass: str | None = None


class CommonPrefix(BaseModel):
    Prefix: str


class ObjectList(BaseModel):
    Objects: list[S3Object]
    CommonPrefixes: list[CommonPrefix]
    Prefix: str


class S3ObjectContent(S3Object):
    ContentType: str | None = None
    Metadata: dict[str, str] | None = None
    Content: str | None = None


class DeletePrefixRequest(BaseModel):
    prefix: str


class BatchPrefixRequest(BaseModel):
    prefixes: list[str]


class CopyRequest(BaseModel):
    source_bucket: str
    source_key: str
    destination_bucket: str
    destination_key: str
    move: bool = False


@router.get("/buckets", response_model=list[Bucket])
def list_buckets() -> list[Bucket]:
    s3 = get_s3_client()
    response = s3.list_buckets()
    return [Bucket(**b) for b in response.get("Buckets", [])]


@router.get("/buckets/{bucket}/objects", response_model=ObjectList)
def list_objects(bucket: str, prefix: str = "") -> dict[str, Any]:
    s3 = get_s3_client()
    return _fetch_objects(s3, bucket, prefix)


@router.post("/buckets/{bucket}/objects/batch", response_model=dict[str, ObjectList])
def list_objects_batch(bucket: str, request: BatchPrefixRequest) -> dict[str, Any]:
    s3 = get_s3_client()
    results = {}

    # Use ThreadPoolExecutor to fetch in parallel
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(_fetch_objects, s3, bucket, p): p for p in request.prefixes}
        for future in futures:
            prefix = futures[future]
            try:
                results[prefix] = future.result()
            except Exception as e:
                # Log error or return empty?
                # For now returning empty result to avoid breaking the whole batch
                print(f"Error fetching prefix {prefix}: {e}")
                results[prefix] = {"Objects": [], "CommonPrefixes": [], "Prefix": prefix}

    return results


def _fetch_objects(s3: Any, bucket: str, prefix: str) -> dict[str, Any]:
    try:
        response = s3.list_objects_v2(Bucket=bucket, Prefix=prefix, Delimiter="/")

        objects = []
        for obj in response.get("Contents", []):
            # Skip the folder itself if it appears in contents
            if obj["Key"] == prefix and prefix != "":
                continue
            objects.append(obj)

        common_prefixes = [{"Prefix": p["Prefix"]} for p in response.get("CommonPrefixes", [])]

        return {"Objects": objects, "CommonPrefixes": common_prefixes, "Prefix": prefix}
    except s3.exceptions.NoSuchBucket as e:
        raise HTTPException(status_code=404, detail="Bucket not found") from e


@router.get("/buckets/{bucket}/objects/{key:path}", response_model=S3ObjectContent)
def get_object(bucket: str, key: str) -> dict[str, Any]:
    s3 = get_s3_client()
    try:
        # Get metadata first
        head = s3.head_object(Bucket=bucket, Key=key)

        # Basic info
        obj_data = {
            "Key": key,
            "LastModified": head["LastModified"],
            "ETag": head["ETag"],
            "Size": head["ContentLength"],
            "StorageClass": head.get("StorageClass"),
            "ContentType": head.get("ContentType"),
            "Metadata": head.get("Metadata"),
        }

        # Try to get content if it's text
        try:
            response = s3.get_object(Bucket=bucket, Key=key)
            content = response["Body"].read().decode("utf-8")
            obj_data["Content"] = content
        except UnicodeDecodeError:
            obj_data["Content"] = None  # Binary content

        return obj_data

    except s3.exceptions.NoSuchKey as e:
        raise HTTPException(status_code=404, detail="Object not found") from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/buckets/{bucket}/download/{key:path}")
def download_object(bucket: str, key: str, inline: bool = False) -> StreamingResponse:
    s3 = get_s3_client()
    try:
        response = s3.get_object(Bucket=bucket, Key=key)

        content_type = response.get("ContentType", "application/octet-stream")
        # If generic or missing, try to guess from filename
        if not content_type or content_type == "application/octet-stream":
            guessed_type, _ = mimetypes.guess_type(key)
            if guessed_type:
                content_type = guessed_type

        disposition = "inline" if inline else "attachment"
        return StreamingResponse(
            response["Body"],
            media_type=content_type,
            headers={"Content-Disposition": f'{disposition}; filename="{key.split("/")[-1]}"'},
        )
    except s3.exceptions.NoSuchKey as e:
        raise HTTPException(status_code=404, detail="Object not found") from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/buckets/{bucket}/objects/{key:path}")
def upload_object(bucket: str, key: str, file: Annotated[UploadFile, File()]) -> dict[str, str]:
    s3 = get_s3_client()
    try:
        extra_args = {}
        if file.content_type:
            extra_args["ContentType"] = file.content_type
        else:
            guessed_type, _ = mimetypes.guess_type(key)
            if guessed_type:
                extra_args["ContentType"] = guessed_type

        s3.upload_fileobj(file.file, bucket, key, ExtraArgs=extra_args)
        return {"message": "File uploaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/buckets/{bucket}/objects/{key:path}")
def delete_object(bucket: str, key: str) -> dict[str, str]:
    s3 = get_s3_client()
    try:
        s3.delete_object(Bucket=bucket, Key=key)
        return {"message": "Object deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/buckets/{bucket}/delete-prefix")
def delete_prefix(bucket: str, request: DeletePrefixRequest) -> dict[str, str]:
    s3 = get_s3_client()
    try:
        # List all objects with prefix
        paginator = s3.get_paginator("list_objects_v2")
        pages = paginator.paginate(Bucket=bucket, Prefix=request.prefix)

        objects_to_delete = []
        for page in pages:
            if "Contents" in page:
                for obj in page["Contents"]:
                    objects_to_delete.append({"Key": obj["Key"]})

        if objects_to_delete:
            # Delete in batches (S3 limit)
            for i in range(0, len(objects_to_delete), S3_DELETE_BATCH_SIZE):
                batch = objects_to_delete[i : i + S3_DELETE_BATCH_SIZE]
                s3.delete_objects(Bucket=bucket, Delete={"Objects": batch})

        return {"message": f"Deleted {len(objects_to_delete)} objects"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/copy")
def copy_object(request: CopyRequest) -> dict[str, str]:
    s3 = get_s3_client()
    try:
        copy_source = {"Bucket": request.source_bucket, "Key": request.source_key}
        s3.copy(copy_source, request.destination_bucket, request.destination_key)

        if request.move:
            s3.delete_object(Bucket=request.source_bucket, Key=request.source_key)
            return {"message": "Object moved successfully"}

        return {"message": "Object copied successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
