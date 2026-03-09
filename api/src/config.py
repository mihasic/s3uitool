from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    aws_default_region: str | None = None
    aws_endpoint_url: str | None = None
    aws_s3_endpoint_url: str | None = None
    aws_sqs_endpoint_url: str | None = None
    enable_s3: bool = True
    enable_sqs: bool = True

    model_config = SettingsConfigDict(env_file=[".env", "../.env"], extra="ignore")

    @property
    def s3_endpoint_url(self) -> str | None:
        """Prefer S3-specific endpoint, fallback to legacy shared endpoint."""
        return self.aws_s3_endpoint_url or self.aws_endpoint_url

    @property
    def sqs_endpoint_url(self) -> str | None:
        """Prefer SQS-specific endpoint, fallback to legacy shared endpoint."""
        return self.aws_sqs_endpoint_url or self.aws_endpoint_url


settings = Settings()
