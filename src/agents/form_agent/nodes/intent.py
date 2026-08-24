"""nodes/intent.py — Entry node: confirm the student wants to proceed.

This node handles TWO checks, both using the same whole-word matching
strategy (see _matches_cancel_phrase's docstring for why substring
matching is unsafe with short Vietnamese words):

  1. Cancellation (any turn): if the student says "thôi khỏi", "hủy",
     etc., end the session gracefully instead of continuing to ask
     for fields.

  2. Confirmation (FIRST turn of a session only): previously this
     graph assumed the caller (frontend) had already gotten an
     explicit "yes" from the student — e.g. via a button click —
     before ever invoking this graph, so no confirmation check
     happened here at all.

     FIX: the product now wants the student to be able to just reply
     in plain chat text (no button) after the RAG answer suggests a
     form, in ANY wording that means "yes, help me" — but explicitly
     NOT "any text at all", to avoid accidentally starting a whole
     multi-turn field-collection flow because the student typed
     something unrelated right after that answer.

     So: on the first turn of a session (no form detected yet, no
     fields collected yet), the message is checked against a
     whole-word confirm-phrase list. Only a clear match proceeds to
     form_selector. Anything that's neither a clear "yes" nor a clear
     "no" (cancel phrase) is treated as UNCLEAR — the session does not
     silently start; instead the student gets asked to confirm
     explicitly. This intentionally avoids guessing on ambiguous input
     (the same principle as detect_form() in form_selector.py
     returning None on a tie rather than picking one).
"""

from __future__ import annotations

from src.agents.form_agent.state import FormAgentState

# Phrases that unambiguously mean aborting/cancelling an ongoing form-filling session
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

# Phrases that decline a first-turn / RAG suggestion offer before a session starts
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

# Combined cancel phrases for bridge.py / general offer rejection checking
_CANCEL_PHRASES = _CANCEL_SESSION_PHRASES + _REJECT_OFFER_PHRASES

# Whole-word / short-phrase confirmations. Kept deliberately narrow —
# these are the ways a student naturally replies "yes" to a direct
# yes/no question ("Cần mình giúp điền Form 3 luôn không?"), not a
# general "sounds affirmative somewhere in this sentence" list. A
# reply must consist of (mostly) one of these, not just contain one
# buried in an unrelated longer message — see _matches_confirm_phrase.
_CONFIRM_PHRASES = (
    "co", "uh", "um", "uk", "ukm", "ok", "okay", "duoc", "duoc roi",
    "dong y", "vang", "ung", "roi", "yes", "yep", "sure",
    "giup minh", "giup minh voi", "giup mik", "giup mik voi",
    "giup em", "giup em voi", "giup toi", "giup toi voi",
    "lam luon", "dien luon", "dien di", "lam di",
    "minh can", "em can", "mik can", "can lam", "can giup",
    "lam giup", "lam ho", "lam gium", "dien giup", "dien ho", "dien gium",
    "tao giup", "tao don", "dien form", "lam form",
    "lam giup minh", "lam giup em", "lam giup mik",
    "dien giup minh", "dien giup em", "dien giup mik",
    "nho ban", "ho tro", "bat dau", "tien hanh",
)


def _normalize(text: str) -> str:
    import re
    import unicodedata

    value = (text or "").replace("đ", "d").replace("Đ", "D")
    normalized = unicodedata.normalize("NFKD", value)
    stripped = "".join(c for c in normalized if not unicodedata.combining(c))
    return " ".join(re.findall(r"[a-z0-9]+", stripped.lower()))


def _matches_whole_word_or_phrase(normalized_text: str, phrases: tuple[str, ...]) -> bool:
    """Shared matcher: multi-word phrases match as a substring (safe,
    since an exact multi-word sequence can't accidentally occur inside
    a single unrelated token); single-word phrases must match a WHOLE
    token, never a substring buried inside a longer, unrelated word
    (e.g. "huy" inside "chuyen").
    """
    tokens = set(normalized_text.split())

    for phrase in phrases:
        if " " in phrase:
            if phrase in normalized_text:
                return True
        else:
            if phrase in tokens:
                return True

    return False


def _matches_cancel_phrase(normalized_text: str) -> bool:
    return _matches_whole_word_or_phrase(normalized_text, _CANCEL_PHRASES)


def _matches_cancel_session_phrase(normalized_text: str) -> bool:
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
    yet and no fields collected yet. Used to scope the confirmation
    check to the very first message only; subsequent turns (already
    mid-collection) never need to re-confirm."""
    return not state.get("detected_form") and not state.get("field_values")


def intent_node(state: FormAgentState) -> FormAgentState:
    latest = _normalize(state.get("latest_user_message", ""))

    # 1. Any turn: student explicitly requests to cancel/abort the active session
    if latest and _matches_cancel_session_phrase(latest):
        return {
            **state,
            "status": "cancelled",
            "error": None,
        }

    # 2. First turn of a session only: check if student confirmed or declined the offer
    if _is_first_turn(state):
        if latest and _matches_cancel_phrase(latest):
            return {
                **state,
                "status": "cancelled",
                "error": None,
            }

        if _matches_confirm_phrase(latest):
            # Clear yes — proceed to form_selector as normal.
            return state

        # Neither a clear yes nor a clear no. Don't guess and don't
        # silently start a multi-turn field-collection flow off an
        # unrelated message — ask explicitly instead.
        return {
            **state,
            "status": "awaiting_confirmation",
            "ask_message": (
                "Bạn có muốn mình giúp điền form này không? "
                "Trả lời 'có' để mình bắt đầu nhé."
            ),
        }

    # 3. Resumed turn mid-session: student is providing information or skipping optional fields
    return state