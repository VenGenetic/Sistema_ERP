import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Error: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const oldJsonPath = path.resolve(__dirname, '../../odoo_scraper/data_costos.json');
const newJsonPath = path.resolve(__dirname, '../../odoo_scraper/data_costos_cantidad.json');

async function main() {
    console.log("Reading correct JSON:", oldJsonPath);
    const oldData = JSON.parse(fs.readFileSync(oldJsonPath, 'utf8'));
    const newData = JSON.parse(fs.readFileSync(newJsonPath, 'utf8'));

    console.log(`Found ${oldData.length} correct records to restore.`);

    // Crear mapa de los correctos
    const correctMap = new Map();
    for (const item of oldData) {
        if (item.id) {
            correctMap.set(item.id.toUpperCase(), {
                price: parseFloat(item.pvp) || 0,
                cost_without_vat: parseFloat(item.costo_sin_iva) || 0
            });
        }
    }

    // Identificar los 43 nuevos
    for (const item of newData) {
        if (item.id) {
            const sku = item.id.toUpperCase();
            if (!correctMap.has(sku)) {
                // Para los nuevos que se rasparon mal (al doble), dividimos su costo_sin_iva y pvp por 2
                correctMap.set(sku, {
                    price: (parseFloat(item.pvp) || 0) / 2,
                    cost_without_vat: (parseFloat(item.costo_sin_iva) || 0) / 2
                });
            }
        }
    }

    console.log(`Total records to update in Supabase: ${correctMap.size}`);

    // Fetch existing products to only update what's needed
    const { data: dbProducts, error: dbErr } = await supabase.from('products').select('sku, price, cost_without_vat');
    if (dbErr) {
        console.error("Error fetching db products:", dbErr.message);
        process.exit(1);
    }

    const updates = [];
    for (const dbProd of dbProducts) {
        if (dbProd.sku) {
            const sku = dbProd.sku.toUpperCase();
            const correct = correctMap.get(sku);
            if (correct) {
                // Only update if there is a discrepancy to avoid unnecessary writes
                if (Math.abs(dbProd.price - correct.price) > 0.01 || Math.abs(dbProd.cost_without_vat - correct.cost_without_vat) > 0.01) {
                    updates.push({
                        sku: dbProd.sku,
                        price: correct.price,
                        cost_without_vat: correct.cost_without_vat
                    });
                }
            }
        }
    }

    console.log(`Found ${updates.length} products that actually need fixing.`);

    let successCount = 0;
    const batchSize = 30;
    for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        const promises = batch.map(async (row) => {
            const { error } = await supabase
                .from('products')
                .update({
                    price: row.price,
                    cost_without_vat: row.cost_without_vat
                })
                .eq('sku', row.sku);

            if (error) {
                console.error(`Error updating SKU ${row.sku}:`, error.message);
                return false;
            }
            return true;
        });

        const results = await Promise.all(promises);
        successCount += results.filter(Boolean).length;
        console.log(`Progress: Restored ${Math.min(i + batchSize, updates.length)}/${updates.length} products...`);
    }

    console.log(`Successfully restored prices for ${successCount} products.`);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
