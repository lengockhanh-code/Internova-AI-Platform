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

FIX (Explicit Intent Only): /detect is now back to fully stateless
(no session_id tracking) — the earlier "remember the last detected
form per chat session, auto-start on the student's next plain 'yes'"
mechanism (_PENDING_SUGGESTIONS) has been removed. bridge.py now
detects fill-intent directly on every incoming message instead (an
explicit action phrase like "điền giúp" + a form detect_form() can
identify), independent of any prior RAG turn or /detect call. /detect
itself is kept only as an optional, stateless "is this text related
to a form?" check the frontend may still use for a lightweight
discoverability hint (e.g. a small text note under a form-related RAG
answer) — it no longer drives any auto-trigger logic.
"""

from __future__ import annotations

import uuid
from threading import Lock
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from src.agents.form_agent.graph import form_agent
from src.agents.form_agent.state import FormAgentState
from src.agents.form_agent.tools.form_tool import build_profile_field_values
from src.database.connection import SessionLocal
from src.security.auth import decode_access_token
from src.services.student_settings_service import get_student_settings

router = APIRouter(prefix="/form-agent", tags=["form-agent"])

_SESSIONS: dict[str, FormAgentState] = {}
_LOCK = Lock()


def _get_user_from_header(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split("Bearer ", 1)[1].strip()
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if user_id:
            return {"id": int(user_id)}
    except Exception:
        pass
    return None


def _fetch_profile_field_values(current_user: Optional[dict]) -> dict[str, str | None]:
    if not current_user or not current_user.get("id"):
        return {}
    user_id = current_user["id"]
    try:
        with SessionLocal() as db:
            profile = get_student_settings(db, int(user_id))
            return dict(build_profile_field_values(profile))
    except Exception:
        return {}


class FormAgentTurnRequest(BaseModel):
    session_id: Optional[str] = None
    message: str
    detected_form: Optional[str] = None


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


class FormAgentDetectResponse(BaseModel):
    detected_form: Optional[str] = None


def _fresh_state(profile_field_values: dict[str, str | None] | None = None) -> FormAgentState:
    return {
        "conversation_text": "",
        "latest_user_message": "",
        "field_values": dict(profile_field_values or {}),
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
    Form 1-4? No longer drives any auto-trigger logic — kept only as
    an optional signal the frontend may use for a discoverability
    hint (e.g. a small non-blocking text note, not a Yes/No prompt).
    See bridge.py for how form-filling sessions actually get started
    now (explicit intent detected directly on each incoming message).
    """
    from src.agents.form_agent.nodes.form_selector import detect_form

    detected = detect_form(request.text)
    return FormAgentDetectResponse(detected_form=detected)


@router.post("/turn", response_model=FormAgentTurnResponse)
async def form_agent_turn(
    request: FormAgentTurnRequest,
    current_user: Optional[dict] = Depends(_get_user_from_header),
) -> FormAgentTurnResponse:
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
            # If state exists but student profile wasn't loaded before and user is authenticated now:
            if current_user and not any(state.get("field_values", {}).get(k) for k in ("name_in_full", "student_id")):
                prof = _fetch_profile_field_values(current_user)
                for k, v in prof.items():
                    if v and not state.setdefault("field_values", {}).get(k):
                        state["field_values"][k] = v
        else:
            session_id = request.session_id or str(uuid.uuid4())
            profile_values = _fetch_profile_field_values(current_user)
            state = _fresh_state(profile_values)
            if request.detected_form:
                state["detected_form"] = request.detected_form  # type: ignore[assignment]
                state["status"] = "collecting_info"

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