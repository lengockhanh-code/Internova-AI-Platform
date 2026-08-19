from langgraph.graph import END, StateGraph

from src.agents.nodes.rag_nodes import (
    build_bilingual_queries_node,
    classify_intent_node,
    detect_language_node,
    evidence_gate_node,
    filter_by_allowed_sources_node,
    format_response_node,
    generate_answer_node,
    groundedness_check_node,
    hybrid_retrieve_node,
    normalize_query_node,
    rerank_node,
    route_scope_node,
)
from src.agents.state import AgentState


def after_classify_intent(state: AgentState) -> str:
    if state.get("scope") == "out_of_scope":
        return "format_response"
    return "route_scope"


def after_hybrid_retrieve(state: AgentState) -> str:
    if state.get("error") or state.get("answer_status") == "insufficient_evidence":
        return "format_response"
    return "filter_by_allowed_sources"


def after_evidence_gate(state: AgentState) -> str:
    if state.get("answer_status") == "not_found":
        return "format_response"
    return "generate_answer"


def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("normalize_query", normalize_query_node)
    graph.add_node("detect_language", detect_language_node)
    graph.add_node("classify_intent", classify_intent_node)
    graph.add_node("route_scope", route_scope_node)
    graph.add_node("build_bilingual_queries", build_bilingual_queries_node)
    graph.add_node("hybrid_retrieve", hybrid_retrieve_node)
    graph.add_node("filter_by_allowed_sources", filter_by_allowed_sources_node)
    graph.add_node("rerank", rerank_node)
    graph.add_node("evidence_gate", evidence_gate_node)
    graph.add_node("generate_answer", generate_answer_node)
    graph.add_node("groundedness_check", groundedness_check_node)
    graph.add_node("format_response", format_response_node)

    graph.set_entry_point("normalize_query")
    graph.add_edge("normalize_query", "detect_language")
    graph.add_edge("detect_language", "classify_intent")
    graph.add_conditional_edges("classify_intent", after_classify_intent)
    graph.add_edge("route_scope", "build_bilingual_queries")
    graph.add_edge("build_bilingual_queries", "hybrid_retrieve")
    graph.add_conditional_edges("hybrid_retrieve", after_hybrid_retrieve)
    graph.add_edge("filter_by_allowed_sources", "rerank")
    graph.add_edge("rerank", "evidence_gate")
    graph.add_conditional_edges("evidence_gate", after_evidence_gate)
    graph.add_edge("generate_answer", "groundedness_check")
    graph.add_edge("groundedness_check", "format_response")
    graph.add_edge("format_response", END)

    return graph.compile()


agent = build_graph()
