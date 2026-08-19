from __future__ import annotations

import atexit
import hashlib
import logging
import re
import threading
from contextlib import contextmanager
from functools import wraps
from typing import Any, Callable, Iterator, TypeVar

from src.observability.config import get_observability_settings

logger = logging.getLogger(__name__)
F = TypeVar("F", bound=Callable[..., Any])
RAG_SCOPES = {"rag", "internship", "career", "capstone"}

_CLIENT: Any | None = None
_CLIENT_LOCK = threading.Lock()
_EXPORT_MASK_ACTIVE = False
_SHUTDOWN_REGISTERED = False

_EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b")
_PHONE_RE = re.compile(r"(?<!\d)(?:\+?84|0)[\s.-]?(?:\d[\s.-]?){8,10}(?!\d)")
_BEARER_RE = re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]+")
_OPENAI_KEY_RE = re.compile(r"\bsk-[A-Za-z0-9_-]{12,}\b")
_LANGFUSE_KEY_RE = re.compile(r"\b(?:sk|pk)-lf-[A-Za-z0-9_-]{8,}\b")

_CONTENT_KEY_PARTS = (
    "prompt",
    "completion",
    "message",
    "messages",
    "content",
    "input",
    "output",
    "query",
    "response",
)
_SAFE_CONTENT_KEY_PARTS = (
    "token",
    "usage",
    "cost",
    "price",
    "count",
    "length",
    "hash",
    "id",
    "model",
)
_SECRET_KEY_PARTS = (
    "authorization",
    "api_key",
    "apikey",
    "secret",
    "password",
    "access_token",
    "refresh_token",
)


def _configured() -> bool:
    return get_observability_settings().configured


def _redact_patterns(value: str) -> str:
    """Mask obvious PII/secrets without changing application data."""
    value = _EMAIL_RE.sub("[EMAIL_REDACTED]", value)
    value = _PHONE_RE.sub("[PHONE_REDACTED]", value)
    value = _BEARER_RE.sub("Bearer [TOKEN_REDACTED]", value)
    value = _OPENAI_KEY_RE.sub("[OPENAI_KEY_REDACTED]", value)
    value = _LANGFUSE_KEY_RE.sub("[LANGFUSE_KEY_REDACTED]", value)
    return value


def _legacy_mask(data: Any, **_: Any) -> Any:
    """Fallback masker for Langfuse SDK-created attributes."""
    if isinstance(data, str):
        return _redact_patterns(data)
    if isinstance(data, dict):
        return {key: _legacy_mask(value) for key, value in data.items()}
    if isinstance(data, list):
        return [_legacy_mask(value) for value in data]
    if isinstance(data, tuple):
        return tuple(_legacy_mask(value) for value in data)
    return data


def _mask_exported_spans(*, params: Any) -> Any:
    """Export-stage privacy filter for Langfuse + third-party OTEL spans.

    When raw-content capture is disabled, prompt/query/message/input/output style
    string attributes are replaced while usage, latency, model, cost and IDs are
    retained. Even when content capture is enabled, obvious secrets are scrubbed.
    """
    try:
        from langfuse.types import MaskOtelSpansResult, OtelSpanPatch

        capture_content = get_observability_settings().capture_content
        patches: dict[Any, Any] = {}

        for identifier, span in params.spans.items():
            replacements: dict[str, Any] = {}
            for key, value in span.attributes.items():
                key_lower = str(key).lower()

                if any(part in key_lower for part in _SECRET_KEY_PARTS):
                    replacements[key] = "[SECRET_REDACTED]"
                    continue

                if isinstance(value, str):
                    masked = _redact_patterns(value)
                    looks_like_content = (
                        any(part in key_lower for part in _CONTENT_KEY_PARTS)
                        and not any(part in key_lower for part in _SAFE_CONTENT_KEY_PARTS)
                    )
                    if not capture_content and looks_like_content:
                        masked = "[CONTENT_REDACTED]"
                    if masked != value:
                        replacements[key] = masked

            if replacements:
                patches[identifier] = OtelSpanPatch(set_attributes=replacements)

        return MaskOtelSpansResult(span_patches=patches)
    except Exception as exc:
        # A failing export-stage mask can make Langfuse drop a batch, so fail
        # closed by returning no patch rather than allowing masking code errors
        # to escape the hook.
        logger.warning("Langfuse export masking failed: %s", exc)
        return None


def _safe_client():
    """Get/configure the Langfuse singleton without ever breaking the app."""
    global _CLIENT, _EXPORT_MASK_ACTIVE, _SHUTDOWN_REGISTERED

    if not _configured():
        return None
    if _CLIENT is not None:
        return _CLIENT

    with _CLIENT_LOCK:
        if _CLIENT is not None:
            return _CLIENT
        settings = get_observability_settings()
        try:
            from langfuse import Langfuse

            kwargs: dict[str, Any] = {
                "public_key": settings.public_key,
                "secret_key": settings.secret_key,
                "base_url": settings.base_url,
                "environment": settings.environment,
                "sample_rate": settings.sample_rate,
                "mask": _legacy_mask,
            }

            try:
                # Present in current Langfuse Python SDKs; preferred because it
                # also covers LangChain/other third-party OTEL spans.
                from langfuse.types import MaskOtelSpansResult, OtelSpanPatch  # noqa: F401

                kwargs["mask_otel_spans"] = _mask_exported_spans
                _EXPORT_MASK_ACTIVE = True
            except Exception:
                _EXPORT_MASK_ACTIVE = False

            _CLIENT = Langfuse(**kwargs)
            if not _SHUTDOWN_REGISTERED:
                def _shutdown_langfuse() -> None:
                    try:
                        if _CLIENT is not None:
                            _CLIENT.shutdown()
                    except Exception:
                        pass

                atexit.register(_shutdown_langfuse)
                _SHUTDOWN_REGISTERED = True
            return _CLIENT
        except Exception as exc:  # telemetry must never break the chatbot
            logger.debug("Langfuse client unavailable: %s", exc)
            return None


def langfuse_callbacks() -> list[Any]:
    """Return a LangChain callback handler when safe and configured.

    On older SDK builds that do not expose export-stage masking, callbacks are
    disabled while LANGFUSE_CAPTURE_CONTENT=false to avoid leaking raw prompts
    from third-party LangChain spans. Manual RAG stage tracing still works.
    """
    client = _safe_client()
    if client is None:
        return []

    settings = get_observability_settings()
    if not settings.capture_content and not _EXPORT_MASK_ACTIVE:
        logger.warning(
            "Langfuse SDK lacks export-stage masking; LangChain callbacks are "
            "disabled because LANGFUSE_CAPTURE_CONTENT=false."
        )
        return []

    try:
        from langfuse.langchain import CallbackHandler
        return [CallbackHandler()]
    except Exception as exc:
        logger.debug("Langfuse CallbackHandler unavailable: %s", exc)
        return []


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="ignore")).hexdigest()[:24]


def safe_text(value: str | None) -> dict[str, Any] | str | None:
    if value is None:
        return None
    settings = get_observability_settings()
    if settings.capture_content:
        return _redact_patterns(value)
    return {
        "redacted": True,
        "length": len(value),
        "sha256_24": _sha256(value),
    }


def _hit_ids(hits: Any, limit: int = 10) -> list[str]:
    result: list[str] = []
    if not isinstance(hits, (list, tuple)):
        return result
    for hit in hits[:limit]:
        chunk_id = getattr(hit, "chunk_id", None)
        if chunk_id:
            result.append(str(chunk_id))
        elif isinstance(hit, dict) and hit.get("chunk_id"):
            result.append(str(hit["chunk_id"]))
    return result


def summarize(value: Any) -> Any:
    """Small, privacy-aware summaries for Langfuse observation output."""
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return safe_text(value)
    if isinstance(value, (list, tuple)):
        return {"count": len(value), "chunk_ids": _hit_ids(value)}

    cls = value.__class__.__name__
    if cls == "RetrievalResult":
        return {
            "search_queries": len(getattr(value, "search_queries", []) or []),
            "vector_hits": len(getattr(value, "vector_hits", []) or []),
            "bm25_hits": len(getattr(value, "bm25_hits", []) or []),
            "fused_hits": len(getattr(value, "fused_hits", []) or []),
            "fused_chunk_ids": _hit_ids(getattr(value, "fused_hits", [])),
        }
    if cls == "RerankResult":
        return {
            "hits": len(getattr(value, "hits", []) or []),
            "chunk_ids": _hit_ids(getattr(value, "hits", [])),
            "used_llm": bool(getattr(value, "used_llm", False)),
            "fallback_reason": getattr(value, "fallback_reason", None),
        }
    if cls == "RouteDecision":
        return {
            "intent": getattr(value, "intent", None),
            "scope": getattr(value, "scope", None),
            "language": getattr(value, "language", None),
            "allowed_document_types": getattr(value, "allowed_document_types", []),
        }
    if cls == "QueryExpansionResult":
        return {
            "query_language": getattr(value, "query_language", None),
            "query_count": len(getattr(value, "search_queries", []) or []),
            "used_openai": bool(getattr(value, "used_openai", False)),
            "warnings": getattr(value, "warnings", []),
        }
    if cls == "QueryResult":
        return summarize_query_result(value)

    if hasattr(value, "model_dump"):
        try:
            data = value.model_dump()
            return {k: summarize(v) for k, v in list(data.items())[:20]}
        except Exception:
            pass
    return {"type": cls}


def summarize_query_result(result: Any) -> dict[str, Any]:
    return {
        "answer_status": getattr(result, "answer_status", None),
        "answer_language": getattr(result, "answer_language", None),
        "confidence": float(getattr(result, "confidence", 0.0) or 0.0),
        "route_intent": getattr(result, "route_intent", None),
        "route_scope": getattr(result, "route_scope", None),
        "guardrail_passed": getattr(result, "guardrail_passed", None),
        "groundedness_status": getattr(result, "groundedness_status", None),
        "groundedness_reason": getattr(result, "groundedness_reason", None),
        "latency_ms": float(getattr(result, "latency_ms", 0.0) or 0.0),
        "cache_hit": bool(getattr(result, "cache_hit", False)),
        "vector_hits": len(getattr(result, "vector_hits", []) or []),
        "bm25_hits": len(getattr(result, "bm25_hits", []) or []),
        "reranked_hits": len(getattr(result, "reranked_hits", []) or []),
        "source_count": len(getattr(result, "sources", []) or []),
        "answer": safe_text(getattr(result, "answer", None)),
    }


def _metadata_from_call(args: tuple[Any, ...], kwargs: dict[str, Any]) -> dict[str, Any]:
    metadata: dict[str, Any] = {}
    query = kwargs.get("query")
    if query is None:
        for item in args:
            if isinstance(item, str):
                query = item
                break
    if isinstance(query, str):
        metadata["query_length"] = len(query)
        metadata["query_hash"] = _sha256(query)
    for key in ("top_k", "top_k_vector", "top_k_bm25", "top_k_fused"):
        if key in kwargs and isinstance(kwargs[key], (int, float, str, bool)):
            metadata[key] = kwargs[key]
    return metadata


def observe_rag_stage(
    name: str,
    *,
    as_type: str = "span",
    model: str | None = None,
) -> Callable[[F], F]:
    """Decorate a synchronous RAG stage with a Langfuse observation.

    Business exceptions are never swallowed or retried. When Langfuse is not
    configured the wrapped function is called exactly once without telemetry.
    """
    def decorator(func: F) -> F:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any):
            client = _safe_client()
            if client is None:
                return func(*args, **kwargs)

            observation_kwargs: dict[str, Any] = {
                "name": name,
                "as_type": as_type,
                "metadata": _metadata_from_call(args, kwargs),
            }
            if model:
                observation_kwargs["model"] = model

            try:
                context = client.start_as_current_observation(**observation_kwargs)
            except Exception as exc:
                logger.debug("Unable to create Langfuse observation %s: %s", name, exc)
                return func(*args, **kwargs)

            with context as obs:
                try:
                    value = func(*args, **kwargs)
                except Exception as exc:
                    try:
                        obs.update(level="ERROR", status_message=f"{type(exc).__name__}: {exc}")
                    except Exception:
                        pass
                    raise
                try:
                    obs.update(output=summarize(value))
                except Exception as exc:
                    logger.debug("Unable to update Langfuse observation %s: %s", name, exc)
                return value

        return wrapper  # type: ignore[return-value]
    return decorator


def observed_call(
    name: str,
    func: Callable[..., Any],
    *args: Any,
    _as_type: str = "span",
    _model: str | None = None,
    **kwargs: Any,
) -> Any:
    """Observe a single call without changing the called function's signature."""
    client = _safe_client()
    if client is None:
        return func(*args, **kwargs)

    observation_kwargs: dict[str, Any] = {
        "name": name,
        "as_type": _as_type,
        "metadata": _metadata_from_call(args, kwargs),
    }
    if _model:
        observation_kwargs["model"] = _model

    try:
        context = client.start_as_current_observation(**observation_kwargs)
    except Exception as exc:
        logger.debug("Unable to create Langfuse observation %s: %s", name, exc)
        return func(*args, **kwargs)

    with context as obs:
        try:
            value = func(*args, **kwargs)
        except Exception as exc:
            try:
                obs.update(level="ERROR", status_message=f"{type(exc).__name__}: {exc}")
            except Exception:
                pass
            raise
        try:
            obs.update(output=summarize(value))
        except Exception:
            pass
        return value


@contextmanager
def rag_trace(
    *,
    query: str,
    user_id: str | None = None,
    session_id: str | None = None,
) -> Iterator[Any]:
    """Create the root Internova chatbot observation and correlation context."""
    client = _safe_client()
    if client is None:
        yield None
        return

    settings = get_observability_settings()
    try:
        from langfuse import propagate_attributes
    except Exception as exc:
        logger.debug("Langfuse propagate_attributes unavailable: %s", exc)
        yield None
        return

    propagate_kwargs: dict[str, Any] = {
        "trace_name": "internova.chat",
        "tags": ["internova", "chatbot", "rag"],
        "metadata": {
            "component": "rag",
            "capturecontent": "true" if settings.capture_content else "false",
        },
        "version": str(settings.release)[:200],
        "environment": str(settings.environment)[:40],
    }
    if user_id:
        propagate_kwargs["user_id"] = str(user_id)[:200]
    if session_id:
        propagate_kwargs["session_id"] = str(session_id)[:200]

    # Do not catch exceptions thrown through yield: business exceptions from
    # the RAG pipeline must propagate unchanged.
    with propagate_attributes(**propagate_kwargs):
        with client.start_as_current_observation(
            name="internova.chat",
            as_type="chain",
            input=safe_text(query),
            metadata={
                "query_length": len(query or ""),
                "query_hash": _sha256(query or ""),
            },
        ) as root:
            yield root


def record_trace_result(root: Any, result: Any) -> None:
    if root is None:
        return
    try:
        summary = summarize_query_result(result)
        root.update(
            output=summary,
            metadata={
                "request_status": summary.get("answer_status"),
                "route_intent": summary.get("route_intent"),
                "route_scope": summary.get("route_scope"),
                "groundedness_status": summary.get("groundedness_status"),
                "vector_hits": summary.get("vector_hits"),
                "bm25_hits": summary.get("bm25_hits"),
                "reranked_hits": summary.get("reranked_hits"),
                "source_count": summary.get("source_count"),
                "cache_hit": summary.get("cache_hit"),
            },
        )

        answered = 1.0 if summary.get("answer_status") == "answered" else 0.0
        route_scope = str(summary.get("route_scope") or "").lower()
        is_rag_request = route_scope in RAG_SCOPES
        retrieval_success = 1.0 if (
            (summary.get("reranked_hits") or 0) > 0
            or (summary.get("vector_hits") or 0) > 0
            or (summary.get("bm25_hits") or 0) > 0
        ) else 0.0
        groundedness_status = str(summary.get("groundedness_status") or "").lower()
        groundedness_pass = 1.0 if groundedness_status in {"pass", "passed", "grounded"} else 0.0

        # Answer rate is a chatbot-wide score. Retrieval/groundedness/confidence
        # are RAG-only scores so greetings, general-support and out-of-scope
        # requests do not incorrectly count as retrieval failures.
        root.score_trace(name="answer_rate", value=answered, data_type="NUMERIC")
        if is_rag_request:
            root.score_trace(name="retrieval_success", value=retrieval_success, data_type="NUMERIC")
            if groundedness_status and groundedness_status != "skip":
                root.score_trace(name="groundedness_pass", value=groundedness_pass, data_type="NUMERIC")
            confidence = summary.get("confidence")
            if isinstance(confidence, (int, float)):
                root.score_trace(name="rag_confidence", value=float(confidence), data_type="NUMERIC")
    except Exception as exc:
        logger.debug("Unable to finalize Langfuse trace: %s", exc)