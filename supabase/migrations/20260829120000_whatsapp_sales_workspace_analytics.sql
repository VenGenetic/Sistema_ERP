-- Centro de trabajo y analítica comercial de WhatsApp.
-- No envía mensajes ni ejecuta automatizaciones contra clientes: únicamente
-- organiza trabajo interno y registra hechos para análisis.

CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_work (
    conversation_id BIGINT PRIMARY KEY REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
    work_status TEXT NOT NULL DEFAULT 'new' CHECK (work_status IN (
        'new', 'reviewing', 'waiting_customer', 'quoting', 'quote_sent',
        'sale_confirmed', 'resolved'
    )),
    internal_summary TEXT,
    requested_part TEXT,
    vehicle_make TEXT,
    vehicle_model TEXT,
    vehicle_year INTEGER CHECK (vehicle_year IS NULL OR vehicle_year BETWEEN 1950 AND 2100),
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reminder_at TIMESTAMPTZ,
    reminder_note TEXT,
    quote_sent_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_customer_requests (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT REFERENCES public.agent_conversations(id) ON DELETE SET NULL,
    customer_id INTEGER REFERENCES public.customers(id) ON DELETE SET NULL,
    phone_number TEXT,
    customer_name TEXT,
    product_id INTEGER REFERENCES public.products(id) ON DELETE SET NULL,
    requested_text TEXT NOT NULL,
    vehicle_make TEXT,
    vehicle_model TEXT,
    vehicle_year INTEGER CHECK (vehicle_year IS NULL OR vehicle_year BETWEEN 1950 AND 2100),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN (
        'ai_intake', 'catalog_message', 'proforma', 'manual', 'stock_demand', 'order'
    )),
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN (
        'requested', 'identified', 'quoted', 'accepted', 'sold', 'unavailable', 'cancelled'
    )),
    confidence NUMERIC(5,4),
    quoted_price NUMERIC(14,2),
    order_id INTEGER REFERENCES public.orders(id) ON DELETE SET NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    quoted_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_commercial_events (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT REFERENCES public.agent_conversations(id) ON DELETE SET NULL,
    request_id BIGINT REFERENCES public.whatsapp_customer_requests(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'request_captured', 'ai_ready', 'human_first_response', 'product_linked',
        'quote_created', 'quote_sent', 'quote_accepted', 'order_created',
        'sale_completed', 'reminder_created', 'resolved'
    )),
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    amount NUMERIC(14,2),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_work_status ON public.whatsapp_conversation_work(work_status);
CREATE INDEX IF NOT EXISTS idx_wa_work_reminder ON public.whatsapp_conversation_work(reminder_at) WHERE reminder_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_requests_date ON public.whatsapp_customer_requests(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_requests_product ON public.whatsapp_customer_requests(product_id);
CREATE INDEX IF NOT EXISTS idx_wa_requests_phone ON public.whatsapp_customer_requests(phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_requests_model ON public.whatsapp_customer_requests(vehicle_model);
CREATE INDEX IF NOT EXISTS idx_wa_requests_status ON public.whatsapp_customer_requests(status);
CREATE INDEX IF NOT EXISTS idx_wa_events_type_date ON public.whatsapp_commercial_events(event_type, occurred_at DESC);

ALTER TABLE public.whatsapp_conversation_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_customer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_commercial_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_manage_whatsapp_work" ON public.whatsapp_conversation_work;
CREATE POLICY "authenticated_manage_whatsapp_work" ON public.whatsapp_conversation_work
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_manage_whatsapp_requests" ON public.whatsapp_customer_requests;
CREATE POLICY "authenticated_manage_whatsapp_requests" ON public.whatsapp_customer_requests
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_manage_whatsapp_events" ON public.whatsapp_commercial_events;
CREATE POLICY "authenticated_manage_whatsapp_events" ON public.whatsapp_commercial_events
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_whatsapp_commercial_row()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_whatsapp_work ON public.whatsapp_conversation_work;
CREATE TRIGGER trg_touch_whatsapp_work BEFORE UPDATE ON public.whatsapp_conversation_work
FOR EACH ROW EXECUTE FUNCTION public.touch_whatsapp_commercial_row();
DROP TRIGGER IF EXISTS trg_touch_whatsapp_request ON public.whatsapp_customer_requests;
CREATE TRIGGER trg_touch_whatsapp_request BEFORE UPDATE ON public.whatsapp_customer_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_whatsapp_commercial_row();

-- Registra de forma idempotente un producto cotizado desde el chat o proforma.
CREATE OR REPLACE FUNCTION public.register_whatsapp_product_request(
    p_conversation_id BIGINT,
    p_product_id INTEGER,
    p_requested_text TEXT,
    p_source TEXT DEFAULT 'manual',
    p_quantity INTEGER DEFAULT 1,
    p_quoted_price NUMERIC DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_id BIGINT;
    v_phone TEXT;
    v_name TEXT;
BEGIN
    SELECT phone_number, customer_name INTO v_phone, v_name
    FROM agent_conversations WHERE id = p_conversation_id;

    SELECT id INTO v_id
    FROM whatsapp_customer_requests
    WHERE conversation_id = p_conversation_id
      AND product_id = p_product_id
      AND source = p_source
      AND requested_at > now() - interval '24 hours'
    ORDER BY requested_at DESC LIMIT 1;

    IF v_id IS NULL THEN
        INSERT INTO whatsapp_customer_requests (
            conversation_id, phone_number, customer_name, product_id,
            requested_text, source, quantity, status, quoted_price,
            quoted_at, created_by
        ) VALUES (
            p_conversation_id, v_phone, v_name, p_product_id,
            COALESCE(NULLIF(trim(p_requested_text), ''), 'Repuesto sin descripción'),
            p_source, GREATEST(COALESCE(p_quantity, 1), 1),
            CASE WHEN p_quoted_price IS NULL THEN 'identified' ELSE 'quoted' END,
            p_quoted_price,
            CASE WHEN p_quoted_price IS NULL THEN NULL ELSE now() END,
            auth.uid()
        ) RETURNING id INTO v_id;

        INSERT INTO whatsapp_commercial_events(conversation_id, request_id, event_type, actor_id, amount)
        VALUES (p_conversation_id, v_id, 'product_linked', auth.uid(), p_quoted_price);
    END IF;
    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_whatsapp_product_request(BIGINT, INTEGER, TEXT, TEXT, INTEGER, NUMERIC) TO authenticated;

-- Los mensajes de catálogo ya llevan product_id. El trigger registra ese
-- hecho para analítica, pero no produce ninguna salida hacia WhatsApp.
CREATE OR REPLACE FUNCTION public.capture_whatsapp_catalog_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.direction = 'outbound' AND NEW.product_id IS NOT NULL AND NEW.deleted_at IS NULL THEN
        PERFORM register_whatsapp_product_request(
            NEW.conversation_id, NEW.product_id, COALESCE(NEW.body, 'Repuesto del catálogo'),
            'catalog_message', 1, NULL
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_whatsapp_catalog_request ON public.agent_messages;
CREATE TRIGGER trg_capture_whatsapp_catalog_request
AFTER INSERT ON public.agent_messages FOR EACH ROW
EXECUTE FUNCTION public.capture_whatsapp_catalog_request();

CREATE OR REPLACE FUNCTION public.capture_whatsapp_ai_ready()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.etapa = 'ready_for_sales' AND OLD.etapa IS DISTINCT FROM NEW.etapa THEN
        INSERT INTO whatsapp_commercial_events(conversation_id, event_type, details)
        VALUES (NEW.id, 'ai_ready', jsonb_build_object('source', 'conversation_stage'));
        INSERT INTO whatsapp_conversation_work(conversation_id, work_status)
        VALUES (NEW.id, 'reviewing')
        ON CONFLICT (conversation_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_whatsapp_ai_ready ON public.agent_conversations;
CREATE TRIGGER trg_capture_whatsapp_ai_ready
AFTER UPDATE OF etapa ON public.agent_conversations FOR EACH ROW
EXECUTE FUNCTION public.capture_whatsapp_ai_ready();

-- Un único RPC alimenta el tablero: menos viajes de red y cifras tomadas
-- en el mismo instante.
CREATE OR REPLACE FUNCTION public.get_whatsapp_sales_analytics(
    p_from TIMESTAMPTZ DEFAULT now() - interval '30 days',
    p_to TIMESTAMPTZ DEFAULT now()
) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH filtered AS (
    SELECT * FROM whatsapp_customer_requests
    WHERE requested_at >= p_from AND requested_at < p_to + interval '1 day'
),
kpis AS (
    SELECT jsonb_build_object(
        'requests', count(*),
        'customers', count(DISTINCT COALESCE(phone_number, customer_id::text)),
        'identified', count(*) FILTER (WHERE product_id IS NOT NULL),
        'quoted', count(*) FILTER (WHERE status IN ('quoted','accepted','sold')),
        'sold', count(*) FILTER (WHERE status = 'sold'),
        'revenue', COALESCE(sum(quoted_price * quantity) FILTER (WHERE status = 'sold'), 0),
        'conversionRate', CASE WHEN count(*) = 0 THEN 0 ELSE round(100.0 * count(*) FILTER (WHERE status = 'sold') / count(*), 1) END
    ) value FROM filtered
),
top_products AS (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.requests DESC), '[]'::jsonb) value FROM (
        SELECT f.product_id, COALESCE(p.name, f.requested_text) name, p.sku,
               count(*) requests, sum(f.quantity) units,
               count(*) FILTER (WHERE f.status = 'sold') sold
        FROM filtered f LEFT JOIN products p ON p.id = f.product_id
        GROUP BY f.product_id, COALESCE(p.name, f.requested_text), p.sku
        ORDER BY requests DESC LIMIT 12
    ) x
),
top_models AS (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.requests DESC), '[]'::jsonb) value FROM (
        SELECT COALESCE(NULLIF(trim(vehicle_make), ''), 'Sin marca') make,
               COALESCE(NULLIF(trim(vehicle_model), ''), 'Sin modelo') model,
               vehicle_year AS "year", count(*) requests
        FROM filtered GROUP BY 1,2,3 ORDER BY requests DESC LIMIT 12
    ) x
),
request_customers AS (
    SELECT COALESCE(phone_number, customer_id::text) customer_key,
           max(customer_id) customer_id,
           COALESCE(NULLIF(max(customer_name), ''), max(phone_number), 'Sin identificar') name,
           max(phone_number) phone, count(*) requests
    FROM filtered GROUP BY COALESCE(phone_number, customer_id::text)
),
order_stats AS (
    SELECT customer_id, count(*) FILTER (WHERE status NOT IN ('Cancelado','Reembolsado')) purchases,
           COALESCE(sum(total_amount) FILTER (WHERE status NOT IN ('Cancelado','Reembolsado')), 0) value
    FROM orders
    WHERE created_at >= p_from AND created_at < p_to + interval '1 day'
    GROUP BY customer_id
),
top_customers AS (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.requests DESC, x.purchases DESC), '[]'::jsonb) value FROM (
        SELECT r.name, r.phone, r.requests,
               COALESCE(o.purchases, 0) purchases, COALESCE(o.value, 0) value
        FROM request_customers r
        LEFT JOIN customers c ON c.id = r.customer_id
            OR regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g') = regexp_replace(COALESCE(r.phone, ''), '\D', '', 'g')
        LEFT JOIN order_stats o ON o.customer_id = c.id
        ORDER BY r.requests DESC, COALESCE(o.purchases, 0) DESC LIMIT 12
    ) x
),
daily AS (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.day), '[]'::jsonb) value FROM (
        SELECT requested_at::date day, count(*) requests,
               count(*) FILTER (WHERE status = 'sold') sold
        FROM filtered GROUP BY requested_at::date ORDER BY requested_at::date
    ) x
),
funnel AS (
    SELECT jsonb_build_array(
        jsonb_build_object('stage','Solicitudes','value',count(*)),
        jsonb_build_object('stage','Identificadas','value',count(*) FILTER (WHERE product_id IS NOT NULL)),
        jsonb_build_object('stage','Cotizadas','value',count(*) FILTER (WHERE status IN ('quoted','accepted','sold'))),
        jsonb_build_object('stage','Aceptadas','value',count(*) FILTER (WHERE status IN ('accepted','sold'))),
        jsonb_build_object('stage','Vendidas','value',count(*) FILTER (WHERE status = 'sold'))
    ) value FROM filtered
)
SELECT jsonb_build_object(
    'kpis', kpis.value, 'topProducts', top_products.value,
    'topModels', top_models.value, 'topCustomers', top_customers.value,
    'daily', daily.value, 'funnel', funnel.value, 'generatedAt', now()
)
FROM kpis, top_products, top_models, top_customers, daily, funnel;
$$;

GRANT EXECUTE ON FUNCTION public.get_whatsapp_sales_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
