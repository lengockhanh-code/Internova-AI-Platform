"""memory.py — Chat history management for multi-turn conversations.

Stores recent turns plus a small deterministic conversation state so follow-up
questions such as "còn cái này?", "nó có cần ký không?", or "những form gì?"
can be resolved without an extra LLM call.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone


@dataclass
class ResponsePreferences:
    language: str | None = None
    style: str | None = None


@dataclass
class ConversationState:
    conversation_language: str | None = None
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

        # Raw text is stored; semantic state is updated only by apply_semantic_route().
        self.state.last_user_query = query

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
                f"Conversation language: {self.state.conversation_language}"
                if self.state.conversation_language
                else "Conversation language: infer semantically from recent turns"
            ),
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
                "Important: history/state is only a hint for resolving references. "
                "The CURRENT user message is authoritative and may correct/reject "
                "an active entity. A previous assistant answer is not a user fact, "
                "and history is never documentary evidence."
            ),
            "",
            "[Response Preferences]",
            (
                f"Preferred language: {self.preferences.language}"
                if self.preferences.language
                else "Preferred language: none (use semantic session-language policy)"
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


    def apply_semantic_route(self, route: object) -> None:
        """Update topic + language state only from the semantic-router decision."""
        response_language = getattr(route, "response_language", None)
        if (
            getattr(route, "session_language_update", False)
            and response_language in {"vi", "en"}
        ):
            self.state.conversation_language = response_language

        if (
            getattr(route, "persist_response_language", False)
            and response_language in {"vi", "en"}
        ):
            self.preferences.language = response_language
            self.state.conversation_language = response_language

        response_style = getattr(route, "response_style", None)
        if (
            getattr(route, "persist_response_style", False)
            and response_style in {"shorter", "simpler"}
        ):
            self.preferences.style = response_style

        intent = str(getattr(route, "intent", "") or "")
        relation = str(
            getattr(route, "followup_relation", "new_request") or "new_request"
        )
        form_number = getattr(route, "referenced_form_number", None)
        target = getattr(route, "conversation_target", None)

        if relation == "correction" and intent == "form_guidance" and not form_number:
            self.state.active_form_number = None
            self.state.active_entity = None

        if intent == "form_guidance":
            self.state.active_domain = "internship"
            self.state.active_subject = "form"
            if form_number:
                self.state.active_form_number = str(form_number)
                self.state.active_entity = f"Form {form_number}"
            elif relation in {"new_request", "correction", "topic_switch"}:
                self.state.active_form_number = None
                self.state.active_entity = str(target) if target else None
        elif intent.startswith("internship_"):
            self.state.active_domain = "internship"
            self.state.active_subject = "internship_case"
        elif intent == "career_opportunity":
            self.state.active_domain = "career"
            self.state.active_subject = "career"
            self.state.active_form_number = None
        elif intent == "capstone":
            self.state.active_domain = "capstone"
            self.state.active_subject = "capstone"
            self.state.active_form_number = None

    def get_active_form_number(self) -> str | None:
        return self.state.active_form_number

    def get_response_language_hint(self) -> str | None:
        if self.preferences.language in {"vi", "en"}:
            return self.preferences.language
        if self.state.conversation_language in {"vi", "en"}:
            return self.state.conversation_language
        return None

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
        self.preferences = ResponsePreferences()
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