from __future__ import annotations

import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Any, Iterable

from src.observability.langfuse_api import LangfuseAPI, LangfuseAPIError

RANGES = {
    "1h": timedelta(hours=1),
    "24h": timedelta(hours=24),
    "2d": timedelta(days=2),
    "3d": timedelta(days=3),
    "7d": timedelta(days=7),
    "14d": timedelta(days=14),
    "30d": timedelta(days=30),
}

RAG_SCOPES = {"rag", "internship", "career", "capstone"}


PIPELINE_ORDER = [
    "rag.preference",
    "rag.guardrail",
    "rag.route",
    "rag.query_plan",
    "rag.retrieve",
    "rag.vector_search",
    "rag.embedding",
    "rag.bm25_search",
    "rag.rrf",
    "rag.rerank",
    "rag.rerank_llm",
    "rag.evidence",
    "rag.generation",
    "rag.groundedness",
    "rag.validation",
]


def window(range_name: str) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)

    if range_name == "yesterday":
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return today_start - timedelta(days=1), today_start

    delta = RANGES.get(range_name, RANGES["24h"])
    return now - delta, now


def _dt(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _num(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _duration_ms(row: dict[str, Any]) -> float:
    start = _dt(row.get("startTime"))
    end = _dt(row.get("endTime"))
    if start and end:
        return max(0.0, (end - start).total_seconds() * 1000.0)
    # Observations API v2 reports latency in seconds.
    latency_seconds = _num(row.get("latency"), -1.0)
    return max(0.0, latency_seconds * 1000.0) if latency_seconds >= 0 else 0.0


def _percentile(values: Iterable[float], p: float) -> float:
    data = sorted(float(v) for v in values if v is not None)
    if not data:
        return 0.0
    if len(data) == 1:
        return data[0]
    idx = (len(data) - 1) * p
    lo = math.floor(idx)
    hi = math.ceil(idx)
    if lo == hi:
        return data[lo]
    return data[lo] + (data[hi] - data[lo]) * (idx - lo)


def _is_error(row: dict[str, Any]) -> bool:
    if str(row.get("level", "")).upper() == "ERROR":
        return True
    # Some integrations can omit the ERROR level but still expose a failure
    # through statusMessage. Avoid treating arbitrary informational messages
    # as errors.
    message = str(row.get("statusMessage") or "").lower()
    return bool(message and any(token in message for token in (
        "error", "exception", "failed", "failure", "timeout", "rate limit", "429",
    )))


def _root_requests(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    preferred = [r for r in rows if r.get("name") == "internova.chat"]
    if preferred:
        return preferred
    return [r for r in rows if r.get("isRootObservation") is True]


def _score_value(row: dict[str, Any]) -> float | None:
    for key in ("value", "numericValue"):
        value = row.get(key)
        if isinstance(value, (int, float)):
            return float(value)
        try:
            if value is not None:
                return float(value)
        except (TypeError, ValueError):
            pass
    details = row.get("details")
    if isinstance(details, dict):
        return _score_value(details)
    return None


def _score_name(row: dict[str, Any]) -> str:
    name = row.get("name")
    if name:
        return str(name)
    details = row.get("details")
    if isinstance(details, dict) and details.get("name"):
        return str(details["name"])
    return ""


def score_summary(scores: list[dict[str, Any]]) -> dict[str, dict[str, float | int | None]]:
    grouped: dict[str, list[float]] = defaultdict(list)
    for row in scores:
        name = _score_name(row)
        value = _score_value(row)
        if name and value is not None:
            grouped[name].append(value)
    out: dict[str, dict[str, float | int | None]] = {}
    for name, values in grouped.items():
        out[name] = {
            "avg": round(mean(values), 4) if values else None,
            "count": len(values),
        }
    return out


def _traffic(roots: list[dict[str, Any]], range_name: str) -> dict[str, Any]:
    bucket_minutes = {
        "1h": 5,
        "24h": 60,
        "yesterday": 60,
        "2d": 120,
        "3d": 180,
        "7d": 360,
        "14d": 720,
        "30d": 1440,
    }.get(range_name, 60)
    buckets: Counter[datetime] = Counter()
    for row in roots:
        ts = _dt(row.get("startTime"))
        if not ts:
            continue
        minute = (ts.minute // bucket_minutes) * bucket_minutes if bucket_minutes < 60 else 0
        if bucket_minutes < 60:
            key = ts.replace(minute=minute, second=0, microsecond=0)
        elif bucket_minutes == 60:
            key = ts.replace(minute=0, second=0, microsecond=0)
        elif bucket_minutes == 360:
            hour = (ts.hour // 6) * 6
            key = ts.replace(hour=hour, minute=0, second=0, microsecond=0)
        else:
            key = ts.replace(hour=0, minute=0, second=0, microsecond=0)
        buckets[key] += 1
    points = [{"time": k.isoformat(), "value": buckets[k]} for k in sorted(buckets)]
    return {
        "points": points,
        "peak": max((p["value"] for p in points), default=0),
        "bucket_minutes": bucket_minutes,
    }


def _metadata(row: dict[str, Any]) -> dict[str, Any]:
    value = row.get("metadata")
    return value if isinstance(value, dict) else {}


def _io_object(value: Any) -> dict[str, Any]:
    """Parse Langfuse v2 raw I/O into a dict when our observation wrote JSON."""
    if isinstance(value, dict):
        return value
    if not isinstance(value, str) or not value.strip():
        return {}
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}


def _service_health(rows: list[dict[str, Any]], roots: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def service(name: str, items: list[dict[str, Any]]) -> dict[str, Any]:
        durations = [_duration_ms(r) for r in items]
        errors = sum(1 for r in items if _is_error(r))
        error_rate = 100 * errors / len(items) if items else 0.0
        if not items:
            status = "unknown"
        elif error_rate >= 5:
            status = "error"
        elif error_rate > 0:
            status = "warning"
        else:
            status = "healthy"
        return {
            "name": name,
            "status": status,
            "calls": len(items),
            "p95_ms": round(_percentile(durations, 0.95), 1),
            "error_rate_pct": round(error_rate, 2),
        }

    retrieval = [r for r in rows if r.get("name") == "rag.retrieve"]
    vector = [r for r in rows if r.get("name") == "rag.vector_search"]
    bm25 = [r for r in rows if r.get("name") == "rag.bm25_search"]
    embedding = [r for r in rows if r.get("name") == "rag.embedding"]
    generations = [r for r in rows if str(r.get("type", "")).upper() == "GENERATION"]
    rerank = [r for r in rows if r.get("name") in {"rag.rerank", "rag.rerank_llm"}]
    return [
        service("Chat / RAG Pipeline", roots),
        service("Hybrid Retrieval", retrieval),
        service("Vector Search", vector),
        service("BM25", bm25),
        service("Embedding", embedding),
        service("Reranker", rerank),
        service("LLM Provider", generations),
    ]


def build_overview(range_name: str = "24h") -> dict[str, Any]:
    start, end = window(range_name)
    api = LangfuseAPI()
    rows, truncated = api.observations(start=start, end=end)
    scores, scores_truncated = api.scores(
        start=start,
        end=end,
        names=["answer_rate", "retrieval_success", "groundedness_pass", "rag_confidence", "faithfulness", "answer_relevance"],
    )
    roots = _root_requests(rows)
    durations = [_duration_ms(r) for r in roots]
    errors = [r for r in roots if _is_error(r)]
    users = {str(r.get("userId")) for r in roots if r.get("userId")}
    sessions = {str(r.get("sessionId")) for r in roots if r.get("sessionId")}
    quality = score_summary(scores)

    generations = [r for r in rows if str(r.get("type", "")).upper() in {"GENERATION", "EMBEDDING"}]
    total_cost = sum(_num(r.get("totalCost")) for r in generations)
    total_tokens = sum(_num(r.get("totalUsage")) for r in generations)

    stages = pipeline_breakdown(rows)
    intents = Counter(
        str(_metadata(r).get("route_intent"))
        for r in roots
        if _metadata(r).get("route_intent")
    )

    return {
        "range": range_name,
        "from": start.isoformat(),
        "to": end.isoformat(),
        "requests": {
            "total": len(roots),
            "error_rate_pct": round(100 * len(errors) / len(roots), 2) if roots else 0.0,
            "active_users": len(users),
            "active_sessions": len(sessions),
        },
        "latency": {
            "p50_ms": round(_percentile(durations, 0.50), 1),
            "p95_ms": round(_percentile(durations, 0.95), 1),
            "p99_ms": round(_percentile(durations, 0.99), 1),
            "avg_ms": round(mean(durations), 1) if durations else 0.0,
        },
        "traffic": _traffic(roots, range_name),
        "quality": quality,
        "llm": {
            "calls": len(generations),
            "total_cost_usd": round(total_cost, 6),
            "total_tokens": int(total_tokens),
            "avg_cost_per_request_usd": round(total_cost / len(roots), 8) if roots else 0.0,
        },
        "pipeline": stages,
        "service_health": _service_health(rows, roots),
        "top_intents": [{"name": k, "count": v} for k, v in intents.most_common(8)],
        "data_truncated": truncated or scores_truncated,
    }


def pipeline_breakdown(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        name = str(row.get("name") or "")
        if name.startswith("rag."):
            grouped[name].append(row)
    names = [name for name in PIPELINE_ORDER if name in grouped]
    names.extend(sorted(name for name in grouped if name not in names))
    result = []
    for name in names:
        items = grouped[name]
        durations = [_duration_ms(r) for r in items]
        result.append({
            "name": name,
            "count": len(items),
            "avg_ms": round(mean(durations), 1) if durations else 0.0,
            "p95_ms": round(_percentile(durations, 0.95), 1),
            "errors": sum(1 for r in items if _is_error(r)),
        })
    return result


def build_rag_analytics(range_name: str = "24h") -> dict[str, Any]:
    start, end = window(range_name)
    api = LangfuseAPI()
    rows, truncated = api.observations(start=start, end=end)
    scores, score_truncated = api.scores(start=start, end=end)
    all_roots = _root_requests(rows)
    root_meta = [_metadata(r) for r in all_roots]

    def has_retrieval_meta(meta: dict[str, Any]) -> bool:
        return any(
            _num(meta.get(key)) > 0
            for key in ("vector_hits", "bm25_hits", "reranked_hits", "source_count")
        )

    rag_roots = [
        r for r in all_roots
        if (
            str(_metadata(r).get("route_scope") or "").lower() in RAG_SCOPES
            or has_retrieval_meta(_metadata(r))
        )
    ]
    quality = score_summary(scores)

    retrieval_rows = [r for r in rows if r.get("name") == "rag.retrieve"]
    rerank_rows = [r for r in rows if r.get("name") == "rag.rerank"]
    intent_counts = Counter(str(m.get("route_intent")) for m in root_meta if m.get("route_intent"))
    scope_counts = Counter(str(m.get("route_scope")) for m in root_meta if m.get("route_scope"))

    no_answer = 0
    fallback = 0
    for r in rag_roots:
        meta = _metadata(r)
        status = str(meta.get("request_status") or "")
        if status and status != "answered":
            no_answer += 1

    retrieval_outputs = [_io_object(r.get("output")) for r in retrieval_rows]
    root_retrieval_outputs = [
        {
            "vector_hits": _num(meta.get("vector_hits")),
            "bm25_hits": _num(meta.get("bm25_hits")),
            "fused_hits": _num(
                meta.get("reranked_hits"),
                _num(meta.get("source_count")),
            ),
        }
        for meta in (_metadata(r) for r in rag_roots)
        if has_retrieval_meta(meta)
    ]
    effective_retrieval_outputs = retrieval_outputs or root_retrieval_outputs

    vector_counts = [_num(o.get("vector_hits")) for o in effective_retrieval_outputs if o]
    bm25_counts = [_num(o.get("bm25_hits")) for o in effective_retrieval_outputs if o]
    fused_counts = [_num(o.get("fused_hits")) for o in effective_retrieval_outputs if o]
    zero_result_calls = sum(
        1
        for o in effective_retrieval_outputs
        if o and _num(o.get("fused_hits")) <= 0
    )

    rerank_outputs = [_io_object(r.get("output")) for r in rerank_rows]
    fallback_calls = sum(1 for o in rerank_outputs if o and o.get("fallback_reason"))
    used_llm_calls = sum(1 for o in rerank_outputs if o and o.get("used_llm") is True)
    fallback = fallback_calls

    return {
        "range": range_name,
        "requests_total": len(all_roots),
        "queries": len(rag_roots),
        "quality": quality,
        "no_answer_rate_pct": round(100 * no_answer / len(rag_roots), 2) if rag_roots else 0.0,
        "fallback_rate_pct": round(100 * fallback / len(rerank_rows), 2) if rerank_rows else 0.0,
        "retrieval_calls": len(retrieval_rows) or len(root_retrieval_outputs),
        "rerank_calls": len(rerank_rows) or sum(
            1
            for item in root_retrieval_outputs
            if _num(item.get("fused_hits")) > 0
        ),
        "retrieval": {
            "avg_vector_hits": round(mean(vector_counts), 2) if vector_counts else 0.0,
            "avg_bm25_hits": round(mean(bm25_counts), 2) if bm25_counts else 0.0,
            "avg_fused_hits": round(mean(fused_counts), 2) if fused_counts else 0.0,
            "zero_result_rate_pct": round(100 * zero_result_calls / len(effective_retrieval_outputs), 2) if effective_retrieval_outputs else 0.0,
        },
        "rerank": {
            "used_llm_calls": used_llm_calls,
            "fallback_calls": fallback_calls,
            "fallback_rate_pct": round(100 * fallback_calls / len(rerank_outputs), 2) if rerank_outputs else 0.0,
        },
        "pipeline": pipeline_breakdown(rows),
        "intents": [{"name": k, "count": v} for k, v in intent_counts.most_common()],
        "scopes": [{"name": k, "count": v} for k, v in scope_counts.most_common()],
        "data_truncated": truncated or score_truncated,
    }


def build_llm_analytics(range_name: str = "24h") -> dict[str, Any]:
    start, end = window(range_name)
    rows, truncated = LangfuseAPI().observations(start=start, end=end)
    generations = [r for r in rows if str(r.get("type", "")).upper() in {"GENERATION", "EMBEDDING"}]
    by_model: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in generations:
        model = str(row.get("providedModelName") or "unknown")
        by_model[model].append(row)

    models = []
    for model, items in by_model.items():
        costs = [_num(r.get("totalCost")) for r in items]
        tokens = [_num(r.get("totalUsage")) for r in items]
        latencies = [_duration_ms(r) for r in items]
        errors = sum(1 for r in items if _is_error(r))
        models.append({
            "model": model,
            "calls": len(items),
            "tokens": int(sum(tokens)),
            "cost_usd": round(sum(costs), 6),
            "p95_ms": round(_percentile(latencies, 0.95), 1),
            "error_rate_pct": round(100 * errors / len(items), 2) if items else 0.0,
        })
    models.sort(key=lambda x: x["cost_usd"], reverse=True)

    total_cost = sum(m["cost_usd"] for m in models)
    total_tokens = sum(m["tokens"] for m in models)
    total_calls = sum(m["calls"] for m in models)
    return {
        "range": range_name,
        "calls": total_calls,
        "tokens": total_tokens,
        "cost_usd": round(total_cost, 6),
        "avg_cost_per_call_usd": round(total_cost / total_calls, 8) if total_calls else 0.0,
        "models": models,
        "data_truncated": truncated,
    }


def build_logs(range_name: str = "24h", limit: int = 200) -> dict[str, Any]:
    start, end = window(range_name)
    rows, truncated = LangfuseAPI().observations(start=start, end=end, max_rows=max(limit * 5, 1000))
    rows.sort(key=lambda r: str(r.get("startTime") or ""), reverse=True)
    items = []
    for row in rows[:limit]:
        items.append({
            "id": row.get("id"),
            "trace_id": row.get("traceId"),
            "time": row.get("startTime"),
            "level": row.get("level") or "DEFAULT",
            "type": row.get("type"),
            "name": row.get("name"),
            "status_message": row.get("statusMessage"),
            "latency_ms": round(_duration_ms(row), 1),
            "model": row.get("providedModelName"),
            "metadata": _metadata(row),
        })
    return {"range": range_name, "items": items, "data_truncated": truncated}


def build_errors(range_name: str = "24h", limit: int = 200) -> dict[str, Any]:
    start, end = window(range_name)
    rows, truncated = LangfuseAPI().observations(start=start, end=end)
    errors = [r for r in rows if _is_error(r)]
    errors.sort(key=lambda r: str(r.get("startTime") or ""), reverse=True)
    by_component = Counter(str(r.get("name") or r.get("type") or "unknown") for r in errors)
    return {
        "range": range_name,
        "total": len(errors),
        "by_component": [{"name": k, "count": v} for k, v in by_component.most_common()],
        "items": [
            {
                "id": r.get("id"),
                "trace_id": r.get("traceId"),
                "time": r.get("startTime"),
                "component": r.get("name") or r.get("type"),
                "level": r.get("level"),
                "message": r.get("statusMessage") or "Unknown error",
                "latency_ms": round(_duration_ms(r), 1),
                "model": r.get("providedModelName"),
                "metadata": _metadata(r),
            }
            for r in errors[:limit]
        ],
        "data_truncated": truncated,
    }


def build_traces(range_name: str = "24h", limit: int = 200) -> dict[str, Any]:
    start, end = window(range_name)
    rows, truncated = LangfuseAPI().observations(start=start, end=end)
    by_trace: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        trace_id = row.get("traceId")
        if trace_id:
            by_trace[str(trace_id)].append(row)

    traces = []
    for trace_id, items in by_trace.items():
        root = next((r for r in items if r.get("name") == "internova.chat"), None)
        if root is None:
            root = next((r for r in items if r.get("isRootObservation") is True), None)
        root = root or min(items, key=lambda r: str(r.get("startTime") or ""))
        trace_start = min((_dt(r.get("startTime")) for r in items if _dt(r.get("startTime"))), default=None)
        trace_end = max((_dt(r.get("endTime")) for r in items if _dt(r.get("endTime"))), default=None)
        duration = (trace_end - trace_start).total_seconds() * 1000 if trace_start and trace_end else _duration_ms(root)
        metadata = _metadata(root)
        traces.append({
            "trace_id": trace_id,
            "time": root.get("startTime"),
            "name": root.get("name"),
            "user_id": root.get("userId"),
            "session_id": root.get("sessionId"),
            "intent": metadata.get("route_intent"),
            "scope": metadata.get("route_scope"),
            "status": metadata.get("request_status") or ("error" if any(_is_error(r) for r in items) else "ok"),
            "latency_ms": round(max(0.0, duration), 1),
            "observations": len(items),
            "cost_usd": round(sum(_num(r.get("totalCost")) for r in items), 6),
            "tokens": int(sum(_num(r.get("totalUsage")) for r in items)),
        })
    traces.sort(key=lambda t: str(t.get("time") or ""), reverse=True)
    return {"range": range_name, "items": traces[:limit], "data_truncated": truncated or len(traces) > limit}


def build_trace_detail(trace_id: str, range_name: str = "30d") -> dict[str, Any]:
    start, end = window(range_name)
    rows, truncated = LangfuseAPI().observations(start=start, end=end, trace_id=trace_id, max_rows=2000)
    if not rows:
        return {"trace_id": trace_id, "found": False, "observations": []}

    rows.sort(key=lambda r: str(r.get("startTime") or ""))
    min_start = min((_dt(r.get("startTime")) for r in rows if _dt(r.get("startTime"))), default=None)
    observations = []
    for row in rows:
        start_time = _dt(row.get("startTime"))
        offset = (start_time - min_start).total_seconds() * 1000 if start_time and min_start else 0.0
        observations.append({
            "id": row.get("id"),
            "parent_id": row.get("parentObservationId"),
            "name": row.get("name"),
            "type": row.get("type"),
            "level": row.get("level"),
            "status_message": row.get("statusMessage"),
            "start_time": row.get("startTime"),
            "end_time": row.get("endTime"),
            "offset_ms": round(offset, 1),
            "latency_ms": round(_duration_ms(row), 1),
            "model": row.get("providedModelName"),
            "input_usage": int(_num(row.get("inputUsage"))),
            "output_usage": int(_num(row.get("outputUsage"))),
            "total_usage": int(_num(row.get("totalUsage"))),
            "cost_usd": round(_num(row.get("totalCost")), 8),
            "metadata": _metadata(row),
            "input": row.get("input"),
            "output": row.get("output"),
        })
    root = next((r for r in rows if r.get("name") == "internova.chat"), rows[0])
    return {
        "trace_id": trace_id,
        "found": True,
        "user_id": root.get("userId"),
        "session_id": root.get("sessionId"),
        "observations": observations,
        "data_truncated": truncated,
    }