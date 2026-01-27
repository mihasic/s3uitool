from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_default_region: str | None = None
    aws_endpoint_url: str | None = None
    enable_s3: bool = True
    enable_sqs: bool = True

    model_config = SettingsConfigDict(env_file=[".env", "../.env"], extra="ignore")


settings = Settings()
