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
    tokens = normalized_text.split()
    # A cancellation command is a short command (<= 6 tokens), not an incident description or long message!
    if len(tokens) > 6:
        return False
    return _matches_whole_word_or_phrase(normalized_text, _CANCEL_SESSION_PHRASES)


def _matches_confirm_phrase(normalized_text: str) -> bool:
    """Clear 'yes, go ahead' reply — not just any message that happens
    to contain a positive-sounding word somewhere. Requires the
    message to be short (a direct reply, not an unrelated longer
    sentence that happens to include e.g. "có" in passing) AND match
    one of the confirm phrases as a whole word/phrase.
    """
    if not normalized_text:
        return False

    # A direct "yes" reply to a yes/no question is short. A longer
    # message is more likely to be an unrelated question or statement
    # that merely contains a common word like "có" — don't guess on
    # those; require explicit confirmation instead.
    if len(normalized_text.split()) > 10:
        return False

    return _matches_whole_word_or_phrase(normalized_text, _CONFIRM_PHRASES)


def _is_first_turn(state: FormAgentState) -> bool:
    """True only for a genuinely fresh session — no form identified
    yet and no non-profile fields collected yet."""
    if state.get("detected_form"):
        return False
    non_profile_values = [
        k for k, v in (state.get("field_values") or {}).items()
        if v and k not in (
            "name_in_full", "student_id", "email", "college", "intake",
            "student_full_name", "student_name_printed",
        )
    ]
    return len(non_profile_values) == 0


def intent_node(state: FormAgentState) -> FormAgentState:
    latest = _normalize(state.get("latest_user_message", ""))

    if latest and _matches_cancel_session_phrase(latest):
        return {
            **state,
            "status": "cancelled",
            "ask_message": "Đã hủy phiên điền đơn theo yêu cầu của bạn. Nếu cần hỗ trợ gì khác, bạn cứ nhắn cho mình nhé!",
            "error": None,
        }

    return state