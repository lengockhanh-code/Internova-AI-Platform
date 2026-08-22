"""nodes/intent.py — Entry node: confirm the student wants to proceed.

This graph is only ever invoked AFTER the main RAG chat has already
given advice and explicitly asked "muốn mình giúp điền đơn không?" — so
by the time this graph runs, the caller has usually already confirmed a
"yes". This node exists as a light safety check for the multi-turn
case: if the student changes their mind mid-collection ("thôi khỏi",
"không cần nữa"), catch that here and end gracefully instead of
continuing to ask for more fields.
"""

from __future__ import annotations

from src.agents.form_agent.state import FormAgentState

_CANCEL_PHRASES = (
    "thoi khoi",
    "khong can nua",
    "huy",
    "khong muon lam nua",
    "de sau",
    "cancel",
    "never mind",
    "not anymore",
)


def _normalize(text: str) -> str:
    import re
    import unicodedata

    value = (text or "").replace("đ", "d").replace("Đ", "D")
    normalized = unicodedata.normalize("NFKD", value)
    stripped = "".join(c for c in normalized if not unicodedata.combining(c))
    return " ".join(re.findall(r"[a-z0-9]+", stripped.lower()))


def _matches_cancel_phrase(normalized_text: str) -> bool:
    """Check for a cancellation phrase, but avoid false positives from
    single-word phrases matching as a SUBSTRING inside an unrelated,
    longer word.

    FIX: found via real testing — "chuyên ngành" normalizes to
    "chuyen nganh", and the single-word phrase "huy" (short for "hủy" /
    cancel) matched as a substring INSIDE "chuyen" (c-HUY-en), wrongly
    ending the session when the student was just describing their
    major, nowhere near asking to cancel. Multi-word phrases (e.g.
    "thoi khoi", "khong can nua") don't have this problem — they can
    only match if the exact words appear adjacently with a space
    between them, which can't accidentally occur inside a single
    token. Only single-word phrases need the stricter whole-word check.
    """
    tokens = set(normalized_text.split())

    for phrase in _CANCEL_PHRASES:
        if " " in phrase:
            # Multi-word phrase — substring check is safe here.
            if phrase in normalized_text:
                return True
        else:
            # Single-word phrase — must match a WHOLE token, never a
            # substring buried inside a longer, unrelated word.
            if phrase in tokens:
                return True

    return False


def intent_node(state: FormAgentState) -> FormAgentState:
    latest = _normalize(state.get("latest_user_message", ""))

    if latest and _matches_cancel_phrase(latest):
        return {
            **state,
            "status": "cancelled",
            "error": None,
        }

    # No cancellation detected — proceed. status stays whatever it
    # already was (selecting_form on first entry, collecting_info on
    # a resumed turn), decided by the caller when constructing the
    # initial state for this invocation.
    return state