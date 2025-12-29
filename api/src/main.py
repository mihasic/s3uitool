import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

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


# Serve static files if the directory exists (Production/Docker)
static_dir = "/app/static"
if os.path.isdir(static_dir):
    app.mount("/assets", StaticFiles(directory=f"{static_dir}/assets"), name="assets")

    @app.get("/{full_path:path}")
    async def catch_all(full_path: str) -> FileResponse:
        if full_path.startswith(("api/", "docs", "redoc", "openapi.json")):
            raise HTTPException(status_code=404)

        file_path = os.path.join(static_dir, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(f"{static_dir}/index.html")
