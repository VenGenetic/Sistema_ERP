-- Migration: "Stock Disponible" según el estado real, no según la transición
-- Timestamp: 20260827150000
--
-- Contexto: el kanban de Demanda de Stock deja las solicitudes en "Esperando
-- Stock" aunque el repuesto esté en la bodega, y la tarjeta "Listos para
-- Notificar" contaba 141 que no aparecían en ninguna columna.
--
-- La causa no es el kanban: es que casi ninguna solicitud llega nunca al
-- estado `stock_available`. El disparador que lo pone solo mira la
-- TRANSICIÓN del stock:
--
--     IF ((OLD.importer_stock IS NULL OR OLD.importer_stock = 0)
--         AND NEW.importer_stock > 0) OR ...
--
-- Eso exige que el stock pase de 0 a algo DESPUÉS de que la solicitud exista.
-- Pero el caso más común es exactamente el contrario: el repuesto ya tenía
-- stock cuando se anotó el pedido -- el propio modal de la bandeja avisa
-- "ojo, este repuesto SÍ tiene stock" y deja anotarlo igual -- o el stock
-- llegó antes de que nadie registrara la demanda. En esos casos no hay
-- ninguna transición posterior, así que la solicitud queda en
-- `pending_stock` para siempre y el cliente no se entera nunca.
--
-- Se cambia la pregunta: en vez de "¿cambió el stock?", "¿hay stock?". Con
-- eso, cualquier UPDATE de stock -- una corrida del sync de la importadora,
-- por ejemplo -- reacomoda TODAS las solicitudes de ese producto, no solo
-- las que justo tuvieron la transición.
--
-- Además se agrega el caso que no cubría ningún disparador: anotar un pedido
-- de algo que ya está en stock. Ahí no hay UPDATE sobre `products` que pueda
-- dispararse, así que se resuelve al INSERTAR la solicitud.
--
-- La regla de "hay stock" se unifica con la que ya usan el bot y el chat
-- (`stockUtil` en utils/whatsappOutbox.ts): el stock de la importadora NO
-- cuenta cuando está puesta la marca manual `importer_unavailable_override`
-- ("Agotado en Importadora"). El disparador anterior no la miraba, así que
-- podía prometer disponible algo que alguien ya había marcado como no
-- disponible de verdad.

BEGIN;

-- ============================================================
-- 1. La regla, en un solo lugar
-- ============================================================
-- Una función y no la condición repetida en cada disparador: son tres
-- lugares que tienen que decir lo mismo, y cuando esto se escribe tres
-- veces, un día dicen cosas distintas.
CREATE OR REPLACE FUNCTION public.producto_tiene_stock(p_product_id INTEGER)
RETURNS BOOLEAN AS $$
    SELECT COALESCE(
        (SELECT COALESCE(p.local_stock, 0) > 0
             OR (COALESCE(p.importer_stock, 0) > 0
                 AND COALESCE(p.importer_unavailable_override, FALSE) = FALSE)
         FROM public.products p
         WHERE p.id = p_product_id),
        FALSE
    );
$$ LANGUAGE sql STABLE;

-- ============================================================
-- 2. El índice que este cambio vuelve obligatorio
-- ============================================================
-- Antes el disparador solo hacía algo en la transición de stock, o sea casi
-- nunca. Ahora corre en CADA update de stock, y el sync de la importadora
-- actualiza miles de productos de una sentada: sin índice, eso es un
-- recorrido completo de product_demands por cada producto tocado.
--
-- Parcial y por product_id: el único índice que había empieza por
-- phone_number (`unique_active_product_demand`), así que no sirve para
-- buscar por producto. El WHERE es el mismo que usan las dos ramas del
-- disparador.
CREATE INDEX IF NOT EXISTS idx_product_demands_activas_por_producto
ON public.product_demands (product_id)
WHERE status IN ('pending_stock', 'stock_available');

-- ============================================================
-- 3. Al cambiar el stock de un producto
-- ============================================================
CREATE OR REPLACE FUNCTION trg_check_demand_stock_arrival()
RETURNS TRIGGER AS $$
DECLARE
    hay BOOLEAN;
BEGIN
    -- Se evalúa NEW y no la fila guardada: este disparador corre AFTER
    -- UPDATE y `producto_tiene_stock` leería lo mismo, pero hacerlo sobre
    -- NEW evita una consulta más por cada fila actualizada -- y el sync de
    -- la importadora actualiza miles de una sentada.
    hay := COALESCE(NEW.local_stock, 0) > 0
        OR (COALESCE(NEW.importer_stock, 0) > 0
            AND COALESCE(NEW.importer_unavailable_override, FALSE) = FALSE);

    IF hay THEN
        -- Hay stock: todo lo que estaba esperando pasa a disponible.
        -- Sin condición sobre OLD: es lo que rescata las solicitudes que se
        -- anotaron cuando el stock ya estaba y nunca tuvieron su transición.
        UPDATE public.product_demands
        SET status = 'stock_available',
            stock_detected_at = TIMEZONE('utc'::text, NOW()),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE product_id = NEW.id AND status = 'pending_stock';
    ELSE
        -- No hay: se deshace la promesa, pero SOLO sobre lo que todavía no
        -- se avisó. Un pedido ya notificado no puede volver a la cola: al
        -- cliente ya se le dijo que llegó, y reabrirlo haría que se le
        -- avise de nuevo cuando vuelva a entrar.
        UPDATE public.product_demands
        SET status = 'pending_stock',
            stock_detected_at = NULL,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE product_id = NEW.id AND status = 'stock_available';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_stock_arrival ON public.products;
CREATE TRIGGER trg_products_stock_arrival
AFTER UPDATE OF importer_stock, local_stock, importer_unavailable_override, importer_unavailable_until
ON public.products
FOR EACH ROW
EXECUTE FUNCTION trg_check_demand_stock_arrival();

-- ============================================================
-- 4. Al anotar un pedido de algo que YA está
-- ============================================================
-- El agujero que no cubría nada: acá no hay ningún UPDATE sobre `products`
-- que pueda disparar el punto 3, así que la solicitud nacía en
-- `pending_stock` y se quedaba ahí aunque el repuesto estuviera en la
-- bodega en ese mismo momento.
CREATE OR REPLACE FUNCTION trg_demanda_nace_con_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'pending_stock' AND public.producto_tiene_stock(NEW.product_id) THEN
        NEW.status := 'stock_available';
        NEW.stock_detected_at := TIMEZONE('utc'::text, NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_demands_nace_con_stock ON public.product_demands;
CREATE TRIGGER trg_product_demands_nace_con_stock
BEFORE INSERT ON public.product_demands
FOR EACH ROW
EXECUTE FUNCTION trg_demanda_nace_con_stock();

-- ============================================================
-- 5. Las que ya estaban mal
-- ============================================================
-- Los 141 de la tarjeta: solicitudes esperando algo que hace rato está.
-- Se les pone `stock_detected_at` con la fecha de hoy y no la de cuando
-- llegó el repuesto, porque esa fecha no la sabemos -- lo que sí es cierto
-- es que HOY se detectó.
UPDATE public.product_demands d
SET status = 'stock_available',
    stock_detected_at = TIMEZONE('utc'::text, NOW()),
    updated_at = TIMEZONE('utc'::text, NOW())
WHERE d.status = 'pending_stock'
  AND public.producto_tiene_stock(d.product_id);

-- Y la vuelta: las que decían disponible sin stock real (por ejemplo, algo
-- marcado después como "Agotado en Importadora", que el disparador viejo no
-- miraba). Nunca se toca lo ya notificado.
UPDATE public.product_demands d
SET status = 'pending_stock',
    stock_detected_at = NULL,
    updated_at = TIMEZONE('utc'::text, NOW())
WHERE d.status = 'stock_available'
  AND NOT public.producto_tiene_stock(d.product_id);

COMMIT;
