-- Migration: Permitir sesiones simultáneas en varios dispositivos
-- Timestamp: 20260813110000
--
-- Revierte el trigger instalado por 20260702123000_single_session_limit.sql.
--
-- Ese trigger corría AFTER INSERT sobre auth.sessions y borraba las demás
-- sesiones del usuario, de modo que entrar desde un segundo dispositivo
-- expulsaba al primero en cuanto su token vencía o intentaba refrescarse.
--
-- El negocio pide lo contrario: el mismo usuario tiene que poder trabajar a la
-- vez desde el teléfono (armar la cola de etiquetas, consultar catálogo) y
-- desde la computadora conectada a la impresora térmica, que es la única que
-- puede imprimir. El bloqueo equivalente del lado del cliente ya se había
-- desactivado en contexts/AuthContext.tsx por esa misma razón; este trigger
-- quedó vivo y seguía siendo la restricción real.
--
-- Se elimina primero el trigger y después la función: al revés, el DROP
-- FUNCTION fallaría por la dependencia.

DROP TRIGGER IF EXISTS limit_single_session ON auth.sessions;

DROP FUNCTION IF EXISTS public.handle_single_session();

-- Nota: profiles.current_session_id NO se elimina. AuthContext lo sigue
-- escribiendo para *detectar* accesos concurrentes (registra un aviso en
-- consola, sin cerrar sesión), y borrar la columna rompería esa lectura.
