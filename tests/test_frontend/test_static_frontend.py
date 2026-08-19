from __future__ import annotations

from pathlib import Path

import pytest


FRONTEND_PATH = Path("frontend/index.html")


def test_frontend_file_contains_chat_contract() -> None:
    html = FRONTEND_PATH.read_text(encoding="utf-8")

    assert 'id="chat-form"' in html
    assert 'id="sources"' in html
    assert 'fetch("/api/v1/chat"' in html
    assert "answer_status" in html
    assert "quote_original" in html


@pytest.mark.asyncio
async def test_root_serves_frontend(client) -> None:
    response = await client.get("/")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Internship QA" in response.text
