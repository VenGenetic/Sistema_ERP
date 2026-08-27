-- Migration: pedido de abono para traer un repuesto de la importadora
-- Timestamp: 20260827200000
--
-- Hay dos avisos distintos, y confundirlos le cuesta caro al cliente:
--
--   "ya llegó"  -> el repuesto está en la bodega. Se le avisa, viene y se
--                  lo lleva. El pedido se archiva como `notified`: se
--                  terminó.
--   "lo traemos" -> el repuesto NO está acá, está en la importadora. Se le
--                  ofrece traerlo y se le pide un abono para pedirlo.
--
-- El segundo NO puede archivar el pedido. El cliente sigue esperando: si
-- se marcara `notified`, la solicitud desaparecería de la lista de espera
-- y el día que el repuesto entre de verdad a la bodega no habría a quién
-- avisarle. Es exactamente el agujero que estas pantallas vienen a tapar.
--
-- Por eso el pedido de abono se anota aparte y el estado no se toca: la
-- solicitud sigue activa hasta que el repuesto llegue de verdad.
--
-- Sirve además para no repetirle el pedido de abono a la misma persona
-- todos los días: quien ya lo recibió sale de la lista, y vuelve a
-- aparecer recién pasada una semana, que es el seguimiento razonable a
-- alguien que no contestó.

BEGIN;

ALTER TABLE public.product_demands
    ADD COLUMN IF NOT EXISTS deposit_requested_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS deposit_requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.product_demands.deposit_requested_at IS
    'Cuándo se le pidió un abono al cliente para traer el repuesto de la importadora. No archiva la solicitud: el cliente sigue esperando.';

-- La lista de "piden abono" busca solicitudes activas a las que todavía no
-- se les pidió (o se les pidió hace rato). Sin índice eso es un recorrido
-- completo de la tabla cada vez que se abre la pantalla.
CREATE INDEX IF NOT EXISTS idx_product_demands_abono_pendiente
ON public.product_demands (deposit_requested_at)
WHERE status IN ('pending_stock', 'stock_available');

COMMIT;
