from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import text

from src.config import get_settings
from src.database.connection import SessionLocal
from src.security.auth import decode_access_token
from src.services.notification_websocket_service import (
    notification_connections,
)


router = APIRouter(
    prefix="/student/notifications",
    tags=["Student Notification Realtime"],
)


def _authenticated_student_id(token: str) -> int | None:
    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub"))
    except (HTTPException, TypeError, ValueError):
        return None

    with SessionLocal() as db:
        user = db.execute(
            text(
                """
                SELECT id
                FROM public.users
                WHERE id = :user_id
                  AND role = 'STUDENT'
                  AND is_active = TRUE
                LIMIT 1
                """
            ),
            {"user_id": user_id},
        ).first()

    return user_id if user is not None else None


@router.websocket("/ws")
async def student_notification_socket(websocket: WebSocket) -> None:
    settings = get_settings()
    allowed_origins = {
        origin.strip()
        for origin in settings.cors_origins.split(",")
        if origin.strip()
    }
    origin = websocket.headers.get("origin")

    await websocket.accept()

    if origin and origin not in allowed_origins:
        await websocket.close(code=1008, reason="Origin is not allowed.")
        return

    user_id: int | None = None

    try:
        authentication = await asyncio.wait_for(
            websocket.receive_json(),
            timeout=10,
        )
        if authentication.get("type") != "authenticate":
            await websocket.close(code=1008, reason="Authentication required.")
            return

        token = authentication.get("token")
        if not isinstance(token, str) or not token:
            await websocket.close(code=1008, reason="Authentication required.")
            return

        user_id = await run_in_threadpool(
            _authenticated_student_id,
            token,
        )
        if user_id is None:
            await websocket.close(code=1008, reason="Invalid student session.")
            return

        notification_connections.connect(user_id, websocket)
        await websocket.send_json({"type": "connection.ready"})

        while True:
            message = await websocket.receive_json()
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except (TimeoutError, WebSocketDisconnect):
        pass
    finally:
        if user_id is not None:
            notification_connections.disconnect(user_id, websocket)
