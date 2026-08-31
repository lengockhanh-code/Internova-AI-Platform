from __future__ import annotations

import logging
import json
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
    RouteDecision,
    route_query,
)
from src.rag.schemas import QueryResult
from src.services.redis_cache_service import redis_cache
from src.observability.instrumentation import observed_call, rag_trace, record_trace_result


logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).resolve().parents[2]

CHROMA_DIR = ROOT_DIR / "data" / "chroma"
BM25_PATH = ROOT_DIR / "data" / "rag" / "bm25.pkl"
ACTIVE_INDEX_POINTER = ROOT_DIR / "data" / "rag" / "active_index.json"

RAG_SCOPES = {
    "rag",
    "internship",
    "career",
    "capstone",
    "knowledge",
}



class ChatService:
    def __init__(self) -> None:
        self._pipeline: QueryPipeline | None = None
        self._pipeline_pointer_signature: tuple[bool, int, int] | None = None
        self._lock = Lock()
        self._memories: dict[str, ConversationMemory] = {}


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

    def forget_memory(self, session_id: str) -> None:
        """Remove in-process conversation memory for a deleted session."""
        self._memories.pop(session_id, None)

    def restore_memory(
        self,
        session_id: str,
        turns: list,
    ) -> ConversationMemory:
        """Rebuild in-process conversation memory from persisted chat history.

        This is deterministic and performs no LLM call. It lets the ONE semantic
        router see follow-up context after refresh/restart while keeping user facts
        separate from assistant responses.
        """
        memory = ConversationMemory(session_id=session_id)

        pending_user: str | None = None
        for turn in turns or []:
            if isinstance(turn, dict):
                role = str(turn.get("role") or "").upper()
                content = str(turn.get("content") or "")
                status = str(turn.get("answer_status") or "answered")
            else:
                mapping = getattr(turn, "_mapping", None)
                if mapping is not None:
                    role = str(mapping.get("role") or "").upper()
                    content = str(mapping.get("content") or "")
                    status = str(mapping.get("answer_status") or "answered")
                else:
                    role = str(getattr(turn, "role", "") or "").upper()
                    content = str(getattr(turn, "content", "") or "")
                    status = str(getattr(turn, "answer_status", "answered") or "answered")

            if role == "USER":
                pending_user = content.strip() or None
                continue

            if role == "ASSISTANT" and pending_user:
                memory.add_turn(
                    query=pending_user,
                    answer=content,
                    answer_status=status,
                )
                pending_user = None

        self._memories[session_id] = memory
        return memory


    def _active_index_pointer_signature(self) -> tuple[bool, int, int]:
        """Return a cheap process-local signature for active_index.json."""

        try:
            stat = ACTIVE_INDEX_POINTER.stat()
        except FileNotFoundError:
            return (False, 0, 0)

        return (
            True,
            int(stat.st_mtime_ns),
            int(stat.st_size),
        )

    def _resolve_active_index_paths(
        self,
        *,
        strict: bool = False,
    ) -> tuple[Path, Path]:
        """Resolve the persisted active RAG index.

        Startup may fall back to the canonical index for backward compatibility.
        Runtime hot reload uses strict=True so an invalid new pointer never replaces
        an already-working pipeline.
        """

        if not ACTIVE_INDEX_POINTER.exists():
            if strict:
                raise FileNotFoundError(
                    f"Active RAG index pointer not found: {ACTIVE_INDEX_POINTER}"
                )

            return CHROMA_DIR, BM25_PATH

        try:
            payload = json.loads(
                ACTIVE_INDEX_POINTER.read_text(encoding="utf-8")
            )

            chroma_value = str(
                payload.get("chroma_dir") or ""
            ).strip()

            bm25_value = str(
                payload.get("bm25_path") or ""
            ).strip()

            if not chroma_value or not bm25_value:
                raise ValueError(
                    "Active index pointer is incomplete."
                )

            chroma_dir = Path(chroma_value)
            bm25_path = Path(bm25_value)

            if not chroma_dir.is_absolute():
                chroma_dir = ROOT_DIR / chroma_dir

            if not bm25_path.is_absolute():
                bm25_path = ROOT_DIR / bm25_path

            chroma_dir = chroma_dir.resolve()
            bm25_path = bm25_path.resolve()

            if not chroma_dir.is_dir():
                raise FileNotFoundError(
                    f"Active Chroma directory not found: {chroma_dir}"
                )

            if not bm25_path.is_file():
                raise FileNotFoundError(
                    f"Active BM25 index not found: {bm25_path}"
                )

            return chroma_dir, bm25_path

        except Exception as exc:
            if strict:
                raise RuntimeError(
                    "Invalid active RAG index pointer."
                ) from exc

            logger.exception(
                "Invalid active RAG index pointer; "
                "falling back to canonical index: %s",
                exc,
            )

            return CHROMA_DIR, BM25_PATH

    def _persist_active_index_paths(
        self,
        chroma_dir: Path,
        bm25_path: Path,
    ) -> None:
        """Atomically persist which RAG index should survive process restarts."""

        chroma_dir = Path(chroma_dir).resolve()
        bm25_path = Path(bm25_path).resolve()

        try:
            chroma_value = chroma_dir.relative_to(ROOT_DIR).as_posix()
        except ValueError:
            chroma_value = chroma_dir.as_posix()

        try:
            bm25_value = bm25_path.relative_to(ROOT_DIR).as_posix()
        except ValueError:
            bm25_value = bm25_path.as_posix()

        payload = {
            "chroma_dir": chroma_value,
            "bm25_path": bm25_value,
            "activated_at_unix": int(time.time()),
        }

        ACTIVE_INDEX_POINTER.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        temp_pointer = ACTIVE_INDEX_POINTER.with_suffix(".json.tmp")

        temp_pointer.write_text(
            json.dumps(
                payload,
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        temp_pointer.replace(ACTIVE_INDEX_POINTER)


    def _create_pipeline(
        self,
        chroma_dir: Path,
        bm25_path: Path,
    ) -> QueryPipeline:
        """Create and fully initialize a RAG pipeline for the given index."""

        options = PipelineOptions(
            top_k_vector=6,
            top_k_bm25=6,
            top_k_fused=5,
            top_k_rerank=3,
            use_reranker=True,
            use_openai_translation=False,
            max_context_chars=4000,

            # Keep automatic Vietnamese/English response selection.
            answer_language=None,
        )

        return QueryPipeline(
            chroma_dir=Path(chroma_dir),
            bm25_path=Path(bm25_path),
            options=options,
        )

    def _get_pipeline(self) -> QueryPipeline:
        """Return the active pipeline and hot-reload it when the pointer changes."""

        # --------------------------------------------------------------
        # First process-local load.
        # --------------------------------------------------------------

        if self._pipeline is None:
            with self._lock:
                if self._pipeline is None:
                    pointer_signature = self._active_index_pointer_signature()

                    chroma_dir, bm25_path = self._resolve_active_index_paths()

                    candidate = self._create_pipeline(
                        chroma_dir=chroma_dir,
                        bm25_path=bm25_path,
                    )

                    self._pipeline = candidate
                    self._pipeline_pointer_signature = pointer_signature

                    logger.info(
                        "Loaded initial RAG pipeline chroma=%s bm25=%s",
                        chroma_dir,
                        bm25_path,
                    )

            assert self._pipeline is not None
            return self._pipeline

        # --------------------------------------------------------------
        # Cheap hot-reload detection.
        # --------------------------------------------------------------

        try:
            pointer_signature = self._active_index_pointer_signature()
        except OSError as exc:
            logger.warning(
                "Could not stat active RAG index pointer; "
                "keeping current pipeline: %s",
                exc,
            )
            return self._pipeline

        if pointer_signature == self._pipeline_pointer_signature:
            return self._pipeline

        # --------------------------------------------------------------
        # Pointer changed.
        #
        # Only one request in this worker performs the reload.
        # Other concurrent requests continue using the current pipeline
        # instead of blocking behind an expensive pipeline construction.
        # --------------------------------------------------------------

        if not self._lock.acquire(blocking=False):
            return self._pipeline

        try:
            # Another thread may already have reloaded while this request
            # was reaching the lock.
            try:
                pointer_signature = self._active_index_pointer_signature()
            except OSError as exc:
                logger.warning(
                    "Could not stat active RAG index pointer during reload; "
                    "keeping current pipeline: %s",
                    exc,
                )
                return self._pipeline

            if pointer_signature == self._pipeline_pointer_signature:
                return self._pipeline

            try:
                chroma_dir, bm25_path = self._resolve_active_index_paths(
                    strict=True
                )

                candidate = self._create_pipeline(
                    chroma_dir=chroma_dir,
                    bm25_path=bm25_path,
                )

            except Exception as exc:
                logger.exception(
                    "Failed to hot-reload changed RAG index; "
                    "keeping current pipeline: %s",
                    exc,
                )

                # Do NOT update _pipeline_pointer_signature here.
                # The next request will retry the reload.
                return self._pipeline

            self._pipeline = candidate
            self._pipeline_pointer_signature = pointer_signature

            logger.info(
                "Hot-reloaded RAG pipeline chroma=%s bm25=%s",
                chroma_dir,
                bm25_path,
            )

            return candidate

        finally:
            self._lock.release()

    def install_pipeline(
    self,
    chroma_dir: Path,
    bm25_path: Path,
    *,
    persist: bool = False,
) -> None:
        """Atomically activate a fully built RAG index.

        The candidate pipeline is created before replacing the active pipeline.
        Therefore, if the new index cannot be loaded, the currently active
        chatbot pipeline remains untouched.

        Requests already in progress keep their local reference to the old
        pipeline and can finish normally.
        """

        chroma_dir = Path(chroma_dir)
        bm25_path = Path(bm25_path)

        if not chroma_dir.is_dir():
            raise FileNotFoundError(
                f"Chroma directory does not exist: {chroma_dir}"
            )

        if not bm25_path.is_file():
            raise FileNotFoundError(
                f"BM25 index does not exist: {bm25_path}"
            )

        # IMPORTANT:
        # Fully construct/validate the new pipeline BEFORE acquiring the swap
        # lock and BEFORE touching the currently active pipeline.
        candidate = self._create_pipeline(
            chroma_dir=chroma_dir,
            bm25_path=bm25_path,
        )
        with self._lock:
            pointer_signature = self._pipeline_pointer_signature

            if persist:
                self._persist_active_index_paths(
                    chroma_dir=chroma_dir,
                    bm25_path=bm25_path,
                )

                pointer_signature = self._active_index_pointer_signature()

            self._pipeline = candidate
            self._pipeline_pointer_signature = pointer_signature

        logger.info(
            "Activated RAG pipeline chroma=%s bm25=%s",
            chroma_dir,
            bm25_path,
        )

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
            "index_version": pipeline.cache_version,
            "model": settings.openai_chat_model or settings.model_name,
            # Invalidate old answer-cache entries whenever the semantic
            # orchestrator contract changes. Otherwise a corrected route can still
            # surface an answer cached under older intent/tool behavior.
            "semantic_orchestrator_version": 46,
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

        # Pipeline.run() was skipped: preserve the turn only. Semantic pre-routing
        # already owns session language; cache hits never create a preference.
        if memory is not None:
            memory.add_turn(
                query=message,
                answer=result.answer,
                answer_status=result.answer_status,
            )

        return result

    def prepare_route(
        self,
        message: str,
        session_id: str | None = None,
        runtime_context: str = "",
    ) -> RouteDecision:
        """Run exactly ONE semantic router call for this request."""
        message = message.strip()
        if not message:
            raise ValueError("Message không được để trống.")

        memory = self._get_memory(session_id)
        conversation_history = memory.get_context_window() if memory else ""

        if runtime_context.strip():
            conversation_history = (
                conversation_history
                + "\n\n[Structured Runtime State]\n"
                + runtime_context.strip()
            ).strip()

        # ORIGINAL current input remains untouched. The classifier sees history
        # separately so corrections/topic switches are not rewritten by heuristics.
        route = route_query(
            message,
            conversation_context=conversation_history,
        )

        if memory is not None:
            memory.apply_semantic_route(route)

        return route

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

    def _update_memory_preferences_from_route(
        self,
        route: RouteDecision | None,
        memory: ConversationMemory | None,
    ) -> None:
        """Persist only preferences explicitly marked persistent by the router."""
        if memory is None or route is None:
            return

        if (
            getattr(route, "persist_response_language", False)
            and getattr(route, "response_language", None) in {"vi", "en"}
        ):
            memory.update_preferences(
                language=getattr(route, "response_language")
            )

        if (
            getattr(route, "persist_response_style", False)
            and getattr(route, "response_style", None) in {"shorter", "simpler"}
        ):
            memory.update_preferences(
                style=getattr(route, "response_style")
            )

    def _ask_impl(
        self,
        message: str,
        session_id: str | None = None,
        on_token: Callable[[str], None] | None = None,
        on_status: Callable[[str, dict], None] | None = None,
        should_cancel: Callable[[], bool] | None = None,
        precomputed_route: RouteDecision | None = None,
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
        self._update_memory_preferences_from_route(
            precomputed_route,
            memory,
        )
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
                precomputed_route=precomputed_route,
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
                precomputed_route=precomputed_route,
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
        precomputed_route: RouteDecision | None = None,
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
                precomputed_route=precomputed_route,
            )
            record_trace_result(root, result)
            return result

    def reload_pipeline(self) -> None:
        """Reload the persisted active RAG index without clearing chat memory."""

        pointer_signature = self._active_index_pointer_signature()

        chroma_dir, bm25_path = self._resolve_active_index_paths(
            strict=self._pipeline is not None
        )

        candidate = self._create_pipeline(
            chroma_dir=chroma_dir,
            bm25_path=bm25_path,
        )

        with self._lock:
            self._pipeline = candidate
            self._pipeline_pointer_signature = pointer_signature

        logger.info(
            "Reloaded active RAG pipeline chroma=%s bm25=%s",
            chroma_dir,
            bm25_path,
        )

chat_service = ChatService()