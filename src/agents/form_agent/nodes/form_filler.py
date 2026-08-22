"""nodes/form_filler.py — Generate the filled .docx.

Only runs once collect_info.py has confirmed nothing required is
missing (status == "ready_to_fill"). Calls the tools/form_tool.py
wrapper around src.rag.generation.form_filler.fill_docx_form(), which
writes values additively into the real template — see that module's
docstring for the full safety rationale (never destroys labels/
instructions, never touches sections belonging to another party).
"""

from __future__ import annotations

from src.agents.form_agent.state import FormAgentState
from src.agents.form_agent.tools.form_tool import build_review_summary, fill_form


def form_filler_node(state: FormAgentState) -> FormAgentState:
    form_code = state.get("detected_form")
    field_values = state.get("field_values") or {}

    if form_code is None:
        return {
            **state,
            "status": "selecting_form",
            "error": "form_filler_node reached with no detected_form",
        }

    try:
        docx_bytes = fill_form(form_code, field_values)
    except FileNotFoundError as exc:
        return {
            **state,
            "status": "ready_to_fill",
            "error": f"Không tìm thấy file mẫu để điền: {exc}",
        }
    except Exception as exc:  # noqa: BLE001
        return {
            **state,
            "status": "ready_to_fill",
            "error": f"Lỗi khi điền biểu mẫu: {exc}",
        }

    summary = build_review_summary(field_values, form_code)

    return {
        **state,
        "filled_docx_bytes": docx_bytes,
        "review_summary_markdown": summary,
        "status": "awaiting_review",
        "error": None,
    }