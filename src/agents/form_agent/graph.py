"""graph.py — Form-filling agent graph.

Isolated from src/agents/graph.py (the team's main RAG graph) — see the
folder-structure discussion in chat for why: this whole form_agent/
subtree exists specifically to avoid merge conflicts with the RAG
graph other teammates are actively working on.

## How this graph is meant to be driven (IMPORTANT — read before wiring
## this into demo.py or any UI)

This is NOT a single-shot graph you invoke once and get a final answer
from, the way the main RAG graph is. Filling a form is inherently
multi-turn: the agent may need to ask the student for missing
information and wait for their reply before it can finish. LangGraph
supports pausing mid-graph (e.g. via checkpointers / the `interrupt()`
primitive), but the simplest, most transparent pattern for a
Streamlit-style chat app — and the one this graph is designed around —
is caller-driven re-invocation:

    1. Caller starts with a fresh FormAgentState (status="selecting_form",
       conversation_text=<everything so far>, human_approved=False).
    2. Caller calls `agent.invoke(state)`.
    3. The graph runs until it reaches a NATURAL PAUSE POINT — either
       `collecting_info` (ask_message
       is set, waiting on the student for missing fields), or
       `awaiting_review` (review_summary_markdown is set, waiting on
       the student's approval) — and returns.
    4. Caller shows `ask_message` or `review_summary_markdown` /
       filled_docx_bytes to the student, then WAITS for their next
       message — this graph invocation is over for this turn.
    5. When the student replies, caller updates the state (appends
       their reply to conversation_text and latest_user_message, and
       sets human_approved=True if this was an approval reply) and
       calls `agent.invoke(state)` again, resuming from where it left
       off.

The conditional edges below route straight to END whenever a pause
point or a terminal status (cancelled/approved) is reached, rather than
looping internally — the "loop" happens across separate invocations,
driven by the caller, not inside a single graph run. This keeps the
whole thing simple and fully inspectable turn by turn, at the cost of
the caller needing to persist FormAgentState between turns (e.g. in
st.session_state) — a deliberate, documented tradeoff, not an
oversight.

Intent now only handles explicit cancellation. Missing/ambiguous form selection is handled by form_selector.
"""

from __future__ import annotations

from langgraph.graph import END, StateGraph

from src.agents.form_agent.nodes.collect_info import collect_info_node
from src.agents.form_agent.nodes.form_filler import form_filler_node
from src.agents.form_agent.nodes.form_selector import form_selector_node
from src.agents.form_agent.nodes.human_review import human_review_node
from src.agents.form_agent.nodes.intent import intent_node
from src.agents.form_agent.state import FormAgentState


def after_intent(state: FormAgentState) -> str:
    if state.get("status") == "cancelled":
        # cancelled: student declined or stopped the active form-filling flow.
        return END
    if state.get("detected_form"):
        return "collect_info"
    return "form_selector"


def after_form_selector(state: FormAgentState) -> str:
    if state.get("error") or not state.get("detected_form"):
        # Couldn't identify a form — ask_message is set by
        # form_selector_node explaining what's needed; caller shows it
        # and waits for the student's next message.
        return END
    return "collect_info"


def after_collect_info(state: FormAgentState) -> str:
    if state.get("status") == "ready_to_fill":
        return "form_filler"
    # Still missing required fields (or an error) — pause here,
    # ask_message is set, caller waits for the student's reply.
    return END


def after_form_filler(state: FormAgentState) -> str:
    if state.get("error"):
        return END
    return "human_review"


def after_human_review(state: FormAgentState) -> str:
    # Whether awaiting_review (pause for approval) or approved
    # (finished) — either way this graph invocation is done.
    return END


def build_graph() -> StateGraph:
    # pyrefly: ignore[bad-specialization]  # standard LangGraph TypedDict-as-schema pattern, works fine at runtime
    graph = StateGraph(FormAgentState)

    graph.add_node("intent", intent_node)
    graph.add_node("form_selector", form_selector_node)
    graph.add_node("collect_info", collect_info_node)
    graph.add_node("form_filler", form_filler_node)
    graph.add_node("human_review", human_review_node)

    graph.set_entry_point("intent")

    graph.add_conditional_edges(
        "intent",
        after_intent,
        {"collect_info": "collect_info", "form_selector": "form_selector", END: END},
    )
    graph.add_conditional_edges(
        "form_selector",
        after_form_selector,
        {"collect_info": "collect_info", END: END},
    )
    graph.add_conditional_edges(
        "collect_info",
        after_collect_info,
        {"form_filler": "form_filler", END: END},
    )
    graph.add_conditional_edges(
        "form_filler",
        after_form_filler,
        {"human_review": "human_review", END: END},
    )
    graph.add_conditional_edges(
        "human_review",
        after_human_review,
        {END: END},
    )

    return graph.compile()  # pyrefly: ignore[bad-return]


form_agent = build_graph()