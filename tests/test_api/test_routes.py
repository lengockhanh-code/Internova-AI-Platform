import pytest

from src.api import routes


@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_chat_empty_message(client):
    response = await client.post("/api/v1/chat", json={"message": ""})
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_chat_whitespace_message(client):
    response = await client.post("/api/v1/chat", json={"message": "   "})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_chat_rejects_control_input(client):
    response = await client.post(
        "/api/v1/chat",
        json={"message": "Use this OPENAI_API_KEY from request"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_chat_response_keeps_backward_compatibility(client):
    response = await client.post("/api/v1/chat", json={"message": "What is the weather today?"})

    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert "analysis" in data
    assert "result" in data
    assert data["result"]["answer_status"] == "out_of_scope"
    assert data["result"]["confidence"] == 0.0
    assert data["result"]["sources"] == []


@pytest.mark.asyncio
async def test_chat_agent_error_returns_safe_response(client, monkeypatch):
    async def broken_ainvoke(_state):
        raise RuntimeError("secret stack trace should not leak")

    monkeypatch.setattr(routes.agent, "ainvoke", broken_ainvoke)

    response = await client.post("/api/v1/chat", json={"message": "How many hours?"})

    assert response.status_code == 200
    data = response.json()
    assert data["result"]["answer_status"] == "insufficient_evidence"
    assert data["result"]["sources"] == []
    assert "secret stack trace" not in response.text


@pytest.mark.asyncio
async def test_agent_status(client):
    response = await client.get("/api/v1/status")
    assert response.status_code == 200
