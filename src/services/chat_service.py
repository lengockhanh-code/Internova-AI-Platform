from __future__ import annotations

import logging
import time
from pathlib import Path
from threading import Lock
from typing import Callable

from src.config import get_settings
from src.rag.generation.answer_generator import StreamingCancelled
from src.rag.memory import ConversationMemory
from src.rag.query_pipeline import (
    PipelineOptions,
    QueryPipeline,
    detect_query_language,
    route_query,
)
from src.rag.schemas import QueryResult
from src.services.redis_cache_service import redis_cache
from src.observability.instrumentation import observed_call, rag_trace, record_trace_result


logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).resolve().parents[2]

CHROMA_DIR = ROOT_DIR / "data" / "chroma"
BM25_PATH = ROOT_DIR / "data" / "rag" / "bm25.pkl"

RAG_SCOPES = {
    "rag",
    "internship",
    "career",
    "capstone",
}


def _normalize_preference_text(message: str) -> str:
    """Cheap normalization for explicit preference commands only."""
    import unicodedata

    lowered = " ".join((message or "").strip().lower().split())
    ascii_text = "".join(
        ch
        for ch in unicodedata.normalize("NFD", lowered.replace("đ", "d"))
        if unicodedata.category(ch) != "Mn"
    )
    return f"{lowered} {ascii_text}"


def _detect_explicit_preference(message: str) -> str | None:
    """Detect only clear, persistent response preferences without an LLM.

    Ambiguous natural-language requests are intentionally left to the main chat
    model, which already receives the current query and conversation history.
    This removes a dedicated network round-trip without reducing the semantic
    understanding of the actual answering model.
    """
    text = _normalize_preference_text(message)

    language_en = (
        "tra loi bang tieng anh",
        "tra loi tieng anh",
        "dung tieng anh",
        "noi tieng anh",
        "answer in english",
        "respond in english",
        "reply in english",
        "use english",
    )
    language_vi = (
        "tra loi bang tieng viet",
        "tra loi tieng viet",
        "dung tieng viet",
        "noi tieng viet",
        "answer in vietnamese",
        "respond in vietnamese",
        "reply in vietnamese",
        "use vietnamese",
    )
    shorter = (
        "tra loi ngan hon",
        "tra loi ngan gon",
        "noi ngan hon",
        "viet ngan hon",
        "ngan hon di",
        "keep it shorter",
        "make it shorter",
        "be more concise",
        "more concise",
    )
    simpler = (
        "giai thich don gian hon",
        "giai thich de hieu hon",
        "noi de hieu hon",
        "viet de hieu hon",
        "don gian hon di",
        "explain more simply",
        "make it simpler",
        "simpler explanation",
        "easier to understand",
    )

    if any(phrase in text for phrase in language_en):
        return "language_en"
    if any(phrase in text for phrase in language_vi):
        return "language_vi"
    if any(phrase in text for phrase in shorter):
        return "shorter"
    if any(phrase in text for phrase in simpler):
        return "simpler"
    return None


class ChatService:
    def __init__(self) -> None:
        self._pipeline: QueryPipeline | None = None
        self._lock = Lock()
        self._memories: dict[str, ConversationMemory] = {}

    def _is_low_information_message(
        self,
        message: str,
    ) -> bool:
        normalized = " ".join(message.strip().split())
        if not normalized:
            return True

        words = normalized.split()
        if len(words) >= 5:
            return False

        letters_only = "".join(
            ch
            for ch in normalized
            if ch.isalnum() or ch.isspace()
        )
        informative_chars = sum(
            1
            for ch in letters_only
            if ch.isalnum()
        )

        return informative_chars <= 20

    def _get_memory(
        self,
        session_id: str | None,
    ) -> ConversationMemory | None:
        if not session_id:
            return None

        memory = self._memories.get(session_id)

        if memory is None:
            memory = ConversationMemory(
                session_id=session_id
            )
            self._memories[session_id] = memory

        return memory

    def _get_pipeline(self) -> QueryPipeline:
        """Lazy-load the RAG pipeline."""

        if self._pipeline is None:
            with self._lock:
                if self._pipeline is None:
                    options = PipelineOptions(
                        top_k_vector=6,
                        top_k_bm25=6,
                        top_k_fused=5,
                        top_k_rerank=3,
                        use_reranker=False,
                        use_openai_translation=False,
                        max_context_chars=4000,

                        # IMPORTANT:
                        # None keeps Vietnamese/English automatic response
                        # language selection. "vi" would force every answer
                        # to Vietnamese.
                        answer_language=None,
                    )

                    self._pipeline = QueryPipeline(
                        chroma_dir=CHROMA_DIR,
                        bm25_path=BM25_PATH,
                        options=options,
                    )

        return self._pipeline

    def _result_cache_payload(
        self,
        message: str,
        pipeline: QueryPipeline,
        memory: ConversationMemory | None,
    ) -> dict:
        settings = get_settings()
        preferences = (
            memory.get_preferences()
            if memory is not None
            else None
        )

        return {
            "query": redis_cache.normalize_query(
                message
            ),
            "query_language": detect_query_language(
                message
            ),
            "index_version": pipeline.cache_version,
            "model": settings.openai_chat_model or settings.model_name,
            "preferred_language": (
                preferences.language
                if preferences is not None
                else None
            ),
            "preferred_style": (
                preferences.style
                if preferences is not None
                else None
            ),
            "pipeline": {
                "top_k_vector": pipeline.options.top_k_vector,
                "top_k_bm25": pipeline.options.top_k_bm25,
                "top_k_fused": pipeline.options.top_k_fused,
                "top_k_rerank": pipeline.options.top_k_rerank,
                "use_reranker": pipeline.options.use_reranker,
                "max_context_chars": pipeline.options.max_context_chars,
            },
        }

    def _restore_result_cache_hit(
        self,
        cached: dict,
        message: str,
        memory: ConversationMemory | None,
        latency_ms: float,
    ) -> QueryResult | None:
        try:
            result = QueryResult.model_validate(
                cached
            ).model_copy(
                update={
                    "query": message,
                    "cache_hit": True,
                    "latency_ms": latency_ms,
                }
            )
        except Exception as exc:
            logger.warning(
                "Invalid Redis QueryResult cache entry: %s",
                exc,
            )
            return None

        # Pipeline.run() was skipped, so preserve conversation continuity here.
        if memory is not None:
            if result.answer_language in {
                "vi",
                "en",
            }:
                memory.update_preferences(
                    language=result.answer_language
                )

            memory.add_turn(
                query=message,
                answer=result.answer,
                answer_status=result.answer_status,
            )

        return result

    def classify_query(
        self,
        message: str,
    ) -> dict:
        """Check whether the question requires document retrieval."""

        message = message.strip()

        if not message:
            raise ValueError(
                "Message không được để trống."
            )

        # route_query itself now uses Redis route cache.
        route = route_query(message)

        return {
            "needs_retrieval": route.scope in RAG_SCOPES,
            "route_intent": route.intent,
            "route_scope": route.scope,
        }

    def _update_memory_preferences(
        self,
        message: str,
        memory: ConversationMemory | None,
    ) -> None:
        if memory is None:
            return

        # No dedicated semantic-preference LLM call here. Clear persistent
        # preferences are captured locally; nuanced/ambiguous wording is left
        # to the main answer model, which already sees the query + history.
        preference_intent = _detect_explicit_preference(message)

        detected_language = detect_query_language(
            message
        )

        current_language = (
            memory.get_preferences().language
        )

        is_low_information_message = (
            self._is_low_information_message(
                message
            )
        )

        if preference_intent == "language_vi":
            memory.update_preferences(
                language="vi"
            )

        elif preference_intent == "language_en":
            memory.update_preferences(
                language="en"
            )

        elif (
            detected_language == "en"
            and (
                current_language is None
                or (
                    current_language != "en"
                    and not is_low_information_message
                )
            )
        ):
            memory.update_preferences(
                language="en"
            )

        elif (
            detected_language == "vi"
            and (
                current_language is None
                or (
                    current_language != "vi"
                    and not is_low_information_message
                )
            )
        ):
            memory.update_preferences(
                language="vi"
            )

        if preference_intent in {
            "shorter",
            "simpler",
        }:
            memory.update_preferences(
                style=preference_intent
            )

    def _ask_impl(
        self,
        message: str,
        session_id: str | None = None,
        on_token: Callable[[str], None] | None = None,
        on_status: Callable[[str, dict], None] | None = None,
        should_cancel: Callable[[], bool] | None = None,
    ) -> QueryResult:
        """Send a question through the RAG pipeline, optionally streaming model chunks."""

        message = message.strip()
        if not message:
            raise ValueError("Message không được để trống.")

        def raise_if_cancelled() -> None:
            if should_cancel is not None and should_cancel():
                raise StreamingCancelled("Streaming client disconnected")

        started_at = time.perf_counter()
        settings = get_settings()
        pipeline = self._get_pipeline()
        memory = self._get_memory(session_id)

        raise_if_cancelled()
        preference_started = time.perf_counter()
        observed_call("rag.preference", self._update_memory_preferences, message, memory)
        preference_ms = round(
            (time.perf_counter() - preference_started) * 1000.0,
            1,
        )
        logger.debug(
            "Chat preference stage ms=%s",
            preference_ms,
        )
        raise_if_cancelled()

        is_independent_turn = (
            memory is None
            or memory.turn_count == 0
        )

        # Follow-ups are context-dependent, so cross-user result caching is unsafe.
        if not is_independent_turn:
            return pipeline.run(
                query=message,
                memory=memory,
                on_token=on_token,
                on_status=on_status,
                should_cancel=should_cancel,
            )

        cache_payload = self._result_cache_payload(
            message=message,
            pipeline=pipeline,
            memory=memory,
        )

        cached = redis_cache.get_json(
            "result",
            cache_payload,
        )

        if cached is not None:
            restored = self._restore_result_cache_hit(
                cached=cached,
                message=message,
                memory=memory,
                latency_ms=round(
                    (time.perf_counter() - started_at) * 1000,
                    1,
                ),
            )
            if restored is not None:
                logger.debug("Redis QueryResult cache HIT")
                if on_status is not None:
                    on_status(
                        "answering",
                        {
                            "route_intent": restored.route_intent,
                            "route_scope": restored.route_scope,
                            "needs_retrieval": restored.route_scope in RAG_SCOPES,
                            "cache_hit": True,
                        },
                    )
                if on_token is not None and restored.answer:
                    on_token(restored.answer)
                return restored

        result_cache_key = redis_cache.make_key(
            "result",
            cache_payload,
        )
        lock_key = f"{result_cache_key}:singleflight"
        lock_context = redis_cache.lock(
            key=lock_key,
            ttl_seconds=settings.redis_lock_ttl_seconds,
            wait_seconds=settings.redis_lock_wait_seconds,
        )

        raise_if_cancelled()
        with lock_context:
            raise_if_cancelled()

            cached = redis_cache.get_json(
                "result",
                cache_payload,
            )
            if cached is not None:
                restored = self._restore_result_cache_hit(
                    cached=cached,
                    message=message,
                    memory=memory,
                    latency_ms=round(
                        (time.perf_counter() - started_at) * 1000,
                        1,
                    ),
                )
                if restored is not None:
                    logger.debug(
                        "Redis QueryResult cache HIT after single-flight wait"
                    )
                    if on_status is not None:
                        on_status(
                            "answering",
                            {
                                "route_intent": restored.route_intent,
                                "route_scope": restored.route_scope,
                                "needs_retrieval": restored.route_scope in RAG_SCOPES,
                                "cache_hit": True,
                            },
                        )
                    if on_token is not None and restored.answer:
                        on_token(restored.answer)
                    return restored

            result = pipeline.run(
                query=message,
                memory=memory,
                on_token=on_token,
                on_status=on_status,
                should_cancel=should_cancel,
            )

            if (
                result.answer_status == "answered"
                and result.route_scope in RAG_SCOPES
                and result.guardrail_passed
            ):
                redis_cache.set_json(
                    "result",
                    cache_payload,
                    result.model_dump(mode="json"),
                    settings.redis_result_cache_ttl_seconds,
                )

            return result

    def ask(
        self,
        message: str,
        session_id: str | None = None,
        on_token: Callable[[str], None] | None = None,
        on_status: Callable[[str, dict], None] | None = None,
        should_cancel: Callable[[], bool] | None = None,
        user_id: str | None = None,
    ) -> QueryResult:
        """Root production trace including Redis cache hits and the full chat request."""
        normalized_message = message.strip()
        if not normalized_message:
            raise ValueError("Message không được để trống.")

        with rag_trace(
            query=normalized_message,
            user_id=user_id,
            session_id=session_id,
        ) as root:
            result = self._ask_impl(
                message=normalized_message,
                session_id=session_id,
                on_token=on_token,
                on_status=on_status,
                should_cancel=should_cancel,
            )
            record_trace_result(root, result)
            return result

    def reload_pipeline(self) -> None:
        """Reset pipeline after rebuilding Chroma/BM25."""

        with self._lock:
            self._pipeline = None
            self._memories.clear()

chat_service = ChatService()