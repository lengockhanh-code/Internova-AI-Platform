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
    ),
    "Form 3": (
        "form 3", "khieu nai", "quay roi", "su co",
        "bao cao su co", "grievance", "harassment", "incident",
        "bi doi xu", "bi ep buoc", "khong an toan", "nguoc dai",
        "bi nguoc dai", "bi bat nat", "bat nat", "de doa",
        "hanh vi khong phu hop", "dung cham",
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


def detect_form(conversation_text: str) -> FormCode | None:
    """Return the best-matching form based on keyword phrases found in
    the conversation, or None if nothing matched clearly."""
    normalized = _normalize(conversation_text)

    scores: dict[FormCode, int] = {code: 0 for code in _FORM_KEYWORDS}

    for code, phrases in _FORM_KEYWORDS.items():
        for phrase in phrases:
            if phrase in normalized:
                scores[code] += 1

    best_code = max(scores, key=lambda c: scores[c])

    if scores[best_code] == 0:
        return None

    return best_code


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
                "Mình chưa xác định được bạn cần dùng biểu mẫu nào. "
                "Bạn có thể mô tả rõ hơn tình huống của mình không "
                "(vd: đăng ký thực tập, sự cố/khiếu nại, đánh giá cuối kỳ, "
                "thực tập quốc tế)?"
            ),
        }

    return {
        **state,
        "detected_form": form_code,
        "status": "collecting_info",
        "ask_message": None,
    }