"""nodes/collect_info.py — Extract known fields, ask for what's missing.

This is the node most likely to run MULTIPLE TIMES across separate
graph invocations (one per chat turn) rather than looping internally
in a single run — see graph.py's module docstring for how the caller
is expected to drive multi-turn collection. Each call:

  1. Re-extracts field values from the full conversation_text so far
     (including anything the student just added this turn).
  2. Merges newly-found values into the existing field_values.
  3. If any field the student just tried to provide was REJECTED by
     the guardrail in form_tool.py (unreasonable/fake/inappropriate
     content, or a bad email/student_id format), that takes priority
     over the generic "still missing" message — the student gets a
     specific corrective message instead, and repeated invalid
     attempts escalate to a firmer warning (see
     build_rejection_message in form_tool.py).
  4. Otherwise, checks what's still missing. If something required is
     still missing, sets ask_message and status stays
     "collecting_info" — the caller should show ask_message to the
     student and wait for their next message before invoking the
     graph again.
  5. Once nothing required is missing, asks ONE time whether the
     student wants to add any optional info (see
     build_optional_info_offer_message in form_tool.py) — this makes
     it explicit that unfilled optional fields (many of which are
     company-side HR details on Form 1) are not something the student
     is expected to know, rather than silently leaving a mostly-blank
     form with no explanation.
  6. Only after that one-time offer has been made does status become
     "ready_to_fill" and the graph moves on to form_filler.py.

FIX (merge logic): a fresh, non-null extraction always overwrites the
existing value for that field — extract_fields() re-reads the WHOLE
conversation every call, so a non-null result reflects the model's
best current read of the truth, including any correction the student
just made (e.g. "à nhầm, công ty là B chứ không phải A"). Only a None
result (field not found this time, e.g. that batch's LLM call errored,
or the field genuinely isn't mentioned) falls back to the existing
value, so already-confirmed info is never silently lost.

FIX (guardrail / rejection messages): previously extract_fields()
returned only a plain dict of values, with no way to tell "field is
still missing" apart from "student provided something but it was
rejected as invalid". Both cases just showed the same generic
"cần thêm thông tin sau" message, which doesn't explain WHY a field
still shows as missing after the student just answered it — feels
like the agent ignored them. Now extract_fields() also returns
`flags` (field name -> short reason), and this node tracks
`invalid_field_attempts` per field in state so build_rejection_message
can escalate wording on repeated invalid attempts, rather than
repeating the same polite ask forever.
"""

from __future__ import annotations

from src.agents.form_agent.state import FormAgentState
from src.agents.form_agent.tools.form_tool import (
    build_ask_message,
    build_optional_info_offer_message,
    build_rejection_message,
    extract_fields,
    find_missing_required,
)


def collect_info_node(state: FormAgentState) -> FormAgentState:
    form_code = state.get("detected_form")

    if form_code is None:
        # Should not happen if graph edges are wired correctly (this
        # node only runs after form_selector), but fail loudly rather
        # than silently continuing with no form context.
        return {
            **state,
            "status": "selecting_form",
            "error": "collect_info_node reached with no detected_form",
        }

    conversation_text = state.get("conversation_text", "")
    existing_values = dict(state.get("field_values") or {})
    attempt_counts = dict(state.get("invalid_field_attempts") or {})

    extracted_values, flags = extract_fields(conversation_text, form_code)

    # Merge: a fresh, non-null extraction always wins for general fields.
    # For profile identity fields (student name, ID, email, intake, college),
    # if we already have a verified profile value from DB, preserve it to maintain
    # personalization and ensure students only submit under their own verified identity.
    profile_identity_keys = {
        "name_in_full",
        "student_id",
        "email",
        "intake",
        "college",
        "student_full_name",
        "student_name_printed",
    }

    merged_values = dict(existing_values)
    for key, value in extracted_values.items():
        if value:
            if key in profile_identity_keys and existing_values.get(key):
                continue
            merged_values[key] = value

    # Update the repeated-attempt counter: increment for fields
    # flagged again this turn, reset (drop) for fields that are now
    # successfully filled (either just now or from an earlier turn) —
    # a field that's finally valid shouldn't keep an escalated-warning
    # history hanging around if the student later needs to correct it
    # again for an unrelated reason.
    next_attempt_counts = dict(attempt_counts)
    for field_name in flags:
        next_attempt_counts[field_name] = attempt_counts.get(field_name, 0) + 1
    for field_name in list(next_attempt_counts):
        if merged_values.get(field_name):
            next_attempt_counts.pop(field_name, None)

    if flags:
        rejection_message = build_rejection_message(flags, form_code, attempt_counts)
        return {
            **state,
            "field_values": merged_values,
            "invalid_field_attempts": next_attempt_counts,
            "ask_message": rejection_message,
            "status": "collecting_info",
        }

    missing_names = find_missing_required(merged_values, form_code)

    if missing_names:
        student_name = merged_values.get("name_in_full") or merged_values.get("student_full_name")
        student_code = merged_values.get("student_id")
        ask_message = build_ask_message(
            missing_names, form_code, student_name=student_name, student_id=student_code
        )
        return {
            **state,
            "field_values": merged_values,
            "invalid_field_attempts": next_attempt_counts,
            "missing_required_field_names": missing_names,
            "ask_message": ask_message,
            "status": "collecting_info",
        }

    # All required fields satisfied -> proceed immediately to filling form and review
    return {
        **state,
        "field_values": merged_values,
        "invalid_field_attempts": next_attempt_counts,
        "missing_required_field_names": [],
        "ask_message": None,
        "status": "ready_to_fill",
    }