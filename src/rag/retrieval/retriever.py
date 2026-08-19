from __future__ import annotations

import os
import pickle
import re
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from contextvars import copy_context
from dataclasses import dataclass
from pathlib import Path
from threading import RLock

import chromadb
from langchain_openai import OpenAIEmbeddings

from src.config import get_settings
from src.observability.instrumentation import observed_call
from src.rag.retrieval.bm25_store import (
    BM25StorePayload,
    tokenize_for_bm25,
)
from src.rag.retrieval.vector_store import COLLECTION_NAME
from src.rag.schemas import DocumentChunk


EMBEDDING_CACHE_MAX_SIZE = 512

# Vector search waits on an embedding/network path while BM25 is local CPU.
# Running both concurrently preserves identical hit sets and RRF behavior while
# shaving the BM25 work off the critical path.
_HYBRID_SEARCH_WORKERS = max(
    2,
    int(os.getenv("RAG_HYBRID_SEARCH_WORKERS", "8")),
)

_HYBRID_SEARCH_EXECUTOR = ThreadPoolExecutor(
    max_workers=_HYBRID_SEARCH_WORKERS,
    thread_name_prefix="rag-hybrid",
)


# =============================================================================
# Retrieval models
# =============================================================================

@dataclass
class RetrievalHit:
    chunk_id: str
    chunk: DocumentChunk
    score: float
    source: str
    rank: int

    def to_dict(self) -> dict:
        return {
            "chunk_id": self.chunk_id,
            "score": self.score,
            "source": self.source,
            "rank": self.rank,
            "document_name": self.chunk.document_name,
            "document_type": self.chunk.document_type,
            "source_priority": self.chunk.source_priority,
            "page": self.chunk.page,
            "section": self.chunk.section,
            "topic": self.chunk.topic,
            "content_original": self.chunk.content_original,
        }


@dataclass
class RetrievalResult:
    query: str
    search_queries: list[str]
    vector_hits: list[RetrievalHit]
    bm25_hits: list[RetrievalHit]
    fused_hits: list[RetrievalHit]


# =============================================================================
# Hybrid Retriever
# =============================================================================

class HybridRetriever:
    """Hybrid retriever using Chroma vector search + BM25."""

    def __init__(
        self,
        chroma_dir: Path,
        bm25_path: Path,
        collection_name: str = COLLECTION_NAME,
    ) -> None:
        self.chroma_dir = Path(chroma_dir)
        self.bm25_path = Path(bm25_path)
        self.collection_name = collection_name

        self._bm25_payload = self._load_bm25_payload()

        self._chunks_by_id: dict[str, DocumentChunk] = {
            chunk["chunk_id"]: DocumentChunk.model_validate(chunk)
            for chunk in self._bm25_payload.chunks
        }

        # Reuse vector-search resources inside the lifetime of this retriever.
        # This removes per-request client construction while preserving the
        # exact embedding model, query text, Chroma collection and scoring.
        self._embeddings: OpenAIEmbeddings | None = None
        self._chroma_client = None
        self._chroma_collection = None
        self._vector_init_lock = RLock()

        # Exact LRU cache for query embeddings.
        # Key = (embedding_model, exact tuple of prepared queries).
        # No fuzzy matching / normalization beyond the existing preparation
        # path, so retrieval behavior remains unchanged.
        self._embedding_cache: OrderedDict[
            tuple[str, tuple[str, ...]],
            tuple[tuple[float, ...], ...],
        ] = OrderedDict()
        self._embedding_cache_lock = RLock()

    def _ensure_vector_resources(self) -> None:
        """Lazy-init and reuse OpenAI embeddings + Chroma resources."""

        if (
            self._embeddings is not None
            and self._chroma_client is not None
            and self._chroma_collection is not None
        ):
            return

        with self._vector_init_lock:
            if (
                self._embeddings is not None
                and self._chroma_client is not None
                and self._chroma_collection is not None
            ):
                return

            settings = get_settings()

            if not settings.openai_api_key:
                raise RuntimeError(
                    "OPENAI_API_KEY is required for vector retrieval"
                )

            self._embeddings = OpenAIEmbeddings(
                model=settings.openai_embedding_model,
                api_key=settings.openai_api_key,
            )

            self._chroma_client = chromadb.PersistentClient(
                path=str(self.chroma_dir)
            )

            self._chroma_collection = self._chroma_client.get_collection(
                self.collection_name
            )

    def _embed_queries(
        self,
        queries: list[str],
    ) -> list[list[float]]:
        """Embed exact prepared queries with a bounded in-process LRU cache."""

        if not queries:
            return []

        self._ensure_vector_resources()

        settings = get_settings()
        cache_key = (
            settings.openai_embedding_model,
            tuple(queries),
        )

        with self._embedding_cache_lock:
            cached = self._embedding_cache.get(cache_key)
            if cached is not None:
                self._embedding_cache.move_to_end(cache_key)
                return [
                    list(vector)
                    for vector in cached
                ]

        # Same call as before; only the client object is reused.
        vectors = self._embeddings.embed_documents(queries)

        frozen_vectors = tuple(
            tuple(float(value) for value in vector)
            for vector in vectors
        )

        with self._embedding_cache_lock:
            self._embedding_cache[cache_key] = frozen_vectors
            self._embedding_cache.move_to_end(cache_key)

            while len(self._embedding_cache) > EMBEDDING_CACHE_MAX_SIZE:
                self._embedding_cache.popitem(last=False)

        return [
            list(vector)
            for vector in frozen_vectors
        ]

    def retrieve(
        self,
        query: str,
        top_k_vector: int = 10,
        top_k_bm25: int = 10,
        top_k_fused: int = 5,
        allowed_document_types: list[str] | None = None,
        search_queries: list[str] | None = None,
    ) -> RetrievalResult:
        """Run hybrid retrieval.

        Query expansion/translation must happen before this method is called.

        Args:
            query:
                Main retrieval query.

            top_k_vector:
                Maximum number of vector hits.

            top_k_bm25:
                Maximum number of BM25 hits.

            top_k_fused:
                Maximum number of final RRF hits.

            allowed_document_types:
                Optional document scope filter.

            search_queries:
                Optional additional retrieval query variants.
                If omitted, only `query` is used.

        Returns:
            RetrievalResult containing vector, BM25, and fused hits.
        """

        queries = _prepare_search_queries(
            query=query,
            search_queries=search_queries,
        )

        if not queries:
            return RetrievalResult(
                query=query,
                search_queries=[],
                vector_hits=[],
                bm25_hits=[],
                fused_hits=[],
            )

        # -----------------------------------------------------------------
        # Hybrid search in parallel
        # -----------------------------------------------------------------
        # These branches are independent and read-only with respect to the
        # indexed corpus. We still wait for BOTH and feed the exact same lists
        # into the exact same filtering/RRF code below.
        vector_context = copy_context()
        bm25_context = copy_context()

        vector_future = _HYBRID_SEARCH_EXECUTOR.submit(
            vector_context.run,
            observed_call,
            "rag.vector_search",
            self.vector_search,
            queries,
            top_k_vector,
        )
        bm25_future = _HYBRID_SEARCH_EXECUTOR.submit(
            bm25_context.run,
            observed_call,
            "rag.bm25_search",
            self.bm25_search,
            queries,
            top_k_bm25,
        )

        vector_hits = vector_future.result()
        bm25_hits = bm25_future.result()

        # -----------------------------------------------------------------
        # Source-scope filtering
        # -----------------------------------------------------------------

        vector_hits = filter_allowed_document_types(
            vector_hits,
            allowed_document_types,
        )

        bm25_hits = filter_allowed_document_types(
            bm25_hits,
            allowed_document_types,
        )

        # -----------------------------------------------------------------
        # Reciprocal Rank Fusion
        # -----------------------------------------------------------------

        fused_hits = observed_call(
            "rag.rrf",
            reciprocal_rank_fusion,
            vector_hits=vector_hits,
            bm25_hits=bm25_hits,
            top_k=top_k_fused,
        )

        # Deterministic exact-document safeguard:
        # If the CURRENT retrieval query explicitly asks for "Form N", make
        # sure chunks from Form-N survive the candidate cut. Semantic query
        # expansion can otherwise flood top-k with a different form.
        explicit_form_number = _extract_explicit_form_number(query)

        if explicit_form_number:
            fused_hits = _pin_exact_form_hits(
                fused_hits=fused_hits,
                chunks_by_id=self._chunks_by_id,
                form_number=explicit_form_number,
                top_k=top_k_fused,
                allowed_document_types=allowed_document_types,
            )
        elif _is_form_listing_query(query):
            fused_hits = _pin_all_form_hits(
                fused_hits=fused_hits,
                chunks_by_id=self._chunks_by_id,
                top_k=top_k_fused,
            )

        return RetrievalResult(
            query=query,
            search_queries=queries,
            vector_hits=vector_hits,
            bm25_hits=bm25_hits,
            fused_hits=fused_hits,
        )

    # =========================================================================
    # Vector search
    # =========================================================================

    def vector_search(
        self,
        queries: list[str],
        top_k: int,
    ) -> list[RetrievalHit]:
        """Search ChromaDB using OpenAI embeddings."""

        if not queries:
            return []

        if not self._chunks_by_id:
            return []

        self._ensure_vector_resources()

        query_vectors = observed_call(
            "rag.embedding",
            self._embed_queries,
            queries,
            _as_type="embedding",
        )

        n_results = min(
            top_k,
            len(self._chunks_by_id),
        )

        if n_results <= 0:
            return []

        response = self._chroma_collection.query(
            query_embeddings=query_vectors,
            n_results=n_results,
            include=["distances"],
        )

        best_by_chunk: dict[
            str,
            float,
        ] = {}

        ids_by_query = response.get(
            "ids",
            [],
        )

        distances_by_query = response.get(
            "distances",
            [],
        )

        for ids, distances in zip(
            ids_by_query,
            distances_by_query,
            strict=False,
        ):
            for chunk_id, distance in zip(
                ids,
                distances,
                strict=False,
            ):
                if chunk_id not in self._chunks_by_id:
                    continue

                score = (
                    1.0
                    / (
                        1.0
                        + float(distance)
                    )
                )

                previous_score = best_by_chunk.get(
                    chunk_id
                )

                if (
                    previous_score is None
                    or score > previous_score
                ):
                    best_by_chunk[
                        chunk_id
                    ] = score

        ranked = sorted(
            best_by_chunk.items(),
            key=lambda item: item[1],
            reverse=True,
        )

        return [
            RetrievalHit(
                chunk_id=chunk_id,
                chunk=self._chunks_by_id[
                    chunk_id
                ],
                score=score,
                source="vector",
                rank=rank,
            )
            for rank, (
                chunk_id,
                score,
            ) in enumerate(
                ranked[:top_k],
                start=1,
            )
        ]

    # =========================================================================
    # BM25 search
    # =========================================================================

    def bm25_search(
        self,
        queries: list[str],
        top_k: int,
    ) -> list[RetrievalHit]:
        """Search the BM25 index."""

        if not queries:
            return []

        scores_by_chunk: dict[
            str,
            float,
        ] = {}

        for query in queries:
            tokens = tokenize_for_bm25(
                query
            )

            if not tokens:
                continue

            scores = (
                self._bm25_payload
                .bm25
                .get_scores(tokens)
            )

            for index, score in enumerate(
                scores
            ):
                if (
                    index
                    >= len(
                        self._bm25_payload.chunk_ids
                    )
                ):
                    continue

                chunk_id = (
                    self._bm25_payload
                    .chunk_ids[index]
                )

                if chunk_id not in self._chunks_by_id:
                    continue

                numeric_score = float(
                    score
                )

                previous_score = (
                    scores_by_chunk.get(
                        chunk_id,
                        0.0,
                    )
                )

                if numeric_score > previous_score:
                    scores_by_chunk[
                        chunk_id
                    ] = numeric_score

        ranked = sorted(
            scores_by_chunk.items(),
            key=lambda item: item[1],
            reverse=True,
        )

        return [
            RetrievalHit(
                chunk_id=chunk_id,
                chunk=self._chunks_by_id[
                    chunk_id
                ],
                score=score,
                source="bm25",
                rank=rank,
            )
            for rank, (
                chunk_id,
                score,
            ) in enumerate(
                ranked[:top_k],
                start=1,
            )
            if score > 0
        ]

    # =========================================================================
    # BM25 loading
    # =========================================================================

    def _load_bm25_payload(
        self,
    ) -> BM25StorePayload:
        """Load the serialized BM25 store."""

        if not self.bm25_path.exists():
            raise FileNotFoundError(
                f"BM25 store not found: "
                f"{self.bm25_path}"
            )

        with self.bm25_path.open(
            "rb"
        ) as file:
            payload = pickle.load(
                file
            )

        if isinstance(
            payload,
            BM25StorePayload,
        ):
            return payload

        # Accept legacy payloads serialized from src.rag.* as long as they
        # expose the same fields used by the current retriever.
        required_attrs = (
            "tokenized_corpus",
            "chunk_ids",
            "chunks",
            "bm25",
        )

        if all(
            hasattr(payload, attr)
            for attr in required_attrs
        ):
            return BM25StorePayload(
                tokenized_corpus=list(payload.tokenized_corpus),
                chunk_ids=list(payload.chunk_ids),
                chunks=list(payload.chunks),
                bm25=payload.bm25,
            )

        if isinstance(payload, dict) and all(
            key in payload
            for key in required_attrs
        ):
            return BM25StorePayload(
                tokenized_corpus=list(payload["tokenized_corpus"]),
                chunk_ids=list(payload["chunk_ids"]),
                chunks=list(payload["chunks"]),
                bm25=payload["bm25"],
            )

        raise TypeError(
            "Invalid BM25 store payload. "
            "Please rebuild the RAG index."
        )


# =============================================================================
# Reciprocal Rank Fusion
# =============================================================================

def reciprocal_rank_fusion(
    vector_hits: list[RetrievalHit],
    bm25_hits: list[RetrievalHit],
    top_k: int,
    k: int = 60,
) -> list[RetrievalHit]:
    """Fuse vector and BM25 rankings using Reciprocal Rank Fusion."""

    scores: dict[str, float] = {}
    chunks: dict[
        str,
        DocumentChunk,
    ] = {}

    sources: dict[
        str,
        set[str],
    ] = {}

    for hits in (
        vector_hits,
        bm25_hits,
    ):
        for rank, hit in enumerate(
            hits,
            start=1,
        ):
            scores[
                hit.chunk_id
            ] = (
                scores.get(
                    hit.chunk_id,
                    0.0,
                )
                + 1.0
                / (
                    k
                    + rank
                )
            )

            chunks[
                hit.chunk_id
            ] = hit.chunk

            sources.setdefault(
                hit.chunk_id,
                set(),
            ).add(
                hit.source
            )

    ranked = sorted(
        scores.items(),
        key=lambda item: item[1],
        reverse=True,
    )

    results: list[
        RetrievalHit
    ] = []

    for rank, (
        chunk_id,
        score,
    ) in enumerate(
        ranked[:top_k],
        start=1,
    ):
        source_names = sorted(
            sources.get(
                chunk_id,
                set(),
            )
        )

        source_label = (
            "rrf:"
            + "+".join(
                source_names
            )
        )

        results.append(
            RetrievalHit(
                chunk_id=chunk_id,
                chunk=chunks[
                    chunk_id
                ],
                score=score,
                source=source_label,
                rank=rank,
            )
        )

    return results


# =============================================================================
# Document scope filtering
# =============================================================================

def filter_allowed_document_types(
    hits: list[RetrievalHit],
    allowed_document_types: list[str] | None,
) -> list[RetrievalHit]:
    """Keep only chunks belonging to the selected route scope."""

    if not allowed_document_types:
        return hits

    allowed = set(
        allowed_document_types
    )

    filtered = [
        hit
        for hit in hits
        if hit.chunk.document_type
        in allowed
    ]

    return [
        RetrievalHit(
            chunk_id=hit.chunk_id,
            chunk=hit.chunk,
            score=hit.score,
            source=hit.source,
            rank=rank,
        )
        for rank, hit in enumerate(
            filtered,
            start=1,
        )
    ]


# =============================================================================
# Helpers
# =============================================================================

def _extract_explicit_form_number(query: str) -> str | None:
    """Return an explicitly requested Form number from the CURRENT query."""
    match = re.search(
        r"\bform\s*[-_#:]?\s*(\d+(?:\.\d+)?)\b",
        query or "",
        flags=re.IGNORECASE,
    )
    return match.group(1) if match else None


def _normalize_form_query(value: str) -> str:
    """Normalize Vietnamese/English form requests for deterministic matching."""
    import unicodedata

    text = unicodedata.normalize(
        "NFKD",
        (value or "").lower(),
    )
    text = "".join(
        char
        for char in text
        if not unicodedata.combining(char)
    )
    text = text.replace("đ", "d")
    return " ".join(text.split())


def _is_form_listing_query(query: str) -> bool:
    """True when the user asks for all/list of internship forms."""
    normalized = _normalize_form_query(query)

    if "form" not in normalized:
        return False

    return any(
        phrase in normalized
        for phrase in (
            "tat ca form",
            "tat ca cac form",
            "toan bo form",
            "toan bo cac form",
            "cac form",
            "danh sach form",
            "liet ke form",
            "nhung form nao",
            "bao nhieu form",
            "all forms",
            "all the forms",
            "list forms",
            "which forms",
            "how many forms",
        )
    )


def _form_number_from_document_name(document_name: str) -> str | None:
    match = re.search(
        r"form[-_ ]?(\d+)",
        document_name or "",
        flags=re.IGNORECASE,
    )
    return match.group(1) if match else None


def _pin_all_form_hits(
    fused_hits: list[RetrievalHit],
    chunks_by_id: dict[str, DocumentChunk],
    top_k: int,
) -> list[RetrievalHit]:
    """Guarantee one representative chunk for every available official form.

    Form files are deterministic resources, not fuzzy semantic concepts. When
    the user asks for all forms, keep exactly one chunk per Form-N document in
    the candidate set so Form 1/2/3/4 cannot disappear because of semantic
    expansion or reranking noise.
    """
    if top_k <= 0:
        return []

    representatives: dict[str, DocumentChunk] = {}

    for chunk in chunks_by_id.values():
        if chunk.document_type not in {"form", "agreement"}:
            continue

        form_number = _form_number_from_document_name(
            chunk.document_name
        )
        if not form_number:
            continue

        current = representatives.get(form_number)
        if current is None:
            representatives[form_number] = chunk
            continue

        # Prefer the earliest/most representative chunk deterministically.
        current_key = (
            current.page if current.page is not None else 10**9,
            current.chunk_id,
        )
        candidate_key = (
            chunk.page if chunk.page is not None else 10**9,
            chunk.chunk_id,
        )
        if candidate_key < current_key:
            representatives[form_number] = chunk

    if not representatives:
        return fused_hits[:top_k]

    def form_sort_key(item: tuple[str, DocumentChunk]) -> tuple[int, str]:
        number, chunk = item
        try:
            numeric = int(number)
        except ValueError:
            numeric = 10**9
        return numeric, chunk.document_name.lower()

    pinned_chunks = [
        chunk
        for _, chunk in sorted(
            representatives.items(),
            key=form_sort_key,
        )
    ]

    pinned_ids = {
        chunk.chunk_id
        for chunk in pinned_chunks
    }

    combined: list[RetrievalHit] = [
        RetrievalHit(
            chunk_id=chunk.chunk_id,
            chunk=chunk,
            score=1.0,
            source="all_forms",
            rank=0,
        )
        for chunk in pinned_chunks
    ]

    combined.extend(
        hit
        for hit in fused_hits
        if hit.chunk_id not in pinned_ids
    )

    return [
        RetrievalHit(
            chunk_id=hit.chunk_id,
            chunk=hit.chunk,
            score=hit.score,
            source=hit.source,
            rank=rank,
        )
        for rank, hit in enumerate(
            combined[:top_k],
            start=1,
        )
    ]


def _pin_exact_form_hits(
    fused_hits: list[RetrievalHit],
    chunks_by_id: dict[str, DocumentChunk],
    form_number: str,
    top_k: int,
    allowed_document_types: list[str] | None,
) -> list[RetrievalHit]:
    """Pin the explicitly named Form-N document into the fused candidate set.

    This does not replace semantic retrieval. It only prevents an exact
    document request such as "mẫu Form 1" from being lost when expansion
    produces semantically related Form-4 candidates.
    """
    if top_k <= 0:
        return []

    allowed = set(allowed_document_types or [])
    form_pattern = re.compile(
        rf"form[-_ ]?{re.escape(form_number)}(?:\D|$)",
        flags=re.IGNORECASE,
    )

    exact_chunks: list[DocumentChunk] = []
    for chunk in chunks_by_id.values():
        if allowed and chunk.document_type not in allowed:
            continue
        if form_pattern.search(chunk.document_name or ""):
            exact_chunks.append(chunk)

    if not exact_chunks:
        return fused_hits[:top_k]

    # Stable ordering; pin at most two chunks so multi-page Form 4 does not
    # crowd every other useful candidate out of the RRF set.
    exact_chunks.sort(
        key=lambda chunk: (
            chunk.source_priority,
            chunk.document_name.lower(),
            chunk.chunk_id,
        )
    )
    exact_chunks = exact_chunks[:2]

    exact_ids = {chunk.chunk_id for chunk in exact_chunks}
    combined: list[RetrievalHit] = [
        RetrievalHit(
            chunk_id=chunk.chunk_id,
            chunk=chunk,
            score=1.0,
            source="exact_form",
            rank=0,
        )
        for chunk in exact_chunks
    ]

    combined.extend(
        hit
        for hit in fused_hits
        if hit.chunk_id not in exact_ids
    )

    return [
        RetrievalHit(
            chunk_id=hit.chunk_id,
            chunk=hit.chunk,
            score=hit.score,
            source=hit.source,
            rank=rank,
        )
        for rank, hit in enumerate(
            combined[:top_k],
            start=1,
        )
    ]


def _prepare_search_queries(
    query: str,
    search_queries: list[str] | None,
) -> list[str]:
    """Normalize and deduplicate retrieval query variants."""

    candidates = [
        query,
        *(search_queries or []),
    ]

    seen: set[str] = set()
    result: list[str] = []

    for value in candidates:
        normalized = " ".join(
            (value or "")
            .strip()
            .split()
        )

        key = normalized.lower()

        if (
            normalized
            and key not in seen
        ):
            seen.add(
                key
            )

            result.append(
                normalized
            )

    return result