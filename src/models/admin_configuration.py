from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# Public API fields intentionally follow the frontend camelCase contract.
# ruff: noqa: N815

ServiceState = Literal["ONLINE", "OFFLINE", "DISABLED", "CONFIGURED", "NOT_CONFIGURED"]


class AdminConfigurationValues(BaseModel):
    appName: str = Field(min_length=2, max_length=100)
    logLevel: Literal["DEBUG", "INFO", "WARNING", "ERROR"]
    sessionTimeoutMinutes: int = Field(ge=5, le=10080)
    copilotTimezone: str = Field(min_length=3, max_length=100)
    notificationWorkerEnabled: bool
    notificationPollSeconds: int = Field(ge=30, le=3600)
    smartDeadlineDaysBefore: int = Field(ge=0, le=30)
    chatRateLimitEnabled: bool
    chatRateLimitPerMinute: int = Field(ge=1, le=1000)
    llmGuardrailEnabled: bool
    dynamicConversationEnabled: bool
    llmRoutingEnabled: bool
    generalSupportEnabled: bool
    chatModel: str = Field(min_length=2, max_length=150)
    embeddingModel: str = Field(min_length=2, max_length=150)
    rerankModel: str = Field(min_length=2, max_length=150)
    llmTemperature: float = Field(ge=0, le=2)
    resultCacheTtlSeconds: int = Field(ge=0, le=86400)
    routeCacheTtlSeconds: int = Field(ge=0, le=86400)
    retrievalCacheTtlSeconds: int = Field(ge=0, le=86400)
    redisEnabled: bool

    @field_validator(
        "appName",
        "copilotTimezone",
        "chatModel",
        "embeddingModel",
        "rerankModel",
        mode="before",
    )
    @classmethod
    def normalize_text(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        return value.strip()


class AdminConfigurationUpdateRequest(AdminConfigurationValues):
    pass


class AdminConfigurationServiceStatus(BaseModel):
    database: ServiceState
    redis: ServiceState
    openai: ServiceState
    googleAuth: ServiceState
    vectorStore: ServiceState


class AdminConfigurationMeta(BaseModel):
    environment: str
    source: str
    updatedAt: datetime | None = None
    restartRequired: bool = False
    sensitiveValuesProtected: bool = True


class AdminConfigurationResponse(BaseModel):
    values: AdminConfigurationValues
    services: AdminConfigurationServiceStatus
    meta: AdminConfigurationMeta
    message: str | None = None
    changedKeys: list[str] = Field(default_factory=list)
