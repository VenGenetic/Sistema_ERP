-- Migration: que cada venta registre quién la hizo.
--
-- EL PROBLEMA (medido el 14/09/2026)
-- ---------------------------------
-- Las 320 órdenes del sistema tienen `created_by` en NULL y `closer_id` en
-- NULL. Ninguna venta dice quién la atendió. Eso deja sin datos al panel del
-- vendedor, impide calcular comisiones reales y borra la única forma de saber
-- quién vendió qué.
--
-- LA CAUSA
-- --------
-- No es que falte el campo: `orders.created_by` existe desde siempre y nadie
-- lo escribe. Lo que hay es una confusión entre dos cosas distintas:
--
--   closer_id   de QUIÉN ES el cliente. Es un concepto de relación comercial
--               y de comisión por referido: `process_pos_sale` lo resuelve
--               desde el código promo, y el POS le pasa `customer.claimed_by`.
--               Está bien como está.
--
--   created_by  QUIÉN COBRÓ esta venta. Es lo que el panel del vendedor
--               necesita y lo que nadie llena.
--
-- Como casi toda venta va contra CONSUMIDOR FINAL, que no tiene `claimed_by`,
-- `closer_id` termina siempre en NULL. Por eso las dos columnas están vacías
-- y parecía que no había dónde guardar el dato.
--
-- POR QUÉ UN DISPARADOR Y NO TOCAR `process_pos_sale`
-- ---------------------------------------------------
-- Tres razones:
--
-- 1. `process_pos_sale` tiene más de 200 líneas y lógica de inventario,
--    contabilidad y promociones. Reescribirla entera para agregar una columna
--    es arriesgar todo eso por un campo.
-- 2. Las órdenes no nacen sólo ahí: también las crea `save_draft_order` y las
--    modifica `modify_completed_sale`. Un disparador cubre TODOS los caminos,
--    incluidos los que se agreguen mañana.
-- 3. Y la razón de fondo: el valor tiene que venir de la sesión, no del
--    navegador. Si el ERP mandara el vendedor como parámetro, cualquiera
--    podría cobrar una venta a nombre de otro compañero editando la llamada
--    desde la consola. `auth.uid()` lo resuelve el servidor a partir del token
--    ya validado y no se puede falsificar desde el cliente.
--
-- VENTAS SIN PERSONA DETRÁS
-- -------------------------
-- Cuando escribe el agente o un script con la clave de servicio, `auth.uid()`
-- es NULL y `created_by` queda en NULL. Es correcto y hay que leerlo así:
-- NULL significa "no lo hizo una persona identificada", no "se perdió el
-- dato". El panel del vendedor tiene que distinguir esos casos en vez de
-- atribuírselos a alguien.
--
-- LO QUE ESTA MIGRACIÓN **NO** HACE
-- ---------------------------------
-- No toca las 320 órdenes históricas. No hay forma honesta de saber quién
-- cobró cada una: adivinarlo por fecha o por quién estaba conectado sería
-- inventar el dato que justamente falta. Quedan con `created_by` en NULL, y
-- el panel lo va a decir con todas las letras.
--
-- RECUPERACIÓN
-- ------------
-- Quitar el disparador, sin perder nada de lo ya registrado:
--
--     DROP TRIGGER IF EXISTS trg_orders_registrar_vendedor ON public.orders;
--
-- Es aditiva e idempotente: se puede volver a correr sin efecto.

BEGIN;

-- ============================================================
-- 1. Quién cobró la venta
-- ============================================================
CREATE OR REPLACE FUNCTION public.registrar_vendedor_de_la_orden()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    /*
        Sólo se rellena si viene vacío. Así una orden que YA trae vendedor
        -- por ejemplo una corrección hecha a mano, o una futura importación
        que sepa a quién corresponde -- conserva el suyo en vez de que se lo
        pise quien está ejecutando la operación.

        `auth.uid()` funciona dentro de una función SECURITY DEFINER: lo que
        cambia el modo definidor es el ROL de base de datos, no las claims del
        token, que siguen disponibles. Verificado con `es_admin_del_erp()`,
        que es SECURITY DEFINER y distingue correctamente entre usuarios.
    */
    IF NEW.created_by IS NULL THEN
        NEW.created_by := auth.uid();
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.registrar_vendedor_de_la_orden() IS
    'Graba en orders.created_by quién cobró la venta, tomándolo de la sesión validada. NULL = la creó un proceso automático, no una persona.';

DROP TRIGGER IF EXISTS trg_orders_registrar_vendedor ON public.orders;
CREATE TRIGGER trg_orders_registrar_vendedor
    BEFORE INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.registrar_vendedor_de_la_orden();

COMMENT ON COLUMN public.orders.created_by IS
    'Quién cobró la venta, desde la sesión validada (disparador trg_orders_registrar_vendedor, 2026-09-14). NULL en las órdenes anteriores a esa fecha y en las creadas por procesos automáticos. NO confundir con closer_id, que es de quién es el cliente.';

-- ============================================================
-- 2. Que el borrador no pierda al vendedor
-- ============================================================
-- Un borrador se guarda, se reabre y recién entonces se cobra. Si al cobrar
-- se creara una orden nueva, el vendedor sería quien la reabrió y no quien la
-- armó. `process_pos_sale` recibe `p_draft_id` y ACTUALIZA esa orden en vez de
-- crear otra, así que el `created_by` del momento en que se guardó el
-- borrador es el que queda -- que es el comportamiento correcto y no hace
-- falta tocarlo.
--
-- Se deja el índice porque el panel del vendedor va a filtrar exactamente por
-- estas dos columnas y por nada más.
CREATE INDEX IF NOT EXISTS idx_orders_vendedor_fecha
    ON public.orders (created_by, created_at DESC)
    WHERE created_by IS NOT NULL;

COMMIT;
