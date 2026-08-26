/**
 * warehouseResolution.ts
 * Elige la bodega real de la que sale cada línea de una venta.
 *
 * Existe porque la regla estaba escrita dos veces: la proforma la resolvía
 * bien y el borrador del POS caía en `order.warehouse_id || 0`. Bodega 0 es
 * la señal de "producto manual, no toca inventario" que lee `process_pos_sale`
 * (ver el `IF v_item.warehouse_id != 0` de la migración
 * 20260712130000_simplify_and_integrate_till.sql), así que asignarla por
 * descarte cobraba la venta sin sacar nunca el repuesto del inventario --
 * sin error, sin movimiento y sin rastro. Una sola copia de la regla.
 */

/** Bodega ficticia: venta libre / producto manual, sin inventario detrás. */
export const FREE_SALE_WAREHOUSE_ID = 0;

export interface InventoryLevelRow {
    current_stock: number;
    warehouse_id: number;
    warehouses?: { name?: string } | { name?: string }[] | null;
}

export interface ResolvedWarehouse {
    warehouse_id: number;
    warehouse_name: string;
    current_stock: number;
}

/** El join de PostgREST llega como objeto o como arreglo según la consulta. */
const levelWarehouseName = (level: InventoryLevelRow): string | undefined =>
    Array.isArray(level.warehouses) ? level.warehouses[0]?.name : level.warehouses?.name;

/** Bodega por defecto del usuario, la misma que usa el resto del POS. */
export const readDefaultWarehouseId = (): number | null => {
    const raw = localStorage.getItem('erp_default_warehouse_id');
    if (!raw) return null;
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) ? null : parsed;
};

/**
 * Un producto sin ninguna fila en `inventory_levels` nunca estuvo en bodega:
 * es un manual (`MANUAL-…`) o una línea suelta de borrador (`DRAFT-…`), y su
 * sitio legítimo es la venta libre.
 */
export const isFreeSaleProduct = (sku: string | undefined, levels: InventoryLevelRow[]): boolean =>
    levels.length === 0 && (!!sku?.startsWith('MANUAL-') || !!sku?.startsWith('DRAFT-'));

/**
 * Devuelve la bodega de la que debe salir la línea, o `null` si no hay
 * ninguna a la que atribuirla.
 *
 * Se prefiere una bodega que cubra la cantidad pedida; si no hay, cualquiera
 * con stock; y como último recurso la primera registrada, aunque esté en
 * cero: es preferible que el carrito muestre el faltante en rojo y que la
 * venta se caiga con "stock insuficiente" a que se cobre en silencio contra
 * un inventario que nunca se descuenta.
 */
export const resolveWarehouseForLine = (
    levels: InventoryLevelRow[],
    quantity: number,
    warehouseNameById: Map<number, string>,
    defaultWarehouseId: number | null
): ResolvedWarehouse | null => {
    const chosen =
        levels.find((l) => l.current_stock >= quantity) ||
        levels.find((l) => l.current_stock > 0) ||
        levels[0];

    if (chosen) {
        return {
            warehouse_id: chosen.warehouse_id,
            warehouse_name:
                levelWarehouseName(chosen) || warehouseNameById.get(chosen.warehouse_id) || 'Bodega',
            current_stock: chosen.current_stock,
        };
    }

    if (defaultWarehouseId && warehouseNameById.has(defaultWarehouseId)) {
        return {
            warehouse_id: defaultWarehouseId,
            warehouse_name: warehouseNameById.get(defaultWarehouseId)!,
            current_stock: 0,
        };
    }

    return null;
};
