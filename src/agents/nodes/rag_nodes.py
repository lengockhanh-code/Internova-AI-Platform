from __future__ import annotations

from src.agents.state import AgentState
from src.rag.answer_generator import generate_answer_from_evidence, refusal_answer
from src.rag.config import get_rag_paths
from src.rag.evidence import EvidenceCheckResult, check_evidence
from src.rag.groundedness import apply_groundedness_gate, check_groundedness
from src.rag.query_expander import build_bilingual_queries, detect_query_language, normalize_query
from src.rag.retriever import HybridRetriever, RetrievalHit, filter_allowed_document_types
from src.rag.router import RouteDecision, route_query
from src.rag.schemas import DocumentChunk


def normalize_query_node(state: AgentState) -> dict:
    query = normalize_query(state.get("query", ""))
    return {"query": query, "normalized_query": query}


def detect_language_node(state: AgentState) -> dict:
    language = detect_query_language(state.get("normalized_query", state.get("query", "")))
    return {"query_language": language}


def classify_intent_node(state: AgentState) -> dict:
    route = route_query(state.get("normalized_query", state.get("query", "")))
    result = {
        "intent": route.intent,
        "scope": route.scope,
        "route": route.model_dump(),
    }
    if route.scope == "out_of_scope":
        result["answer_status"] = "out_of_scope"
    return result


def route_scope_node(state: AgentState) -> dict:
    route = route_from_state(state)
    return {
        "allowed_document_types": route.allowed_document_types,
        "blocked_document_types": route.blocked_document_types,
    }


def build_bilingual_queries_node(state: AgentState) -> dict:
    expanded = build_bilingual_queries(
        state.get("normalized_query", state.get("query", "")),
        use_openai=False,
    )
    return {
        "expanded_query": expanded.model_dump(),
        "search_queries": expanded.search_queries,
    }


def hybrid_retrieve_node(state: AgentState) -> dict:
    if state.get("retrieval_hits"):
        return {}

    paths = get_rag_paths()
    route = route_from_state(state)
    try:
        retriever = HybridRetriever(
            chroma_dir=paths.chroma_dir,
            bm25_path=paths.output_dir / "bm25.pkl",
        )
        result = retriever.retrieve(
            state.get("normalized_query", state.get("query", "")),
            use_openai_translation=False,
            allowed_document_types=route.allowed_document_types,
        )
    except Exception as exc:
        return {
            "error": f"retrieval_failed: {exc}",
            "answer_status": "insufficient_evidence",
        }

    return {"retrieval_hits": result.fused_hits}


def filter_by_allowed_sources_node(state: AgentState) -> dict:
    route = route_from_state(state)
    hits = hits_from_state(state, key="retrieval_hits")
    return {
        "retrieval_hits": filter_allowed_document_types(hits, route.allowed_document_types)
    }


def rerank_node(state: AgentState) -> dict:
    hits = hits_from_state(state, key="retrieval_hits")
    reranked = sorted(
        hits,
        key=lambda hit: (hit.chunk.source_priority, hit.rank, -hit.score),
    )
    return {
        "reranked_hits": [
            RetrievalHit(
                chunk_id=hit.chunk_id,
                chunk=hit.chunk,
                score=hit.score,
                source=hit.source,
                rank=rank,
            )
            for rank, hit in enumerate(reranked, start=1)
        ]
    }


def evidence_gate_node(state: AgentState) -> dict:
    route = route_from_state(state)
    hits = hits_from_state(state, key="reranked_hits")
    evidence = check_evidence(
        query=state.get("normalized_query", state.get("query", "")),
        hits=hits,
        route=route,
    )
    return {
        "evidence": evidence.model_dump(),
        "answer_status": evidence.answer_status,
    }


def generate_answer_node(state: AgentState) -> dict:
    evidence = EvidenceCheckResult.model_validate(state.get("evidence", {}))
    answer = generate_answer_from_evidence(
        query=state.get("normalized_query", state.get("query", "")),
        evidence=evidence,
        hits=hits_from_state(state, key="reranked_hits"),
    )
    return {"generated_answer": answer.model_dump(), "answer_status": answer.answer_status}


def groundedness_check_node(state: AgentState) -> dict:
    from src.rag.answer_generator import GeneratedAnswer

    draft = GeneratedAnswer.model_validate(state.get("generated_answer", {}))
    check = check_groundedness(
        answer=draft,
        hits=hits_from_state(state, key="reranked_hits"),
        route=route_from_state(state),
    )
    final_answer = apply_groundedness_gate(draft, check)
    return {
        "groundedness": check.model_dump(),
        "generated_answer": final_answer.model_dump(),
        "answer_status": final_answer.answer_status,
    }


def format_response_node(state: AgentState) -> dict:
    answer_data = state.get("generated_answer")
    if answer_data:
        answer = answer_data.get("answer", "")
        return {
            "response": answer,
            "answer_status": answer_data.get("answer_status"),
            "confidence": answer_data.get("confidence", 0.0),
            "sources": answer_data.get("sources", []),
            "metadata": {
                "intent": state.get("intent"),
                "scope": state.get("scope"),
                "groundedness": state.get("groundedness", {}),
            },
        }

    status = state.get("answer_status")
    if status == "out_of_scope":
        answer = refusal_answer(answer_language="vi", status="not_found")
    elif status == "not_found":
        answer = refusal_answer(answer_language="vi", status="not_found")
    else:
        answer = refusal_answer(answer_language="vi", status="insufficient_evidence")

    return {
        "response": answer.answer,
        "generated_answer": answer.model_dump(),
        "answer_status": status if status in {"out_of_scope", "not_found"} else answer.answer_status,
        "confidence": 0.0,
        "sources": [],
        "metadata": {"intent": state.get("intent"), "scope": state.get("scope")},
    }


def route_from_state(state: AgentState) -> RouteDecision:
    route_data = state.get("route")
    if route_data:
        return RouteDecision.model_validate(route_data)
    return route_query(state.get("normalized_query", state.get("query", "")))


def hits_from_state(state: AgentState, key: str) -> list[RetrievalHit]:
    hits = state.get(key, [])
    parsed: list[RetrievalHit] = []
    for hit in hits:
        if isinstance(hit, RetrievalHit):
            parsed.append(hit)
            continue
        hit_data = dict(hit)
        chunk = hit_data.get("chunk")
        if isinstance(chunk, dict):
            hit_data["chunk"] = DocumentChunk.model_validate(chunk)
        parsed.append(RetrievalHit(**hit_data))
    return parsed
