# Punto de continuidad

Se actualiza al cerrar cada bloque. Si el contexto se corta, **empezar leyendo este archivo**
y `01-diagnostico.md`; no repetir investigación ya registrada.

**Última actualización:** 14/09/2026, sesión nocturna.

---

## Autorizaciones vigentes

| Acción | Estado |
|---|---|
| Lectura de producción, acotada | ✅ autorizada |
| Editar código local, migraciones, pruebas | ✅ autorizada |
| Aplicar migraciones en producción | ❌ **no autorizada** |
| Cambiar roles efectivos | ❌ no autorizada |
| Reiniciar o revincular WhatsApp | ❌ no autorizada |
| `git push` / desplegar | ❌ no autorizada |
| Crear usuarios de prueba en producción | ❌ no autorizada (D-6 sin responder) |
| Enviar mensajes, acuses o conversiones | ❌ no autorizada |
| Cerrar escalamientos | ❌ no autorizada |
| Habilitar la IA en más chats | ❌ no autorizada |

> El mensaje del usuario que parecía autorizar la migración de `profiles` llegó cortado y
> repetía una frase mía. **No se tomó como autorización.** Sigue pendiente.

---

## Cola de trabajo

| Bloque | Tema | Estado |
|---|---|---|
| 1 | Seguridad de `profiles` | **terminado** (preparado, sin aplicar) |
| 2 | Escalamientos | **parcial** — clasificación lista; flujo de estados pendiente |
| 3 | Atribución del vendedor | **terminado** (local, sin desplegar) |
| 4 | Panel del vendedor | **parcial** — depende del bloque 3 desplegado |
| 5 | Identidad de clientes | **terminado** (diagnóstico + corrección local) |
| 6 | Sincronización / salud de la IA | **parcial** — causa raíz identificada |
| 7 | Cola de salida | **no iniciado** |
| 8 | Calidad del catálogo | **terminado** (diagnóstico; cola real es pequeña) |
| 9 | Atribución publicitaria | **no iniciado** |
| 10 | Rendimiento | **parcial** — auditoría de código |
| 11 | Mantenimiento selectivo | **no iniciado** (correctamente: hay defectos prioritarios) |

---

## Archivos tocados en esta sesión

**ERP** (`sistema_erp-main/sistema_erp-main`, rama `perf/modo-movil`)

- `docs/estabilizacion/` — 01-diagnostico, 02-plan-y-decisiones, CONTINUIDAD, INFORME_NOCTURNO
- `supabase/migrations/20260914180000_rls_profiles.sql` — **nueva, sin aplicar**
- `supabase/migrations/20260914190000_vendedor_en_ventas.sql` — **nueva, sin aplicar**
- `pages/RepDashboard.tsx` — distingue fallo de consulta / falta de atribución / cero ventas
- `pages/POS.tsx` — registra el vendedor en la venta
- `utils/compradorDeChat.ts` — identidad de cliente desde el chat
- `scripts/verificar-rls-profiles.mjs` — **nuevo**, verificación post-aplicación
- `scripts/diagnostico-vinculos-clientes.mjs` — **nuevo**, vista previa histórica

**Agente** (`agente`, rama `main`)

- `scripts/clasificar-escalamientos.ts` — **nuevo**, clasificación de los 675

Nada commiteado en esta sesión nocturna. Nada pusheado. Nada aplicado a la base.

---

## Próximo paso exacto

1. Esperar decisión sobre **D-1** (aplicar RLS de `profiles`). Es lo único urgente.
2. Si hay tiempo seguro: bloque 7 (cola de salida) y bloque 9 (atribución publicitaria),
   ambos auditables sin tocar producción.

---

## Bloqueos registrados

| Bloque | Bloqueo | Depende de |
|---|---|---|
| 1 | No se puede aplicar la migración | D-1 |
| 2 | No se pueden cerrar escalamientos | D-7 (nueva) |
| 3 | No se puede desplegar | autorización de despliegue |
| 4 | Sin atribución desplegada, el panel no tiene datos | bloque 3 |
| 6 | Verificar la corrección exige reiniciar el agente | D-2 |
