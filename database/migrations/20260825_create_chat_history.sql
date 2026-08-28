BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL
        REFERENCES public.users(id)
        ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Cuộc trò chuyện mới',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL
        REFERENCES public.chat_sessions(id)
        ON DELETE CASCADE,
    client_message_id UUID,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL')),
    content TEXT NOT NULL
        CHECK (LENGTH(BTRIM(content)) > 0),
    answer_status VARCHAR(40)
        CHECK (
            answer_status IS NULL
            OR answer_status IN (
                'answered',
                'not_found',
                'insufficient_evidence',
                'out_of_scope'
            )
        ),
    answer_language VARCHAR(10)
        CHECK (
            answer_language IS NULL
            OR answer_language IN ('vi', 'en')
        ),
    confidence NUMERIC(5,4)
        CHECK (
            confidence IS NULL
            OR confidence BETWEEN 0 AND 1
        ),
    needs_retrieval BOOLEAN NOT NULL DEFAULT FALSE,
    route_intent VARCHAR(100),
    route_scope VARCHAR(100),
    sources JSONB NOT NULL DEFAULT '[]'::JSONB
        CHECK (JSONB_TYPEOF(sources) = 'array'),
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB
        CHECK (JSONB_TYPEOF(metadata) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (session_id, client_message_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user
ON public.chat_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated
ON public.chat_sessions(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_message
ON public.chat_sessions(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session
ON public.chat_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
ON public.chat_messages(session_id, created_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sources_gin
ON public.chat_messages USING GIN(sources);

CREATE OR REPLACE FUNCTION public.update_chat_session_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.chat_sessions
    SET
        updated_at = CURRENT_TIMESTAMP,
        last_message_at = NEW.created_at
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_chat_session_timestamp
ON public.chat_messages;

CREATE TRIGGER trg_update_chat_session_timestamp
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_chat_session_timestamp();

CREATE OR REPLACE FUNCTION public.set_chat_session_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_chat_session_updated_at
ON public.chat_sessions;

CREATE TRIGGER trg_set_chat_session_updated_at
BEFORE UPDATE ON public.chat_sessions
FOR EACH ROW
EXECUTE FUNCTION public.set_chat_session_updated_at();

COMMIT;
