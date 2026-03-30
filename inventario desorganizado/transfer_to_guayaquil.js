import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') }); 

// Usando la misma clave y URL que upload_to_supabase.js
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6c2RzbXNreW9zZXBlbWFsYWdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMzMTk4MywiZXhwIjoyMDg2OTA3OTgzfQ.XY-OoGMVyhCcJIbb2sq7VSGL1NnEzZszjs8a6BswizE";
const supabase = createClient(process.env.VITE_SUPABASE_URL, SERVICE_ROLE_KEY);

async function transfer() {
    console.log("Iniciando transferencia de Bodega Principal a Guayaquil...");

    // 1. Obtener ID de Bodega Principal
    const { data: bpData, error: bpErr } = await supabase.from('warehouses').select('id, partner_id').eq('name', 'Bodega Principal').single();
    if (bpErr || !bpData) {
        console.error("No se encontró 'Bodega Principal'.", bpErr);
        return;
    }
    const sourceWarehouseId = bpData.id;
    console.log(`Bodega Principal ID: ${sourceWarehouseId}`);

    // 2. Obtener o crear Guayaquil
    let { data: guayaquil, error: gErr } = await supabase.from('warehouses').select('id').eq('name', 'Guayaquil').maybeSingle();
    let targetWarehouseId;

    if (!guayaquil) {
        console.log("Creando bodega 'Guayaquil'...");
        const { data: newWh, error: newWhErr } = await supabase.from('warehouses').insert([{
            name: 'Guayaquil',
            type: 'physical',
            partner_id: bpData.partner_id
        }]).select().single();

        if (newWhErr) {
            console.error("Error creando bodega Guayaquil:", newWhErr);
            return;
        }
        targetWarehouseId = newWh.id;
    } else {
        targetWarehouseId = guayaquil.id;
    }
    console.log(`Guayaquil ID: ${targetWarehouseId}`);

    if (sourceWarehouseId === targetWarehouseId) {
        console.log("La bodega de origen y destino son la misma. Abortando.");
        return;
    }

    // 3. Obtener todo el inventario de Bodega Principal
    console.log("Obteniendo niveles de inventario de Bodega Principal...");
    const { data: inventory, error: invErr } = await supabase.from('inventory_levels')
        .select('*')
        .eq('warehouse_id', sourceWarehouseId);

    if (invErr) {
        console.error("Error obteniendo inventario:", invErr);
        return;
    }

    if (!inventory || inventory.length === 0) {
        console.log("No hay productos en Bodega Principal para transferir.");
        return;
    }

    console.log(`Se encontraron ${inventory.length} registros de inventario. Transfiriendo...`);

    // 4. Mover el inventario. 
    // Lo más seguro es actualizar el warehouse_id de esos registros si no existen en Guayaquil.
    // Para simplificar, insertaremos/actualizaremos en Guayaquil y cambiaremos a 0 en Bodega Principal.
    let transferCount = 0;
    
    // Obtener lo que ya hay en Guayaquil para sumar si es necesario
    const { data: targetInventory } = await supabase.from('inventory_levels').select('*').eq('warehouse_id', targetWarehouseId);
    const targetMap = new Map((targetInventory || []).map(i => [i.product_id, i]));

    for (const item of inventory) {
        // Ignorar si el stock es 0 (opcional, pero ayuda a limpiar)
        if (item.current_stock <= 0) continue;

        const targetItem = targetMap.get(item.product_id);
        const newStock = (targetItem ? targetItem.current_stock : 0) + item.current_stock;

        // Upsert a Guayaquil
        await supabase.from('inventory_levels').upsert({
            product_id: item.product_id,
            warehouse_id: targetWarehouseId,
            current_stock: newStock
        }, { onConflict: 'product_id, warehouse_id' });

        // Dejar en 0 Bodega Principal
        await supabase.from('inventory_levels').update({ current_stock: 0 }).eq('id', item.id);

        // Registrar en logs
        await supabase.from('inventory_logs').insert([
            { product_id: item.product_id, warehouse_id: sourceWarehouseId, quantity_change: -item.current_stock, reason: 'Transferencia a Guayaquil' },
            { product_id: item.product_id, warehouse_id: targetWarehouseId, quantity_change: item.current_stock, reason: 'Transferencia desde Bodega Principal' }
        ]);

        transferCount++;
        if (transferCount % 50 === 0) console.log(`Transferidos ${transferCount} ítems...`);
    }

    console.log(`¡Transferencia completada! ${transferCount} productos movidos a Guayaquil.`);
}

transfer();
