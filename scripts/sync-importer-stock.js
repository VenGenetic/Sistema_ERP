import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Use service_role key from environment variable to bypass RLS constraints
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Error: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const jsonPath = path.resolve(__dirname, '../../odoo_scraper/data_costos_cantidad.json');

async function main() {
    console.log("==================================================");
    console.log("🚀 STARTING IMPORTER STOCK SYNC");
    console.log("==================================================");

    if (!fs.existsSync(jsonPath)) {
        console.error(`❌ Error: JSON file not found at ${jsonPath}`);
        process.exit(1);
    }

    console.log(`Loading JSON data from: ${jsonPath}`);
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const jsonProducts = JSON.parse(rawData);
    console.log(`📄 Found ${jsonProducts.length} products in JSON file.`);

    // Map to updates array
    const updates = jsonProducts.map(item => ({
        sku: (item.id || item.codigo_referencia || '').trim(),
        stock: parseInt(item.stock_cantidad) || 0
    })).filter(u => u.sku);

    console.log(`📦 Prepared ${updates.length} products for upload.`);

    // 1. Try to test if the RPC function 'update_importer_stock' exists
    console.log("Checking if SQL RPC function exists...");
    const testBatch = updates.slice(0, 1);
    const { error: rpcTestError } = await supabase.rpc('update_importer_stock', {
        updates: testBatch
    });

    const useRpc = !rpcTestError;

    if (useRpc) {
        console.log("✅ SQL RPC function found! Using high-speed bulk upload.");
        const batchSize = 500;
        for (let i = 0; i < updates.length; i += batchSize) {
            const batch = updates.slice(i, i + batchSize);
            const { error } = await supabase.rpc('update_importer_stock', {
                updates: batch
            });
            if (error) {
                console.error(`❌ Batch upload failed:`, error.message);
                process.exit(1);
            }
            console.log(`   Progress: Updated ${Math.min(i + batchSize, updates.length)}/${updates.length} products...`);
        }
    } else {
        console.log(`⚠️ SQL RPC function not found (Error: ${rpcTestError ? rpcTestError.message : 'Unknown'}).`);
        console.log("⚠️ Falling back to standard parallel batch updates (slower)...");
        
        // standard fallback: update using .update() in parallel batches
        const batchSize = 30; // 30 concurrent updates at a time
        for (let i = 0; i < updates.length; i += batchSize) {
            const batch = updates.slice(i, i + batchSize);
            const promises = batch.map(async (item) => {
                const { error } = await supabase
                    .from('products')
                    .update({ importer_stock: item.stock })
                    .eq('sku', item.sku);
                if (error) {
                    // If the column itself doesn't exist, we will fail early and inform the user
                    if (error.message.includes("column") || error.code === '42703') {
                        console.error(`❌ Column 'importer_stock' does not exist in the 'products' table.`);
                        console.error("❌ Please run the SQL migration on your Supabase dashboard first!");
                        console.error("SQL to run:\nALTER TABLE public.products ADD COLUMN IF NOT EXISTS importer_stock INTEGER DEFAULT 0;");
                        process.exit(1);
                    }
                    console.warn(`[WARN] Failed to update SKU ${item.sku}:`, error.message);
                }
            });
            
            await Promise.all(promises);
            console.log(`   Progress (Fallback): Updated ${Math.min(i + batchSize, updates.length)}/${updates.length} products...`);
        }
    }

    console.log("==================================================");
    console.log("🎉 IMPORTER STOCK SYNC COMPLETED SUCCESSFULLY!");
    console.log("==================================================");
}

main().catch(err => {
    console.error("❌ Fatal script error:", err);
    process.exit(1);
});
