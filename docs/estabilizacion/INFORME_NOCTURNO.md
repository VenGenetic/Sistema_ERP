# Informe nocturno — 14/09/2026

**Nada se aplicó a producción. Nada se desplegó. Nada se pusheó.** Todo lo de abajo está en el
árbol de trabajo, compilando y con tipos en verde.

---

## 1. Qué mejoró para el negocio

**Se cerró la investigación de la puerta abierta.** Ahora hay prueba concluyente, no una
sospecha: `profiles` devuelve las 8 filas del equipo a un visitante **sin iniciar sesión**,
mientras `customers`, `orders` y `roles` devuelven cero con la misma clave. La protección está
escrita, validada y con un verificador que la comprueba sola. Falta tu autorización para
aplicarla.

**Se encontró por qué ninguna venta sabe quién la hizo.** No era un campo faltante: el punto de
venta manda `customer.claimed_by`, que es *de quién es el cliente*, no *quién cobró*. Como casi
todo va a CONSUMIDOR FINAL, siempre llegaba vacío. `orders.created_by` existe desde siempre y
nadie lo escribía. Ya está resuelto para las ventas futuras.

**El panel del vendedor tenía además un error de reloj.** Usaba la fecha UTC: hoy en Ecuador es
14 de septiembre, pero en UTC ya es el 15. El panel pedía las ventas de mañana y se reiniciaba
solo a las 19:00, justo en el cierre de caja. Corregido en los dos lados.

**Se tapó una fuga de clientes fantasma.** Cuando un cliente oculta su número, WhatsApp usa un
identificador interno de 14 dígitos que el sistema aceptaba como si fuera un teléfono: habría
creado fichas con números inventados y las habría mandado a Meta y Google como identificador de
conversión. Ahora se rechazan los identificadores internos y los grupos.

---

## 2. Estado por bloque

| Bloque | Tema | Estado | Qué falta |
|---|---|---|---|
| 1 | Seguridad de `profiles` | **Terminado** | Tu autorización para aplicar |
| 2 | Escalamientos | **Parcial** | Flujo de estados; la clasificación ya está |
| 3 | Vendedor en las ventas | **Terminado** | Aplicar migración + desplegar |
| 4 | Panel del vendedor | **Terminado** | Depende del bloque 3 |
| 5 | Identidad de clientes | **Terminado** | Decidir el histórico |
| 6 | Sincronización / IA | **Parcial** | Verificar exige reiniciar el agente |
| 7 | Cola de salida | No iniciado | — |
| 8 | Calidad del catálogo | **Terminado** | Es una cola de 17 fichas |
| 9 | Atribución publicitaria | No iniciado | — |
| 10 | Rendimiento | **Parcial** | Auditoría hecha en sesiones previas |
| 11 | Mantenimiento | No iniciado | Correcto: hay defectos prioritarios |

---

## 3. Evidencia y pruebas

### Bloque 1 — seguridad

| Prueba | Resultado |
|---|---|
| Contraste anónimo vs servicio en 4 tablas | `profiles` 8/8 · `customers` 0/10 · `orders` 0/321 · `roles` 0/8 |
| Privilegios del anónimo | `INSERT` bloqueado (42501); `UPDATE`/`DELETE` **concedidos** |
| Sintaxis de la migración | Validada con el analizador de Postgres |
| `scripts/verificar-rls-profiles.mjs` | Ejecutado: detecta 3 fallos (los esperados hoy) |

Corrección respecto de ayer: la sonda sobre un identificador inexistente **no demuestra**
modificación real, sólo que el privilegio existe. La prueba concluyente es el contraste de
lectura: `profiles` es la única tabla sensible que responde a un anónimo. Y como RLS es por tabla,
si no protege la lectura tampoco puede proteger la escritura.

### Bloque 3 — vendedor

| Prueba | Resultado |
|---|---|
| Órdenes con `created_by` / `closer_id` | 0 de 320 en ambos |
| Origen del fallo | `POS.tsx:685` pasa `customer.claimed_by` |
| ¿Un borrador conserva al vendedor? | Sí: con `p_draft_id`, `process_pos_sale` hace `UPDATE`, no crea otra orden |
| Sintaxis de la migración | Válida |

### Bloque 4 — panel

| Prueba | Resultado |
|---|---|
| ¿Existe `v_daily_sales_stats`? | No (PGRST205) |
| Fecha UTC vs Ecuador | **2026-09-15** vs **2026-09-14** — el error está activo ahora |
| Tipos y compilación | En verde |

### Bloque 5 — identidad

12 casos probados, **12 correctos**: teléfono con 0, E.164, celular sin 0, con formato, prefijo
`00`, extranjero válido, y rechazo de LID por longitud, LID por columna exacta, JID de grupo,
grupo truncado, basura y vacío.

Vista previa histórica sobre las 1.000 conversaciones más recientes:

| Categoría | Casos |
|---|---|
| Vínculo exacto (un solo cliente con ese teléfono) | 1 |
| Sin ficha de cliente todavía | 950 |
| Sólo tienen identificador interno (LID) | 49 |
| Ambiguas (varias fichas) | 0 |
| **Total** | **1.000 (cuadra)** |

Lectura: **no hay ambigüedad que resolver**. El trabajo histórico es crear fichas, no desenredar
identidades — y por eso mismo conviene decidirlo con calma, porque son ~950 fichas nuevas.

### Bloque 8 — catálogo

Ya medido: de 744 fichas sin precio, sólo **17** son activas y no descontinuadas. De 341 sin
foto, **68**. De los 300 repuestos más pedidos: 1 sin precio, 1 sin foto.

---

## 4. Archivos y migraciones

**Migraciones nuevas — ninguna aplicada**

| Archivo | Qué hace | Orden |
|---|---|---|
| `20260914180000_rls_profiles.sql` | Cierra `profiles`; revoca el privilegio de escribir `role_id` | 1.º |
| `20260914190000_vendedor_en_ventas.sql` | Disparador que graba quién cobró, desde la sesión validada | 2.º |
| `20260914200000_vista_ventas_del_vendedor.sql` | La vista del panel | 3.º |

**Código**

| Archivo | Cambio |
|---|---|
| `pages/RepDashboard.tsx` | Distingue fallo / falta de atribución / cero ventas; fecha de Ecuador |
| `utils/compradorDeChat.ts` | Rechaza LIDs y grupos; acepta el `lid` para descartar con exactitud |
| `utils/proformaToCart.ts` | El `lid` viaja hasta la creación del cliente |
| `scripts/verificar-rls-profiles.mjs` | **Nuevo** — verificación post-aplicación |
| `scripts/diagnostico-vinculos-clientes.mjs` | **Nuevo** — vista previa, no modifica nada |
| `agente/scripts/clasificar-escalamientos.ts` | **Nuevo** — clasifica los 675 |

---

## 5. Acciones sobre producción

Sólo **lecturas acotadas**. Ninguna escritura, ningún mensaje, ningún acuse, ninguna conversión,
ningún usuario creado, ningún escalamiento cerrado, ningún reinicio.

---

## 6. Decisiones que necesito

### Urgente

**D-1 · ¿Aplico la protección de `profiles`?**
Hoy cualquiera en internet lee los correos del equipo y puede cambiar roles o desactivar cuentas.
Orden: aplicar la migración, correr `node scripts/verificar-rls-profiles.mjs`, y probar a mano
iniciar sesión y editar el perfil propio. La recuperación afloja la política, **no** apaga RLS.

### Agrupadas — despliegue

**D-2 · ¿Aplico y despliego la atribución del vendedor?** (migraciones 2.ª y 3.ª + el código).
Sin esto el panel del vendedor no puede tener datos. Las ventas históricas quedan sin vendedor a
propósito: repartirlas por aproximación sería inventar el dato.

**D-3 · ¿Autorizás el reinicio del agente, y a qué hora?** Sin él no funciona el botón de
revincular WhatsApp.

### Agrupadas — criterio de negocio

**D-4 · Roles.** ¿Cuál de los 8 correos es el tuyo, y qué rol lleva cada uno de los otros 7?
No lo voy a deducir por el nombre.

**D-5 · Alcance de la IA.** Contesta sola en 703 de 11.491 chats (6 %), porque hay que
habilitarla uno por uno. Es como se diseñó. ¿Se amplía?

**D-6 · Los 675 escalamientos.** 359 con evidencia alta de atención, 249 media, 12 duplicados,
12 sólo con el bot y **43 sin ninguna respuesta**. ¿Cierro los 359 de evidencia alta, o preferís
revisarlos antes?

**D-7 · Histórico de clientes.** ~950 conversaciones recientes sin ficha. ¿Se crean, y con qué
criterio?

**D-8 · Usuarios de prueba.** Sin ellos no puedo comprobar la escalada de privilegios con una
sesión real.

---

## 7. Plan de despliegue y recuperación

**Orden obligatorio:** base → agente → ERP.

1. `20260914180000_rls_profiles.sql` → `node scripts/verificar-rls-profiles.mjs` → probar sesión.
2. `20260914190000_vendedor_en_ventas.sql` → hacer una venta de prueba → comprobar que
   `orders.created_by` quedó con el usuario correcto.
3. `20260914200000_vista_ventas_del_vendedor.sql` → abrir `/rep-dashboard`.
4. Desplegar el ERP (Vercel).
5. Reiniciar el agente, si D-3 se autoriza.

**Detener y revertir si:** alguien no puede iniciar sesión, la pantalla de Equipo queda vacía, o
una venta falla al cobrarse.

**Recuperación por paso**

| Paso | Cómo se revierte | ¿Pierde datos? |
|---|---|---|
| 1 | Aflojar la política (3 escalones documentados en la migración) | No |
| 2 | `DROP TRIGGER trg_orders_registrar_vendedor ON orders;` | No |
| 3 | `DROP VIEW v_daily_sales_stats;` | No |
| 4 | Redesplegar el commit anterior en Vercel | No |

---

## 8. Limitaciones reales

- **No hay entorno de pruebas ni pruebas automatizadas** en ninguno de los dos repositorios.
  Todo se verificó con fixtures sintéticos, sondas de lectura y datos restaurados.
- **No se pudo probar la escalada de privilegios con una sesión real** (falta D-8).
- **El validador de SQL no soporta funciones `RETURNS trigger`** — una función trivial también
  falla. El SQL completo sí se validó; la lógica del disparador son 4 líneas.
- **La vista previa de clientes cubre 1.000 de 11.491 conversaciones** (tope de PostgREST). Se
  eligió no paginar 12 veces para no cargar la base de noche.
- **La comisión del panel es cero, no calculada.** Las reglas del negocio no están confirmadas y
  `commission_ledger.sales_user_id` está vacío en los 309 asientos.

---

## 9. Próximas cinco acciones por impacto

1. **Aplicar la protección de `profiles`** (D-1). Cierra una puerta abierta a internet.
2. **Atender los 43 clientes sin respuesta** — lista en el clasificador; el más viejo, 14 días.
3. **Aplicar y desplegar la atribución del vendedor** (D-2). Desbloquea panel y comisiones.
4. **Definir los roles** (D-4) y quitar el disparador que fuerza administrador.
5. **Reiniciar el agente** (D-3) y verificar la revinculación.

---

*Queda pendiente aplicar y desplegar. Esto no está terminado hasta que eso ocurra.*
