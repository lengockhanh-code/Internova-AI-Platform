"""reranker.py — Step 4 of Query Pipeline (after Retrieval).

Reranks retrieved hits using a dedicated reranking model while preserving the
signal from the original Hybrid/RRF retrieval order.

IMPORTANT:
- This module no longer uses a generative LLM for reranking.
- Default model: Cohere ``rerank-v4.0-fast`` via the dedicated /v2/rerank API.
- Existing public function signatures and ``RerankResult.used_llm`` are kept for
  backward compatibility with the current Query Pipeline / observability code.
- If the reranker is unavailable, missing an API key, times out, or returns an
  invalid response, the function falls back to the original RRF order.

Strategy:
- Take the top retrieval candidates.
- Send the FULL chunk text to the dedicated reranker (no head/tail LLM prompt).
- Read relevance scores returned directly by the rerank endpoint.
- Fuse original retrieval rank and reranker rank using reciprocal-rank fusion.
- Return the top_k fused candidates.

Tối ưu theo chi phí / tốc độ / độ chính xác:
  1. [TỐC ĐỘ] Bỏ toàn bộ LLM generation, prompt, JSON-mode, output-token và
     parse-score path. Dedicated reranker trả index + relevance_score trực tiếp.
  2. [TỐC ĐỘ] Timeout ngắn và không retry trong request path; nếu dịch vụ rerank
     chậm/lỗi thì fallback RRF ngay để không kéo P95 latency của chatbot lên cao.
  3. [ĐỘ CHÍNH XÁC] Gửi toàn bộ content_original của chunk thay vì chỉ HEAD+TAIL,
     tránh mất thông tin quan trọng nằm giữa chunk.
  4. [ĐỘ CHÍNH XÁC] Reranker chuyên dụng có trọng số lớn hơn retrieval ban đầu
     (0.8 / 0.2), nhưng vẫn giữ RRF signal để chống các trường hợp reranker nhiễu.
  5. [CHI PHÍ + TỐC ĐỘ] Giữ early-exit và cache theo query + chunk_id + model.
  6. [TƯƠNG THÍCH] Giữ tên tham số use_llm và field used_llm để không phá code
     đang gọi module này. Chúng giờ mang nghĩa bật/đã dùng dedicated reranker.
"""
from __future__ import annotations

import json
import logging
import os
from collections import OrderedDict
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from src.config import get_settings
from src.rag.retrieval.retriever import RetrievalHit

logger = logging.getLogger(__name__)

RERANK_RRF_K = 60.0

# Dedicated reranker should drive the final ranking, while retrieval rank remains
# a stabilizing signal. Keep the legacy constant as an alias in case another
# module imports it.
RETRIEVAL_RANK_WEIGHT = 0.2
RERANK_RANK_WEIGHT = 0.8
LLM_RANK_WEIGHT = RERANK_RANK_WEIGHT  # backward-compatible alias; no LLM is used

# Conservative early-exit: only skip reranking on clearly separated results.
CONFIDENT_MARGIN_RATIO = 0.35

# Dedicated Cohere Rerank API configuration. Environment overrides let production
# tune model/timeout without changing this module.
RERANK_PROVIDER = "cohere"
RERANK_MODEL = os.getenv("RERANK_MODEL", "rerank-v4.0-fast")
RERANK_API_URL = os.getenv("RERANK_API_URL", "https://api.cohere.com/v2/rerank")
RERANK_TIMEOUT_SECONDS = float(os.getenv("RERANK_TIMEOUT_SECONDS", "5"))

# Cache trong tiến trình: (model, query, tuple(chunk_ids)) -> RerankResult.
# Giới hạn kích thước để không phình bộ nhớ vô hạn trong tiến trình chạy dài.
_RERANK_CACHE: "OrderedDict[tuple, RerankResult]" = OrderedDict()
_RERANK_CACHE_MAX_SIZE = 256


@dataclass
class RerankResult:
    hits: list[RetrievalHit]
    # Backward compatibility: existing pipeline may read this field. True now
    # means the dedicated reranker was used successfully; no generative LLM call.
    used_llm: bool
    fallback_reason: str | None = None

    @property
    def used_reranker(self) -> bool:
        """Explicit alias for new code without breaking existing callers."""
        return self.used_llm


def rerank_hits(
    query: str,
    hits: list[RetrievalHit],
    top_k: int = 5,
    use_llm: bool = True,
    max_candidates: int = 10,
) -> RerankResult:
    """Rerank retrieval hits using a dedicated reranking model.

    Args:
        query:          The user's search query.
        hits:           Retrieved hits to rerank (from hybrid search).
        top_k:          Number of hits to return after reranking.
        use_llm:        Backward-compatible switch. ``True`` now enables the
                        dedicated reranker; no generative LLM is used.
        max_candidates: Cap on candidates sent to the reranker to keep latency
                        bounded and preserve the existing pipeline contract.

    Returns:
        RerankResult with reranked hits and metadata.
    """
    if not hits:
        return RerankResult(hits=[], used_llm=False)

    # Không có gì để so sánh -> không cần gọi reranker.
    if len(hits) == 1:
        return RerankResult(
            hits=hits[:top_k],
            used_llm=False,
            fallback_reason="single_hit",
        )

    if not use_llm:
        return RerankResult(
            hits=hits[:top_k],
            used_llm=False,
            fallback_reason="reranker_disabled",
        )

    settings = get_settings()
    api_key = _get_cohere_api_key(settings)
    if not api_key:
        return RerankResult(
            hits=hits[:top_k],
            used_llm=False,
            fallback_reason="no_cohere_api_key",
        )

    candidates = hits[:max_candidates]

    # Early-exit khi retrieval đã rất tự tin để giảm latency/cost trên câu dễ.
    if _is_retrieval_confident(candidates):
        return RerankResult(
            hits=hits[:top_k],
            used_llm=False,
            fallback_reason="retrieval_confident",
        )

    cache_key = _cache_key(query, candidates)
    cached = _RERANK_CACHE.get(cache_key)
    if cached is not None:
        _RERANK_CACHE.move_to_end(cache_key)
        return cached

    try:
        result = _dedicated_rerank(query, candidates, top_k, api_key)

        # Preserve old behavior if max_candidates < top_k for any caller.
        if len(result.hits) < top_k and len(hits) > len(candidates):
            selected_ids = {hit.chunk_id for hit in result.hits}
            remainder = [
                hit
                for hit in hits[len(candidates):]
                if hit.chunk_id not in selected_ids
            ]
            needed = top_k - len(result.hits)
            result.hits.extend(remainder[:needed])

        _store_in_cache(cache_key, result)
        return result
    except Exception as exc:
        # Fast fail: a reranker problem must not make the chatbot unavailable.
        logger.warning("Dedicated reranking failed, using RRF order: %s", exc)
        return RerankResult(
            hits=hits[:top_k],
            used_llm=False,
            fallback_reason=f"reranker_error:{exc}",
        )


def _get_cohere_api_key(settings) -> str | None:
    """Resolve Cohere key without requiring a config.py structural change.

    Preferred: add ``cohere_api_key`` to the existing Settings class.
    Compatibility fallback: read COHERE_API_KEY from the process environment.
    """
    value = getattr(settings, "cohere_api_key", None)
    if value:
        return str(value).strip()

    value = os.getenv("COHERE_API_KEY")
    return value.strip() if value else None


def _is_retrieval_confident(hits: list[RetrievalHit]) -> bool:
    """Heuristic early-exit: skip reranker when retrieval is unambiguous."""
    if len(hits) < 2:
        return False

    top_score = hits[0].score
    second_score = hits[1].score
    if top_score <= 0:
        return False

    margin_ratio = (top_score - second_score) / top_score
    return margin_ratio >= CONFIDENT_MARGIN_RATIO


def _cache_key(query: str, hits: list[RetrievalHit]) -> tuple:
    return (
        RERANK_MODEL,
        query.strip().lower(),
        tuple(hit.chunk_id for hit in hits),
    )


def _store_in_cache(key: tuple, result: RerankResult) -> None:
    _RERANK_CACHE[key] = result
    _RERANK_CACHE.move_to_end(key)
    if len(_RERANK_CACHE) > _RERANK_CACHE_MAX_SIZE:
        _RERANK_CACHE.popitem(last=False)


def _build_rerank_documents(hits: list[RetrievalHit]) -> list[str]:
    """Return full chunk text for the dedicated reranker.

    Chunking already keeps content bounded (~600 tokens in chunker.py), so the
    old LLM-specific HEAD+TAIL truncation is unnecessary and could hide relevant
    facts located in the middle of a policy chunk.
    """
    documents: list[str] = []
    for hit in hits:
        content = (hit.chunk.content_original or "").strip()
        documents.append(content)
    return documents


def _cohere_rerank_request(
    query: str,
    documents: list[str],
    top_n: int,
    api_key: str,
) -> list[dict]:
    """Call Cohere's dedicated v2 Rerank endpoint using only stdlib HTTP.

    Using urllib avoids forcing a third project-file change just to add an SDK
    dependency. The endpoint returns ranked ``index`` + ``relevance_score``.
    """
    payload = json.dumps(
        {
            "model": RERANK_MODEL,
            "query": query,
            "documents": documents,
            "top_n": min(top_n, len(documents)),
        },
        ensure_ascii=False,
    ).encode("utf-8")

    request = Request(
        RERANK_API_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Internova-RAG-Reranker/1.0",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=RERANK_TIMEOUT_SECONDS) as response:
            raw = response.read().decode("utf-8")
    except HTTPError as exc:
        # Keep body short; enough for debugging but avoid huge logs.
        try:
            detail = exc.read().decode("utf-8", errors="replace")[:500]
        except Exception:
            detail = ""
        raise RuntimeError(
            f"Cohere rerank HTTP {exc.code}: {detail or exc.reason}"
        ) from exc
    except URLError as exc:
        raise RuntimeError(f"Cohere rerank connection error: {exc.reason}") from exc
    except TimeoutError as exc:
        raise RuntimeError(
            f"Cohere rerank timeout after {RERANK_TIMEOUT_SECONDS}s"
        ) from exc

    data = json.loads(raw)
    results = data.get("results")
    if not isinstance(results, list):
        raise ValueError("Cohere rerank response missing 'results' list")

    return results


def _dedicated_rerank(
    query: str,
    hits: list[RetrievalHit],
    top_k: int,
    api_key: str,
) -> RerankResult:
    documents = _build_rerank_documents(hits)
    if not documents:
        return RerankResult(hits=[], used_llm=False, fallback_reason="no_documents")

    logger.debug(
        "RERANK DEBUG: provider=%s model=%s num_hits=%d full_chars=%d",
        RERANK_PROVIDER,
        RERANK_MODEL,
        len(hits),
        sum(len(document) for document in documents),
    )

    # Ask the reranker for every candidate so the existing RRF-fusion step can
    # compare dedicated rank against original retrieval rank.
    raw_results = _cohere_rerank_request(
        query=query,
        documents=documents,
        top_n=len(documents),
        api_key=api_key,
    )

    score_by_index: dict[int, float] = {}
    reranker_order: list[int] = []

    for item in raw_results:
        index = item.get("index")
        score = item.get("relevance_score")

        if isinstance(index, bool) or not isinstance(index, int):
            raise ValueError(f"Invalid rerank index: {index!r}")
        if index < 0 or index >= len(hits):
            raise ValueError(f"Rerank index out of range: {index}")
        if isinstance(score, bool) or not isinstance(score, (int, float)):
            raise ValueError(f"Invalid relevance_score for index {index}: {score!r}")

        score_by_index[index] = float(score)
        reranker_order.append(index)

    if len(score_by_index) != len(hits):
        raise ValueError(
            "Reranker result count mismatch: "
            f"got {len(score_by_index)}, expected {len(hits)}"
        )

    rerank_rank_by_index = {
        hit_index: rank
        for rank, hit_index in enumerate(reranker_order, start=1)
    }

    fused_candidates = []

    for index, hit in enumerate(hits):
        retrieval_rank = index + 1
        rerank_rank = rerank_rank_by_index[index]
        relevance_score = score_by_index[index]

        fused_score = (
            RETRIEVAL_RANK_WEIGHT / (RERANK_RRF_K + retrieval_rank)
            + RERANK_RANK_WEIGHT / (RERANK_RRF_K + rerank_rank)
        )

        fused_candidates.append(
            (
                fused_score,
                relevance_score,
                retrieval_rank,
                rerank_rank,
                hit,
            )
        )

    # Primary decision: fused rank.
    # Tie breakers: higher dedicated relevance score, then retrieval rank.
    fused_candidates.sort(
        key=lambda item: (
            -item[0],
            -item[1],
            item[2],
        )
    )

    max_fused_score = fused_candidates[0][0] if fused_candidates else 1.0
    reranked: list[RetrievalHit] = []

    for rank, (
        fused_score,
        _rerank_score,
        _retrieval_rank,
        _rerank_rank,
        hit,
    ) in enumerate(fused_candidates[:top_k], start=1):
        normalized_score = (
            fused_score / max_fused_score
            if max_fused_score
            else 0.0
        )

        reranked.append(
            RetrievalHit(
                chunk_id=hit.chunk_id,
                chunk=hit.chunk,
                score=float(normalized_score),
                # Preserve the old source prefix so downstream observability/UI
                # does not break on a string change.
                source=f"reranked_fused:{hit.source}",
                rank=rank,
            )
        )

    return RerankResult(
        hits=reranked,
        used_llm=True,  # compatibility field: dedicated reranker was used
    )


# ---------------------------------------------------------------------------
# Backward-compatible private helper name.
# Existing tests or imports that still call _llm_rerank will continue to work,
# but this wrapper does NOT call an LLM.
# ---------------------------------------------------------------------------
def _llm_rerank(
    query: str,
    hits: list[RetrievalHit],
    top_k: int,
    settings,
) -> RerankResult:
    api_key = _get_cohere_api_key(settings)
    if not api_key:
        raise RuntimeError("COHERE_API_KEY is not configured")
    return _dedicated_rerank(query, hits, top_k, api_key)


# Legacy parser retained only so external tests/imports do not break. It is no
# longer used by the reranking path because the dedicated API returns scores as
# structured JSON fields instead of generated text.
def _parse_scores(raw: str, expected_len: int) -> list:
    text = raw
    if text.startswith("```"):
        parts = text.split("```")
        if len(parts) >= 2:
            text = parts[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        if not text:
            raise ValueError("Rerank response was only markdown fences, no content")

    parsed = json.loads(text)

    if isinstance(parsed, dict):
        if "scores" not in parsed:
            raise ValueError(
                "Expected key 'scores' in JSON object, "
                f"got keys: {list(parsed.keys())}"
            )
        scores = parsed["scores"]
    else:
        scores = parsed

    if not isinstance(scores, list):
        raise ValueError(
            f"Expected a JSON array of scores, got: {type(scores).__name__}"
        )

    if len(scores) != expected_len:
        raise ValueError(
            "Rerank score count mismatch: "
            f"got {len(scores)}, expected {expected_len}"
        )

    return scores