from functools import cache
from typing import Any

import boto3

from config import settings


@cache
def get_client(service: str) -> Any:
    """Return a cached boto3 client for the given service ("s3" or "sqs").

    boto3 clients are thread-safe and meant to be reused, so we build one lazily
    per service on first use and cache it. Use ``get_client.cache_clear()`` if a
    test ever needs to rebuild against a different endpoint.
    """
    kwargs: dict[str, Any] = {}
    endpoint_url = settings.s3_endpoint_url if service == "s3" else settings.sqs_endpoint_url
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
    if settings.aws_default_region:
        kwargs["region_name"] = settings.aws_default_region

    return boto3.client(service, **kwargs)
