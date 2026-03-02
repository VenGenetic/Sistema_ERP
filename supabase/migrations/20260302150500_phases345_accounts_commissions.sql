-- Migration: Phases 3, 4, 5
-- Timestamp: 20260302150500

-- Phase 3: Accounts verification
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE name = 'Efectivo en Tránsito Ops') THEN
        INSERT INTO public.accounts (code, name, category, is_nominal, currency, position) 
        VALUES ('1-1004', 'Efectivo en Tránsito Ops', 'asset', false, 'USD', 4);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE name = 'Caja Principal') THEN
        INSERT INTO public.accounts (code, name, category, is_nominal, currency, position) 
        VALUES ('1-1005', 'Caja Principal', 'asset', false, 'USD', 5);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE name = 'Ingresos Diferidos / Anticipos') THEN
        INSERT INTO public.accounts (code, name, category, is_nominal, currency, position) 
        VALUES ('2-2001', 'Ingresos Diferidos / Anticipos', 'liability', false, 'USD', 1);
    END IF;
END $$;

-- Phase 4 & 5: Commission Ledger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_type_enum') THEN
        CREATE TYPE commission_type_enum AS ENUM ('credit', 'clawback');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_status_enum') THEN
        CREATE TYPE commission_status_enum AS ENUM ('pending', 'vested', 'paid');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.commission_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_user_id UUID REFERENCES public.profiles(id),
    order_id INTEGER REFERENCES public.orders(id),
    amount NUMERIC NOT NULL,
    type commission_type_enum NOT NULL,
    status commission_status_enum NOT NULL DEFAULT 'pending',
    vesting_date TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '30 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS for commission_ledger
ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own commissions" ON public.commission_ledger;
CREATE POLICY "Users can view their own commissions"
ON public.commission_ledger FOR SELECT
USING (auth.uid() = sales_user_id);

-- Admin policy for testing/viewing all
DROP POLICY IF EXISTS "Admins can view all commissions" ON public.commission_ledger;
CREATE POLICY "Admins can view all commissions"
ON public.commission_ledger FOR SELECT
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_id = 1));

-- Trigger for Commission Generation (Phase 4) and Clawback (Phase 5)
CREATE OR REPLACE FUNCTION process_order_commission()
RETURNS TRIGGER AS $$
DECLARE
    v_total_cost NUMERIC := 0;
    v_margin NUMERIC := 0;
    v_commission NUMERIC := 0;
BEGIN
    -- PHASE 4: Generation on Entregado
    IF NEW.status = 'Entregado' AND OLD.status != 'Entregado' THEN
        -- Calculate total cost for the order
        SELECT COALESCE(SUM(quantity * unit_cost), 0) INTO v_total_cost
        FROM public.order_items
        WHERE order_id = NEW.id;
        
        v_margin := NEW.total_amount - v_total_cost;
        
        IF v_margin > 0 THEN
            v_commission := v_margin * 0.10; -- 10% commission
            
            INSERT INTO public.commission_ledger (sales_user_id, order_id, amount, type, status)
            VALUES (NEW.closer_id, NEW.id, v_commission, 'credit', 'pending');
        END IF;
    
    -- PHASE 5: Clawback on Reembolsado/Cancelado/RMA_Pendiente
    ELSIF NEW.status IN ('Reembolsado', 'Cancelado', 'RMA_Pendiente') AND OLD.status NOT IN ('Reembolsado', 'Cancelado', 'RMA_Pendiente') THEN
        -- Sum up all prior credits minus clawbacks for this order to know how much we can clawback
        SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) INTO v_commission
        FROM public.commission_ledger
        WHERE order_id = NEW.id;
        
        IF v_commission > 0 THEN
            INSERT INTO public.commission_ledger (sales_user_id, order_id, amount, type, status)
            VALUES (NEW.closer_id, NEW.id, v_commission, 'clawback', 'pending');
        END IF;

    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_process_order_commission ON public.orders;

CREATE TRIGGER trigger_process_order_commission
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION process_order_commission();
