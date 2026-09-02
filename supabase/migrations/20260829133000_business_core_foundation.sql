-- Business Core Foundation
--
-- This migration is additive: it does not alter current stock, prices, POS,
-- orders, WhatsApp queues or agent behaviour.  It only adds guarded building
-- blocks that can be adopted by existing flows one at a time.

BEGIN;

-- A durable outbox for future workers, integrations and agents.  Existing
-- agent_outbox remains the WhatsApp delivery queue and is intentionally not
-- changed by this migration.
CREATE TABLE IF NOT EXISTS public.domain_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL CHECK (length(trim(event_type)) > 0),
    entity_type TEXT NOT NULL CHECK (length(trim(entity_type)) > 0),
    entity_id TEXT NOT NULL CHECK (length(trim(entity_id)) > 0),
    source TEXT NOT NULL DEFAULT 'erp' CHECK (source IN (
        'erp', 'catalog', 'whatsapp', 'agent', 'system', 'integration'
    )),
    actor_type TEXT NOT NULL DEFAULT 'system' CHECK (actor_type IN (
        'employee', 'agent', 'system', 'integration', 'customer'
    )),
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'processed', 'failed', 'discarded'
    )),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    last_error TEXT,
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_domain_events_source_idempotency
    ON public.domain_events(source, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_domain_events_pending
    ON public.domain_events(available_at, created_at)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_domain_events_entity
    ON public.domain_events(entity_type, entity_id, created_at DESC);

ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_domain_events" ON public.domain_events;
CREATE POLICY "authenticated_read_domain_events"
    ON public.domain_events FOR SELECT TO authenticated USING (true);

-- Browser clients use this RPC instead of having generic INSERT access to the
-- event table.  Its idempotency key turns a retry into the original event.
CREATE OR REPLACE FUNCTION public.emit_domain_event(
    p_event_type TEXT,
    p_entity_type TEXT,
    p_entity_id TEXT,
    p_payload JSONB DEFAULT '{}'::jsonb,
    p_source TEXT DEFAULT 'erp',
    p_idempotency_key TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_id UUID;
    v_actor_id UUID := auth.uid();
BEGIN
    IF NULLIF(trim(COALESCE(p_event_type, '')), '') IS NULL
       OR NULLIF(trim(COALESCE(p_entity_type, '')), '') IS NULL
       OR NULLIF(trim(COALESCE(p_entity_id, '')), '') IS NULL THEN
        RAISE EXCEPTION 'event_type, entity_type and entity_id are required';
    END IF;
    IF p_source NOT IN ('erp', 'catalog', 'whatsapp', 'agent', 'system', 'integration') THEN
        RAISE EXCEPTION 'Unsupported event source: %', p_source;
    END IF;

    IF NULLIF(trim(COALESCE(p_idempotency_key, '')), '') IS NOT NULL THEN
        SELECT id INTO v_event_id
        FROM public.domain_events
        WHERE source = p_source AND idempotency_key = p_idempotency_key;
        IF v_event_id IS NOT NULL THEN
            RETURN v_event_id;
        END IF;
    END IF;

    INSERT INTO public.domain_events (
        event_type, entity_type, entity_id, source, actor_type, actor_id,
        payload, idempotency_key
    ) VALUES (
        trim(p_event_type), trim(p_entity_type), trim(p_entity_id), p_source,
        CASE
            WHEN v_actor_id IS NOT NULL THEN 'employee'
            WHEN auth.role() = 'service_role' THEN 'agent'
            ELSE 'system'
        END,
        v_actor_id, COALESCE(p_payload, '{}'::jsonb),
        NULLIF(trim(COALESCE(p_idempotency_key, '')), '')
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
EXCEPTION
    WHEN unique_violation THEN
        SELECT id INTO v_event_id
        FROM public.domain_events
        WHERE source = p_source AND idempotency_key = p_idempotency_key;
        IF v_event_id IS NOT NULL THEN
            RETURN v_event_id;
        END IF;
        RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.emit_domain_event(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emit_domain_event(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT)
    TO authenticated, service_role;

-- Append-only audit data.  Existing tables are not given triggers yet: the
-- first adopters will call this RPC explicitly, which keeps current flows
-- untouched and makes each rollout observable.
CREATE TABLE IF NOT EXISTS public.business_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type TEXT NOT NULL CHECK (actor_type IN (
        'employee', 'agent', 'system', 'integration', 'customer'
    )),
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (length(trim(action)) > 0),
    entity_type TEXT NOT NULL CHECK (length(trim(entity_type)) > 0),
    entity_id TEXT NOT NULL CHECK (length(trim(entity_id)) > 0),
    before_data JSONB,
    after_data JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_audit_entity
    ON public.business_audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_audit_actor
    ON public.business_audit_log(actor_id, created_at DESC)
    WHERE actor_id IS NOT NULL;

ALTER TABLE public.business_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_business_audit" ON public.business_audit_log;
CREATE POLICY "authenticated_read_business_audit"
    ON public.business_audit_log FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.record_business_audit(
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id TEXT,
    p_before_data JSONB DEFAULT NULL,
    p_after_data JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_audit_id UUID;
    v_actor_id UUID := auth.uid();
BEGIN
    IF v_actor_id IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'An authenticated ERP user or authorized service is required to write an audit record';
    END IF;
    IF NULLIF(trim(COALESCE(p_action, '')), '') IS NULL
       OR NULLIF(trim(COALESCE(p_entity_type, '')), '') IS NULL
       OR NULLIF(trim(COALESCE(p_entity_id, '')), '') IS NULL THEN
        RAISE EXCEPTION 'action, entity_type and entity_id are required';
    END IF;

    INSERT INTO public.business_audit_log (
        actor_type, actor_id, action, entity_type, entity_id,
        before_data, after_data, metadata
    ) VALUES (
        CASE WHEN v_actor_id IS NULL THEN 'agent' ELSE 'employee' END,
        v_actor_id, trim(p_action), trim(p_entity_type), trim(p_entity_id),
        p_before_data, p_after_data, COALESCE(p_metadata, '{}'::jsonb)
    ) RETURNING id INTO v_audit_id;
    RETURN v_audit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_business_audit(TEXT, TEXT, TEXT, JSONB, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_business_audit(TEXT, TEXT, TEXT, JSONB, JSONB, JSONB)
    TO authenticated, service_role;

-- A reservation is a soft commitment.  It never changes inventory_levels;
-- therefore all current POS, orders and stock reports keep their behaviour
-- until a specific caller opts into the new availability function.
CREATE TABLE IF NOT EXISTS public.inventory_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    customer_id INTEGER REFERENCES public.customers(id) ON DELETE SET NULL,
    quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'released', 'consumed', 'cancelled', 'expired'
    )),
    reference_type TEXT NOT NULL DEFAULT 'manual' CHECK (length(trim(reference_type)) > 0),
    reference_id TEXT,
    idempotency_key TEXT,
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 hours'),
    released_at TIMESTAMPTZ,
    released_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    release_reason TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_reservations_idempotency
    ON public.inventory_reservations(idempotency_key)
    WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_available
    ON public.inventory_reservations(product_id, warehouse_id, expires_at)
    WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_reference
    ON public.inventory_reservations(reference_type, reference_id)
    WHERE reference_id IS NOT NULL;

ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_inventory_reservations" ON public.inventory_reservations;
CREATE POLICY "authenticated_read_inventory_reservations"
    ON public.inventory_reservations FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.touch_business_core_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_inventory_reservations ON public.inventory_reservations;
CREATE TRIGGER trg_touch_inventory_reservations
    BEFORE UPDATE ON public.inventory_reservations
    FOR EACH ROW EXECUTE FUNCTION public.touch_business_core_updated_at();

-- This read model ignores expired rows even if no maintenance worker has
-- marked them as expired yet.
CREATE OR REPLACE FUNCTION public.get_inventory_availability(
    p_product_id INTEGER,
    p_warehouse_id INTEGER
) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT jsonb_build_object(
        'product_id', il.product_id,
        'warehouse_id', il.warehouse_id,
        'on_hand', COALESCE(il.current_stock, 0),
        'reserved', COALESCE(SUM(r.quantity) FILTER (
            WHERE r.status = 'active' AND r.expires_at > now()
        ), 0),
        'available', GREATEST(COALESCE(il.current_stock, 0) - COALESCE(
            SUM(r.quantity) FILTER (WHERE r.status = 'active' AND r.expires_at > now()), 0
        ), 0)
    )
    FROM public.inventory_levels il
    LEFT JOIN public.inventory_reservations r
        ON r.product_id = il.product_id AND r.warehouse_id = il.warehouse_id
    WHERE il.product_id = p_product_id AND il.warehouse_id = p_warehouse_id
    GROUP BY il.product_id, il.warehouse_id, il.current_stock;
$$;

-- Row-level locking serializes competing reservations for the same product
-- and warehouse, preventing two users from reserving the final unit.
CREATE OR REPLACE FUNCTION public.reserve_inventory_stock(
    p_product_id INTEGER,
    p_warehouse_id INTEGER,
    p_quantity NUMERIC,
    p_reference_type TEXT DEFAULT 'manual',
    p_reference_id TEXT DEFAULT NULL,
    p_customer_id INTEGER DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_on_hand NUMERIC;
    v_reserved NUMERIC;
    v_expires_at TIMESTAMPTZ := COALESCE(p_expires_at, now() + interval '2 hours');
    v_reservation_id UUID;
    v_existing public.inventory_reservations%ROWTYPE;
BEGIN
    IF v_actor_id IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'An authenticated ERP user or authorized service is required to reserve stock';
    END IF;
    IF p_product_id IS NULL OR p_warehouse_id IS NULL OR COALESCE(p_quantity, 0) <= 0 THEN
        RAISE EXCEPTION 'product_id, warehouse_id and a positive quantity are required';
    END IF;
    IF NULLIF(trim(COALESCE(p_reference_type, '')), '') IS NULL OR v_expires_at <= now() THEN
        RAISE EXCEPTION 'reference_type is required and expiration must be in the future';
    END IF;

    SELECT COALESCE(current_stock, 0) INTO v_on_hand
    FROM public.inventory_levels
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No inventory level exists for product % in warehouse %', p_product_id, p_warehouse_id;
    END IF;

    -- Check after taking the inventory lock so concurrent retries converge.
    IF NULLIF(trim(COALESCE(p_idempotency_key, '')), '') IS NOT NULL THEN
        SELECT * INTO v_existing FROM public.inventory_reservations
        WHERE idempotency_key = p_idempotency_key;
        IF FOUND THEN
            RETURN jsonb_build_object(
                'reservation_id', v_existing.id, 'status', v_existing.status,
                'product_id', v_existing.product_id, 'warehouse_id', v_existing.warehouse_id,
                'quantity', v_existing.quantity, 'idempotent', true
            );
        END IF;
    END IF;

    SELECT COALESCE(SUM(quantity), 0) INTO v_reserved
    FROM public.inventory_reservations
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
      AND status = 'active' AND expires_at > now();
    IF v_on_hand - v_reserved < p_quantity THEN
        RAISE EXCEPTION 'Insufficient available stock for product % in warehouse % (on hand %, reserved %, requested %)',
            p_product_id, p_warehouse_id, v_on_hand, v_reserved, p_quantity;
    END IF;

    INSERT INTO public.inventory_reservations (
        product_id, warehouse_id, customer_id, quantity, reference_type,
        reference_id, idempotency_key, notes, metadata, expires_at, created_by
    ) VALUES (
        p_product_id, p_warehouse_id, p_customer_id, p_quantity, trim(p_reference_type),
        NULLIF(trim(COALESCE(p_reference_id, '')), ''),
        NULLIF(trim(COALESCE(p_idempotency_key, '')), ''),
        NULLIF(trim(COALESCE(p_notes, '')), ''), COALESCE(p_metadata, '{}'::jsonb),
        v_expires_at, v_actor_id
    ) RETURNING id INTO v_reservation_id;

    PERFORM public.emit_domain_event(
        'inventory.reserved', 'inventory_reservation', v_reservation_id::text,
        jsonb_build_object('product_id', p_product_id, 'warehouse_id', p_warehouse_id,
                           'quantity', p_quantity, 'expires_at', v_expires_at),
        'erp', 'inventory-reserved:' || v_reservation_id::text
    );
    PERFORM public.record_business_audit(
        'inventory.reserved', 'inventory_reservation', v_reservation_id::text,
        NULL, jsonb_build_object('product_id', p_product_id, 'warehouse_id', p_warehouse_id,
                                 'quantity', p_quantity, 'expires_at', v_expires_at),
        jsonb_build_object('reference_type', trim(p_reference_type))
    );

    RETURN jsonb_build_object(
        'reservation_id', v_reservation_id, 'status', 'active',
        'on_hand', v_on_hand, 'reserved_before', v_reserved,
        'available_after', v_on_hand - v_reserved - p_quantity,
        'expires_at', v_expires_at, 'idempotent', false
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_inventory_reservation(
    p_reservation_id UUID,
    p_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_reservation public.inventory_reservations%ROWTYPE;
BEGIN
    IF v_actor_id IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'An authenticated ERP user or authorized service is required to release a reservation';
    END IF;
    SELECT * INTO v_reservation FROM public.inventory_reservations
    WHERE id = p_reservation_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation % was not found', p_reservation_id;
    END IF;
    IF v_reservation.status <> 'active' THEN
        RETURN jsonb_build_object('reservation_id', v_reservation.id, 'status', v_reservation.status, 'changed', false);
    END IF;

    UPDATE public.inventory_reservations
    SET status = 'released', released_at = now(), released_by = v_actor_id,
        release_reason = NULLIF(trim(COALESCE(p_reason, '')), '')
    WHERE id = p_reservation_id;

    PERFORM public.emit_domain_event(
        'inventory.reservation_released', 'inventory_reservation', p_reservation_id::text,
        jsonb_build_object('reason', NULLIF(trim(COALESCE(p_reason, '')), '')),
        'erp', 'inventory-released:' || p_reservation_id::text
    );
    PERFORM public.record_business_audit(
        'inventory.reservation_released', 'inventory_reservation', p_reservation_id::text,
        jsonb_build_object('status', 'active'), jsonb_build_object('status', 'released'),
        jsonb_build_object('reason', NULLIF(trim(COALESCE(p_reason, '')), ''))
    );
    RETURN jsonb_build_object('reservation_id', p_reservation_id, 'status', 'released', 'changed', true);
END;
$$;

-- This closes a reservation only after an existing sale/order flow has
-- deducted physical stock.  It deliberately never performs that deduction.
CREATE OR REPLACE FUNCTION public.consume_inventory_reservation(
    p_reservation_id UUID,
    p_reference_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_reservation public.inventory_reservations%ROWTYPE;
BEGIN
    IF v_actor_id IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'An authenticated ERP user or authorized service is required to consume a reservation';
    END IF;
    SELECT * INTO v_reservation FROM public.inventory_reservations
    WHERE id = p_reservation_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation % was not found', p_reservation_id;
    END IF;
    IF v_reservation.status <> 'active' THEN
        RETURN jsonb_build_object('reservation_id', v_reservation.id, 'status', v_reservation.status, 'changed', false);
    END IF;

    UPDATE public.inventory_reservations
    SET status = 'consumed', released_at = now(), released_by = v_actor_id,
        reference_id = COALESCE(NULLIF(trim(COALESCE(p_reference_id, '')), ''), reference_id)
    WHERE id = p_reservation_id;

    PERFORM public.emit_domain_event(
        'inventory.reservation_consumed', 'inventory_reservation', p_reservation_id::text,
        jsonb_build_object('reference_id', NULLIF(trim(COALESCE(p_reference_id, '')), '')),
        'erp', 'inventory-consumed:' || p_reservation_id::text
    );
    PERFORM public.record_business_audit(
        'inventory.reservation_consumed', 'inventory_reservation', p_reservation_id::text,
        jsonb_build_object('status', 'active'), jsonb_build_object('status', 'consumed'),
        jsonb_build_object('reference_id', NULLIF(trim(COALESCE(p_reference_id, '')), ''))
    );
    RETURN jsonb_build_object('reservation_id', p_reservation_id, 'status', 'consumed', 'changed', true);
END;
$$;

-- A worker can call this for clear reporting.  Availability already ignores
-- expired rows, so a delayed worker cannot block a sale.
CREATE OR REPLACE FUNCTION public.expire_inventory_reservations(
    p_limit INTEGER DEFAULT 500
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_count INTEGER;
BEGIN
    WITH expired AS (
        SELECT id FROM public.inventory_reservations
        WHERE status = 'active' AND expires_at <= now()
        ORDER BY expires_at
        LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 500), 5000))
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.inventory_reservations r
    SET status = 'expired', released_at = now(), release_reason = 'expired automatically'
    FROM expired WHERE r.id = expired.id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.get_inventory_availability(INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reserve_inventory_stock(INTEGER, INTEGER, NUMERIC, TEXT, TEXT, INTEGER, TIMESTAMPTZ, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_inventory_reservation(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.consume_inventory_reservation(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expire_inventory_reservations(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inventory_availability(INTEGER, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reserve_inventory_stock(INTEGER, INTEGER, NUMERIC, TEXT, TEXT, INTEGER, TIMESTAMPTZ, TEXT, JSONB, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_inventory_reservation(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_inventory_reservation(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expire_inventory_reservations(INTEGER) TO service_role;

COMMIT;
