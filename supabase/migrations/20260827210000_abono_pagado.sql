-- Migration: registrar que el cliente ABONÓ, no solo que se le pidió
-- Timestamp: 20260827210000
--
-- La migración anterior (20260827200000) anotó cuándo se le PIDE el abono
-- al cliente. Falta la otra mitad: cuándo lo pagó. Son dos hechos
-- distintos y el segundo es el que dispara trabajo real -- hay que
-- encargarle el repuesto al proveedor.
--
-- No hay integración de pagos, así que lo marca quien atiende: el cliente
-- manda el comprobante por WhatsApp y se registra de un clic desde la
-- bandeja. Esa marca es la que hace que el grupo de compras se entere
-- automáticamente (ver `requirements_group_jid` en la migración 0034 del
-- agente).
--
-- El monto se guarda aparte del precio del producto a propósito: lo que
-- se cobró de abono no es necesariamente la mitad sugerida, se negocia. Y
-- cuando después haya que cerrar la venta, lo que importa es cuánto puso
-- de verdad, no cuánto se le había pedido.

BEGIN;

ALTER TABLE public.product_demands
    ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS deposit_paid_amount NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS deposit_paid_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.product_demands.deposit_paid_at IS
    'Cuándo el cliente pagó el abono. Dispara el aviso al grupo de compras. No archiva la solicitud: el repuesto todavía no llegó.';
COMMENT ON COLUMN public.product_demands.deposit_paid_amount IS
    'Cuánto abonó de verdad, que no siempre es el monto sugerido: se negocia.';

-- Lo que se busca es "abonó y todavía está esperando": la cola de compras.
CREATE INDEX IF NOT EXISTS idx_product_demands_abonadas
ON public.product_demands (deposit_paid_at)
WHERE deposit_paid_at IS NOT NULL AND status IN ('pending_stock', 'stock_available');

COMMIT;
