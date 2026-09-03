from __future__ import annotations

import hashlib
import json
import threading
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from src.observability.analytics import build_llm_analytics, build_overview, build_rag_analytics
from src.observability.config import get_observability_settings
from src.observability.langfuse_api import LangfuseAPI

_STATE_PATH = Path("data/observability_alert_state.json")
_LOCK = threading.Lock()


def _alert_id(code: str) -> str:
    return hashlib.sha1(code.encode("utf-8")).hexdigest()[:12]


def _load_state() -> dict[str, Any]:
    with _LOCK:
        try:
            if _STATE_PATH.exists():
                payload = json.loads(_STATE_PATH.read_text(encoding="utf-8"))
                if isinstance(payload, dict):
                    return payload
        except Exception:
            pass
    return {}


def _save_state(state: dict[str, Any]) -> None:
    with _LOCK:
        _STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        _STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def set_alert_state(alert_id: str, status: str) -> dict[str, Any]:
    if status not in {"acknowledged", "resolved", "active"}:
        raise ValueError("Invalid alert status")
    state = _load_state()
    state[alert_id] = {
        "status": status,
        "updated_at": datetime.now(UTC).isoformat(),
    }
    _save_state(state)
    return state[alert_id]


def build_alerts(
    range_name: str = "24h",
    *,
    health_check: Callable[[], Any] | None = None,
    overview_loader: Callable[[str], dict[str, Any]] | None = None,
    rag_loader: Callable[[str], dict[str, Any]] | None = None,
    llm_loader: Callable[[str], dict[str, Any]] | None = None,
) -> dict[str, Any]:
    settings = get_observability_settings()
    state = _load_state()
    alerts: list[dict[str, Any]] = []
    triggered_ids: set[str] = set()

    def add(code: str, severity: str, title: str, message: str, metric: str, value: Any, threshold: Any, href: str) -> None:
        aid = _alert_id(code)
        triggered_ids.add(aid)
        saved = state.get(aid, {}) if isinstance(state.get(aid), dict) else {}
        status = saved.get("status", "active")
        alerts.append({
            "id": aid,
            "code": code,
            "severity": severity,
            "status": status,
            "title": title,
            "message": message,
            "metric": metric,
            "value": value,
            "threshold": threshold,
            "investigate_url": href,
        })

    def persist_cleared_conditions() -> None:
        # Once a condition clears, forget its acknowledgement/resolution. If the
        # same rule breaches again later it becomes a fresh active alert.
        changed = False
        for aid in list(state):
            if aid not in triggered_ids:
                state.pop(aid, None)
                changed = True
        if changed:
            _save_state(state)

    try:
        (health_check or (lambda: LangfuseAPI().health()))()
    except Exception as exc:
        add(
            "LANGFUSE_UNAVAILABLE", "critical", "Langfuse unavailable",
            str(exc), "langfuse_health", 0, 1, "/admin/ai-monitoring/errors",
        )
        persist_cleared_conditions()
        return {
            "range": range_name,
            "items": alerts,
            "active": sum(1 for a in alerts if a["status"] == "active"),
            "critical": sum(1 for a in alerts if a["severity"] == "critical" and a["status"] == "active"),
        }

    overview = (overview_loader or build_overview)(range_name)
    rag = (rag_loader or build_rag_analytics)(range_name)
    llm = (llm_loader or build_llm_analytics)(range_name)
    p95 = float(overview["latency"]["p95_ms"])
    error = float(overview["requests"]["error_rate_pct"])

    if p95 >= settings.alert_p95_critical_ms:
        add("P95_CRITICAL", "critical", "P95 latency quá cao", f"P95 hiện tại {p95:.0f} ms", "p95_latency_ms", p95, settings.alert_p95_critical_ms, "/admin/ai-monitoring/traces")
    elif p95 >= settings.alert_p95_warning_ms:
        add("P95_WARNING", "warning", "P95 latency tăng", f"P95 hiện tại {p95:.0f} ms", "p95_latency_ms", p95, settings.alert_p95_warning_ms, "/admin/ai-monitoring/traces")

    if error >= settings.alert_error_critical_pct:
        add("ERROR_RATE_CRITICAL", "critical", "Error rate cao", f"Error rate {error:.2f}%", "error_rate_pct", error, settings.alert_error_critical_pct, "/admin/ai-monitoring/errors")
    elif error >= settings.alert_error_warning_pct:
        add("ERROR_RATE_WARNING", "warning", "Error rate tăng", f"Error rate {error:.2f}%", "error_rate_pct", error, settings.alert_error_warning_pct, "/admin/ai-monitoring/errors")

    q = rag.get("quality", {})
    retrieval = ((q.get("retrieval_success") or {}).get("avg"))
    answer_rate = ((q.get("answer_rate") or {}).get("avg"))
    grounded = ((q.get("groundedness_pass") or {}).get("avg"))
    if retrieval is not None and retrieval * 100 < settings.alert_retrieval_warning_pct:
        add("RETRIEVAL_LOW", "warning", "Retrieval success thấp", f"Retrieval success {retrieval*100:.1f}%", "retrieval_success_pct", retrieval*100, settings.alert_retrieval_warning_pct, "/admin/ai-monitoring/rag")
    if answer_rate is not None and answer_rate * 100 < settings.alert_answer_warning_pct:
        add("ANSWER_RATE_LOW", "warning", "Answer rate thấp", f"Answer rate {answer_rate*100:.1f}%", "answer_rate_pct", answer_rate*100, settings.alert_answer_warning_pct, "/admin/ai-monitoring/rag")
    if grounded is not None and grounded * 100 < settings.alert_groundedness_warning_pct:
        add("GROUNDEDNESS_LOW", "warning", "Groundedness giảm", f"Groundedness pass {grounded*100:.1f}%", "groundedness_pct", grounded*100, settings.alert_groundedness_warning_pct, "/admin/ai-monitoring/rag")

    if range_name in {"24h", "1h"} and float(llm.get("cost_usd", 0)) > settings.daily_cost_budget_usd:
        add("DAILY_COST_HIGH", "warning", "LLM cost vượt ngân sách", f"Cost ${llm['cost_usd']:.4f}", "cost_usd", llm["cost_usd"], settings.daily_cost_budget_usd, "/admin/ai-monitoring/llm")

    persist_cleared_conditions()

    return {
        "range": range_name,
        "items": alerts,
        "active": sum(1 for a in alerts if a["status"] == "active"),
        "critical": sum(1 for a in alerts if a["severity"] == "critical" and a["status"] == "active"),
    }
