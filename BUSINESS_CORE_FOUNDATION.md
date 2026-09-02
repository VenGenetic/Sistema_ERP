# Base segura del Core de negocio

La migracion `supabase/migrations/20260829133000_business_core_foundation.sql`
es aditiva: no modifica precios, inventario fisico, POS, pedidos, WhatsApp ni
respuestas automaticas ya existentes.

## Capacidades nuevas

- `domain_events`: cola durable y con idempotencia para eventos de negocio.
- `business_audit_log`: registro de auditoria append-only para acciones de
  usuarios autenticados del ERP.
- `inventory_reservations`: reservas temporales que no cambian
  `inventory_levels`.

## Funciones de inventario

| Funcion | Uso |
| --- | --- |
| `get_inventory_availability(product_id, warehouse_id)` | Devuelve existencia, reservas activas y disponible. |
| `reserve_inventory_stock(...)` | Reserva de forma atomica y evita sobreventa en una bodega. |
| `release_inventory_reservation(id, reason)` | Libera una reserva sin consumir. |
| `consume_inventory_reservation(id, reference_id)` | La cierra despues de que el flujo de venta actual ya desconto stock. |
| `expire_inventory_reservations(limit)` | Marca reservas vencidas para reportes y mantenimiento. |

## Adopcion sin riesgo

1. Aplicar y comprobar la migracion.
2. Usar primero la consulta de disponibilidad en una vista interna de prueba.
3. Crear reservas desde cotizaciones o pedidos en espera, con una clave de
   idempotencia por accion.
4. Consumir una reserva solo despues de que POS/pedido haya terminado su
   movimiento de inventario con exito.
5. Liberar al cancelar o cuando el cliente rechace la cotizacion.

Las reservas no se conectan automaticamente al POS por diseno. Ese enlace se
hara en una fase posterior, con pruebas especificas, para no cambiar el
comportamiento de ventas que ya estan operativas.
