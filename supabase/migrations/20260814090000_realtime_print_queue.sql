-- Migration: Realtime para la cola de impresión
-- Timestamp: 20260814090000
--
-- Permite que la cola se vea igual en el teléfono y en la computadora sin
-- recargar: quien arma la cola desde el celular y quien imprime desde la PC
-- miran la misma lista en vivo.
--
-- Supabase sólo emite postgres_changes de las tablas incluidas en la
-- publicación supabase_realtime. print_queue_items nunca se agregó (la
-- migración de sesión única sí agregó profiles), así que la suscripción del
-- cliente se conectaba bien pero no recibía nada.
--
-- La lectura sigue protegida por las políticas RLS ya existentes: Realtime las
-- respeta, de modo que cada usuario sólo recibe eventos de sus propias filas.

BEGIN;
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'print_queue_items'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.print_queue_items;
      END IF;
    END IF;
  END
  $$;
COMMIT;

-- Con la identidad de réplica por defecto (la llave primaria), un DELETE sólo
-- viaja con el id de la fila borrada. El cliente filtra por user_id, así que
-- esos eventos no coincidirían con el filtro y quitar un producto en un
-- dispositivo no se reflejaría en el otro. FULL manda la fila completa.
ALTER TABLE public.print_queue_items REPLICA IDENTITY FULL;
