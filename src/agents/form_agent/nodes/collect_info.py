"""nodes/collect_info.py — Extract known fields, ask for what's missing.

This is the node most likely to run MULTIPLE TIMES across separate
graph invocations (one per chat turn) rather than looping internally
in a single run — see graph.py's module docstring for how the caller
is expected to drive multi-turn collection. Each call:

  1. Re-extracts field values from the full conversation_text so far
     (including anything the student just added this turn).
  2. Merges newly-found values into the existing field_values.
  3. Checks what's still missing. If something required is still
     missing, sets ask_message and status stays "collecting_info" —
     the caller should show ask_message to the student and wait for
     their next message before invoking the graph again.
  4. Once nothing required is missing, asks ONE time whether the
     student wants to add any optional info (see
     build_optional_info_offer_message in form_tool.py) — this makes
     it explicit that unfilled optional fields (many of which are
     company-side HR details on Form 1) are not something the student
     is expected to know, rather than silently leaving a mostly-blank
     form with no explanation.
  5. Only after that one-time offer has been made does status become
     "ready_to_fill" and the graph moves on to form_filler.py.

FIX: merge logic previously only filled GAPS — a field that already
had a value could never be updated by a later extraction, even when
that later extraction was reading an explicit correction from the
student (e.g. "à nhầm, công ty là B chứ không phải A"). This directly
broke the "correction" flow described in form_agent_routes.py
(POST /turn while status == "awaiting_review" is documented as a
correction request), because the corrected value from the student's
new message could never overwrite the old one — the old, wrong value
stayed locked in and the regenerated .docx kept showing it.

The fix is simply: trust each fresh extraction's non-null values and
let them overwrite (extract_fields() re-reads the WHOLE conversation
every call, so a non-null result reflects the most current, complete
context — including any correction the student just made). Protection
against a flaky/failed LLM call losing data is already handled
separately and correctly: _extract_fields_batch() returns None per
field on error, and `if value:` below simply skips None values,
leaving the existing (already correct) value untouched. No extra
"don't overwrite" guard is needed on top of that.
"""

from __future__ import annotations

from src.agents.form_agent.state import FormAgentState
from src.agents.form_agent.tools.form_tool import (
    build_ask_message,
    build_optional_info_offer_message,
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

    extracted = extract_fields(conversation_text, form_code)

    # Merge: a fresh, non-null extraction always wins — extract_fields()
    # re-reads the FULL conversation each turn, so a non-null result is
    # the model's best current read of the truth, including any
    # correction the student just made. Only a None result (field not
    # found this time, e.g. because that batch's LLM call errored, or
    # the field genuinely isn't mentioned) falls back to the existing
    # value, so we never silently lose already-confirmed info.
    merged_values = dict(existing_values)
    for key, value in extracted.items():
        if value:
            merged_values[key] = value

    missing_names = find_missing_required(merged_values, form_code)

    if missing_names:
        ask_message = build_ask_message(missing_names, form_code)
        return {
            **state,
            "field_values": merged_values,
            "missing_required_field_names": missing_names,
            "ask_message": ask_message,
            "status": "collecting_info",
        }

    # All required fields satisfied. Before moving on, offer ONCE to
    # add optional info — but only if that offer hasn't been made yet
    # this session (avoid asking every single turn).
    if not state.get("optional_offer_made"):
        offer_message = build_optional_info_offer_message(merged_values, form_code)

        if offer_message:
            return {
                **state,
                "field_values": merged_values,
                "missing_required_field_names": [],
                "ask_message": offer_message,
                "optional_offer_made": True,
                "status": "collecting_info",
            }

    return {
        **state,
        "field_values": merged_values,
        "missing_required_field_names": [],
        "ask_message": None,
        "status": "ready_to_fill",
    }