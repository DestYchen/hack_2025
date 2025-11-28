from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = Field(default="postgresql+asyncpg://postgres:postgres@localhost:5432/app_db")
    upload_dir: str = Field(default="storage/uploads")
    output_dir: str = Field(default="storage/outputs")

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
