from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


    # =========================================================
    # APP
    # =========================================================

    app_name: str = "Internova AI"

    app_env: Literal[
        "development",
        "production",
        "test",
    ] = "development"

    app_port: int = Field(
        default=8000,
        ge=1,
        le=65535,
    )

    app_host: str = "0.0.0.0"

    log_level: Literal[
        "DEBUG",
        "INFO",
        "WARNING",
        "ERROR",
    ] = "INFO"

    cors_origins: str = (
        "http://localhost:3000"
    )


    # =========================================================
    # DATABASE
    # =========================================================

    database_url: str


    # =========================================================
    # AUTH / JWT
    # =========================================================

    jwt_secret_key: str = ""

    jwt_algorithm: str = "HS256"

    access_token_expire_minutes: int = Field(
        default=60,
        ge=1,
    )


    # =========================================================
    # GOOGLE AUTH
    # =========================================================

    google_client_id: str = ""


    # =========================================================
    # OPENAI / LLM
    # =========================================================

    openai_api_key: str = ""

    model_name: str = (
        "gpt-5.6-terra"
    )

    llm_temperature: float = Field(
        default=0.7,
        ge=0.0,
        le=2.0,
    )

    openai_chat_model: str = (
        "gpt-5.6-terra"
    )

    openai_embedding_model: str = (
        "text-embedding-3-small"
    )

    openai_temperature: float = Field(
        default=0.0,
        ge=0.0,
        le=2.0,
    )


    # Mặc định tắt để giảm latency. Bật bằng ENABLE_LLM_GUARDRAIL=true trong .env.
    # Regex injection patterns ở tầng 1 đã đủ bảo vệ thông thường.
    enable_llm_guardrail: bool = False

    enable_dynamic_conversation: bool = True

    enable_llm_routing: bool = True

    enable_llm_general_support: bool = True

    enable_semantic_preference_detection: bool = True

    query_cache_size: int = Field(
        default=128,
        ge=0,
        le=2000,
    )

    query_cache_ttl_seconds: int = Field(
        default=300,
        ge=0,
        le=86400,
    )


    # =========================================================
    # RERANKING
    # =========================================================

    cohere_api_key: str = ""

    rerank_model: str = (
        "gpt-5.6-terra"
    )


    # =========================================================
    # VECTOR STORE
    # =========================================================

    chroma_persist_dir: str = (
        "./data/chroma"
    )


    # =========================================================
    # RATE LIMIT
    # =========================================================

    chat_rate_limit_enabled: bool = True

    chat_rate_limit_per_minute: int = 30


    # =========================================================
    # REDIS / CACHE
    # =========================================================

    redis_enabled: bool = True

    redis_url: str = ""

    redis_key_prefix: str = "internova"

    redis_connect_timeout_seconds: float = 0.35

    redis_socket_timeout_seconds: float = 0.75

    redis_failure_cooldown_seconds: int = 10

    redis_planner_cache_ttl_seconds: int = 1800

    redis_route_cache_ttl_seconds: int = 1800

    redis_retrieval_cache_ttl_seconds: int = 600

    redis_lock_ttl_seconds: int = 120

    redis_lock_wait_seconds: int = 15

    redis_result_cache_ttl_seconds: int = 300


@lru_cache
def get_settings() -> Settings:
    return Settings()
