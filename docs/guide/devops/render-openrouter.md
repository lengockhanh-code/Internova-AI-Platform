# OpenRouter on Render

Deploy the code changes in this repository together with the following backend
environment variables. Editing your local `.env` does not update Render.

## Backend environment variables

In Render Dashboard, select the backend Web Service, open **Environment**, and
edit existing variables or use **Add from .env** for this block. Replace the key
placeholder with your actual OpenRouter key before saving. Keep the existing
database, JWT, CORS, Redis and other unrelated values.

```dotenv
OPENAI_API_KEY=<your-openrouter-key>
OPENAI_BASE_URL=https://openrouter.ai/api/v1
MODEL_NAME=openai/gpt-4o-mini
OPENAI_CHAT_MODEL=openai/gpt-4o-mini
RERANK_MODEL=openai/gpt-4o-mini
OPENAI_GUARDRAIL_MODEL=openai/gpt-4o-mini
OPENAI_EMBEDDING_MODEL=openai/text-embedding-3-small
OPENAI_EMBEDDING_CHECK_CTX_LENGTH=false
```

`OPENAI_API_KEY` keeps its existing name for compatibility; its value can be an
OpenRouter key when `OPENAI_BASE_URL` points to OpenRouter. All chat clients,
including report review, form extraction, evidence checks and guardrails, use
that endpoint. Both indexing and retrieval embeddings use it too. Disabling
the embedding context length check sends text rather than token arrays.

The chat model above is a starting configuration and changes the model used by
the application. You can choose a different supported OpenRouter model by
updating the chat and rerank variables. Models used for structured outputs
must support the structured output features required by the application.

## Deploy and verify

1. Make these code changes available on the Git branch connected to Render.
2. Save the environment variables with **Save, rebuild, and deploy** so the new
   configuration and code are deployed together. If code is already deployed,
   **Save and deploy** is enough for later key rotations.
3. Wait for the deployment to become live, then check `/health`, submit a new
   chat question that needs document retrieval, and try form/report AI features.
4. Check backend logs for authentication errors (401), credit errors (402), or
   invalid model errors. Check OpenRouter activity to confirm fresh requests.
   A cached answer alone does not verify the new credentials.

Set these variables on the backend service. Do not expose the key through a
frontend `NEXT_PUBLIC_*` variable or commit `.env` to Git. Render environment
variables override values read from the local `.env` by application settings.
Restart/redeploy all backend processes when changing credentials because settings
and several clients are cached in memory.

The embedding example keeps the underlying `text-embedding-3-small` model.
If you change the actual embedding model or dimensions, rebuild the Chroma
index before querying it. Keep the existing index when only rotating a key.

## References

- [Render environment variables](https://render.com/docs/configure-environment-variables)
- [OpenRouter quickstart](https://openrouter.ai/docs/quickstart)
- [OpenRouter embeddings](https://openrouter.ai/docs/api/api-reference/embeddings/create-embeddings)
