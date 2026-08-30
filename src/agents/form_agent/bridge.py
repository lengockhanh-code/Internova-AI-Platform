"""bridge.py — Thin adapter so src/api/routes.py can dispatch a chat
message to the form-filling agent, while every actual decision lives
inside form_agent/. routes.py's only touchpoint is try_dispatch() —
its own code never needs to change when this file's internal logic
changes (see the "Suggested routes.py usage" note at the bottom).

FIX (Explicit Intent Only — architecture change, not additive): this
subtree previously auto-suggested a form after every RAG answer that
seemed related ("🤖 Cần mình giúp điền Form X luôn không?"), then
waited for a confirming reply on the NEXT turn. In practice this
interrupted normal Q&A — a student just asking "Form 1 là gì?" (an
information question) got the same "muốn điền không?" prompt as a
student who actually wanted help filling it in, training students to
ignore the prompt over time. It also depended on fragile multi-turn
state (_PENDING_SUGGESTIONS keyed by chat session_id, populated by a
separate /detect call) that was a repeated source of bugs (stale
suggestions, wrong-form false positives, whole-word matching gaps).

Replaced with: detect explicit fill-intent directly on EVERY incoming
message, independent of any prior RAG turn. Only starts a session
when BOTH are true: (1) the message contains a clear action phrase or
verb+helper co-occurrence (see _has_fill_intent_phrase) — not just any
mention of "form" or "đơn", which would false-positive on ordinary
questions like "Form 1 là gì?"; and (2) detect_form() (unchanged,
reused as-is) can identify which form. Either signal alone is not
enough — a question that merely NAMES a form ("form 3 dùng để làm gì")
has no action signal, so it correctly falls through to normal RAG; a
message with an action signal but no identifiable form also falls
through (nothing to start).

This removes the multi-turn "suggest, then wait for confirm" state
machine entirely — no more _PENDING_SUGGESTIONS, no more relying on
the frontend to call /detect with a session_id and remember to send a
follow-up confirm. A single message either clearly expresses "please
fill this form for me" or it doesn't; there is no ambiguous middle
state to track across turns for THIS decision (the existing
"awaiting_confirmation" status in intent.py still applies for its own
separate purpose — an ambiguous reply to the graph's own first-turn
entry check — but is no longer reachable via this auto-suggest path
specifically, since a session is now only ever started here on an
unambiguous explicit-intent message).
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any
import logging

from src.api import form_agent_routes as _routes_module
from src.agents.form_agent.graph import form_agent
from src.agents.form_agent.nodes.form_selector import detect_form
from src.agents.form_agent.state import FormAgentState
from src.agents.form_agent.tools.form_tool import build_profile_field_values
from src.database.connection import SessionLocal
from src.services.student_settings_service import get_student_settings

logger = logging.getLogger(__name__)

_ACTIVE_STATUSES = {
    "selecting_form",
    "collecting_info",
    "ready_to_fill",
    "awaiting_review",
}

# Explicit "please fill this in for me" action phrases — deliberately
# NOT including bare "form"/"đơn" alone (too broad: "Form 1 là gì?"
# would false-trigger). All multi-word, so plain substring matching is
# safe here (an exact multi-word sequence can't accidentally occur
# inside a single unrelated token) — no whole-word tokenization
# needed, unlike the short single-word lists elsewhere in this
# subtree that caused false positives in the past.
_FILL_INTENT_PHRASES = (
    "dien giup", "dien ho", "giup dien", "giup toi dien",
    "giup minh dien", "giup em dien",
    "lam don giup", "tao don giup", "lam ho don", "dien don giup",
    "muon dien", "can dien",
    "muon lam don", "can lam don",
    "dien form giup", "dien bieu mau giup",
    "lam don dang ky giup", "tao don dang ky giup",
    "nop don giup", "giup nop don",
    "dien luon", "lam luon don", "dien don luon",
    # FIX (2nd pass): bổ sung sau khi phát hiện thiếu — "điền cho mik
    # form 1 đi" (cách nói rất tự nhiên) không khớp bất kỳ cụm nào ở
    # trên. Danh sách gốc chỉ phủ mẫu "điền + giúp/hộ", bỏ sót "điền
    # cho <ai>", câu mệnh lệnh "đi", và "dùm/giùm".
    "dien cho", "dien dum", "dien gium", "gium dien",
    "dien di", "dien luon di", "lam don di", "tao don di",
    "dien no giup", "dien no ho", "dien no di", "dien no cho",
)

# FIX (3rd pass — important, fixes a whole class of misses): the
# ADJACENT-phrase list above still misses very common natural
# phrasings where Vietnamese inserts an object/noun BETWEEN the verb
# and the helper word — e.g. "điền THÔNG TIN giúp tôi", "điền [...]
# vào form 1 giúp tôi". No fixed adjacent phrase can ever cover every
# way a student might phrase this. Instead of endlessly adding more
# exact phrases, add a CO-OCCURRENCE rule: the message contains a fill
# VERB ("điền", or "làm/tạo/nộp đơn") *and* a HELPER word ("giúp",
# "dùm", "giùm") *anywhere* in the message, not necessarily adjacent.
# Both must be present — either alone is not enough (a lone "điền"
# could be part of an information question; a lone "giúp" appears in
# many unrelated requests, e.g. "hãy giúp tôi" alone with no "điền" at
# all must NOT trigger — see the failing real case that had "giúp
# tôi" but no fill verb).
#
# "hộ" is intentionally NOT in the helper set here (even though it
# also means "help") — stripped of its diacritic it becomes "ho",
# which collides with "họ" (the pronoun "they"). As a co-occurring
# WHOLE-WORD token that collision is real: "Họ điền form chưa nhỉ?"
# (an information question about whether THEY have filled it, not a
# request for help) would false-trigger if "ho" were included here.
# "dien ho" (điền hộ) as an ADJACENT phrase is safe and stays in
# _FILL_INTENT_PHRASES above, where the ambiguity doesn't arise.
_FILL_VERB_PHRASES = ("lam don", "tao don", "nop don")
_FILL_HELPER_TOKENS = {"giup", "dum", "gium"}


def _normalize(text: str) -> str:
    import re
    import unicodedata

    value = (text or "").replace("đ", "d").replace("Đ", "D")
    normalized = unicodedata.normalize("NFKD", value)
    stripped = "".join(c for c in normalized if not unicodedata.combining(c))
    return " ".join(re.findall(r"[a-z0-9]+", stripped.lower()))


def _has_fill_intent_phrase(message: str) -> bool:
    normalized = _normalize(message)

    if any(phrase in normalized for phrase in _FILL_INTENT_PHRASES):
        return True

    # Co-occurrence fallback — see _FILL_VERB_PHRASES/_FILL_HELPER_TOKENS
    # docstring above for the real failure this fixes.
    tokens = set(normalized.split())
    has_verb = "dien" in tokens or any(p in normalized for p in _FILL_VERB_PHRASES)
    has_helper = bool(tokens & _FILL_HELPER_TOKENS)
    return has_verb and has_helper


def has_active_session(session_id: str | None) -> bool:
    """True if this chat session_id currently has a form-filling
    session in progress (not finished, not cancelled, not merely
    absent)."""
    if not session_id:
        return False

    with _routes_module._LOCK:
        state = _routes_module._SESSIONS.get(session_id)

    return bool(state) and state.get("status") in _ACTIVE_STATUSES


def _fetch_profile_field_values(current_user: Any) -> dict[str, str | None]:
    """Look up the logged-in student's profile and convert it to
    field_values ready to pre-fill a fresh state — so collect_info
    never has to ask for (or risk mis-extracting) info the system
    already has on file. Never raises: a DB error, missing profile,
    or missing user just means an empty pre-fill, silently falling
    back to the old ask-the-student behavior for those fields —
    never breaks the chat turn itself.
    """
    if current_user is None:
        return {}

    user_id = (
        current_user.get("id")
        if isinstance(current_user, dict)
        else getattr(current_user, "id", None)
    )
    if not user_id:
        return {}

    try:
        with SessionLocal() as db:
            profile = get_student_settings(db, int(user_id))
    except Exception:
        logger.warning(
            "Could not fetch student profile for pre-fill (user_id=%s)",
            user_id,
            exc_info=True,
        )
        return {}

    return dict(build_profile_field_values(profile))


def _fresh_state(profile_field_values: dict[str, str | None] | None = None) -> FormAgentState:
    field_values: dict[str, str | None] = dict(profile_field_values or {})
    return {
        "conversation_text": "",
        "latest_user_message": "",
        "field_values": field_values,
        "human_approved": False,
        "status": "selecting_form",
    }


def run_turn(session_id: str, message: str, current_user: Any = None) -> dict[str, Any]:
    """Run one form_agent turn for this (already-bridged) session_id.
    Mirrors form_agent_routes.py's own /turn handler logic exactly —
    intentionally duplicated rather than imported, so this bridge has
    zero FastAPI/Request coupling and can be called directly from a
    plain function in routes.py."""
    with _routes_module._LOCK:
        state = _routes_module._SESSIONS.get(session_id)
        if state is None:
            state = _fresh_state(_fetch_profile_field_values(current_user))

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


def _start_if_explicit_intent(
    session_id: str | None, message: str, current_user: Any = None,
) -> dict[str, Any] | None:
    """If this message clearly expresses intent to fill a specific
    form (see _has_fill_intent_phrase + detect_form), start a NEW
    session for it immediately — the form is already known, so
    form_selector skips its own keyword-matching guesswork entirely
    (detected_form is pre-set here). Returns None (meaning: let RAG
    answer this message normally) whenever either signal is missing:
    no clear fill-intent signal, or the form can't be identified from
    this message. Never guesses off just one signal alone.
    """
    if not session_id:
        return None

    if not _has_fill_intent_phrase(message):
        return None

    form_code = detect_form(message)
    if form_code is None:
        return None

    with _routes_module._LOCK:
        state = _fresh_state(_fetch_profile_field_values(current_user))
        state["detected_form"] = form_code
        state["status"] = "collecting_info"
        _routes_module._SESSIONS[session_id] = state

    return run_turn(session_id, message, current_user)


def try_dispatch(
    session_id: str | None, message: str, current_user: Any = None,
) -> dict[str, Any] | None:
    """Single entry point for routes.py.

    Returns a form_agent turn result dict if this message should be
    handled by form_agent, or None if it should fall through to
    normal RAG chat unchanged.
    """
    if has_active_session(session_id):
        return run_turn(session_id, message, current_user)

    return _start_if_explicit_intent(session_id, message, current_user)


# =============================================================================
# routes.py usage:
#
#     from src.agents.form_agent.bridge import try_dispatch
#
#     form_result = await run_in_threadpool(
#         try_dispatch, request.session_id, message, current_user
#     )
#     if form_result is not None:
#         return _build_form_agent_chat_response(request.session_id, form_result)
#
#     # ... existing RAG code below is UNCHANGED ...
#
# Frontend requirement (Explicit Intent Only): NONE for triggering —
# the student just types normally in the chat box ("điền giúp mình
# Form 1"), and /chat itself detects intent and auto-starts on the
# very next request. No button, no separate /detect call needed to
# make the core flow work. A lightweight discoverability hint (e.g. a
# small non-blocking text under a form-related RAG answer, "Gõ 'điền
# giúp mình' khi bạn muốn mình hỗ trợ điền form này") is a frontend UX
# decision, not a backend requirement — /detect remains available,
# stateless, for that purpose if wanted, but no longer drives any
# auto-trigger logic itself.
# =============================================================================
