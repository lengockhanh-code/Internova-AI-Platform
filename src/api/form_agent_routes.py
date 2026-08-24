"""form_agent_routes.py — API endpoints for the form-filling agent.

FIX: entirely NEW, additive file. Does NOT import from or modify
query_pipeline.py, evidence.py, form_directory.py (generation/),
chat_service.py, or any file the team's RAG pipeline depends on — the
only thing needed elsewhere is ONE new line in main.py to register
this router (see the comment at the bottom of this file for the exact
line to add).

Session storage is a simple in-memory dict for now, guarded by a Lock
(same pattern already used in chat_service.py) — NOT yet persisted to
PostgreSQL. Sessions are lost on server restart. This is a deliberate,
documented simplification to get the feature working end-to-end
without touching the database layer; swapping this for a real DB
table later does not require changing this file's public API (the
request/response models stay the same).

FIX (2nd pass): /detect now optionally accepts the CHAT's session_id
and remembers the last detected form for it in _PENDING_SUGGESTIONS.
This lets bridge.py recognize "the student just said yes to a form
suggestion" on the very next /chat turn WITHOUT reading anything from
RAG's own conversation memory (src.rag.memory) — the frontend already
calls /detect after every RAG answer (to decide whether to show the
suggestion text), so this reuses that exact call instead of adding a
new dependency on RAG internals.
"""

from __future__ import annotations

import uuid
from threading import Lock
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from src.agents.form_agent.graph import form_agent
from src.agents.form_agent.state import FormAgentState, FormCode

router = APIRouter(prefix="/form-agent", tags=["form-agent"])

_SESSIONS: dict[str, FormAgentState] = {}
_LOCK = Lock()

# chat-session-id -> last detected form, set by /detect. Lives here
# (not in bridge.py) because it's naturally next to _SESSIONS and
# guarded by the same _LOCK. See module docstring above.
_PENDING_SUGGESTIONS: dict[str, FormCode] = {}


class FormAgentTurnRequest(BaseModel):
    session_id: Optional[str] = None
    message: str
    detected_form: Optional[FormCode] = None


class FormAgentTurnResponse(BaseModel):
    session_id: str
    status: str
    detected_form: Optional[str] = None
    ask_message: Optional[str] = None
    review_summary_markdown: Optional[str] = None
    docx_ready: bool = False
    error: Optional[str] = None


class FormAgentConfirmRequest(BaseModel):
    session_id: str


class FormAgentDetectRequest(BaseModel):
    text: str
    session_id: Optional[str] = None


class FormAgentDetectResponse(BaseModel):
    detected_form: Optional[str] = None


def _fresh_state() -> FormAgentState:
    return {
        "conversation_text": "",
        "latest_user_message": "",
        "field_values": {},
        "human_approved": False,
        "status": "selecting_form",
    }


def _to_response(session_id: str, state: FormAgentState) -> FormAgentTurnResponse:
    return FormAgentTurnResponse(
        session_id=session_id,
        status=state.get("status", "unknown"),
        detected_form=state.get("detected_form"),
        ask_message=state.get("ask_message"),
        review_summary_markdown=state.get("review_summary_markdown"),
        docx_ready=bool(state.get("filled_docx_bytes")),
        error=state.get("error"),
    )


@router.post("/detect", response_model=FormAgentDetectResponse)
async def form_agent_detect(request: FormAgentDetectRequest) -> FormAgentDetectResponse:
    """Lightweight, stateless check: does this text relate to one of
    Form 1-4? Used by the frontend to decide whether to show the
    inline '🤖 Cần mình giúp điền...' suggestion under a chat message —
    intentionally independent of how chat_service.py tags its own
    sources (that tagging is out of scope to modify, and isn't
    reliable for this purpose).

    FIX: if the caller also passes the chat's session_id, remember the
    detected form (or forget it, if none was found) for that session —
    see _PENDING_SUGGESTIONS and bridge.maybe_autostart(), which uses
    this to auto-start a form_agent session on the student's next
    plain-text "yes", without needing to read RAG's own memory.
    """
    from src.agents.form_agent.nodes.form_selector import detect_form

    detected = detect_form(request.text)

    if request.session_id:
        with _LOCK:
            if detected:
                _PENDING_SUGGESTIONS[request.session_id] = detected
            else:
                _PENDING_SUGGESTIONS.pop(request.session_id, None)

    return FormAgentDetectResponse(detected_form=detected)


@router.post("/turn", response_model=FormAgentTurnResponse)
async def form_agent_turn(request: FormAgentTurnRequest) -> FormAgentTurnResponse:
    """One turn of the form-filling conversation.

    Send session_id=None (or omit it) the first time to start a new
    session — a new session_id comes back in the response; the
    frontend must send that same session_id on every subsequent call
    in the same conversation.

    Reaching status "awaiting_review" here does NOT approve anything —
    the frontend must call POST /form-agent/confirm explicitly with
    the session_id to move to "approved". A free-text message sent
    while status is "awaiting_review" is treated as a correction
    request, not approval — nothing is finalized without an explicit,
    unambiguous approval action.
    """
    with _LOCK:
        if request.session_id and request.session_id in _SESSIONS:
            session_id = request.session_id
            state = _SESSIONS[session_id]
        else:
            session_id = request.session_id or str(uuid.uuid4())
            state = _fresh_state()
            if request.detected_form:
                state["detected_form"] = request.detected_form

        if state.get("status") == "awaiting_review":
            state["status"] = "collecting_info"

        state["conversation_text"] = state.get("conversation_text", "") + f"\n{request.message}"
        state["latest_user_message"] = request.message

        try:
            state = form_agent.invoke(state)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=500, detail=f"Form agent error: {exc}") from exc

        _SESSIONS[session_id] = state

    return _to_response(session_id, state)


@router.post("/confirm", response_model=FormAgentTurnResponse)
async def form_agent_confirm(request: FormAgentConfirmRequest) -> FormAgentTurnResponse:
    """Explicit approval step — the ONLY way a session reaches
    'approved'. Never triggered by parsing free-text messages."""
    with _LOCK:
        state = _SESSIONS.get(request.session_id)
        if state is None:
            raise HTTPException(status_code=404, detail="Session not found")

        state["human_approved"] = True

        try:
            state = form_agent.invoke(state)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=500, detail=f"Form agent error: {exc}") from exc

        _SESSIONS[request.session_id] = state

    return _to_response(request.session_id, state)


@router.post("/cancel/{session_id}", response_model=FormAgentTurnResponse)
async def form_agent_cancel(session_id: str) -> FormAgentTurnResponse:
    with _LOCK:
        state = _SESSIONS.get(session_id)
        if state is None:
            raise HTTPException(status_code=404, detail="Session not found")
        state["status"] = "cancelled"
        _SESSIONS[session_id] = state
    return _to_response(session_id, state)


@router.get("/download/{session_id}")
async def form_agent_download(session_id: str) -> Response:
    with _LOCK:
        state = _SESSIONS.get(session_id)

    if state is None:
        raise HTTPException(status_code=404, detail="Session not found")

    docx_bytes = state.get("filled_docx_bytes")
    if not docx_bytes:
        raise HTTPException(status_code=400, detail="File chưa sẵn sàng")

    form_code = str(state.get("detected_form", "form")).replace(" ", "_").replace(".", "")

    return Response(
        content=docx_bytes,
        media_type=(
            "application/vnd.openxmlformats-officedocument"
            ".wordprocessingml.document"
        ),
        headers={
            "Content-Disposition": f'attachment; filename="{form_code}_da_dien.docx"'
        },
    )