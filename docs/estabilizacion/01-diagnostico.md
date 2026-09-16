# Diagnóstico de estabilización — Xsistem ERP y agente de WhatsApp

Iniciado el 14/09/2026. Todas las observaciones salen de consultas de **solo lectura** contra la
base de producción y de lectura del código. Ninguna modifica datos.

Clasificación usada en cada hallazgo:

| Clase | Significado |
|---|---|
| **CONFIRMADO** | Reproducido ahora, con evidencia registrada abajo |
| **YA CORREGIDO** | El informe lo reportaba, hoy no ocurre |
| **NO REPRODUCIDO** | El informe lo reportaba, la evidencia lo contradice |
| **HIPÓTESIS** | Sospecha razonada, sin evidencia suficiente todavía |

---

## 0. Estado de los repositorios

| | ERP | Agente |
|---|---|---|
| Ruta | `Xsistem/sistema_erp-main/sistema_erp-main` | `Xsistem/agente` |
| Rama | `perf/modo-movil` | `main` |
| Último commit | `f853b10` | `6ee6b02` |
| Árbol | limpio | limpio salvo 6 borradores `scripts/_tmp_*` |
| Pruebas automatizadas | ninguna | ninguna (`sin runner de pruebas`) |
| Entorno de pruebas | **no existe** | **no existe** |

**Consecuencia operativa:** no hay red de seguridad. Toda verificación tiene que hacerse con
fixtures sintéticos, sondas de solo lectura o sobre datos que se restauran. Es el motivo por el
que en este trabajo no se abre ninguna conversación real ni se dispara ningún envío.

---

## H-01 · El proceso en ejecución no tiene el código de revinculación

**Clase:** CONFIRMADO · **Riesgo:** medio · **Observado:** 14/09/2026 16:45

**Evidencia**

| Elemento | Marca de tiempo |
|---|---|
| Cadena de procesos `node.exe` (37188 → 33940 → 30764 → 24124) | arrancada 13:26:00–13:26:01 |
| `src/db/vinculacion.ts` | escrito 13:26:44 |
| `src/index.ts` | escrito 13:27:38 |
| `src/whatsapp/baileys.ts` | escrito 13:35:08 |
| Rastro de `[vinculacion]` en `agent.runtime.stdout.log` | **0 coincidencias** |

**Causa confirmada:** el proceso arrancó antes de que existieran esos archivos. El código está en
el repositorio y compila, pero no se está ejecutando.

**Implicación:** el botón «Vincular WhatsApp» del ERP hoy no tiene quién lo atienda. La migración
`0079` sí está aplicada, así que la pantalla y los candados funcionan, pero el pedido quedaría en
la tabla sin que nadie lo ejecute.

**Solución:** reiniciar el agente. **Requiere autorización** (interrumpe producción). Ver
`03-despliegue.md`.

**Criterio de aceptación:** tras el reinicio, `agent.runtime.stdout.log` muestra el trabajo
periódico «la vinculación de WhatsApp» y una solicitud de prueba cambia `agent_whatsapp_link.state`
a `preparing`.

---

## H-02 · La IA **no** está silenciada por la barrera de sincronización

**Clase:** NO REPRODUCIDO · **Corrige el hallazgo «Prioridad 1» del informe del 14/09**
**Observado:** 14/09/2026 16:50

Esto invalida la conclusión principal del informe anterior. Se documenta en detalle porque la
decisión de negocio cambia por completo.

### Lo que decía el informe

> «11.254 de 11.488 conversaciones en sincronización incierta … la IA está silenciada en la
> práctica … es el único punto que, resuelto, multiplica la capacidad de atención.»

Ese razonamiento iba de la bandera al impacto sin medir el impacto.

### Lo que dicen los datos

**Las banderas sí están puestas** (conteo actual):

| Métrica | Valor |
|---|---|
| Conversaciones totales | 11.491 |
| `sync_confidence = 'uncertain'` | 11.258 |
| `possible_gap = true` | 10.719 |
| `sync_confidence = 'live_evidence'` | 233 |
| `sync_confidence = 'synced'` | **0** |

**Pero las supresiones reales son casi inexistentes.** La tabla
`agent_whatsapp_sync_events` registra cada vez que la barrera frena un envío:

| Ventana | Eventos totales | `auto_reply_suppressed` | Por respuesta humana |
|---|---|---|---|
| 24 h | 10.302 | **12** | 1 |
| 7 días | 27.627 | **113** | 5 |
| Histórico completo | 27.628 | **113** | 5 |

**Desglose por motivo, histórico completo:**

| Motivo | Veces |
|---|---|
| `stale_customer_target` | 84 |
| `human_or_closed` | 13 |
| **`sync_uncertain`** | **10** |
| `human_replied_after_customer` | 5 |
| `escalated` | 3 |
| `whatsapp_not_connected` | 2 |
| `bot_disabled` | 1 |

La sincronización incierta ha frenado **10 respuestas en toda la historia del sistema**, no miles.
El motivo dominante, `stale_customer_target`, significa «el cliente escribió otra cosa mientras
generábamos la respuesta»: es la protección funcionando bien, no una avería.

**Y la IA está contestando:**

| Ventana | Salientes totales | De la IA (`intake`) | De humanos |
|---|---|---|---|
| 24 h | 747 | **46** | 700 |
| 7 días | 1.000+ | **128** | 868 |

### Dónde está el verdadero embudo

| Etapa (últimas 24 h) | Conversaciones | Pérdida |
|---|---|---|
| Activas | 183 | — |
| … con `bot_enabled = true` | 40 | **−78 %** |
| … y `status = 'bot_active'` | 7 | −82 % |
| … y sin bloqueo de sincronización | 1 | −86 % |

El 78 % se pierde en `bot_enabled`, **antes** de que la sincronización tenga nada que opinar. Y
eso es **comportamiento diseñado**, no una avería: `0017_agent_conversation_bot_enabled.sql` dice
literalmente

> «`bot_enabled` arranca en FALSE por diseño … el bot no le responde hasta que alguien del equipo
> lo habilite a mano … modo seguro por defecto.»

De 11.491 conversaciones, sólo **703 tienen el bot habilitado** (6 %). Es una decisión de negocio
tomada a propósito: el equipo decide chat por chat a quién le contesta la IA.

### Conclusión

No hay una avería de sincronización que esté bloqueando la atención. Hay una **decisión de
producto** —el bot desactivado por defecto— que determina el alcance de la IA, y una bandera de
sincronización que está mal puesta en casi todo el histórico pero que casi nunca llega a aplicarse.

**La pregunta correcta para el negocio ya no es técnica:** ¿a cuántos clientes se quiere que la IA
conteste sola? Hoy son 703 de 11.491. Subir ese número es una decisión, no un arreglo.

**Queda pendiente** (ver H-03) la higiene de las banderas, que sí importa el día que se amplíe el
alcance del bot.

---

## H-03 · Ninguna conversación llega nunca a `synced`

**Clase:** CONFIRMADO · **Riesgo:** bajo hoy, medio si se amplía el alcance del bot
**Observado:** 14/09/2026 16:50

**Evidencia:** `sync_confidence = 'synced'` en **0** de 11.491 conversaciones. Sólo existen
`uncertain` (11.258) y `live_evidence` (233). El estado `history_partial` tampoco aparece nunca.

Las 233 con `live_evidence` coinciden exactamente con las que no están bloqueadas en los últimos
7 y 30 días: la confianza se está ganando **sólo por tráfico en vivo**, nunca por historial.

**Hipótesis de causa:** la vía que certifica historial (`history_sync_*`) no llega a completarse
nunca, y la única que otorga confianza en la práctica es la evidencia en vivo. El marcador
`history_sync_stalled` que reportó el informe **ya no está** (`whatsapp_sync_error = null` ahora),
lo que indica que es transitorio y se limpia solo.

**Pendiente de evidencia:** trazar por qué ninguna corrida de historial termina certificando. No
se ha hecho todavía porque no bloquea la operación actual (ver H-02) y porque investigarlo a fondo
exige observar corridas nuevas.

**No se debe hacer:** marcar chats como sincronizados para que la métrica quede en verde. Un
timeout no prueba que el historial esté completo.

---

## H-04 · `profiles` está expuesta a usuarios anónimos — lectura y escritura

**Clase:** CONFIRMADO · **Riesgo: CRÍTICO** · **Observado:** 14/09/2026 16:58

Es el hallazgo más grave de esta revisión. Supera en gravedad al «todos son administradores» que
reportaba el informe.

**Evidencia.** Con la clave anónima —que viaja en el paquete JavaScript, o sea que la tiene
cualquiera que abra el sitio— y **sin iniciar sesión**:

| Operación sobre `profiles` | Resultado |
|---|---|
| `SELECT` | **8 filas devueltas** |
| `UPDATE role_id` | **Permitido** (0 filas porque el id sondeado no existe) |
| `DELETE` | **Permitido** (0 filas por lo mismo) |
| `INSERT` | Bloqueado (42501) |

Columnas visibles: `id, full_name, email, is_active, role_id, nickname, bio, avatar_url,
referral_code, current_session_id`. Con valor: nombre completo, correo, apodo e identificador de
sesión activa de las 8 personas del equipo.

La sonda de escritura usó el id inexistente `00000000-…-0000`, así que **no modificó ninguna
fila**. La distinción es fiable: `INSERT` devolvió 42501 (bloqueado) mientras `UPDATE` y `DELETE`
devolvieron éxito, o sea que la diferencia es de autorización real y no casualidad.

**Causa confirmada:** ninguna migración activa RLS sobre `profiles` ni define políticas para ella.
Comprobado por búsqueda exhaustiva en las 106 migraciones del ERP. Las demás tablas sensibles sí
están protegidas: con la misma clave anónima, `customers`, `orders`, `agent_conversations`,
`agent_messages`, `transactions` y `daily_expenses` devuelven **cero filas**.

**Lo que esto permite hoy a cualquiera en internet:**

1. Obtener la lista del personal con sus correos.
2. Cambiar el `role_id` de cualquier persona.
3. Desactivar cuentas (`is_active = false`) y dejar al equipo fuera del sistema.
4. Borrar perfiles.

**Contraste con lo que decía el informe.** «Los 8 perfiles son administradores» es cierto
—confirmado, ver H-05— pero es el problema menor. El problema mayor es que la tabla que decide
los permisos no tiene ninguna protección.

**Matiz honesto sobre la escritura:** que `UPDATE` devuelva éxito sobre 0 filas es compatible con
dos estados: RLS desactivada (lo más probable, y lo que indican las migraciones) o RLS activada
con una política que no deja pasar nada. La lectura de 8 filas descarta el segundo caso para
`SELECT`. Para cerrar la duda sobre escritura sin tocar datos de producción, basta ejecutar en el
editor SQL de Supabase:

```sql
SELECT relrowsecurity FROM pg_class WHERE oid = 'public.profiles'::regclass;
```

`false` confirma el diagnóstico completo.

**Solución preparada:** migración `20260914_rls_profiles.sql` (ver `02-plan.md`). **No aplicada**:
es un cambio de permisos efectivos y requiere autorización.

---

## H-05 · Todos los perfiles son administradores, y el sistema los fuerza

**Clase:** CONFIRMADO · **Riesgo:** alto · **Observado:** 14/09/2026 16:55

**Evidencia en la base:** los 8 perfiles tienen `role_id = 1`.

**Evidencia en el código, dos vías independientes:**

1. **Disparador en la base.** `20260626184500_automatic_profile_creation.sql` crea
   `handle_new_user()`, que inserta todo perfil nuevo con `1 -- Force Admin role`, y además
   `ON CONFLICT (id) DO UPDATE SET … role_id = 1`, o sea que **vuelve a forzar admin también al
   actualizar**. La misma migración hace `UPDATE public.profiles SET role_id = 1` sobre los
   existentes.
2. **Banderas fijas en el frontend.** `contexts/AuthContext.tsx:198-202`:
   ```ts
   const isAdmin = true;
   const isCloser = false;
   const isSourcingManager = false;
   const isWarehouse = false;
   const isSalesMonitor = false;
   ```
   No derivan de `userProfile.roles.name`. La línea de arriba sí lee `permissions` del perfil,
   pero las banderas lo ignoran.

**Existe ya la pieza correcta y no se usa:** `20260222213000_rls_lockdown.sql` define
`public.get_user_role()`, que resuelve el rol real uniendo `profiles` con `roles`. Está en la
base y ninguna de las dos capas la consulta.

**Riesgo de la corrección:** dejar al equipo fuera del sistema. Por eso la transición tiene que
conservar explícitamente el acceso del propietario, y el propietario **no se puede deducir por
el nombre**. Es una de las decisiones que hay que consultar.

---

## H-06 · Ninguna clave privilegiada llega al navegador

**Clase:** YA CORRECTO · **Observado:** 14/09/2026 16:57

Búsqueda de la `service_role` en los 60 archivos de `dist/assets/`: **0 coincidencias**. La única
clave presente es la anónima, que es pública por diseño.

`.env` está ignorado por git en los dos repositorios y no hay claves literales en el historial.

---

## Verificaciones pendientes que requieren autorización

| Prueba | Por qué hace falta permiso |
|---|---|
| Escalada de privilegios con un usuario sin rol | Exige crear usuarios temporales en producción |
| Sesión abierta tras reducir permisos | Igual |
| Reinicio del agente para validar H-01 | Interrumpe la atención |
| Confirmar `relrowsecurity` de `profiles` | Requiere el editor SQL (una sentencia de lectura) |

---

*Última actualización: 14/09/2026. Continuar por `02-plan.md`.*
