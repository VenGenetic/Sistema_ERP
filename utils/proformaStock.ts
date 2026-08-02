import { supabase } from '../supabaseClient';
import { isProductDiscontinued } from './discontinuedHelper';

export type StockStatus = 'in_stock' | 'backorder' | 'out_of_stock';

export interface ProformaStockInfo {
    totalStock: number;
    status: StockStatus;
}

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
    in_stock: 'En Stock',
    backorder: 'Bajo Pedido',
    out_of_stock: 'Agotado',
};

// Stock status shown in the Proforma panel and exported image: summed across
// all warehouses (a proforma item has no warehouse yet). Zero stock is split
// into "Agotado" vs "Bajo Pedido" using the same is_discontinued/discontinued_until
// fields isProductDiscontinued() already uses elsewhere in the app (POS.tsx's
// "Descontinuado" badge) — discontinued means it won't be restocked, anything
// else with zero stock is still sourceable/orderable.
export async function fetchProformaStockInfo(productIds: number[]): Promise<Record<number, ProformaStockInfo>> {
    if (productIds.length === 0) return {};

    const { data, error } = await supabase
        .from('products')
        .select('id, is_discontinued, discontinued_until, inventory_levels ( current_stock )')
        .in('id', productIds);

    if (error || !data) return {};

    const result: Record<number, ProformaStockInfo> = {};
    for (const prod of data as any[]) {
        const totalStock = (prod.inventory_levels || []).reduce((sum: number, l: any) => sum + (l.current_stock || 0), 0);
        const status: StockStatus = totalStock > 0
            ? 'in_stock'
            : isProductDiscontinued(prod)
                ? 'out_of_stock'
                : 'backorder';
        result[prod.id] = { totalStock, status };
    }
    return result;
}
