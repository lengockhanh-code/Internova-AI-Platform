from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any

from dotenv import set_key
from sqlalchemy import text
from sqlalchemy.orm import Session

from src.config import Settings, get_settings
from src.services.redis_cache_service import redis_cache

ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
_write_lock = Lock()

_FIELD_TO_ENV = {
    "appName": "APP_NAME",
    "logLevel": "LOG_LEVEL",
    "sessionTimeoutMinutes": "ACCESS_TOKEN_EXPIRE_MINUTES",
    "copilotTimezone": "COPILOT_TIMEZONE",
    "notificationWorkerEnabled": "COPILOT_NOTIFICATION_WORKER_ENABLED",
    "notificationPollSeconds": "COPILOT_NOTIFICATION_POLL_SECONDS",
    "smartDeadlineDaysBefore": "COPILOT_SMART_DEADLINE_DAYS_BEFORE",
    "chatRateLimitEnabled": "CHAT_RATE_LIMIT_ENABLED",
    "chatRateLimitPerMinute": "CHAT_RATE_LIMIT_PER_MINUTE",
    "llmGuardrailEnabled": "ENABLE_LLM_GUARDRAIL",
    "dynamicConversationEnabled": "ENABLE_DYNAMIC_CONVERSATION",
    "llmRoutingEnabled": "ENABLE_LLM_ROUTING",
    "generalSupportEnabled": "ENABLE_LLM_GENERAL_SUPPORT",
    "chatModel": "OPENAI_CHAT_MODEL",
    "embeddingModel": "OPENAI_EMBEDDING_MODEL",
    "rerankModel": "RERANK_MODEL",
    "llmTemperature": "OPENAI_TEMPERATURE",
    "resultCacheTtlSeconds": "REDIS_RESULT_CACHE_TTL_SECONDS",
    "routeCacheTtlSeconds": "REDIS_ROUTE_CACHE_TTL_SECONDS",
    "retrievalCacheTtlSeconds": "REDIS_RETRIEVAL_CACHE_TTL_SECONDS",
    "redisEnabled": "REDIS_ENABLED",
}


def _configuration_values(settings: Settings) -> dict[str, Any]:
    return {
        "appName": settings.app_name,
        "logLevel": settings.log_level,
        "sessionTimeoutMinutes": settings.access_token_expire_minutes,
        "copilotTimezone": settings.copilot_timezone,
        "notificationWorkerEnabled": settings.copilot_notification_worker_enabled,
        "notificationPollSeconds": settings.copilot_notification_poll_seconds,
        "smartDeadlineDaysBefore": settings.copilot_smart_deadline_days_before,
        "chatRateLimitEnabled": settings.chat_rate_limit_enabled,
        "chatRateLimitPerMinute": settings.chat_rate_limit_per_minute,
        "llmGuardrailEnabled": settings.enable_llm_guardrail,
        "dynamicConversationEnabled": settings.enable_dynamic_conversation,
        "llmRoutingEnabled": settings.enable_llm_routing,
        "generalSupportEnabled": settings.enable_llm_general_support,
        "chatModel": settings.openai_chat_model or settings.model_name,
        "embeddingModel": settings.openai_embedding_model,
        "rerankModel": settings.rerank_model,
        "llmTemperature": settings.openai_temperature,
        "resultCacheTtlSeconds": settings.redis_result_cache_ttl_seconds,
        "routeCacheTtlSeconds": settings.redis_route_cache_ttl_seconds,
        "retrievalCacheTtlSeconds": settings.redis_retrieval_cache_ttl_seconds,
        "redisEnabled": settings.redis_enabled,
    }


def _env_value(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _updated_at() -> datetime | None:
    try:
        return datetime.fromtimestamp(ENV_PATH.stat().st_mtime, tz=UTC)
    except OSError:
        return None


def _service_statuses(db: Session, settings: Settings) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
        database_status = "ONLINE"
    except Exception:
        database_status = "OFFLINE"

    if not settings.redis_enabled:
        redis_status = "DISABLED"
    else:
        redis_status = "ONLINE" if redis_cache.ping() else "OFFLINE"

    vector_path = Path(settings.chroma_persist_dir)
    if not vector_path.is_absolute():
        vector_path = ENV_PATH.parent / vector_path

    return {
        "database": database_status,
        "redis": redis_status,
        "openai": "CONFIGURED" if settings.openai_api_key else "NOT_CONFIGURED",
        "googleAuth": "CONFIGURED" if settings.google_client_id else "NOT_CONFIGURED",
        "vectorStore": "ONLINE" if vector_path.exists() else "NOT_CONFIGURED",
    }


def get_admin_configuration(
    db: Session,
    *,
    restart_required: bool = False,
    message: str | None = None,
    changed_keys: list[str] | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    return {
        "values": _configuration_values(settings),
        "services": _service_statuses(db, settings),
        "meta": {
            "environment": settings.app_env,
            "source": ".env",
            "updatedAt": _updated_at(),
            "restartRequired": restart_required,
            "sensitiveValuesProtected": True,
        },
        "message": message,
        "changedKeys": changed_keys or [],
    }


def update_admin_configuration(db: Session, payload: dict[str, Any]) -> dict[str, Any]:
    current = _configuration_values(get_settings())
    changed = [key for key in _FIELD_TO_ENV if payload[key] != current[key]]
    if not changed:
        return get_admin_configuration(db, message="Cấu hình không có thay đổi.")

    with _write_lock:
        for key in changed:
            set_key(
                str(ENV_PATH),
                _FIELD_TO_ENV[key],
                _env_value(payload[key]),
                quote_mode="auto",
            )
        get_settings.cache_clear()

    return get_admin_configuration(
        db,
        restart_required=True,
        message="Đã lưu cấu hình. Khởi động lại backend để áp dụng đầy đủ.",
        changed_keys=changed,
    )
