"""state.py — State schema for the form-filling agent subgraph.

Deliberately isolated from src/agents/state.py (the team's main RAG
AgentState) — this graph is invoked as its OWN, separate run, only
after the main RAG chat has already given advice and the student has
said yes to "muốn mình giúp điền đơn không?". The two graphs do not
share state directly; the caller (wherever demo.py or the outer chat
loop decides to start this graph) is responsible for passing in
whatever conversation context is needed via `conversation_text`.

Because filling a form is a MULTI-TURN process (collect_info may need
to ask the student for missing fields and wait for their next message
before it can proceed), this state is meant to be persisted between
graph invocations by the caller (e.g. in st.session_state), not
assumed to complete in a single graph.invoke() call. See graph.py's
module docstring for how a turn-by-turn caller should drive this.

FIX: FormCode is defined directly here instead of imported from
src.rag.generation.form_filler, so this file has zero dependency on
anything outside the form_agent/ subtree — nothing here can break or
show an import error based on what does or doesn't exist in the shared
src/rag/generation/ folder the rest of the team works in.

Current behavior: ambiguous form choice is handled by form_selector asking which form to fill; no separate first-turn confirmation status is used.
"""

from __future__ import annotations

from typing import Literal, TypedDict

FormCode = Literal["Form 1", "Form 2", "Form 3", "Form 4.3"]


FormAgentStatus = Literal[
    "selecting_form",         # form not yet identified
    "collecting_info",        # form known, still missing required fields
    "ready_to_fill",          # all required fields present, about to generate docx
    "awaiting_review",        # docx generated, waiting on student confirmation
    "approved",               # student confirmed — done, file ready for download
    "cancelled",               # student declined to continue
]


class FormAgentState(TypedDict, total=False):
    # ── Input / running context ─────────────────────────────────────
    conversation_text: str
    """Full conversation so far (advice turn + form-filling turns),
    used as context for field extraction. Caller appends each new user
    message here before re-invoking the graph."""

    latest_user_message: str
    """Just the newest message from the student this turn — used by
    intent.py to check for cancellation, and appended to
    conversation_text by the caller before invocation."""

    # ── Form selection ───────────────────────────────────────────────
    detected_form: FormCode | None
    """Which of Form 1 / Form 2 / Form 3 / Form 4.3 applies. Set by
    form_selector.py, reusing src.rag.generation.form_directory's
    existing detection logic (deterministic + semantic) — not
    reimplemented here."""

    # ── Field collection ─────────────────────────────────────────────
    field_values: dict[str, str | None]
    """Field name -> value collected so far. Grows across turns as the
    student answers follow-up questions."""

    missing_required_field_names: list[str]
    """Required fields still missing after the latest extraction pass.
    Empty list means ready to move on to form_filler.py."""

    ask_message: str | None
    """The question to show the student this turn, when
    missing_required_field_names is non-empty. None once nothing more
    is needed."""

    optional_offer_made: bool
    """True once collect_info.py has asked its one-time 'anything else
    you'd like to add?' question for optional (non-required) fields.
    Prevents asking this every turn — only asked once, right after all
    required fields are satisfied, before moving on to form_filler."""

    # ── Filling + review ──────────────────────────────────────────────
    filled_docx_bytes: bytes | None
    """The generated, filled .docx — produced by form_filler.py (node),
    shown to the student in human_review.py before being offered for
    download. Never sent anywhere automatically."""

    review_summary_markdown: str | None
    """Human-readable summary of what was filled, for the review step
    (from form_filler.summarize_filled_form)."""

    human_approved: bool
    """True only after the student has explicitly confirmed the
    filled form is correct. Nothing downstream of this point should
    ever be auto-triggered without this being True first."""

    # ── Control ───────────────────────────────────────────────────────
    status: FormAgentStatus

    error: str | None
    """Set if something failed (e.g. template file missing, LLM call
    error) — caller should surface this to the student plainly rather
    than silently failing."""