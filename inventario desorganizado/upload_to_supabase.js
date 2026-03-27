import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') }); 
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6c2RzbXNreW9zZXBlbWFsYWdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMzMTk4MywiZXhwIjoyMDg2OTA3OTgzfQ.XY-OoGMVyhCcJIbb2sq7VSGL1NnEzZszjs8a6BswizE";
const supabase = createClient(process.env.VITE_SUPABASE_URL, SERVICE_ROLE_KEY);

async function run() {
    console.log("Starting upload...");
    const previewData = JSON.parse(readFileSync(path.join(__dirname, 'upload_preview.json'), 'utf-8'));

    // 1. Get or Create Brand
    let { data: brands, error: bErr } = await supabase.from('brands').select('id').eq('name', 'DAYTONA');
    let brandId = brands?.[0]?.id;
    if (!brandId) {
        const { data: newBrand, error: nbErr } = await supabase.from('brands').insert([{ name: 'DAYTONA' }]).select();
        if (nbErr) { console.error("Brand error:", nbErr); return; }
        brandId = newBrand[0].id;
    }

    // 2. Get or Create Warehouse
    let { data: warehouses, error: wErr } = await supabase.from('warehouses').select('id').eq('name', 'Bodega Principal');
    let warehouseId = warehouses?.[0]?.id;
    if (!warehouseId) {
        // Need a partner? Let's check partners
        let { data: partners } = await supabase.from('partners').select('id').limit(1);
        let partnerId = partners?.[0]?.id;
        if (!partnerId) {
            const { data: newP } = await supabase.from('partners').insert([{ name: 'Main Partner', type: 'internal' }]).select();
            partnerId = newP?.[0]?.id;
        }
        
        const { data: newW, error: nwErr } = await supabase.from('warehouses').insert([{ 
            name: 'Bodega Principal', 
            type: 'physical',
            partner_id: partnerId
        }]).select();
        if (nwErr) { console.error("Warehouse error:", nwErr); return; }
        warehouseId = newW[0].id;
    }

    // Deduplicate previewData by SKU
    const uniqueMap = new Map();
    for (const item of previewData) {
        if (!uniqueMap.has(item.sku)) {
            uniqueMap.set(item.sku, item);
        }
    }
    const uniquePreviewData = Array.from(uniqueMap.values());

    console.log(`Ready to insert ${uniquePreviewData.length} unique products...`);
    let insertedCount = 0;
    
    // We will do it in chunks to avoid overwhelming the API
    const chunkSize = 50;
    for (let i = 0; i < uniquePreviewData.length; i += chunkSize) {
        const chunk = uniquePreviewData.slice(i, i + chunkSize);
        
        // Prepare products payload
        const productsPayload = chunk.map(p => ({
            sku: p.sku || 'UNKNOWN',
            name: p.name || 'Sin nombre',
            price: p.price || 0,
            cost_without_vat: (p.price || 0) * 0.7, // Estimate
            brand_id: brandId
        }));

        const { data: insertedProducts, error: ipErr } = await supabase
            .from('products')
            .upsert(productsPayload, { onConflict: 'sku' })
            .select('id, sku');
            
        if (ipErr) {
            console.error("Error inserting products:", ipErr);
            continue;
        }

        // Map inserted products to inventory levels
        const inventoryPayload = [];
        const inventoryLogs = [];
        
        for (const inserted of insertedProducts) {
            const orig = chunk.find(c => c.sku === inserted.sku);
            const rawStock = orig ? orig.stock : 0;
            const stock = Math.floor(Number(rawStock) || 0);
            
            inventoryPayload.push({
                product_id: inserted.id,
                warehouse_id: warehouseId,
                current_stock: stock
            });

            if (stock > 0) {
                 // The schema log might require reason, transaction_type
                 // But wait, schema.md says: product_id, warehouse_id, quantity_change, user_id
                 inventoryLogs.push({
                     product_id: inserted.id,
                     warehouse_id: warehouseId,
                     quantity_change: stock,
                     reason: 'Inventario Inicial Asignado vía Excel'
                 });
            }
        }

        const { error: ilErr } = await supabase.from('inventory_levels').upsert(inventoryPayload, { onConflict: 'product_id, warehouse_id' });
        if (ilErr) console.error("Error inventory_levels:", ilErr);

        if (inventoryLogs.length > 0) {
            const { error: logErr } = await supabase.from('inventory_logs').insert(inventoryLogs);
            if (logErr) console.error("Error inventory_logs:", logErr);
        }

        insertedCount += chunk.length;
        console.log(`Inserted ${insertedCount} / ${uniquePreviewData.length}...`);
    }
    
    console.log("Upload complete!");
}

run();
