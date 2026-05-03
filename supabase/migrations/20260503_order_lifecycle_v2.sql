-- Migration: Order Lifecycle V2 — Role-Based Dashboard + WhatsApp + Tracking
-- Timestamp: 20260503
-- Purpose: Add Confirmado_Proveedor status, tracking columns, new roles, and guarded status transition RPC.
-- CAUTION: Does NOT modify the tr_orders_financial_transaction trigger. That trigger fires on Entregado and is untouched.

-- ============================================================
-- 1. Add new enum value: Confirmado_Proveedor
-- ============================================================
-- ALTER TYPE ... ADD VALUE is non-transactional in Postgres,
-- so it must be outside a transaction block. Supabase migrations
-- run each file in its own transaction, but ADD VALUE IF NOT EXISTS
-- is safe in PG 12+.
DO $$
BEGIN
    -- Check if the value already exists before adding
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'order_status_enum'::regtype 
        AND enumlabel = 'Confirmado_Proveedor'
    ) THEN
        -- We need to use a workaround since ADD VALUE can't be in a transaction
        -- in older PG versions. For Supabase (PG 15+), this is safe.
        EXECUTE 'ALTER TYPE order_status_enum ADD VALUE ''Confirmado_Proveedor'' AFTER ''Sourcing_Pendiente''';
    END IF;
END$$;

-- ============================================================
-- 2. Add tracking & audit columns to orders
-- ============================================================
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS carrier_name TEXT,
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS status_updated_by UUID REFERENCES auth.users(id);

-- ============================================================
-- 3. Insert new roles (dynamic conflict handling)
-- ============================================================
-- Using ON CONFLICT to handle cases where IDs are already taken.
-- The permissions JSONB controls what ProtectedRoute.tsx allows.
INSERT INTO public.roles (id, name, permissions) VALUES
(3, 'Sourcing Manager', '{
    "dispatch": {"read": true, "write": true},
    "orders": {"read": true, "write": true},
    "products": {"read": true},
    "inventory": {"read": true}
}'::jsonb),
(4, 'Warehouse', '{
    "dispatch": {"read": true, "write": true},
    "inventory": {"read": true, "write": true},
    "orders": {"read": true}
}'::jsonb),
(5, 'Sales Monitor', '{
    "orders": {"read": true, "write": true},
    "customers": {"read": true, "write": true},
    "dispatch": {"read": true}
}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    permissions = EXCLUDED.permissions;

-- ============================================================
-- 4. Guarded Status Transition RPC (State Machine)
-- ============================================================
-- This function validates that status transitions follow the 
-- approved lifecycle, and records audit metadata.
-- It does NOT touch the financial trigger — that's handled by 
-- tr_orders_financial_transaction on Entregado.

CREATE OR REPLACE FUNCTION update_order_status(
    p_order_id INTEGER,
    p_new_status TEXT,  -- Accepts text, casts to enum internally
    p_user_id UUID DEFAULT NULL,
    p_tracking_number TEXT DEFAULT NULL,
    p_carrier_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_status order_status_enum;
    v_new_status order_status_enum;
    v_allowed BOOLEAN := FALSE;
    v_order_record RECORD;
BEGIN
    -- 1. Fetch current order
    SELECT status, id INTO v_order_record
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;  -- Lock row to prevent race conditions

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orden #% no encontrada.', p_order_id;
    END IF;

    v_current_status := v_order_record.status;
    
    -- 2. Cast new status
    BEGIN
        v_new_status := p_new_status::order_status_enum;
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Estado inválido: %. Estados válidos: Borrador, Sourcing_Pendiente, Confirmado_Proveedor, Pendiente_Pago, Listo_Cumplimiento, En_Transito, Entregado, Cancelado', p_new_status;
    END;

    -- 3. Validate transition (state machine)
    v_allowed := CASE
        -- From Borrador → can go to Sourcing or directly to Pendiente_Pago (POS flow)
        WHEN v_current_status = 'Borrador' AND v_new_status IN ('Sourcing_Pendiente', 'Pendiente_Pago', 'Cancelado') THEN TRUE
        
        -- From Sourcing_Pendiente → provider confirms
        WHEN v_current_status = 'Sourcing_Pendiente' AND v_new_status IN ('Confirmado_Proveedor', 'Cancelado') THEN TRUE
        
        -- From Confirmado_Proveedor → customer sends payment OR cancel
        WHEN v_current_status = 'Confirmado_Proveedor' AND v_new_status IN ('Pendiente_Pago', 'Cancelado') THEN TRUE
        
        -- From Pendiente_Pago → payment verified → ready for dispatch
        WHEN v_current_status = 'Pendiente_Pago' AND v_new_status IN ('Listo_Cumplimiento', 'Borrador', 'Cancelado') THEN TRUE
        
        -- From Listo_Cumplimiento → warehouse ships (requires tracking)
        WHEN v_current_status = 'Listo_Cumplimiento' AND v_new_status IN ('En_Transito', 'Cancelado') THEN TRUE
        
        -- From En_Transito → delivered (triggers accounting)
        WHEN v_current_status = 'En_Transito' AND v_new_status IN ('Entregado', 'RMA_Pendiente') THEN TRUE
        
        -- From Entregado → post-delivery issues
        WHEN v_current_status = 'Entregado' AND v_new_status IN ('RMA_Pendiente', 'Reembolsado') THEN TRUE
        
        ELSE FALSE
    END;

    IF NOT v_allowed THEN
        RAISE EXCEPTION 'Transición no permitida: % → %. Verifique el flujo de trabajo.', v_current_status, v_new_status;
    END IF;

    -- 4. Enforce tracking number requirement for En_Transito
    IF v_new_status = 'En_Transito' AND (p_tracking_number IS NULL OR p_tracking_number = '') THEN
        RAISE EXCEPTION 'Se requiere número de rastreo para marcar como En Tránsito.';
    END IF;

    -- 5. Perform the update
    UPDATE orders SET
        status = v_new_status,
        tracking_number = COALESCE(p_tracking_number, tracking_number),
        carrier_name = COALESCE(p_carrier_name, carrier_name),
        status_updated_at = NOW(),
        status_updated_by = p_user_id
    WHERE id = p_order_id;

    -- 6. Return result
    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'previous_status', v_current_status::text,
        'new_status', v_new_status::text,
        'tracking_number', p_tracking_number
    );
END;
$$;

-- ============================================================
-- 5. Grant execute to authenticated users
-- ============================================================
GRANT EXECUTE ON FUNCTION update_order_status(INTEGER, TEXT, UUID, TEXT, TEXT) TO authenticated;
