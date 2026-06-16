from pathlib import Path

from botocore.exceptions import ClientError
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from config import settings
from s3_routes import router as s3_router
from sqs_routes import router as sqs_router

app = FastAPI(title="S3 & SQS UI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Map known AWS error codes to friendly 404 messages; everything else is a 502.
NOT_FOUND_MESSAGES = {
    "NoSuchBucket": "Bucket not found",
    "NoSuchKey": "Object not found",
    "404": "Not found",
    "AWS.SimpleQueueService.NonExistentQueue": "Queue not found",
}
AUTH_ERROR_CODES = {"InvalidAccessKeyId", "SignatureDoesNotMatch"}


@app.exception_handler(ClientError)
async def handle_client_error(request: Request, exc: ClientError) -> JSONResponse:
    code = exc.response.get("Error", {}).get("Code", "Unknown")
    if code in NOT_FOUND_MESSAGES:
        return JSONResponse(status_code=404, content={"detail": NOT_FOUND_MESSAGES[code]})
    if code in AUTH_ERROR_CODES:
        return JSONResponse(
            status_code=502,
            content={"detail": "AWS authentication failed. Check endpoint and credentials."},
        )
    return JSONResponse(status_code=502, content={"detail": f"AWS request failed: {code}"})


if settings.enable_s3:
    app.include_router(s3_router, prefix="/api")

if settings.enable_sqs:
    app.include_router(sqs_router, prefix="/api")


@app.get("/api/config")
def get_config() -> dict[str, bool]:
    return {
        "s3": settings.enable_s3,
        "sqs": settings.enable_sqs,
    }


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


def resolve_static_file(base: Path, full_path: str) -> Path | None:
    """Resolve ``full_path`` under ``base``, or None if it escapes or isn't a file.

    Guards against path traversal (e.g. URL-encoded ``..``) by requiring the
    resolved target to stay within ``base``.
    """
    target = (base / full_path).resolve()
    if target.is_relative_to(base.resolve()) and target.is_file():
        return target
    return None


# Serve the built frontend (Production/Docker). The route is always registered and
# existence is checked per-request, so it's robust to the static dir not being ready
# at import time and to running without a bundled frontend (e.g. dev, where Vite serves it).
static_dir = Path("/app/static")


@app.get("/{full_path:path}")
async def catch_all(full_path: str) -> FileResponse:
    if full_path.startswith(("api/", "docs", "redoc", "openapi.json")):
        raise HTTPException(status_code=404)

    index = static_dir / "index.html"
    if not index.is_file():
        raise HTTPException(status_code=404)

    target = resolve_static_file(static_dir, full_path)
    return FileResponse(target if target else index)
