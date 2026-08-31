-- Encuentra conversaciones por nombre, número o texto registrado en cualquiera
-- de sus mensajes. Se devuelve solo el ID para no duplicar el contrato que las
-- pantallas ya usan al leer `agent_conversations`.

BEGIN;

-- Se mantiene el mismo esquema de extensión que la migración de índices de
-- productos existente, para que funcione tanto en instalaciones nuevas como
-- en las que `pg_trgm` ya está habilitada.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- El historial puede ser grande. El índice acelera las búsquedas parciales
-- ("amortiguador", "comprobante", etc.) sin afectar los mensajes vacíos.
CREATE INDEX IF NOT EXISTS agent_messages_body_trgm_search_idx
    ON public.agent_messages
    USING GIN (body gin_trgm_ops)
    WHERE body IS NOT NULL AND body <> '';

CREATE OR REPLACE FUNCTION public.search_agent_conversation_ids(
    p_search TEXT,
    p_limit INTEGER DEFAULT 200
)
RETURNS TABLE (
    conversation_id BIGINT,
    total_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    WITH term AS (
        SELECT
            NULLIF(regexp_replace(trim(COALESCE(p_search, '')), '[[:space:]]+', ' ', 'g'), '') AS value
    ),
    escaped_term AS (
        SELECT
            value,
            replace(
                replace(
                    replace(value, E'\\', E'\\\\'),
                    '%', E'\\%'
                ),
                '_', E'\\_'
            ) AS pattern
        FROM term
    ),
    matches AS (
        SELECT c.id, c.last_message_at
        FROM public.agent_conversations AS c
        CROSS JOIN escaped_term AS q
        WHERE q.value IS NOT NULL
          AND (
              c.customer_name ILIKE '%' || q.pattern || '%' ESCAPE E'\\'
              OR c.phone_number ILIKE '%' || q.pattern || '%' ESCAPE E'\\'
              OR c.lid ILIKE '%' || q.pattern || '%' ESCAPE E'\\'
              OR EXISTS (
                  SELECT 1
                  FROM public.agent_messages AS m
                  WHERE m.conversation_id = c.id
                    AND m.body ILIKE '%' || q.pattern || '%' ESCAPE E'\\'
              )
          )
    ),
    ranked AS (
        SELECT
            id AS conversation_id,
            count(*) OVER () AS total_count,
            last_message_at
        FROM matches
    )
    SELECT conversation_id, total_count
    FROM ranked
    ORDER BY last_message_at DESC NULLS LAST
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 200);
$$;

REVOKE ALL ON FUNCTION public.search_agent_conversation_ids(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_agent_conversation_ids(TEXT, INTEGER) TO authenticated, service_role;

COMMIT;
