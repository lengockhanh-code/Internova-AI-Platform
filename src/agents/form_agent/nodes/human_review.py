"""nodes/human_review.py — Human-in-the-loop checkpoint.

This is the safety gate the whole agent design hinges on (see the
abuse-prevention discussion — this node is why nothing produced by
this agent is ever "official" until a real person, the student
themself, has looked at it). This node:

  1. On first arrival (human_approved not yet True): builds a preview
     of the filled document (via tools/document_tool.py) and returns
     status "awaiting_review" with the preview text — the caller
     should show this to the student and ask them to confirm or
     request changes, then STOP (do not auto-continue the graph).
  2. On a later turn, once the caller has recorded the student's
     explicit approval (e.g. they clicked "Xác nhận, tôi đã kiểm tra
     kỹ" or typed "đúng rồi"), the caller sets human_approved=True in
     the state BEFORE re-invoking the graph. This node then simply
     marks status "approved" and the graph reaches END.

This node NEVER auto-approves. If human_approved is not explicitly
True, it always stops at "awaiting_review" — there is no code path
here that finalizes anything without that explicit flag being set by
the caller in response to a real user action.
"""

from __future__ import annotations

from src.agents.form_agent.state import FormAgentState


def human_review_node(state: FormAgentState) -> FormAgentState:
    if state.get("human_approved") is True:
        return {**state, "status": "approved"}

    docx_bytes = state.get("filled_docx_bytes")

    if not docx_bytes:
        return {
            **state,
            "status": "ready_to_fill",
            "error": "human_review_node reached with no filled_docx_bytes",
        }

    # FIX: previously appended a raw text dump of the whole .docx
    # (extract_preview_text) below the clean bulleted summary — this
    # duplicated the same information in a much messier form (showing
    # raw template placeholders like blank signature underscores and
    # checkbox option lists verbatim). The bulleted
    # review_summary_markdown from form_tool.build_review_summary
    # already covers everything the student needs to verify; keep only
    # that, plus the confirm/edit prompt.
    review_note = (
        f"{state.get('review_summary_markdown', '')}\n\n"
        "Bạn kiểm tra kỹ lại thông tin trên nhé. Nếu đúng, xác nhận để "
        "tải file; nếu có chỗ sai, cứ nói cho mình biết để sửa lại."
    )

    return {
        **state,
        "review_summary_markdown": review_note,
        "status": "awaiting_review",
    }