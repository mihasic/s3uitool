from datetime import datetime

import boto3
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .config import settings

router = APIRouter(prefix="/s3", tags=["s3"])

def get_s3_client():
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
    Metadata: dict | None = None
    Content: str | None = None

@router.get("/buckets", response_model=list[Bucket])
def list_buckets():
    s3 = get_s3_client()
    response = s3.list_buckets()
    return response.get("Buckets", [])

@router.get("/buckets/{bucket}/objects", response_model=ObjectList)
def list_objects(bucket: str, prefix: str = ""):
    s3 = get_s3_client()
    try:
        response = s3.list_objects_v2(Bucket=bucket, Prefix=prefix, Delimiter="/")
        
        objects = []
        for obj in response.get("Contents", []):
            # Skip the folder itself if it appears in contents
            if obj["Key"] == prefix and prefix != "":
                continue
            objects.append(obj)
            
        common_prefixes = [{"Prefix": p["Prefix"]} for p in response.get("CommonPrefixes", [])]
        
        return {
            "Objects": objects,
            "CommonPrefixes": common_prefixes,
            "Prefix": prefix
        }
    except s3.exceptions.NoSuchBucket as e:
        raise HTTPException(status_code=404, detail="Bucket not found") from e

@router.get("/buckets/{bucket}/objects/{key:path}", response_model=S3ObjectContent)
def get_object(bucket: str, key: str):
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
            obj_data["Content"] = None # Binary content
            
        return obj_data
        
    except s3.exceptions.NoSuchKey as e:
        raise HTTPException(status_code=404, detail="Object not found") from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

@router.get("/buckets/{bucket}/download/{key:path}")
def download_object(bucket: str, key: str):
    s3 = get_s3_client()
    try:
        response = s3.get_object(Bucket=bucket, Key=key)
        return StreamingResponse(
            response["Body"],
            media_type=response.get("ContentType", "application/octet-stream"),
            headers={"Content-Disposition": f'attachment; filename="{key.split("/")[-1]}"'}
        )
    except s3.exceptions.NoSuchKey as e:
        raise HTTPException(status_code=404, detail="Object not found") from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
