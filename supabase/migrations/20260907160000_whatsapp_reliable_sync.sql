-- Reliable WhatsApp mirror: connection gaps, history reconciliation and
-- fail-closed automatic-reply barrier. Additive/idempotent by design.

BEGIN;

-- Connection and reconciliation are deliberately separate. A socket can be
-- connected while the ERP still has an unverified interval.
ALTER TABLE public.agent_settings
    ADD COLUMN IF NOT EXISTS whatsapp_sync_state TEXT NOT NULL DEFAULT 'uncertain',
    ADD COLUMN IF NOT EXISTS whatsapp_process_generation UUID,
    ADD COLUMN IF NOT EXISTS whatsapp_connection_generation BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS whatsapp_sync_started_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS whatsapp_last_sync_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS whatsapp_last_history_chunk_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS whatsapp_last_history_progress INTEGER,
    ADD COLUMN IF NOT EXISTS whatsapp_last_history_sync_type TEXT,
    ADD COLUMN IF NOT EXISTS whatsapp_history_messages_recovered BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS whatsapp_from_me_recovered BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS whatsapp_duplicates_prevented BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS whatsapp_auto_replies_suppressed BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS whatsapp_stale_outbox_cancelled BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS whatsapp_sync_error TEXT;

ALTER TABLE public.agent_settings
    DROP CONSTRAINT IF EXISTS agent_settings_whatsapp_sync_state_check;
ALTER TABLE public.agent_settings
    ADD CONSTRAINT agent_settings_whatsapp_sync_state_check
    CHECK (whatsapp_sync_state IN (
        'disconnected', 'connected', 'syncing', 'reconciling',
        'synced', 'uncertain', 'gap_detected'
    ));

COMMENT ON COLUMN public.agent_settings.whatsapp_sync_state IS
    'Estado de integridad del espejo ERP. No equivale a agent_connection.';

-- One durable row per disconnected interval.
CREATE TABLE IF NOT EXISTS public.agent_whatsapp_disconnects (
    id BIGSERIAL PRIMARY KEY,
    process_generation UUID,
    connection_generation BIGINT NOT NULL,
    disconnected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT,
    status_code INTEGER,
    last_inbound_at TIMESTAMP WITH TIME ZONE,
    last_outbound_at TIMESTAMP WITH TIME ZONE,
    last_whatsapp_message_id TEXT,
    reconnected_at TIMESTAMP WITH TIME ZONE,
    approximate_gap_seconds BIGINT,
    reconciliation_state TEXT NOT NULL DEFAULT 'gap_detected',
    reconciliation_finished_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_agent_whatsapp_disconnects_open
    ON public.agent_whatsapp_disconnects(disconnected_at DESC)
    WHERE reconnected_at IS NULL;

-- Every history chunk/status remains auditable. A zero-message chunk is data,
-- not proof that no activity existed.
CREATE TABLE IF NOT EXISTS public.agent_whatsapp_history_syncs (
    id BIGSERIAL PRIMARY KEY,
    process_generation UUID,
    connection_generation BIGINT NOT NULL,
    sync_type TEXT NOT NULL,
    progress INTEGER,
    is_latest BOOLEAN,
    chunk_order INTEGER,
    peer_request_id TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    finished_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'started',
    chats_count INTEGER NOT NULL DEFAULT 0,
    contacts_count INTEGER NOT NULL DEFAULT 0,
    messages_count INTEGER NOT NULL DEFAULT 0,
    messages_inserted INTEGER NOT NULL DEFAULT 0,
    from_me_inserted INTEGER NOT NULL DEFAULT 0,
    duplicates_prevented INTEGER NOT NULL DEFAULT 0,
    skipped_before_cutoff INTEGER NOT NULL DEFAULT 0,
    skipped_unparseable INTEGER NOT NULL DEFAULT 0,
    success BOOLEAN,
    explicit_completion BOOLEAN,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_agent_whatsapp_history_syncs_generation
    ON public.agent_whatsapp_history_syncs(process_generation, connection_generation, created_at);

-- Global connection/sync observability, separate from conversational events.
CREATE TABLE IF NOT EXISTS public.agent_whatsapp_sync_events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    process_generation UUID,
    connection_generation BIGINT,
    conversation_id BIGINT REFERENCES public.agent_conversations(id) ON DELETE SET NULL,
    reason TEXT,
    detail JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_agent_whatsapp_sync_events_type_time
    ON public.agent_whatsapp_sync_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_whatsapp_sync_events_conversation
    ON public.agent_whatsapp_sync_events(conversation_id, created_at DESC)
    WHERE conversation_id IS NOT NULL;

-- Durable LID <-> phone mapping. Baileys' auth-state copy intentionally does
-- not back up its large regenerable mapping cache; this table is the durable
-- business identity layer used by reconciliation.
CREATE TABLE IF NOT EXISTS public.agent_whatsapp_lid_mappings (
    lid TEXT PRIMARY KEY,
    phone_number TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'unknown',
    first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    last_reconciled_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_agent_whatsapp_lid_mappings_phone
    ON public.agent_whatsapp_lid_mappings(phone_number);

-- Per-chat mirror metadata and explicit confidence.
ALTER TABLE public.agent_conversations
    ADD COLUMN IF NOT EXISTS first_message_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS last_outbound_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS last_human_outbound_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS last_agent_outbound_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS last_whatsapp_message_id TEXT,
    ADD COLUMN IF NOT EXISTS last_history_sync_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS last_reconciled_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS sync_confidence TEXT NOT NULL DEFAULT 'uncertain',
    ADD COLUMN IF NOT EXISTS possible_gap BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS sync_uncertain_reason TEXT,
    ADD COLUMN IF NOT EXISTS whatsapp_archived BOOLEAN,
    ADD COLUMN IF NOT EXISTS whatsapp_pinned BOOLEAN,
    ADD COLUMN IF NOT EXISTS whatsapp_chat_timestamp TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS whatsapp_chat_deleted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.agent_conversations
    DROP CONSTRAINT IF EXISTS agent_conversations_sync_confidence_check;
ALTER TABLE public.agent_conversations
    ADD CONSTRAINT agent_conversations_sync_confidence_check
    CHECK (sync_confidence IN ('synced', 'live_evidence', 'history_partial', 'uncertain'));

CREATE INDEX IF NOT EXISTS idx_agent_conversations_possible_gap
    ON public.agent_conversations(last_message_at DESC) WHERE possible_gap;
CREATE INDEX IF NOT EXISTS idx_agent_conversations_sync_uncertain
    ON public.agent_conversations(last_message_at DESC) WHERE sync_confidence = 'uncertain';

-- Message provenance. from_me is evidence that the business side spoke even
-- when WhatsApp cannot identify the exact linked device.
ALTER TABLE public.agent_messages
    ADD COLUMN IF NOT EXISTS from_me BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS sender_origin TEXT NOT NULL DEFAULT 'customer',
    ADD COLUMN IF NOT EXISTS message_source TEXT NOT NULL DEFAULT 'live',
    ADD COLUMN IF NOT EXISTS upsert_type TEXT,
    ADD COLUMN IF NOT EXISTS is_historical BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS edit_version INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS revoked_by_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS reactions JSONB NOT NULL DEFAULT '[]'::JSONB;

ALTER TABLE public.agent_messages
    DROP CONSTRAINT IF EXISTS agent_messages_sender_origin_check;
ALTER TABLE public.agent_messages
    ADD CONSTRAINT agent_messages_sender_origin_check
    CHECK (sender_origin IN (
        'customer', 'erp', 'phone_or_other_device', 'agent',
        'system', 'human_unknown_device'
    ));

ALTER TABLE public.agent_messages
    DROP CONSTRAINT IF EXISTS agent_messages_message_source_check;
ALTER TABLE public.agent_messages
    ADD CONSTRAINT agent_messages_message_source_check
    CHECK (message_source IN ('live', 'history_sync', 'append', 'recovered', 'on_demand'));

UPDATE public.agent_messages
SET
    from_me = (direction = 'outbound'),
    sender_origin = CASE
        WHEN direction = 'inbound' THEN 'customer'
        WHEN agent IN ('intake', 'sales') THEN 'agent'
        WHEN agent = 'system' THEN 'system'
        WHEN agent = 'human' OR action_taken = 'human_reply' THEN 'human_unknown_device'
        ELSE 'human_unknown_device'
    END
WHERE sender_origin = 'customer' OR (direction = 'outbound' AND from_me = FALSE);

CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation_human_outbound
    ON public.agent_messages(conversation_id, created_at DESC, id DESC)
    WHERE direction = 'outbound'
      AND (agent = 'human' OR action_taken = 'human_reply'
           OR sender_origin IN ('erp', 'phone_or_other_device', 'human_unknown_device'));
CREATE INDEX IF NOT EXISTS idx_agent_messages_historical
    ON public.agent_messages(created_at DESC) WHERE is_historical;

-- Automatic messages may use this queue in the future. Existing and ERP rows
-- remain human_erp and are never silently cancelled by the automatic guard.
ALTER TABLE public.agent_outbox
    ADD COLUMN IF NOT EXISTS message_origin TEXT NOT NULL DEFAULT 'human_erp',
    ADD COLUMN IF NOT EXISTS target_inbound_wa_id TEXT,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

ALTER TABLE public.agent_outbox
    DROP CONSTRAINT IF EXISTS agent_outbox_message_origin_check;
ALTER TABLE public.agent_outbox
    ADD CONSTRAINT agent_outbox_message_origin_check
    CHECK (message_origin IN ('human_erp', 'intake', 'sales', 'system'));

-- Recalculate one conversation after any message mutation.
CREATE OR REPLACE FUNCTION public.whatsapp_refresh_conversation_sync_summary(p_conversation_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    WITH summary AS (
        SELECT
            MIN(m.created_at) AS first_message_at,
            MAX(m.created_at) AS last_message_at,
            MAX(m.created_at) FILTER (WHERE m.direction = 'inbound') AS last_inbound_at,
            MAX(m.created_at) FILTER (WHERE m.direction = 'outbound') AS last_outbound_at,
            MAX(m.created_at) FILTER (
                WHERE m.direction = 'outbound'
                  AND (m.agent = 'human' OR m.action_taken = 'human_reply'
                       OR m.sender_origin IN ('erp', 'phone_or_other_device', 'human_unknown_device'))
            ) AS last_human_outbound_at,
            MAX(m.created_at) FILTER (
                WHERE m.direction = 'outbound' AND m.agent IN ('intake', 'sales')
            ) AS last_agent_outbound_at,
            (ARRAY_AGG(m.whatsapp_message_id ORDER BY m.created_at DESC, m.id DESC)
                FILTER (WHERE m.whatsapp_message_id IS NOT NULL))[1] AS last_whatsapp_message_id,
            (ARRAY_AGG(m.direction ORDER BY m.created_at DESC, m.id DESC))[1] AS last_direction,
            (ARRAY_AGG(COALESCE(NULLIF(m.body, ''), '(' || m.content_type || ')')
                ORDER BY m.created_at DESC, m.id DESC))[1] AS last_preview
        FROM public.agent_messages m
        WHERE m.conversation_id = p_conversation_id
    )
    UPDATE public.agent_conversations c
    SET
        first_message_at = s.first_message_at,
        last_message_at = s.last_message_at,
        last_inbound_at = s.last_inbound_at,
        last_outbound_at = s.last_outbound_at,
        last_human_outbound_at = s.last_human_outbound_at,
        last_agent_outbound_at = s.last_agent_outbound_at,
        last_whatsapp_message_id = s.last_whatsapp_message_id,
        last_message_direction = s.last_direction,
        last_message_preview = s.last_preview,
        updated_at = TIMEZONE('utc'::text, NOW())
    FROM summary s
    WHERE c.id = p_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_message_summary_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.whatsapp_refresh_conversation_sync_summary(OLD.conversation_id);
    ELSIF TG_OP = 'INSERT' THEN
        PERFORM public.whatsapp_refresh_conversation_sync_summary(NEW.conversation_id);
    ELSIF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
        PERFORM public.whatsapp_refresh_conversation_sync_summary(OLD.conversation_id);
        PERFORM public.whatsapp_refresh_conversation_sync_summary(NEW.conversation_id);
    ELSE
        PERFORM public.whatsapp_refresh_conversation_sync_summary(NEW.conversation_id);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_message_summary ON public.agent_messages;
CREATE TRIGGER trg_whatsapp_message_summary
AFTER INSERT OR UPDATE OR DELETE ON public.agent_messages
FOR EACH ROW EXECUTE FUNCTION public.whatsapp_message_summary_trigger();

-- Bulk repair used by the safe reconciler and by this migration.
CREATE OR REPLACE FUNCTION public.whatsapp_recalculate_conversation_sync_summaries()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    changed INTEGER;
BEGIN
    WITH summary AS (
        SELECT
            m.conversation_id,
            MIN(m.created_at) AS first_message_at,
            MAX(m.created_at) AS last_message_at,
            MAX(m.created_at) FILTER (WHERE m.direction = 'inbound') AS last_inbound_at,
            MAX(m.created_at) FILTER (WHERE m.direction = 'outbound') AS last_outbound_at,
            MAX(m.created_at) FILTER (
                WHERE m.direction = 'outbound'
                  AND (m.agent = 'human' OR m.action_taken = 'human_reply'
                       OR m.sender_origin IN ('erp', 'phone_or_other_device', 'human_unknown_device'))
            ) AS last_human_outbound_at,
            MAX(m.created_at) FILTER (
                WHERE m.direction = 'outbound' AND m.agent IN ('intake', 'sales')
            ) AS last_agent_outbound_at,
            (ARRAY_AGG(m.whatsapp_message_id ORDER BY m.created_at DESC, m.id DESC)
                FILTER (WHERE m.whatsapp_message_id IS NOT NULL))[1] AS last_whatsapp_message_id,
            (ARRAY_AGG(m.direction ORDER BY m.created_at DESC, m.id DESC))[1] AS last_direction,
            (ARRAY_AGG(COALESCE(NULLIF(m.body, ''), '(' || m.content_type || ')')
                ORDER BY m.created_at DESC, m.id DESC))[1] AS last_preview
        FROM public.agent_messages m
        GROUP BY m.conversation_id
    )
    UPDATE public.agent_conversations c
    SET
        first_message_at = s.first_message_at,
        last_message_at = s.last_message_at,
        last_inbound_at = s.last_inbound_at,
        last_outbound_at = s.last_outbound_at,
        last_human_outbound_at = s.last_human_outbound_at,
        last_agent_outbound_at = s.last_agent_outbound_at,
        last_whatsapp_message_id = s.last_whatsapp_message_id,
        last_message_direction = s.last_direction,
        last_message_preview = s.last_preview,
        updated_at = TIMEZONE('utc'::text, NOW())
    FROM summary s
    WHERE c.id = s.conversation_id;
    GET DIAGNOSTICS changed = ROW_COUNT;
    RETURN changed;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_increment_sync_counters(
    p_history BIGINT DEFAULT 0,
    p_from_me BIGINT DEFAULT 0,
    p_duplicates BIGINT DEFAULT 0
)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.agent_settings
    SET whatsapp_history_messages_recovered = whatsapp_history_messages_recovered + GREATEST(p_history, 0),
        whatsapp_from_me_recovered = whatsapp_from_me_recovered + GREATEST(p_from_me, 0),
        whatsapp_duplicates_prevented = whatsapp_duplicates_prevented + GREATEST(p_duplicates, 0)
    WHERE id = 1;
$$;

-- Atomic database snapshot immediately before any Reception/Sales send.
CREATE OR REPLACE FUNCTION public.whatsapp_auto_reply_barrier(
    p_conversation_id BIGINT,
    p_agent TEXT,
    p_target_inbound_wa_id TEXT DEFAULT NULL,
    p_allow_escalated BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    s public.agent_settings%ROWTYPE;
    c public.agent_conversations%ROWTYPE;
    inbound_id BIGINT;
    inbound_wa_id TEXT;
    inbound_at TIMESTAMP WITH TIME ZONE;
    human_id BIGINT;
    human_wa_id TEXT;
    human_at TIMESTAMP WITH TIME ZONE;
    reason TEXT;
BEGIN
    -- Serializes competing claims/checks for this chat inside Postgres. The
    -- external WhatsApp send cannot be part of a DB transaction, but this
    -- gives every sender one current, ordered snapshot immediately before it.
    PERFORM pg_advisory_xact_lock(p_conversation_id);

    SELECT * INTO s FROM public.agent_settings WHERE id = 1;
    SELECT * INTO c FROM public.agent_conversations WHERE id = p_conversation_id;

    IF s.id IS NULL OR c.id IS NULL THEN reason := 'missing_state';
    ELSIF s.agent_connection IS DISTINCT FROM 'connected' THEN reason := 'whatsapp_not_connected';
    ELSIF s.agent_last_seen_at IS NULL OR s.agent_last_seen_at < NOW() - INTERVAL '2 minutes' THEN reason := 'agent_heartbeat_stale';
    ELSIF s.whatsapp_sync_state IN ('disconnected', 'syncing', 'reconciling', 'gap_detected') THEN reason := 'sync_not_ready';
    ELSIF s.whatsapp_sync_state = 'uncertain' AND c.sync_confidence = 'uncertain' THEN reason := 'sync_uncertain';
    ELSIF c.sync_confidence = 'uncertain' THEN reason := 'sync_uncertain';
    ELSIF c.possible_gap THEN reason := 'possible_gap';
    ELSIF NOT s.bot_auto_reply_enabled OR NOT c.bot_enabled THEN reason := 'bot_disabled';
    ELSIF c.selected_agent IS DISTINCT FROM p_agent THEN reason := 'wrong_agent';
    ELSIF p_agent = 'intake' AND NOT s.intake_agent_enabled THEN reason := 'intake_disabled';
    ELSIF p_agent = 'sales' AND NOT s.sales_agent_enabled THEN reason := 'sales_disabled';
    ELSIF c.status IN ('human_active', 'closed') THEN reason := 'human_or_closed';
    ELSIF c.status = 'escalated' AND NOT p_allow_escalated THEN reason := 'escalated';
    ELSIF c.etapa IN ('ready_for_sales', 'human_assigned', 'resolved') AND NOT p_allow_escalated THEN reason := 'human_owned_stage';
    END IF;

    SELECT m.id, m.whatsapp_message_id, m.created_at
    INTO inbound_id, inbound_wa_id, inbound_at
    FROM public.agent_messages m
    WHERE m.conversation_id = p_conversation_id AND m.direction = 'inbound'
    ORDER BY m.created_at DESC, m.id DESC LIMIT 1;

    SELECT m.id, m.whatsapp_message_id, m.created_at
    INTO human_id, human_wa_id, human_at
    FROM public.agent_messages m
    WHERE m.conversation_id = p_conversation_id
      AND m.direction = 'outbound'
      AND (m.agent = 'human' OR m.action_taken = 'human_reply'
           OR m.sender_origin IN ('erp', 'phone_or_other_device', 'human_unknown_device'))
    ORDER BY m.created_at DESC, m.id DESC LIMIT 1;

    IF reason IS NULL AND inbound_id IS NULL THEN reason := 'no_customer_message'; END IF;
    IF reason IS NULL AND p_target_inbound_wa_id IS NOT NULL
       AND inbound_wa_id IS DISTINCT FROM p_target_inbound_wa_id THEN
        reason := 'stale_customer_target';
    END IF;
    IF reason IS NULL AND human_at IS NOT NULL
       AND (human_at > inbound_at OR (human_at = inbound_at AND human_id > inbound_id)) THEN
        reason := 'human_replied_after_customer';
    END IF;

    IF reason IS NOT NULL THEN
        UPDATE public.agent_settings
        SET whatsapp_auto_replies_suppressed = whatsapp_auto_replies_suppressed + 1
        WHERE id = 1;
        INSERT INTO public.agent_whatsapp_sync_events (
            event_type, process_generation, connection_generation,
            conversation_id, reason, detail
        ) VALUES (
            CASE WHEN reason = 'human_replied_after_customer'
                 THEN 'auto_reply_suppressed_human_reply'
                 ELSE 'auto_reply_suppressed' END,
            s.whatsapp_process_generation,
            s.whatsapp_connection_generation,
            p_conversation_id,
            reason,
            JSONB_BUILD_OBJECT(
                'agent', p_agent,
                'target_inbound_id', p_target_inbound_wa_id,
                'last_inbound_id', inbound_wa_id,
                'last_human_id', human_wa_id
            )
        );
    END IF;

    RETURN JSONB_BUILD_OBJECT(
        'allowed', reason IS NULL,
        'reason', reason,
        'last_inbound_id', inbound_wa_id,
        'last_inbound_at', inbound_at,
        'last_human_id', human_wa_id,
        'last_human_at', human_at,
        'sync_state', s.whatsapp_sync_state,
        'sync_confidence', c.sync_confidence,
        'possible_gap', c.possible_gap
    );
END;
$$;

-- Applies durable identity evidence without guessing or deleting either side
-- of a duplicate. The repair command performs the audited merge afterwards.
CREATE OR REPLACE FUNCTION public.whatsapp_reconcile_lid_mappings()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    linked_phone_rows INTEGER := 0;
    promoted_lid_rows INTEGER := 0;
    duplicate_pairs INTEGER := 0;
BEGIN
    UPDATE public.agent_conversations c
    SET lid = m.lid, updated_at = NOW()
    FROM public.agent_whatsapp_lid_mappings m
    WHERE c.phone_number = m.phone_number
      AND c.lid IS DISTINCT FROM m.lid;
    GET DIAGNOSTICS linked_phone_rows = ROW_COUNT;

    UPDATE public.agent_conversations c
    SET phone_number = m.phone_number, lid = m.lid, updated_at = NOW()
    FROM public.agent_whatsapp_lid_mappings m
    WHERE (c.lid = m.lid OR c.phone_number = m.lid)
      AND NOT EXISTS (
          SELECT 1 FROM public.agent_conversations phone_row
          WHERE phone_row.phone_number = m.phone_number AND phone_row.id <> c.id
      )
      AND c.phone_number IS DISTINCT FROM m.phone_number;
    GET DIAGNOSTICS promoted_lid_rows = ROW_COUNT;

    SELECT COUNT(*) INTO duplicate_pairs
    FROM public.agent_whatsapp_lid_mappings m
    JOIN public.agent_conversations phone_row ON phone_row.phone_number = m.phone_number
    JOIN public.agent_conversations lid_row
      ON lid_row.id <> phone_row.id
     AND (lid_row.lid = m.lid OR lid_row.phone_number = m.lid);

    UPDATE public.agent_whatsapp_lid_mappings SET last_reconciled_at = NOW();
    RETURN JSONB_BUILD_OBJECT(
        'phone_rows_linked', linked_phone_rows,
        'lid_rows_promoted', promoted_lid_rows,
        'duplicate_pairs', duplicate_pairs
    );
END;
$$;

-- The history worker releases only the conversations for which it actually
-- imported evidence. Conversations absent from a sync stay uncertain.
CREATE OR REPLACE FUNCTION public.whatsapp_mark_conversations_reconciled(
    p_conversation_ids BIGINT[],
    p_confidence TEXT,
    p_clear_gap BOOLEAN,
    p_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE changed INTEGER;
BEGIN
    UPDATE public.agent_conversations
    SET
        last_history_sync_at = p_sync_at,
        last_reconciled_at = CASE WHEN p_clear_gap THEN p_sync_at ELSE last_reconciled_at END,
        sync_confidence = CASE WHEN p_clear_gap THEN p_confidence ELSE sync_confidence END,
        possible_gap = CASE WHEN p_clear_gap THEN FALSE ELSE possible_gap END,
        sync_uncertain_reason = CASE WHEN p_clear_gap THEN NULL ELSE sync_uncertain_reason END,
        updated_at = NOW()
    WHERE id = ANY(p_conversation_ids);
    GET DIAGNOSTICS changed = ROW_COUNT;
    RETURN changed;
END;
$$;

-- Late retries are cancelled only for automatic origins. Human ERP messages
-- remain visible/pending for the person who wrote them.
CREATE OR REPLACE FUNCTION public.whatsapp_cancel_stale_automatic_outbox()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE changed INTEGER;
BEGIN
    UPDATE public.agent_outbox o
    SET
        status = 'canceled',
        cancelled_at = NOW(),
        cancel_reason = CASE
            WHEN c.possible_gap OR c.sync_confidence = 'uncertain' THEN 'sync_uncertain'
            WHEN EXISTS (
                SELECT 1 FROM public.agent_messages h
                WHERE h.conversation_id = o.conversation_id
                  AND h.direction = 'outbound'
                  AND (h.agent = 'human' OR h.action_taken = 'human_reply'
                       OR h.sender_origin IN ('erp', 'phone_or_other_device', 'human_unknown_device'))
                  AND (o.target_inbound_wa_id IS NULL OR h.created_at > COALESCE((
                      SELECT i.created_at FROM public.agent_messages i
                      WHERE i.whatsapp_message_id = o.target_inbound_wa_id LIMIT 1
                  ), o.created_at))
            ) THEN 'human_replied_after_customer'
            ELSE 'stale_customer_target'
        END,
        error = 'Respuesta automatica cancelada: el chat cambio antes del envio'
    FROM public.agent_conversations c
    WHERE o.conversation_id = c.id
      AND o.status = 'pending'
      AND o.message_origin IN ('intake', 'sales')
      AND (
          c.possible_gap OR c.sync_confidence = 'uncertain'
          OR o.target_inbound_wa_id IS NULL
          OR o.target_inbound_wa_id IS DISTINCT FROM (
              SELECT i.whatsapp_message_id FROM public.agent_messages i
              WHERE i.conversation_id = o.conversation_id AND i.direction = 'inbound'
              ORDER BY i.created_at DESC, i.id DESC LIMIT 1
          )
          OR EXISTS (
              SELECT 1 FROM public.agent_messages h
              WHERE h.conversation_id = o.conversation_id
                AND h.direction = 'outbound'
                AND (h.agent = 'human' OR h.action_taken = 'human_reply'
                     OR h.sender_origin IN ('erp', 'phone_or_other_device', 'human_unknown_device'))
                AND h.created_at > COALESCE((
                    SELECT i.created_at FROM public.agent_messages i
                    WHERE i.whatsapp_message_id = o.target_inbound_wa_id LIMIT 1
                ), o.created_at)
          )
      );
    GET DIAGNOSTICS changed = ROW_COUNT;
    UPDATE public.agent_settings
    SET whatsapp_stale_outbox_cancelled = whatsapp_stale_outbox_cancelled + changed
    WHERE id = 1 AND changed > 0;
    IF changed > 0 THEN
        INSERT INTO public.agent_whatsapp_sync_events (
            event_type, process_generation, connection_generation, detail
        )
        SELECT 'stale_outbox_cancelled', whatsapp_process_generation,
               whatsapp_connection_generation, JSONB_BUILD_OBJECT('count', changed)
        FROM public.agent_settings WHERE id = 1;
    END IF;
    RETURN changed;
END;
$$;

GRANT SELECT ON public.agent_whatsapp_disconnects,
    public.agent_whatsapp_history_syncs,
    public.agent_whatsapp_sync_events,
    public.agent_whatsapp_lid_mappings TO authenticated;
GRANT ALL ON public.agent_whatsapp_disconnects,
    public.agent_whatsapp_history_syncs,
    public.agent_whatsapp_sync_events,
    public.agent_whatsapp_lid_mappings TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_auto_reply_barrier(BIGINT, TEXT, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_recalculate_conversation_sync_summaries() TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_increment_sync_counters(BIGINT, BIGINT, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_mark_conversations_reconciled(BIGINT[], TEXT, BOOLEAN, TIMESTAMP WITH TIME ZONE) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_cancel_stale_automatic_outbox() TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_reconcile_lid_mappings() TO service_role;

ALTER TABLE public.agent_whatsapp_disconnects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_whatsapp_history_syncs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_whatsapp_sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_whatsapp_lid_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read WhatsApp disconnects" ON public.agent_whatsapp_disconnects;
CREATE POLICY "Authenticated users read WhatsApp disconnects"
ON public.agent_whatsapp_disconnects FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users read WhatsApp history syncs" ON public.agent_whatsapp_history_syncs;
CREATE POLICY "Authenticated users read WhatsApp history syncs"
ON public.agent_whatsapp_history_syncs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users read WhatsApp sync events" ON public.agent_whatsapp_sync_events;
CREATE POLICY "Authenticated users read WhatsApp sync events"
ON public.agent_whatsapp_sync_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users read WhatsApp LID mappings" ON public.agent_whatsapp_lid_mappings;
CREATE POLICY "Authenticated users read WhatsApp LID mappings"
ON public.agent_whatsapp_lid_mappings FOR SELECT TO authenticated USING (true);

SELECT public.whatsapp_recalculate_conversation_sync_summaries();

COMMIT;
