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

FORM AGENT ROUTING POLICY: this bridge continues an already-active
form-filling session, or starts one only when the newest user message
clearly asks the system to fill/create a form. It never starts from RAG
answers, form sources, pending suggestions, or plain "yes" confirmations.

try_dispatch() is the single entry point routes.py should call.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

from src.api import form_agent_routes as _routes_module
from src.agents.form_agent.graph import form_agent
from src.agents.form_agent.state import FormAgentState

_FORM_TARGET_RE = re.compile(r"\b(form|don|bieu mau)\b")
_FORM_ACTION_RE = re.compile(r"\b(dien|lam|tao|fill|complete|prepare)\b")
_DIRECT_FORM_COMMAND_RE = re.compile(r"^(dien|lam|tao|fill|complete|prepare)\s+(form|don|bieu mau)\b")
_HELP_PHRASES = (
    "giup", "ho", "gium", "cho minh", "cho em", "cho toi",
    "toi muon", "em muon", "minh muon", "can ban", "can minh",
    "ban co the", "co the", "help me", "i want", "please",
)
_INSTRUCTION_PHRASES = (
    "cach dien", "huong dan dien", "quy trinh dien", "tai form",
    "download form", "form nao", "can form nao",
)



def _normalize_intent_text(value: str) -> str:
    normalized = unicodedata.normalize(
        "NFKD",
        (value or "").replace("đ", "d").replace("Đ", "D"),
    )
    stripped = "".join(c for c in normalized if not unicodedata.combining(c))
    return " ".join(re.findall(r"[a-z0-9]+", stripped.lower()))


def is_explicit_form_fill_request(message: str) -> bool:
    """True only when the student is asking the system to fill/create a form.

    This is a routing gate, not a form selector. If the user says "fill a
    form" without naming which one, the Form Agent starts and form_selector
    asks which form to use. Questions about how to fill/download forms stay
    in normal RAG chat.
    """
    normalized = _normalize_intent_text(message)
    if not normalized:
        return False

    if any(phrase in normalized for phrase in _INSTRUCTION_PHRASES):
        return False

    has_form_target = bool(_FORM_TARGET_RE.search(normalized))
    has_fill_action = bool(_FORM_ACTION_RE.search(normalized))
    direct_command = bool(_DIRECT_FORM_COMMAND_RE.search(normalized))
    asks_for_help = any(phrase in normalized for phrase in _HELP_PHRASES)

    return has_form_target and has_fill_action and (direct_command or asks_for_help)

_ACTIVE_STATUSES = {
    "selecting_form",
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


def try_dispatch(session_id: str | None, message: str) -> dict[str, Any] | None:
    """Route active sessions or start only from a clear fill-form request."""
    if has_active_session(session_id):
        return run_turn(session_id, message)  # type: ignore[arg-type]

    if session_id and is_explicit_form_fill_request(message):
        return run_turn(session_id, message)

    return None


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
# New form-agent sessions start here only from explicit fill/create-form intent, or through /form-agent/turn.
# =============================================================================
