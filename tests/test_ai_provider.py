import importlib
import json
from unittest.mock import MagicMock

import httpx
import langchain_openai
import pytest

from src.config import Settings
from src.rag.retrieval import retriever, vector_store
from src.rag.schemas import DocumentChunk


@pytest.fixture
def provider_settings():
    return Settings(
        _env_file=None,
        database_url="sqlite://",
        openai_api_key="test-provider-key",
        openai_base_url="https://openrouter.ai/api/v1",
        model_name="openai/gpt-4o-mini",
        openai_chat_model="openai/gpt-4o-mini",
        openai_guardrail_model="openai/gpt-4o-mini",
        openai_embedding_model="openai/text-embedding-3-small",
        openai_embedding_check_ctx_length=False,
    )


@pytest.mark.parametrize(
    ("module_name", "factory_name", "args"),
    [
        ("src.services.llm", "get_llm", ()),
        ("src.rag.query_pipeline", "_get_chat_llm", ("openai/gpt-4o-mini", 0.0)),
        ("src.rag.evidence", "_get_evidence_llm", ("openai/gpt-4o-mini",)),
        ("src.rag.generation.answer_generator", "_get_chat_llm", ("openai/gpt-4o-mini", 0.0, 20)),
    ],
)
def test_chat_requests_use_configured_provider(monkeypatch, provider_settings, module_name, factory_name, args):
    module = importlib.import_module(module_name)
    monkeypatch.setattr("src.config.get_settings", lambda: provider_settings)
    if hasattr(module, "get_settings"):
        monkeypatch.setattr(module, "get_settings", lambda: provider_settings)
    factory = getattr(module, factory_name)
    if hasattr(factory, "cache_clear"):
        factory.cache_clear()

    def handle(request):
        assert str(request.url) == "https://openrouter.ai/api/v1/chat/completions"
        assert request.headers["authorization"] == "Bearer test-provider-key"
        assert json.loads(request.content)["model"] == "openai/gpt-4o-mini"
        return httpx.Response(200, json={
            "id": "test-chat", "object": "chat.completion", "created": 0,
            "model": "openai/gpt-4o-mini",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": "OK"},
                         "finish_reason": "stop"}],
        })

    try:
        llm = factory(*args)
        with httpx.Client(transport=httpx.MockTransport(handle)) as client:
            llm.root_client._client = client
            assert llm.invoke("Test provider routing").content == "OK"
    finally:
        if hasattr(factory, "cache_clear"):
            factory.cache_clear()


def test_guardrail_uses_configured_model(monkeypatch, provider_settings):
    from src.rag.generation.validation import check_llm_guardrail

    constructor = MagicMock()
    constructor.return_value.invoke.return_value.content = "SAFE"
    monkeypatch.setattr(langchain_openai, "ChatOpenAI", constructor)
    assert check_llm_guardrail("hello", provider_settings)
    assert constructor.call_args.kwargs["model"] == "openai/gpt-4o-mini"
    assert constructor.call_args.kwargs["base_url"] == provider_settings.openai_base_url


@pytest.mark.parametrize("operation", ["index", "retrieve"])
def test_embeddings_send_text_to_configured_provider(monkeypatch, tmp_path, provider_settings, operation):
    module = vector_store if operation == "index" else retriever
    monkeypatch.setattr(module, "get_settings", lambda: provider_settings)
    chroma = MagicMock()
    monkeypatch.setattr(module.chromadb, "PersistentClient", lambda **_: chroma)
    real_constructor = langchain_openai.OpenAIEmbeddings
    requests = []

    def handle(request):
        assert str(request.url) == "https://openrouter.ai/api/v1/embeddings"
        assert request.headers["authorization"] == "Bearer test-provider-key"
        payload = json.loads(request.content)
        assert payload["model"] == "openai/text-embedding-3-small"
        inputs = payload["input"]
        assert inputs and all(isinstance(text, str) for text in inputs)
        requests.append(request)
        return httpx.Response(200, json={
            "object": "list",
            "data": [{"object": "embedding", "index": i, "embedding": [0.1, 0.2]}
                     for i in range(len(inputs))],
            "model": payload["model"], "usage": {"prompt_tokens": 1, "total_tokens": 1},
        })

    with httpx.Client(transport=httpx.MockTransport(handle)) as client:
        monkeypatch.setattr(module, "OpenAIEmbeddings", lambda **kwargs: real_constructor(
            **kwargs, http_client=client,
        ))
        if operation == "index":
            chunk = DocumentChunk(chunk_id="test", document_name="Policy", document_type="policy",
                                  source_priority=1, content_original="Internship requirements")
            vector_store.build_chroma_store([chunk], tmp_path / "chroma")
            assert chroma.create_collection.return_value.add.call_args.kwargs["embeddings"] == [[0.1, 0.2]]
        else:
            monkeypatch.setattr(retriever.HybridRetriever, "_load_bm25_payload", lambda _: MagicMock(chunks=[]))
            instance = retriever.HybridRetriever(tmp_path / "chroma", tmp_path / "bm25.pkl")
            assert instance._embed_queries(["Internship requirements"]) == [[0.1, 0.2]]
        assert len(requests) == 1


@pytest.mark.parametrize("module_name", ["src.config", "src.rag.config"])
def test_settings_read_provider_env_file(monkeypatch, tmp_path, module_name):
    variables = {
        "OPENAI_API_KEY": "test-provider-key",
        "OPENAI_BASE_URL": "https://openrouter.ai/api/v1",
        "OPENAI_GUARDRAIL_MODEL": "openai/gpt-4o-mini",
        "OPENAI_EMBEDDING_CHECK_CTX_LENGTH": "false",
    }
    for name in variables:
        monkeypatch.delenv(name, raising=False)
    env_path = tmp_path / ".env"
    env_path.write_text("\n".join(f"{key}={value}" for key, value in variables.items()), encoding="utf-8")
    settings = importlib.import_module(module_name).Settings(_env_file=env_path, database_url="sqlite://")
    assert settings.openai_base_url == variables["OPENAI_BASE_URL"]
    assert settings.openai_guardrail_model == variables["OPENAI_GUARDRAIL_MODEL"]
    assert settings.openai_embedding_check_ctx_length is False
