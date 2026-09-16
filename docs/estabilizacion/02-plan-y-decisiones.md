# Plan, estado de implementación y decisiones pendientes

Complementa `01-diagnostico.md`. Actualizado el 14/09/2026.

---

## 1. Estado por problema

| # | Problema | Causa | Cambio | Probado | Local | En base | Desplegado | Verificado en ejecución |
|---|---|---|---|---|---|---|---|---|
| H-01 | El agente en ejecución no tiene el código de revinculación | Proceso arrancado antes de escribir los archivos | Ninguno: hay que reiniciar | — | ✅ (ya commiteado) | ✅ migr. 0079 | ✅ repo | ❌ **requiere reinicio** |
| H-02 | «La IA está silenciada» | **No reproducido.** El embudo es `bot_enabled`, por diseño | Ninguno. Es decisión de negocio | ✅ medido | — | — | — | ✅ |
| H-03 | Ninguna conversación llega a `synced` | Hipótesis: el historial nunca certifica | Ninguno todavía | ❌ | — | — | — | ❌ |
| H-04 | **`profiles` abierta a anónimos (lectura y escritura)** | Ninguna migración activa RLS | `20260914180000_rls_profiles.sql` | SQL validado | ✅ | ❌ **espera autorización** | ❌ | ❌ |
| H-05 | Todos son administradores | Disparador `handle_new_user` + banderas fijas | Diseñado, no implementado | — | ❌ | ❌ | ❌ | ❌ |
| H-06 | Claves privilegiadas en el navegador | — | **Ya correcto** | ✅ | — | — | — | ✅ |
| H-07 | Panel del vendedor roto | La vista no existe **y** no hay atribución a vendedor | Arreglado el aviso; la vista **no** se crea | ✅ compila | ✅ | — | ❌ | ❌ |
| H-08 | 675 escalamientos abiertos | Atendidos sin registrar el cierre | `clasificar-escalamientos.ts` | ✅ ejecutado | ✅ | — | ❌ | ✅ |
| H-09 | 744 sin precio / 341 sin foto | **Cifra bruta engañosa** | Ninguno: la cola real son 17 y 68 | ✅ medido | — | — | — | ✅ |

---

## H-07 · Panel del vendedor: la vista no es el arreglo

**Clase:** CONFIRMADO, con causa distinta a la supuesta · **Observado:** 14/09/2026 17:25

El informe decía «crear la vista `v_daily_sales_stats`». Medir primero evitó construir algo
inútil:

| Comprobación | Resultado |
|---|---|
| ¿Existe `v_daily_sales_stats`? | **No** (PGRST205) |
| Órdenes con `created_by` | **0 de 320** |
| Órdenes con `closer_id` | **0 de 320** |
| `commission_ledger.sales_user_id` | **null** |

**Ninguna orden registra quién la vendió.** Crear la vista habría producido un panel
técnicamente correcto que devuelve vacío para todo el mundo, para siempre. El arreglo real está
aguas arriba: el punto de venta tiene que grabar el vendedor en cada orden.

**Lo que sí se implementó** (`pages/RepDashboard.tsx`):

- `single()` → `maybeSingle()`. Un día sin ventas es normal y no debe tratarse como error.
- Se distingue el fallo de consulta de la ausencia de ventas, con un aviso visible arriba de las
  cifras y `role="alert"` para lectores de pantalla.
- El texto explica la causa real: *«falta registrar en cada venta quién la hizo. No es que no
  tengas ventas hoy.»*

**Defecto adicional detectado, no corregido:** la pantalla calcula «hoy» con
`new Date().toISOString().split('T')[0]`, que es la fecha **UTC**. En Ecuador (UTC−5), a partir de
las 19:00 el panel cambiaría de día antes de que termine la jornada. Hay que arreglarlo junto con
la vista, cuando exista atribución, usando `America/Guayaquil` en los dos lados.

---

## H-08 · Los 675 escalamientos: 43 esperan de verdad

**Clase:** CONFIRMADO, magnitud muy distinta · **Observado:** 14/09/2026 17:30

Herramienta: `agente/scripts/clasificar-escalamientos.ts`. Solo lectura, no cierra nada, no
imprime contenido de mensajes ni teléfonos.

Ejecutada sobre **los 675 abiertos**:

| Categoría | Casos | Qué significa |
|---|---|---|
| Atendidos, evidencia alta | **359** | El cliente escribió y una persona le respondió **después** de ese mensaje. Hubo ida y vuelta real. |
| Atendidos, evidencia media | **249** | Una persona respondió, pero no se puede demostrar que cerrara el asunto. |
| Sólo contestó el bot | 12 | Escalar pedía una persona. **No** cuentan como atendidos. |
| **Sin ninguna respuesta** | **43** | La cola real. |
| Duplicados del mismo chat | 12 | Hay otro escalamiento abierto más nuevo. |

Criterio de «persona»: los mismos campos que usa `whatsapp_auto_reply_barrier` para frenar al bot
(`agent = 'human'`, `action_taken = 'human_reply'`, `sender_origin` en `erp`,
`phone_or_other_device`, `human_unknown_device`). Se reutiliza a propósito: si el sistema
considera humano a un mensaje para callar al bot, tiene que considerarlo humano también para dar
un caso por atendido.

**Lectura de negocio:** no hay 675 clientes abandonados. Hay **43 sin respuesta** (el más antiguo,
14 días) y 12 que sólo recibieron al bot. El resto se atendió y nadie registró el cierre.

**No se cerró ninguno.** Cerrar por antigüedad o por «hay algún mensaje posterior» sería fabricar
una métrica en verde. La lista queda para que el equipo decida.

---

## H-09 · La calidad del catálogo estaba mal medida

**Clase:** NO REPRODUCIDO en magnitud · **Observado:** 14/09/2026 17:28

| Indicador | Cifra bruta del informe | Activos | **Activos y NO descontinuados** |
|---|---|---|---|
| Sin precio o en cero | 744 (12 %) | 743 | **17** |
| Sin foto | 341 (5,5 %) | — | **68** |

De los 300 repuestos más demandados en 90 días: **1 sin precio y 1 sin foto**.

Las 726 fichas sin precio son repuestos **descontinuados**, que el sistema ya excluye de la
búsqueda. Contarlas como «oportunidades de venta perdidas» era inflar el problema 44 veces.

**La cola real de calidad son 17 fichas sin precio y 68 sin foto**, y de lo que el cliente pide
de verdad, 2 fichas. Es trabajo de una tarde, no un proyecto.

---

## 2. Lo que necesito que decidas

### D-1 · Cerrar `profiles` — URGENTE

Es la única decisión que no puede esperar. Ahora mismo, cualquiera en internet con la dirección
del ERP puede leer los correos del equipo, cambiar roles, desactivar cuentas y borrar perfiles.

- **Alcance:** aplicar `20260914180000_rls_profiles.sql` en el editor SQL de Supabase.
- **Riesgo:** si una política quedara mal, el equipo no podría iniciar sesión. Bajo pero real.
  Por eso la migración se escribió mirando las 19 consultas reales del ERP sobre esa tabla.
- **Recuperación:** una línea, instantánea, sin pérdida de datos:
  `ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;`
- **Verificación posterior:** iniciar sesión con una cuenta normal, abrir la pantalla de Equipo,
  editar el perfil propio. Y repetir la sonda anónima: debe devolver cero filas.
- **No bloquea tablas** ni reescribe datos: sólo cambia permisos.

> **¿Autorizás aplicarla?** Si preferís, primero corré esto (una sola lectura) para confirmar el
> diagnóstico: `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.profiles'::regclass;`

### D-2 · Reiniciar el agente

Sin reinicio, el botón de revincular WhatsApp no funciona (H-01).

- **Alcance:** parar y arrancar el proceso del agente.
- **Impacto:** unos minutos sin recibir ni enviar. Lo que el equipo escriba queda en cola y sale
  al volver — es el comportamiento normal de `agent_outbox`.
- **Recuperación:** si no levanta, `REVINCULAR-WHATSAPP.bat` regenera la sesión.
- **Cuándo:** conviene fuera del horario de atención (cierran 18:00).

> **¿Autorizás el reinicio, y a qué hora?**

### D-3 · Roles reales: quién es quién

Para quitar el disparador que fuerza administrador hace falta saber a quién dejar como
administrador. **No lo voy a deducir por el nombre.**

> **¿Cuál de los 8 correos es el tuyo (el del dueño), y qué rol debería tener cada uno de los
> otros 7?** Los roles disponibles en la tabla `roles` son 8; te paso la lista si la querés ver.

También hay que decidir el alcance: hoy todos ven todos los chats y toda la información
financiera. ¿Debe seguir así, o un vendedor sólo debería ver lo suyo?

### D-4 · Alcance de la IA

El dato que importa: la IA contesta sola en **703 de 11.491 conversaciones (6 %)**, porque el
sistema exige habilitarla chat por chat. No es una avería; es como se diseñó.

> **¿Querés ampliarlo?** Opciones: dejarlo como está, habilitarla por defecto para chats nuevos,
> o habilitarla sólo para quienes escriben por primera vez. Cada una cambia cuánta gente atiende
> el bot sin supervisión.

### D-5 · Atribución del vendedor en las ventas

Sin esto no hay panel del vendedor ni comisiones reales.

> **¿Registro `orders.created_by` con el usuario que cobra en el POS?** Es un cambio pequeño y
> bien delimitado, pero toca el flujo de cobro, así que prefiero confirmarlo.

### D-6 · Pruebas de permisos con usuarios temporales

Para comprobar la escalada de privilegios hace falta crear 2 usuarios de prueba en producción y
borrarlos al terminar (es lo que hice antes de que fijaras esta regla).

> **¿Autorizás crearlos y borrarlos, o preferís que esas pruebas queden sin hacer?**

---

## 3. Las próximas cinco acciones, por impacto

1. **Aplicar la RLS de `profiles`** (D-1). Cierra una puerta abierta a internet.
2. **Atender los 43 escalamientos sin respuesta** (lista en H-08). Son clientes reales esperando.
3. **Reiniciar el agente** (D-2) y verificar la revinculación.
4. **Decidir los roles** (D-3) y quitar el disparador que fuerza administrador.
5. **Registrar el vendedor en cada venta** (D-5), que desbloquea panel y comisiones.

---

## 4. Lo que NO hice, y por qué

- **No cerré ningún escalamiento.** Sin evidencia de resolución, cerrarlos sería maquillar.
- **No creé `v_daily_sales_stats`.** Habría quedado siempre vacía; el problema es otro.
- **No apliqué la RLS.** Es un cambio de permisos efectivos: requiere tu autorización.
- **No reinicié el agente** ni probé la revinculación en vivo.
- **No toqué las banderas de rol** sin saber quién es el dueño.
- **No abrí conversaciones reales** ni disparé envíos, acuses ni conversiones.
- **No cambié `sync_confidence` de ningún chat.** Un timeout no prueba historial completo.

---

*Continuará en `03-despliegue.md` cuando haya autorizaciones.*
