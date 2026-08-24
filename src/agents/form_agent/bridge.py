"""bridge.py — Thin adapter so src/api/routes.py can dispatch a chat
message to the form-filling agent with a MINIMAL, additive change on
its side, while every actual decision still lives inside form_agent/.

WHY THIS FILE EXISTS: routes.py (owned by the RAG team) needs to know
"should this message go to form_agent instead of chat_service?" and,
if so, get back something shaped like their existing ChatResponse. Put
that logic here instead of writing it inline in routes.py, so:
  - routes.py's diff stays a single guard-clause call, easy to review.
  - All form_agent-specific knowledge (session states, status values,
    field schemas, confirm/cancel phrase matching...) stays inside
    form_agent/, not leaked into a file another team owns.

FIX (2nd pass) — NO RAG MEMORY DEPENDENCY: earlier versions of this
plan assumed reading RAG's own ConversationMemory (src/rag/memory.py)
to know "what form did the last RAG answer suggest?". That would have
meant touching/depending on RAG-owned code. Instead, this now reuses
_PENDING_SUGGESTIONS in form_agent_routes.py — populated by /detect,
which the frontend already calls (with the chat's session_id) after
every RAG answer. try_dispatch() below checks that dict directly, so
this bridge still has ZERO dependency on src.rag.* or
src.services.chat_service.

Two ways a message gets routed to form_agent, both implemented here:
  1. has_active_session() — a form_agent session for this chat
     session_id is already mid-collection (student already confirmed
     earlier and is now answering field questions). Every message
     goes straight to form_agent until the session ends.
  2. maybe_autostart() — no session yet, but /detect just flagged this
     chat session_id as having been shown a form suggestion, AND the
     student's message is a clear "yes" (reusing the same whole-word
     confirm/cancel phrase matching already built and tested in
     nodes/intent.py — not reimplemented here). A clear "no" clears
     the pending suggestion and falls through to RAG. Anything else
     (ambiguous) also falls through to RAG unchanged — no guessing.

try_dispatch() is the single entry point routes.py should call.
"""

from __future__ import annotations

from typing import Any

from src.api import form_agent_routes as _routes_module
from src.agents.form_agent.graph import form_agent
from src.agents.form_agent.nodes.intent import (
    _matches_cancel_phrase,
    _matches_confirm_phrase,
    _normalize,
)
from src.agents.form_agent.state import FormAgentState, FormCode

_ACTIVE_STATUSES = {
    "selecting_form",
    "awaiting_confirmation",
    "collecting_info",
    "ready_to_fill",
    "awaiting_review",
}


def has_active_session(session_id: str | None) -> bool:
    """True if this chat session_id currently has a form-filling
    session in progress (not finished, not cancelled, not merely
    absent)."""
    if not session_id:
        return False

    with _routes_module._LOCK:
        state = _routes_module._SESSIONS.get(session_id)

    return bool(state) and state.get("status") in _ACTIVE_STATUSES


def _fresh_state() -> FormAgentState:
    return {
        "conversation_text": "",
        "latest_user_message": "",
        "field_values": {},
        "human_approved": False,
        "status": "selecting_form",
    }


def run_turn(session_id: str, message: str) -> dict[str, Any]:
    """Run one form_agent turn for this (already-bridged) session_id.
    Mirrors form_agent_routes.py's own /turn handler logic exactly —
    intentionally duplicated rather than imported, so this bridge has
    zero FastAPI/Request coupling and can be called directly from a
    plain function in routes.py."""
    with _routes_module._LOCK:
        state = _routes_module._SESSIONS.get(session_id) or _fresh_state()

        if state.get("status") == "awaiting_review":
            state["status"] = "collecting_info"

        state["conversation_text"] = state.get("conversation_text", "") + f"\n{message}"
        state["latest_user_message"] = message

        state = form_agent.invoke(state)
        _routes_module._SESSIONS[session_id] = state

    return {
        "status": state.get("status", "unknown"),
        "detected_form": state.get("detected_form"),
        "ask_message": state.get("ask_message"),
        "review_summary_markdown": state.get("review_summary_markdown"),
        "docx_ready": bool(state.get("filled_docx_bytes")),
        "error": state.get("error"),
    }


def _get_pending_suggestion(session_id: str) -> FormCode | None:
    with _routes_module._LOCK:
        return _routes_module._PENDING_SUGGESTIONS.get(session_id)


def _clear_pending_suggestion(session_id: str) -> None:
    with _routes_module._LOCK:
        _routes_module._PENDING_SUGGESTIONS.pop(session_id, None)


def maybe_autostart(session_id: str | None, message: str) -> dict[str, Any] | None:
    """If /detect recently flagged this chat session_id as having been
    shown a form suggestion, and the student's message is a clear
    confirmation, start a form_agent session for it — with the form
    already known (skips form_selector's keyword-matching guesswork
    entirely, since we already have a confident answer from /detect)
    — and immediately run the first turn so the student gets the
    field questions right away.

    Returns None (meaning: let RAG answer this message normally) when:
      - there's no pending suggestion for this session_id, or
      - the message is a clear cancellation (also clears the pending
        suggestion, so a stray "yes" later doesn't unexpectedly start
        a session), or
      - the message is ambiguous — neither a clear yes nor a clear no.
        Not guessing here matches the same principle used in
        intent.py and form_selector.py elsewhere in this subtree.
    """
    if not session_id:
        return None

    pending_form = _get_pending_suggestion(session_id)
    if pending_form is None:
        return None

    normalized = _normalize(message)

    if _matches_cancel_phrase(normalized):
        _clear_pending_suggestion(session_id)
        return None

    if not _matches_confirm_phrase(normalized):
        return None

    _clear_pending_suggestion(session_id)

    with _routes_module._LOCK:
        state = _fresh_state()
        state["detected_form"] = pending_form
        state["status"] = "collecting_info"
        _routes_module._SESSIONS[session_id] = state

    return run_turn(session_id, message)


def try_dispatch(session_id: str | None, message: str) -> dict[str, Any] | None:
    """Single entry point for routes.py. Returns a form_agent turn
    result dict if this message should be handled by form_agent, or
    None if it should fall through to normal RAG chat unchanged."""
    if has_active_session(session_id):
        return run_turn(session_id, message)  # type: ignore[arg-type]

    return maybe_autostart(session_id, message)


# =============================================================================
# Suggested routes.py usage (for reference — NOT executed from here):
#
#     from src.agents.form_agent.bridge import try_dispatch
#
#     form_result = await run_in_threadpool(try_dispatch, request.session_id, message)
#     if form_result is not None:
#         return _build_form_agent_chat_response(request.session_id, form_result)
#
#     # ... existing RAG code below is UNCHANGED ...
#
# Frontend requirement (the only thing needed outside form_agent/):
# pass the CHAT's session_id when calling /form-agent/detect, e.g.
#   POST /form-agent/detect { "text": "<RAG answer or question>", "session_id": "<chat session id>" }
# No frontend change is needed to TRIGGER form-filling anymore — the
# student just replies normally in the chat box, and /chat itself
# auto-routes on the next turn.
# =============================================================================