"""memory.py — Chat history management for multi-turn conversations.

Stores recent turns plus a small deterministic conversation state so follow-up
questions such as "còn cái này?", "nó có cần ký không?", or "những form gì?"
can be resolved without an extra LLM call.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone


@dataclass
class ResponsePreferences:
    language: str | None = None
    style: str | None = None


@dataclass
class ConversationState:
    active_domain: str | None = None
    active_subject: str | None = None
    active_form_number: str | None = None
    active_entity: str | None = None
    last_user_query: str | None = None


@dataclass
class ConversationTurn:
    query: str
    answer: str
    answer_status: str
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class ConversationMemory:
    """Manages chat history and lightweight topic state for one session.

    The state is deliberately deterministic: no additional LLM call is made.
    It is used only to resolve conversational references. It is never treated
    as documentary evidence.
    """

    _FORM_RE = re.compile(
        r"\bform\s*[-_#:]?\s*(\d+(?:\.\d+)?)\b",
        flags=re.IGNORECASE,
    )

    _FOLLOWUP_PREFIXES = (
        "con ",
        "còn ",
        "vay ",
        "vậy ",
        "the ",
        "thế ",
        "neu vay",
        "nếu vậy",
        "what about",
        "how about",
        "and ",
    )

    _REFERENCE_PHRASES = (
        "no ",
        "nó ",
        "cai nay",
        "cái này",
        "cai do",
        "cái đó",
        "mau do",
        "mẫu đó",
        "form do",
        "form đó",
        "truong hop do",
        "trường hợp đó",
        "viec do",
        "việc đó",
        "it ",
        "that ",
        "this ",
    )

    def __init__(
        self,
        max_turns: int = 8,
        session_id: str | None = None,
    ) -> None:
        self.max_turns = max_turns
        self.session_id = session_id
        self._turns: list[ConversationTurn] = []
        self.preferences = ResponsePreferences()
        self.state = ConversationState()

    def add_turn(
        self,
        query: str,
        answer: str,
        answer_status: str = "answered",
    ) -> None:
        """Add a Q&A turn and update conversational topic state."""
        self._turns.append(
            ConversationTurn(
                query=query,
                answer=answer,
                answer_status=answer_status,
            )
        )

        if len(self._turns) > self.max_turns:
            self._turns = self._turns[-self.max_turns :]

        self._update_state_from_query(query)

    def get_context_window(
        self,
        n_turns: int | None = None,
        max_answer_chars: int = 900,
    ) -> str:
        """Return structured recent history for router/planner/generation.

        User messages are preserved because they often contain important facts
        (GPA, completed steps, Form number, etc.). Long assistant answers are
        truncated to avoid drowning the current query in stale text.
        """
        turns = self._turns[-(n_turns or self.max_turns) :]

        if not turns and not any(
            (
                self.state.active_domain,
                self.state.active_subject,
                self.state.active_form_number,
                self.state.active_entity,
                self.preferences.language,
                self.preferences.style,
            )
        ):
            return ""

        lines: list[str] = [
            "[Conversation State]",
            (
                f"Active domain: {self.state.active_domain}"
                if self.state.active_domain
                else "Active domain: unknown"
            ),
            (
                f"Active subject: {self.state.active_subject}"
                if self.state.active_subject
                else "Active subject: unknown"
            ),
            (
                f"Active form: Form {self.state.active_form_number}"
                if self.state.active_form_number
                else "Active form: none"
            ),
            (
                f"Active entity: {self.state.active_entity}"
                if self.state.active_entity
                else "Active entity: none"
            ),
            (
                "Important: history is only for resolving references and user "
                "constraints. A previous failed assistant answer does NOT erase "
                "or invalidate the user's earlier facts/topic, and history is "
                "never documentary evidence."
            ),
            "",
            "[Response Preferences]",
            (
                f"Preferred language: {self.preferences.language}"
                if self.preferences.language
                else "Preferred language: follow the current user message"
            ),
            (
                f"Preferred style: {self.preferences.style}"
                if self.preferences.style
                else "Preferred style: normal"
            ),
            (
                "These are presentation preferences only; they must never change "
                "routing, factual requirements, evidence, or policy conclusions."
            ),
            "",
            "[Recent Conversation]",
        ]

        for index, turn in enumerate(turns, start=1):
            lines.append(f"Turn {index} User: {turn.query}")

            if turn.answer_status == "answered":
                compact_answer = self._compact_text(
                    turn.answer,
                    max_chars=max_answer_chars,
                )
                lines.append(f"Turn {index} Assistant: {compact_answer}")
            else:
                lines.append(
                    f"Turn {index} Assistant: "
                    "(previous answer was not completed; preserve the user's "
                    "topic and stated constraints)"
                )

        return "\n".join(lines)

    def resolve_followup_query(self, query: str) -> str:
        """Resolve short/vague follow-ups using deterministic session state.

        This returns a retrieval/routing helper query only. The original user
        message should still be used for the final answer.
        """
        cleaned = " ".join((query or "").strip().split())
        if not cleaned:
            return cleaned

        if self._FORM_RE.search(cleaned):
            return cleaned

        normalized = self._normalize(cleaned)

        # Generic inventory questions should stay in the internship-form domain
        # when the conversation is already about internships/forms.
        if self.state.active_domain == "internship":
            if (
                "form" in normalized
                and any(
                    phrase in normalized
                    for phrase in (
                        "nhung form gi",
                        "co nhung form gi",
                        "cac form nao",
                        "nhung form nao",
                        "form gi",
                        "danh sach form",
                        "liet ke form",
                        "all forms",
                        "which forms",
                        "what forms",
                    )
                )
            ):
                return f"VinUniversity internship forms — {cleaned}"

        is_followup = (
            any(
                normalized.startswith(prefix.strip())
                for prefix in self._FOLLOWUP_PREFIXES
            )
            or any(
                phrase.strip() in normalized
                for phrase in self._REFERENCE_PHRASES
            )
            or (
                len(cleaned) <= 80
                and any(
                    token in normalized.split()
                    for token in (
                        "no",
                        "nay",
                        "do",
                        "vay",
                        "the",
                        "con",
                        "it",
                        "this",
                        "that",
                    )
                )
            )
        )

        if not is_followup:
            return cleaned

        # Only bind a pronoun directly to Form-N when the active subject is
        # actually that form. A long internship case may merely MENTION Form 1;
        # in that case a follow-up like "vậy em thiếu bước gì?" refers to the
        # whole case, not only Form 1.
        if (
            self.state.active_subject == "form"
            and self.state.active_form_number
        ):
            return (
                f"Regarding VinUniversity Form {self.state.active_form_number}: "
                f"{cleaned}"
            )

        if self.state.active_subject == "internship_case":
            return (
                "Regarding the student's current VinUniversity internship "
                f"case and previously stated constraints: {cleaned}"
            )

        return cleaned

    def get_active_form_number(self) -> str | None:
        return self.state.active_form_number

    def update_preferences(
        self,
        language: str | None = None,
        style: str | None = None,
    ) -> None:
        if language:
            self.preferences.language = language
        if style:
            self.preferences.style = style

    def get_preferences(self) -> ResponsePreferences:
        return self.preferences

    def get_recent_queries(self, n: int = 3) -> list[str]:
        return [turn.query for turn in self._turns[-n:]]

    def clear(self) -> None:
        self._turns.clear()
        self.state = ConversationState()

    @property
    def turn_count(self) -> int:
        return len(self._turns)

    @property
    def turns(self) -> list[ConversationTurn]:
        return list(self._turns)

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "max_turns": self.max_turns,
            "turn_count": self.turn_count,
            "preferences": asdict(self.preferences),
            "state": asdict(self.state),
            "turns": [
                {
                    "query": turn.query,
                    "answer": turn.answer,
                    "answer_status": turn.answer_status,
                    "timestamp": turn.timestamp,
                }
                for turn in self._turns
            ],
        }

    def _update_state_from_query(self, query: str) -> None:
        self.state.last_user_query = query

        normalized = self._normalize(query)
        match = self._FORM_RE.search(query or "")

        internship_case_signals = sum(
            1
            for token in (
                "gpa",
                "foundation",
                "orientation",
                "company",
                "cty",
                "job",
                "major",
                "approval",
                "approve",
                "internship",
                "thuc tap",
            )
            if token in normalized
        )

        if match:
            self.state.active_form_number = match.group(1)
            self.state.active_entity = f"Form {match.group(1)}"
            self.state.active_domain = "internship"

            # A form mentioned inside a complex case is not automatically the
            # subject of the conversation.
            if internship_case_signals >= 3 and len(query) > 140:
                self.state.active_subject = "internship_case"
            else:
                self.state.active_subject = "form"

        if any(
            token in normalized
            for token in (
                "internship",
                "thuc tap",
                "irf",
                "foundation course",
                "orientation",
                "gpa",
                "form",
            )
        ):
            self.state.active_domain = "internship"

            if (
                not match
                and internship_case_signals >= 2
            ):
                self.state.active_subject = "internship_case"

        if any(
            token in normalized
            for token in (
                "career",
                "talent handbook",
                "cv",
                "job search",
            )
        ):
            self.state.active_domain = "career"
            self.state.active_subject = "career"
            if "form" not in normalized:
                self.state.active_form_number = None

        if "capstone" in normalized:
            self.state.active_domain = "capstone"
            self.state.active_subject = "capstone"
            self.state.active_form_number = None

    @staticmethod
    def _normalize(value: str) -> str:
        text = (value or "").replace("đ", "d").replace("Đ", "D")
        text = unicodedata.normalize("NFKD", text)
        text = "".join(
            char
            for char in text
            if not unicodedata.combining(char)
        )
        return " ".join(text.lower().split())

    @staticmethod
    def _compact_text(value: str, max_chars: int) -> str:
        compact = " ".join((value or "").split())

        if len(compact) <= max_chars:
            return compact

        truncated = compact[:max_chars]
        cutoff = truncated.rfind(" ")

        if cutoff >= max_chars // 2:
            truncated = truncated[:cutoff]

        return truncated.rstrip() + " …"