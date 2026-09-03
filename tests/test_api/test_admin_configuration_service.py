from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from src.api.admin_configuration_routes import require_admin
from src.middleware.admin_audit import describe_admin_action
from src.models.admin_configuration import AdminConfigurationUpdateRequest
from src.services import admin_configuration_service as service


def configuration_payload() -> dict[str, Any]:
    return {
        "appName": "Internova AI",
        "logLevel": "INFO",
        "sessionTimeoutMinutes": 60,
        "copilotTimezone": "Asia/Ho_Chi_Minh",
        "notificationWorkerEnabled": True,
        "notificationPollSeconds": 60,
        "smartDeadlineDaysBefore": 3,
        "chatRateLimitEnabled": True,
        "chatRateLimitPerMinute": 30,
        "llmGuardrailEnabled": False,
        "dynamicConversationEnabled": True,
        "llmRoutingEnabled": True,
        "generalSupportEnabled": True,
        "chatModel": "gpt-5.6-terra",
        "embeddingModel": "text-embedding-3-small",
        "rerankModel": "gpt-5.5-terra",
        "llmTemperature": 0.0,
        "resultCacheTtlSeconds": 300,
        "routeCacheTtlSeconds": 1800,
        "retrievalCacheTtlSeconds": 600,
        "redisEnabled": True,
    }


def test_configuration_model_enforces_safe_ranges() -> None:
    payload = configuration_payload()
    payload["chatRateLimitPerMinute"] = 0

    with pytest.raises(ValidationError):
        AdminConfigurationUpdateRequest(**payload)


def test_configuration_whitelist_excludes_secrets() -> None:
    writable_keys = set(service._FIELD_TO_ENV.values())

    assert "OPENAI_API_KEY" not in writable_keys
    assert "JWT_SECRET_KEY" not in writable_keys
    assert "DATABASE_URL" not in writable_keys
    assert "REDIS_URL" not in writable_keys


def test_admin_guard_rejects_non_admin() -> None:
    with pytest.raises(HTTPException) as exc_info:
        require_admin({"id": 2, "role": "LECTURER"})
    assert exc_info.value.status_code == 403


def test_configuration_write_is_classified_as_high_risk_audit() -> None:
    descriptor = describe_admin_action("PUT", "/api/v1/admin/system/configuration")

    assert descriptor is not None
    assert descriptor.action == "SYSTEM_CONFIGURATION_UPDATED"
    assert descriptor.severity == "HIGH"


def test_configuration_values_never_include_credentials() -> None:
    payload = configuration_payload()
    settings = SimpleNamespace(
        app_name=payload["appName"],
        log_level=payload["logLevel"],
        access_token_expire_minutes=payload["sessionTimeoutMinutes"],
        copilot_timezone=payload["copilotTimezone"],
        copilot_notification_worker_enabled=payload["notificationWorkerEnabled"],
        copilot_notification_poll_seconds=payload["notificationPollSeconds"],
        copilot_smart_deadline_days_before=payload["smartDeadlineDaysBefore"],
        chat_rate_limit_enabled=payload["chatRateLimitEnabled"],
        chat_rate_limit_per_minute=payload["chatRateLimitPerMinute"],
        enable_llm_guardrail=payload["llmGuardrailEnabled"],
        enable_dynamic_conversation=payload["dynamicConversationEnabled"],
        enable_llm_routing=payload["llmRoutingEnabled"],
        enable_llm_general_support=payload["generalSupportEnabled"],
        openai_chat_model=payload["chatModel"],
        model_name=payload["chatModel"],
        openai_embedding_model=payload["embeddingModel"],
        rerank_model=payload["rerankModel"],
        openai_temperature=payload["llmTemperature"],
        redis_result_cache_ttl_seconds=payload["resultCacheTtlSeconds"],
        redis_route_cache_ttl_seconds=payload["routeCacheTtlSeconds"],
        redis_retrieval_cache_ttl_seconds=payload["retrievalCacheTtlSeconds"],
        redis_enabled=payload["redisEnabled"],
        openai_api_key="secret-openai-key",
        jwt_secret_key="secret-jwt-key",
        database_url="postgresql://secret",
        redis_url="redis://secret",
    )

    result = service._configuration_values(settings)  # type: ignore[arg-type]

    assert result == payload
    assert "secret-openai-key" not in str(result)
    assert "secret-jwt-key" not in str(result)
