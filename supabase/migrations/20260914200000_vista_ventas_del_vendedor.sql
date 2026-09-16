-- Migration: la vista que alimenta el panel del vendedor.
--
-- DEPENDE DE LA MIGRACIÓN ANTERIOR
-- --------------------------------
-- `20260914190000_vendedor_en_ventas.sql` es la que hace que `orders.created_by`
-- se llene. Sin ella esta vista es correcta pero devuelve vacío para todos,
-- porque hoy las 320 órdenes tienen ese campo en NULL. Aplicar en ese orden.
--
-- Esta vista NO inventa atribución. Las ventas viejas siguen sin vendedor y
-- simplemente no aparecen: el panel lo explica en pantalla en vez de repartir
-- ventas históricas entre la gente por aproximación.
--
-- QUÉ CUENTA COMO VENTA
-- ---------------------
-- Se parte de la regla que ya usa el negocio en `scripts/atribucion/ventas.js`:
--
--     ESTADOS_NO_VENTA = { 'Borrador', 'Cancelado' }
--
-- y se le agrega `Reembolsado`. El script de atribución no lo excluye, y eso
-- es un defecto suyo: una venta devuelta al cliente no es una venta, ni para
-- la comisión del vendedor ni para reportarle una conversión a Meta. Acá se
-- corrige; queda anotado que ese script debería alinearse.
--
-- Se define en NEGATIVO a propósito, igual que el original: si mañana aparece
-- un estado nuevo, lo peor que pasa es que una venta real se cuente, no que
-- desaparezca en silencio de la comisión de alguien.
--
-- LA FECHA ES LA DE ECUADOR, NO LA DEL SERVIDOR
-- ---------------------------------------------
-- `created_at` se guarda en UTC. Ecuador es UTC-5, así que una venta de las
-- 19:30 del martes en Guayaquil es el miércoles en UTC. Agrupando por la
-- fecha UTC, el panel del vendedor se le reiniciaba a las 19:00 y las ventas
-- de la última hora de trabajo aparecían como del día siguiente. El negocio
-- atiende hasta las 18:00, así que el error caía justo en el cierre.
--
-- QUIÉN VE QUÉ
-- ------------
-- La vista filtra por `auth.uid()`: cada quien ve lo suyo y nada más. No
-- alcanza con que la pantalla haga `.eq('user_id', …)`, porque eso se cambia
-- desde la consola del navegador. El filtro tiene que estar acá.
--
-- RECUPERACIÓN
--     DROP VIEW IF EXISTS public.v_daily_sales_stats;
-- No borra datos: es una vista, no guarda nada.

BEGIN;

CREATE OR REPLACE VIEW public.v_daily_sales_stats
WITH (security_invoker = true)
AS
SELECT
    o.created_by                                        AS user_id,
    (o.created_at AT TIME ZONE 'America/Guayaquil')::date AS sale_date,
    COUNT(DISTINCT o.id)                                AS total_orders,
    COALESCE(SUM(li.cantidad), 0)                       AS total_items_sold,
    -- El importe de la mercadería, sin el envío: el envío se cobra aparte y
    -- no es margen del vendedor. La pantalla los suma para mostrar el total.
    COALESCE(SUM(o.total_amount - COALESCE(o.shipping_cost, 0)), 0) AS total_sales_revenue,
    COALESCE(SUM(o.shipping_cost), 0)                   AS total_shipping_revenue,
    /*
        Comisión: CERO a propósito, no calculada.

        El libro de comisiones (`commission_ledger`) existe y tiene 309
        asientos, pero su `sales_user_id` está en NULL en todos: no hay forma
        de saber de quién es cada uno. Y las reglas de comisión del negocio
        (pozo mensual, puntos por etapa, congelado hasta el cobro, devolución
        de puntos si hay devolución) están documentadas pero no confirmadas
        con el dueño.

        Inventar acá un porcentaje sería peor que mostrar cero: el vendedor
        creería un número que no le van a pagar. Cuando las reglas estén
        confirmadas, se conecta este campo al libro.
    */
    0::numeric                                          AS total_commission
FROM public.orders o
LEFT JOIN LATERAL (
    -- Subconsulta aparte para que sumar las unidades no multiplique el
    -- importe de la orden por su cantidad de líneas.
    SELECT COALESCE(SUM(oi.quantity), 0) AS cantidad
    FROM public.order_items oi
    WHERE oi.order_id = o.id
) li ON TRUE
WHERE o.created_by IS NOT NULL
  AND o.created_by = auth.uid()
  AND o.status NOT IN ('Borrador', 'Cancelado', 'Reembolsado')
GROUP BY o.created_by, (o.created_at AT TIME ZONE 'America/Guayaquil')::date;

COMMENT ON VIEW public.v_daily_sales_stats IS
    'Ventas por vendedor y por día (hora de Ecuador). Cada usuario ve sólo las suyas. Excluye borradores, canceladas y reembolsadas. Las órdenes anteriores al 14/09/2026 no tienen vendedor y no aparecen.';

REVOKE ALL ON public.v_daily_sales_stats FROM PUBLIC, anon;
GRANT SELECT ON public.v_daily_sales_stats TO authenticated;

COMMIT;
