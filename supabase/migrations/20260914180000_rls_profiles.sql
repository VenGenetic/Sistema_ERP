-- Migration: cerrar `profiles`, que hoy está abierta a cualquiera en internet.
--
-- EL PROBLEMA (medido el 14/09/2026)
-- ---------------------------------
-- Con la clave anónima -- que viaja dentro del paquete JavaScript, o sea que
-- la tiene cualquiera que abra el sitio -- y SIN iniciar sesión:
--
--     SELECT sobre profiles  ->  devuelve las 8 filas del equipo
--     UPDATE role_id         ->  permitido
--     DELETE                 ->  permitido
--     INSERT                 ->  bloqueado (42501)
--
-- Es decir: nombre, correo, apodo e identificador de sesión de todo el
-- personal quedan a la vista, y cualquiera puede cambiar el rol de cualquier
-- persona, desactivar cuentas (`is_active = false`) o borrar perfiles.
--
-- La causa es simple: ninguna de las 106 migraciones del ERP activa RLS sobre
-- `profiles` ni define políticas para ella. El resto de las tablas sensibles
-- sí están protegidas -- con la misma clave anónima, `customers`, `orders`,
-- `agent_conversations`, `agent_messages`, `transactions` y `daily_expenses`
-- devuelven cero filas. `profiles` se quedó afuera.
--
-- Importa más que el hallazgo de "todos son administradores": de nada sirve
-- afinar los roles si la tabla que los guarda la puede escribir un anónimo.
--
-- QUÉ TIENE QUE SEGUIR FUNCIONANDO
-- --------------------------------
-- Las políticas de abajo se escribieron mirando cada consulta real del ERP:
--
--   AuthContext.tsx:64   lee el perfil propio con su rol al iniciar sesión
--   AuthContext.tsx:85   escribe `current_session_id` en el perfil propio
--   ProfilePanel.tsx:67  el usuario edita su nombre, apodo, bio y avatar
--   Team.tsx:50          lista al equipo entero con sus roles
--   Team.tsx:100         un administrador activa o desactiva a alguien
--   WhatsAppInbox.tsx    resuelve nombres de quien atendió un chat
--   DailyRegistry, POS, Orders, ProductDemands, RepDashboard: sólo lectura
--
-- NADA en el ERP escribe `role_id` (comprobado). Por eso ese privilegio se
-- retira por completo del navegador: los cambios de rol se hacen desde el
-- editor SQL o con la clave de servicio, que es lo correcto para una
-- operación que reparte permisos.
--
-- RECUPERACIÓN (sin volver a dejar la tabla abierta)
-- --------------------------------------------------
-- Si una política quedara demasiado estrecha y alguien no pudiera trabajar,
-- lo que se afloja es la POLÍTICA, nunca RLS. Apagar RLS devolvería la tabla
-- al estado en que un anónimo puede leerla y escribirla, que es el problema
-- que esta migración vino a cerrar.
--
-- Escalón 1 -- alguien no puede editar su propio perfil:
--
--     GRANT UPDATE (full_name, nickname, bio, avatar_url, current_session_id,
--                   is_active, referral_code)
--         ON public.profiles TO authenticated;
--
-- Escalón 2 -- una pantalla no carga por falta de lectura (no debería pasar:
-- la política de SELECT ya es `USING (true)` para todo autenticado):
--
--     DROP POLICY IF EXISTS "perfiles visibles para quien inicio sesion" ON public.profiles;
--     CREATE POLICY "perfiles visibles para quien inicio sesion"
--     ON public.profiles FOR SELECT TO authenticated USING (true);
--
-- Escalón 3 -- emergencia real, nadie puede iniciar sesión. Se abre la
-- escritura a todo autenticado PERO se mantiene a los anónimos fuera:
--
--     CREATE POLICY "emergencia: escritura autenticada" ON public.profiles
--     FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
--
-- `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` queda como último recurso
-- consciente, no como el plan: reabre la tabla a internet. Si se usa, hay que
-- volver a encenderla el mismo día.
--
-- Ninguno de estos escalones borra datos, así que todos son reversibles.
--
-- Es aditiva e idempotente: se puede volver a correr sin efecto.

BEGIN;

-- ============================================================
-- 1. Quién es administrador
-- ============================================================
-- Ya existe `public.es_admin_del_erp()` (migración 0079 del agente), que
-- resuelve `profiles.role_id = 1` y devuelve false si no hay sesión. Se
-- reutiliza en vez de escribir una segunda definición de "admin" que un día
-- diga algo distinto.
--
-- Se declara acá el requisito para que esta migración falle de forma clara
-- si se aplicara sobre una base donde 0079 no está.
DO $$
BEGIN
    IF to_regprocedure('public.es_admin_del_erp()') IS NULL THEN
        RAISE EXCEPTION
            'Falta public.es_admin_del_erp(). Aplicá antes la migración 0079 del repo del agente.';
    END IF;
END;
$$;

-- ============================================================
-- 2. Encender RLS
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Lectura
-- ============================================================
-- Cualquiera que haya iniciado sesión puede leer los perfiles. No se restringe
-- al perfil propio a propósito: la pantalla de Equipo lista a todos, la
-- bandeja de WhatsApp resuelve el nombre de quien atendió cada chat, y el
-- registro diario y el POS muestran quién hizo cada movimiento. Restringirlo
-- rompería esas cuatro pantallas sin ganar nada frente al riesgo real, que es
-- el acceso ANÓNIMO.
--
-- Lo que esta política corta es exactamente eso: sin sesión no se ve nada.
DROP POLICY IF EXISTS "perfiles visibles para quien inicio sesion" ON public.profiles;
CREATE POLICY "perfiles visibles para quien inicio sesion"
ON public.profiles FOR SELECT TO authenticated
USING (true);

-- ============================================================
-- 4. Escritura del propio perfil
-- ============================================================
-- Cada quien edita lo suyo: nombre, apodo, bio, avatar y el identificador de
-- sesión del dispositivo. El `WITH CHECK` con la misma condición impide algo
-- que el `USING` solo no impediría: cambiar el `id` de la fila para
-- apropiarse del perfil de otra persona.
DROP POLICY IF EXISTS "cada uno edita su propio perfil" ON public.profiles;
CREATE POLICY "cada uno edita su propio perfil"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Un administrador puede editar a cualquiera. Lo usa el botón de activar o
-- desactivar a alguien del equipo (Team.tsx:100).
DROP POLICY IF EXISTS "un admin edita cualquier perfil" ON public.profiles;
CREATE POLICY "un admin edita cualquier perfil"
ON public.profiles FOR UPDATE TO authenticated
USING (public.es_admin_del_erp())
WITH CHECK (public.es_admin_del_erp());

-- ============================================================
-- 5. Alta
-- ============================================================
-- Los perfiles los crea el disparador `handle_new_user`, que es
-- SECURITY DEFINER y se salta RLS. Esta política existe sólo para que el
-- `upsert` de ProfilePanel siga funcionando si alguna vez corre sobre una
-- fila que todavía no existe, y sólo para el perfil propio.
DROP POLICY IF EXISTS "alta del propio perfil" ON public.profiles;
CREATE POLICY "alta del propio perfil"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- ============================================================
-- 6. Borrado: desde el navegador, nunca
-- ============================================================
-- No se crea política de DELETE a propósito. Sin política, RLS lo niega.
-- Dar de baja a alguien se hace con `is_active = false`, que conserva el
-- historial de quién hizo cada venta y cada movimiento de inventario --
-- borrar la fila lo dejaría huérfano.

-- ============================================================
-- 7. El candado de verdad contra la escalada de privilegios
-- ============================================================
-- Las políticas de arriba dejan a cada persona editar su propia fila... y
-- `role_id` está en su propia fila. Sin esto, cualquiera con sesión podría
-- hacerse administrador con un solo UPDATE.
--
-- El privilegio se retira a nivel de COLUMNA, que es independiente de las
-- políticas y no se puede esquivar desde PostgREST. Se listan las columnas
-- permitidas en vez de revocar sólo `role_id`: así, una columna sensible que
-- se agregue mañana nace cerrada en lugar de abierta.
--
-- `referral_code` queda fuera: lo genera un disparador (migración
-- 20260222200000) y no es un dato que el usuario deba reescribir.
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (full_name, nickname, bio, avatar_url, current_session_id, is_active)
    ON public.profiles TO authenticated;

-- Y se cierra el resto del acceso anónimo, que es el agujero original.
REVOKE ALL ON public.profiles FROM anon, PUBLIC;
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;

COMMENT ON TABLE public.profiles IS
    'Perfiles del equipo. RLS activa desde 2026-09-14: sin sesión no se ve nada, cada quien edita lo suyo, y role_id NO se puede escribir desde el navegador (privilegio de columna revocado).';

COMMIT;
