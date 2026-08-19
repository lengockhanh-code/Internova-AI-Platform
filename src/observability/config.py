from __future__ import annotations

import os
import re

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    # Environment variables supplied by Docker/systemd still work without it.
    pass
from dataclasses import dataclass


def _bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _environment(value: str) -> str:
    """Normalize environment to a conservative Langfuse-compatible label."""
    normalized = re.sub(r"[^a-z0-9_-]+", "-", (value or "development").strip().lower())
    normalized = normalized.strip("-_")
    return normalized[:40] or "development"


def _float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default


@dataclass(frozen=True)
class ObservabilitySettings:
    enabled: bool
    public_key: str
    secret_key: str
    base_url: str
    capture_content: bool
    environment: str
    release: str
    sample_rate: float
    max_observations: int
    alert_p95_warning_ms: float
    alert_p95_critical_ms: float
    alert_error_warning_pct: float
    alert_error_critical_pct: float
    alert_retrieval_warning_pct: float
    alert_answer_warning_pct: float
    alert_groundedness_warning_pct: float
    daily_cost_budget_usd: float

    @property
    def configured(self) -> bool:
        return bool(self.enabled and self.public_key and self.secret_key and self.base_url)


def get_observability_settings() -> ObservabilitySettings:
    return ObservabilitySettings(
        enabled=_bool("LANGFUSE_ENABLED", True),
        public_key=os.getenv("LANGFUSE_PUBLIC_KEY", "").strip(),
        secret_key=os.getenv("LANGFUSE_SECRET_KEY", "").strip(),
        base_url=os.getenv("LANGFUSE_BASE_URL", "https://cloud.langfuse.com").rstrip("/"),
        capture_content=_bool("LANGFUSE_CAPTURE_CONTENT", False),
        environment=_environment(os.getenv("LANGFUSE_TRACING_ENVIRONMENT", os.getenv("APP_ENV", "development"))),
        release=os.getenv("LANGFUSE_RELEASE", os.getenv("APP_VERSION", "dev")),
        sample_rate=max(0.0, min(1.0, _float("LANGFUSE_SAMPLE_RATE", 1.0))),
        max_observations=max(100, int(_float("OBSERVABILITY_MAX_OBSERVATIONS", 5000))),
        alert_p95_warning_ms=_float("OBS_ALERT_P95_WARNING_MS", 6000.0),
        alert_p95_critical_ms=_float("OBS_ALERT_P95_CRITICAL_MS", 7500.0),
        alert_error_warning_pct=_float("OBS_ALERT_ERROR_WARNING_PCT", 2.0),
        alert_error_critical_pct=_float("OBS_ALERT_ERROR_CRITICAL_PCT", 5.0),
        alert_retrieval_warning_pct=_float("OBS_ALERT_RETRIEVAL_WARNING_PCT", 90.0),
        alert_answer_warning_pct=_float("OBS_ALERT_ANSWER_WARNING_PCT", 90.0),
        alert_groundedness_warning_pct=_float("OBS_ALERT_GROUNDEDNESS_WARNING_PCT", 85.0),
        daily_cost_budget_usd=_float("OBS_DAILY_COST_BUDGET_USD", 5.0),
    )