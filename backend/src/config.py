from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    aws_access_key_id: str = "test"
    aws_secret_access_key: str = "test"
    aws_default_region: str = "us-east-1"
    aws_endpoint_url: str = "http://localhost:4566"

    class Config:
        env_file = ".env"


settings = Settings()
