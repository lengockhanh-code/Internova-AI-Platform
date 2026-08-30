"""nodes/form_selector.py — Identify which form applies.

FIX: this used to import detect_relevant_forms() from
src.rag.generation.form_directory, which doesn't exist in this repo.
Detection logic is now defined directly here (keyword-based matching,
self-contained) — no dependency outside form_agent/.

Trade-off: this is simpler than form_directory.py's original 3-layer
design (intent + keyword + semantic embedding) — it only does
keyword/phrase matching, no embedding-based generalization. That means
it won't catch every possible phrasing (e.g. a totally novel synonym
for "harassment" it hasn't seen), but it covers the realistic range of
ways students describe each situation, and is easy to extend by simply
adding more phrases to the lists below — no other file needs to change.

FIX (2nd pass): detect_form() previously used max() alone to pick the
winner, which silently returns the FIRST dict key ("Form 1") whenever
two or more forms tie in score. Now: a tie at the top score is treated
as ambiguous and returns None instead of guessing.

FIX (3rd pass): added a list of countries/regions to Form 2's keywords
so naming a country ("thực tập ở Singapore") is caught even without
the words "nước ngoài"/"quốc tế".

FIX (4th pass — important correctness fix): ALL matching here now uses
WHOLE-WORD matching, not substring matching. Previously, short
single-word phrases (e.g. the country codes "y", "anh", "my", "uc"
added in the 3rd pass) matched as a SUBSTRING anywhere in the
normalized text — so "y" alone matched inside "công ty" (contains
"...ty..." — wait, more precisely: normalized text is a single
space-joined string, and `"y" in normalized` is a substring check
across the WHOLE string, so it matches any occurrence of the letter
sequence "y" regardless of word boundaries, e.g. inside "ty" from
"công ty"). This caused a confirmed real bug: a question about being
forced to work unpaid overtime (clearly Form 3 territory) got
misdetected as Form 2, purely because the message contained the
substring "y" (from "công ty"). This is the exact same class of bug
already fixed once before in nodes/intent.py (the "huy" hidden inside
"chuyên" issue) — reusing that same whole-word matching strategy here
fixes it for good and keeps the two files consistent. Multi-word
phrases (e.g. "form 1", "thuc tap quoc te") still use substring
matching, which is safe since an exact multi-word sequence can't
accidentally occur inside a single unrelated token.
"""

from __future__ import annotations

import re
import unicodedata

from src.agents.form_agent.state import FormAgentState, FormCode

# form_agent's own FormCode -> matching phrases (accent-stripped,
# lowercase). Each list is intentionally broad: situational phrasings
# students actually use, not just the formal form name.
_FORM_KEYWORDS: dict[FormCode, tuple[str, ...]] = {
    "Form 1": (
        "form 1", "irf", "internship request form",
        "dang ky thuc tap", "dang ki thuc tap",
        "ho so thuc tap", "don thuc tap",
        "xin thuc tap", "duyet tin chi thuc tap", "can lam gi dau tien",
        "giay to dang ky", "giay to dang ki",
        "muon dang ky", "muon dang ki",
        "cho don dang ky", "cho don dang ki",
    ),
    "Form 2": (
        "form 2", "hold harmless", "release of liability",
        "mien tru trach nhiem", "cam ket trach nhiem",
        "thuc tap quoc te", "thuc tap nuoc ngoai",
        "thuc tap o nuoc ngoai", "thuc tap o quoc te",
        "nuoc ngoai", "quoc te",
        "di nuoc ngoai", "sang nuoc ngoai",
        "ky cam ket", "ki cam ket",
        # Các quốc gia/vùng lãnh thổ phổ biến sinh viên VinUni hay đi
        # thực tập. Tránh từ đơn như 'anh' (anh/chị), 'y' (ý kiến), 'my' (mỹ)
        # gây va chạm với đại từ và từ ngữ thông dụng tiếng Việt.
        "singapore", "nhat ban", "nhat", "han quoc", "trieu tien",
        "trung quoc", "hong kong", "dai loan",
        "nuoc my", "hoa ky", "hoa ki", "usa", "canada",
        "nuoc anh", "anh quoc", "vuong quoc anh", "uk", "phap", "duc", "ha lan",
        "thuy si", "thuy dien", "nuoc y", "italia", "italy", "tay ban nha",
        "uc", "australia", "new zealand", "niu di lan",
        "thai lan", "malaysia", "indonesia", "philippines",
        "an do", "dubai", "uae",
    ),
    "Form 3": (
        "form 3", "khieu nai", "don khieu nai", "quay roi", "su co",
        "bao cao su co", "grievance", "harassment", "incident",
        "bi doi xu", "bi ep buoc", "khong an toan", "nguoc dai",
        "bi nguoc dai", "bi bat nat", "bat nat", "de doa",
        "hanh vi khong phu hop", "khiem nha", "hanh vi khiem nha",
        "dung cham", "phan anh", "phan anh su co", "phan anh van de",
        # Các tình huống bị bóc lột/ép buộc lao động
        "ep lam them gio", "khong tra luong", "bi boc lot",
        "lam viec qua suc", "bi lam dung",
    ),
    "Form 4.3": (
        "form 4", "danh gia", "evaluation", "tu danh gia",
        "cham diem thuc tap", "nhan xet thuc tap", "thuc tap xong",
        "hoan tat mon hoc",
    ),
}


def _strip_accents(value: str) -> str:
    value = value.replace("đ", "d").replace("Đ", "D")
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(c for c in normalized if not unicodedata.combining(c))


def _normalize(text: str) -> str:
    stripped = _strip_accents(text or "").lower()
    return " ".join(re.findall(r"[a-z0-9]+", stripped))


def _matches_phrase(normalized_text: str, tokens: set[str], phrase: str) -> bool:
    """Multi-word phrase -> substring match is safe (an exact
    multi-word sequence can't accidentally occur inside a single
    unrelated token). Single-word phrase -> must match a WHOLE token,
    never a substring buried inside a longer, unrelated word — see
    module docstring for the concrete bug this prevents."""
    if " " in phrase:
        return phrase in normalized_text
    return phrase in tokens


def _score_text(normalized: str, tokens: set[str]) -> dict[FormCode, int]:
    scores: dict[FormCode, int] = {code: 0 for code in _FORM_KEYWORDS}
    for code, phrases in _FORM_KEYWORDS.items():
        for phrase in phrases:
            if _matches_phrase(normalized, tokens, phrase):
                scores[code] += 1
    return scores


def _best_from_scores(scores: dict[FormCode, int]) -> FormCode | None:
    best_score = max(scores.values())
    if best_score == 0:
        return None
    top_codes = [code for code, score in scores.items() if score == best_score]
    if len(top_codes) > 1:
        return None
    return top_codes[0]


def detect_form(conversation_text: str) -> FormCode | None:
    """Return the best-matching form based on keyword phrases found in
    the conversation, or None if nothing matched clearly (including
    when the match is ambiguous — see module docstring).

    FIX (5th pass): the frontend calls this with
    text = "<user's original question>\\n<RAG's answer>" (see
    checkFormRelevance in page.tsx). A RAG answer that mentions
    multiple forms — one as its confident main recommendation, another
    only as a hedged aside ("chưa xác nhận... nên liên hệ...") — can
    out-score the actually-recommended form purely because the hedged
    mention happens to use more distinct keywords (e.g. a Singapore
    internship question where the answer leads with Form 1 but also
    mentions Form 2/"quốc tế" uncertainly). Keyword counting has no
    concept of "confident" vs "hedged" language, so it can't fix this
    by itself.

    Practical, LOW-RISK mitigation without needing any frontend or
    other-file changes: split off just the first line (the user's own
    original question, per the format above) and score THAT first —
    the student's own wording is a strong, uncontaminated signal.
    Only fall back to scoring the full text (question + RAG answer)
    when the first line alone doesn't clearly match anything. This
    doesn't fully solve "confident vs hedged" in the RAG answer text,
    but it means many cases are now decided by the student's actual
    question before the RAG answer's phrasing can pull the result
    toward a form it only mentioned in passing.
    """
    first_line = conversation_text.split("\n", 1)[0] if conversation_text else ""

    if first_line.strip():
        normalized_first = _normalize(first_line)
        tokens_first = set(normalized_first.split())
        first_line_result = _best_from_scores(_score_text(normalized_first, tokens_first))
        if first_line_result is not None:
            return first_line_result

    normalized = _normalize(conversation_text)
    tokens = set(normalized.split())
    return _best_from_scores(_score_text(normalized, tokens))


def form_selector_node(state: FormAgentState) -> FormAgentState:
    if state.get("detected_form"):
        return {**state, "status": "collecting_info"}

    conversation_text = state.get("conversation_text", "")
    form_code = detect_form(conversation_text)

    if form_code is None:
        return {
            **state,
            "status": "selecting_form",
            "ask_message": (
                "Mình chưa xác định được bạn muốn điền form nào. "
                "Bạn muốn mình điền Form 1, Form 2, Form 3 hay Form 4.3?\n\n"
                "Ví dụ: 'điền Form 1 đăng ký thực tập' hoặc 'điền Form 2 thực tập quốc tế'."
            ),
        }

    return {
        **state,
        "detected_form": form_code,
        "status": "collecting_info",
        "ask_message": None,
    }