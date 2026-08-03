import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';

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
const csvPath = path.resolve(__dirname, '../../correccion_precios_2026-08-01.csv');

async function main() {
    console.log("Reading CSV:", csvPath);
    const fileContent = fs.readFileSync(csvPath, 'utf8');
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true
    });

    console.log(`Found ${records.length} records to restore.`);

    let successCount = 0;
    const batchSize = 30;
    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const promises = batch.map(async (row) => {
            const sku = row.SKU.trim();
            const precioCorregido = parseFloat(row['Precio Corregido']);
            const costoCorregido = parseFloat(row['Costo Corregido']);

            if (!sku || isNaN(precioCorregido) || isNaN(costoCorregido)) {
                console.warn(`Skipping invalid row: ${JSON.stringify(row)}`);
                return false;
            }

            const { error } = await supabase
                .from('products')
                .update({
                    price: precioCorregido,
                    cost_without_vat: costoCorregido
                })
                .eq('sku', sku);

            if (error) {
                console.error(`Error updating SKU ${sku}:`, error.message);
                return false;
            }
            return true;
        });

        const results = await Promise.all(promises);
        successCount += results.filter(Boolean).length;
        console.log(`Progress: Restored ${Math.min(i + batchSize, records.length)}/${records.length} products...`);
    }

    console.log(`Successfully restored prices for ${successCount} products.`);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
