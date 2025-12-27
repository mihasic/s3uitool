import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI(title="S3 & SQS UI")

# API Routes will be included here later
# from .s3_routes import router as s3_router
# from .sqs_routes import router as sqs_router
# app.include_router(s3_router, prefix="/api/s3", tags=["s3"])
# app.include_router(sqs_router, prefix="/api/sqs", tags=["sqs"])

# Mount static files
# In development, we might not have static files built, so we check
static_dir = os.path.join(os.path.dirname(__file__), "../static")
if not os.path.exists(static_dir):
    # Fallback for local dev if running from src without build
    # But in docker, it will be at /app/static
    static_dir = "/app/static"

if os.path.exists(static_dir):
    app.mount("/assets", StaticFiles(directory=f"{static_dir}/assets"), name="assets")

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # API routes are handled above (once added).
    # If it's an API route that 404s, it might fall through here if not careful.
    # But FastAPI handles specific routes first.
    # However, we need to be careful not to capture /api calls here if they are not defined yet.
    if full_path.startswith("api/"):
        return {"error": "Not Found"}, 404
    
    # Serve index.html for SPA
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Frontend not built or not found"}
