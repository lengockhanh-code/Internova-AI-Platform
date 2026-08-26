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

    cors_origins: str = "http://localhost:3000"

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

    model_name: str = "gpt-5.6-terra"

    llm_temperature: float = Field(
        default=0.7,
        ge=0.0,
        le=2.0,
    )

    openai_chat_model: str = "gpt-5.6-terra"

    openai_embedding_model: str = "text-embedding-3-small"

    openai_temperature: float = Field(
        default=0.0,
        ge=0.0,
        le=2.0,
    )

    # Mặc định tắt để giảm latency.
    enable_llm_guardrail: bool = False
    enable_dynamic_conversation: bool = True
    enable_llm_routing: bool = True
    enable_llm_general_support: bool = True
    enable_semantic_preference_detection: bool = True

    # Legacy/in-process cache settings: kept for compatibility with older code.
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
    # REDIS — CACHE / RATE LIMIT / DISTRIBUTED LOCK
    # =========================================================

    redis_enabled: bool = True
    redis_url: str = "redis://localhost:6379/0"
    redis_key_prefix: str = "internova"

    redis_connect_timeout_seconds: float = Field(
        default=0.35,
        gt=0.0,
        le=10.0,
    )

    redis_socket_timeout_seconds: float = Field(
        default=0.75,
        gt=0.0,
        le=30.0,
    )

    redis_failure_cooldown_seconds: float = Field(
        default=10.0,
        ge=1.0,
        le=120.0,
    )

    # 1) Final RAG QueryResult cache.
    redis_result_cache_ttl_seconds: int = Field(
        default=300,
        ge=0,
        le=86400,
    )

    # 2) Semantic router/planner cache.
    redis_route_cache_ttl_seconds: int = Field(
        default=1800,
        ge=0,
        le=86400,
    )

    redis_planner_cache_ttl_seconds: int = Field(
        default=1800,
        ge=0,
        le=86400,
    )

    # 3) Vector/BM25/RRF retrieval-result cache.
    redis_retrieval_cache_ttl_seconds: int = Field(
        default=600,
        ge=0,
        le=86400,
    )

    # 4) User chat rate limit.
    chat_rate_limit_enabled: bool = True

    chat_rate_limit_per_minute: int = Field(
        default=30,
        ge=1,
        le=1000,
    )

    # 5) Single-flight distributed lock for expensive result-cache misses.
    redis_lock_ttl_seconds: int = Field(
        default=120,
        ge=5,
        le=300,
    )

    redis_lock_wait_seconds: float = Field(
        default=15.0,
        ge=0.0,
        le=120.0,
    )

    # =========================================================
    # INTERNSHIP COPILOT
    # =========================================================

    copilot_timezone: str = "Asia/Ho_Chi_Minh"
    copilot_notification_worker_enabled: bool = True
    copilot_notification_poll_seconds: int = Field(
        default=60,
        ge=30,
        le=3600,
    )
    copilot_smart_deadline_days_before: int = Field(
        default=3,
        ge=0,
        le=30,
    )

    # =========================================================
    # RERANKING
    # =========================================================

    rerank_model: str = "gpt-5.5-terra"

    # =========================================================
    # VECTOR STORE
    # =========================================================

    chroma_persist_dir: str = "./data/chroma"


@lru_cache
def get_settings() -> Settings:
    return Settings()