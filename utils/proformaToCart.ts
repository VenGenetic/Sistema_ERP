/**
 * proformaToCart.ts
 * Convierte la proforma en curso en un carrito del POS.
 *
 * Vive aparte del panel de escritorio porque el modo móvil ofrece la misma
 * acción: dejar la resolución de bodegas duplicada en dos pantallas era la
 * forma segura de que una se corrigiera y la otra no.
 */
import { supabase } from '../supabaseClient';
import { useCartStore } from '../store/cartStore';
import { ProformaItem } from '../store/useProformaStore';

export interface ProformaConversionResult {
    /** SKUs que no se pudieron cargar por no tener bodega asignable. */
    unresolved: string[];
    /** SKUs cargados pero sin stock suficiente en la bodega elegida. */
    lowStock: string[];
}

/**
 * Resuelve una bodega real por ítem y carga todo en el carrito del POS.
 *
 * No existe un respaldo tipo "Venta Libre": cada ítem recibe un warehouse_id
 * real para que su stock se vea y se pueda corregir en el carrito antes de
 * cerrar la venta. Si un producto nunca estuvo en ninguna bodega se usa la
 * bodega por defecto del usuario (localStorage 'erp_default_warehouse_id'), y
 * si tampoco hay, se omite y se informa en vez de adivinar.
 */
export const convertProformaToPosCart = async (
    items: ProformaItem[]
): Promise<ProformaConversionResult> => {
    const productIds = items.map((i) => i.productId);

    const [{ data: products, error: prodError }, { data: warehouses, error: whError }] = await Promise.all([
        supabase
            .from('products')
            .select(`
                id, sku, name, price, cost_without_vat, vat_percentage, is_discontinued, discontinued_until,
                inventory_levels ( current_stock, warehouse_id, warehouses ( name ) )
            `)
            .in('id', productIds),
        supabase.from('warehouses').select('id, name').eq('is_active', true),
    ]);

    if (prodError) throw prodError;
    if (whError) throw whError;

    const warehouseNameById = new Map<number, string>((warehouses || []).map((w: any) => [w.id, w.name]));
    const defaultWarehouseIdRaw = localStorage.getItem('erp_default_warehouse_id');
    const defaultWarehouseId = defaultWarehouseIdRaw ? parseInt(defaultWarehouseIdRaw, 10) : null;

    const unresolved: string[] = [];
    const lowStock: string[] = [];

    const { clearCart, addToCart, updateQuantity, updateUnitPrice } = useCartStore.getState();
    clearCart();

    for (const item of items) {
        const prod = products?.find((p: any) => p.id === item.productId);
        if (!prod) {
            unresolved.push(item.sku);
            continue;
        }

        const levels: any[] = prod.inventory_levels || [];
        // Se prefiere una bodega que cubra la cantidad pedida; si no hay,
        // cualquiera con stock; y como último recurso la primera registrada.
        const chosen =
            levels.find((l) => l.current_stock >= item.quantity) ||
            levels.find((l) => l.current_stock > 0) ||
            levels[0];

        let warehouse_id: number;
        let warehouse_name: string;
        let current_stock: number;

        if (chosen) {
            warehouse_id = chosen.warehouse_id;
            warehouse_name =
                (Array.isArray(chosen.warehouses) ? chosen.warehouses[0]?.name : chosen.warehouses?.name) ||
                warehouseNameById.get(chosen.warehouse_id) ||
                'Bodega';
            current_stock = chosen.current_stock;
        } else if (defaultWarehouseId && warehouseNameById.has(defaultWarehouseId)) {
            warehouse_id = defaultWarehouseId;
            warehouse_name = warehouseNameById.get(defaultWarehouseId)!;
            current_stock = 0;
        } else {
            unresolved.push(item.sku);
            continue;
        }

        if (current_stock < item.quantity) lowStock.push(item.sku);

        addToCart({
            product: {
                id: prod.id,
                sku: prod.sku,
                name: prod.name,
                price: prod.price,
                cost_without_vat: prod.cost_without_vat,
                vat_percentage: prod.vat_percentage,
                is_discontinued: prod.is_discontinued,
                discontinued_until: prod.discontinued_until,
            },
            warehouse_id,
            warehouse_name,
            current_stock,
        });

        // addToCart genera el id de la línea, así que se toma la recién añadida
        // para aplicarle la cantidad y el precio pactados en la proforma.
        const cartNow = useCartStore.getState().cart;
        const newCartItem = cartNow[cartNow.length - 1];
        updateQuantity(newCartItem.id, item.quantity);
        updateUnitPrice(newCartItem.id, item.unitPrice);
    }

    return { unresolved, lowStock };
};
