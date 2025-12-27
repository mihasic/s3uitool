from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from s3_routes import router as s3_router
from sqs_routes import router as sqs_router

app = FastAPI(title="S3 UI Tool")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(s3_router)
app.include_router(sqs_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
