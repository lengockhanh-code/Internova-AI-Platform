"""Entry node for the form-filling agent.

The caller should only invoke this graph after the student has expressed a
real form-filling intent. Once invoked, the agent must not ask a second
"do you want me to help?" confirmation. Instead, it proceeds to form
selection; if the form is still unclear, form_selector asks which form the
student wants to fill.

This node only owns cancellation for an already-active form-filling flow.
"""

from __future__ import annotations

from src.agents.form_agent.state import FormAgentState

_CANCEL_SESSION_PHRASES = (
    "huy",
    "huy phien",
    "huy don",
    "huy dien don",
    "dung lai",
    "dung phien",
    "dung dien don",
    "thoi khong lam nua",
    "thoi khong dien nua",
    "khong muon lam nua",
    "khong dien nua",
    "cancel",
)

_REJECT_OFFER_PHRASES = (
    "thoi khoi",
    "khong can",
    "khong can dau",
    "khong can nua",
    "khoi",
    "khong",
    "thoi",
    "de sau",
    "no",
    "never mind",
    "not now",
    "not anymore",
)

_CANCEL_PHRASES = _CANCEL_SESSION_PHRASES + _REJECT_OFFER_PHRASES


def _normalize(text: str) -> str:
    import re
    import unicodedata

    value = (text or "").replace("đ", "d").replace("Đ", "D")
    normalized = unicodedata.normalize("NFKD", value)
    stripped = "".join(c for c in normalized if not unicodedata.combining(c))
    return " ".join(re.findall(r"[a-z0-9]+", stripped.lower()))


def _matches_whole_word_or_phrase(normalized_text: str, phrases: tuple[str, ...]) -> bool:
    tokens = set(normalized_text.split())

    for phrase in phrases:
        if " " in phrase:
            if phrase in normalized_text:
                return True
        elif phrase in tokens:
            return True

    return False


def _matches_cancel_phrase(normalized_text: str) -> bool:
    return _matches_whole_word_or_phrase(normalized_text, _CANCEL_PHRASES)


def _matches_cancel_session_phrase(normalized_text: str) -> bool:
    return _matches_whole_word_or_phrase(normalized_text, _CANCEL_SESSION_PHRASES)


def intent_node(state: FormAgentState) -> FormAgentState:
    latest = _normalize(state.get("latest_user_message", ""))

    if latest and _matches_cancel_session_phrase(latest):
        return {
            **state,
            "status": "cancelled",
            "error": None,
        }

    return state