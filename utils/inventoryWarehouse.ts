import { supabase } from '../supabaseClient';

// Por ahora Modo Inventario cuenta únicamente contra Guayaquil: es la bodega
// donde vive todo el stock desde la consolidación
// (supabase/migrations/20260916140000_consolidar_stock_en_guayaquil.sql).
// Ofrecer otras bodegas solo daría lugar a contar contra un teórico en cero.
//
// Para habilitar más bodegas más adelante basta con quitar el .ilike() de aquí:
// el listado de grupos y la sesión de conteo leen los dos esta misma función.
export const INVENTORY_WAREHOUSE_NAME = 'Guayaquil';

export interface InventoryWarehouse {
    id: number;
    name: string;
}

export const fetchInventoryWarehouses = async (): Promise<InventoryWarehouse[]> => {
    const { data, error } = await supabase
        .from('warehouses')
        .select('id, name')
        .eq('is_active', true)
        .ilike('name', `%${INVENTORY_WAREHOUSE_NAME}%`)
        .order('id');

    if (error) throw error;
    return data || [];
};
