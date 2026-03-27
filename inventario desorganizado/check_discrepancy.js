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

async function check() {
    const jsonDataStr = readFileSync(path.join(__dirname, 'data_guayaquil.json'), 'utf-8');
    const productsJson = JSON.parse(jsonDataStr).RAW_SCRAPED_DATA || [];
    
    console.log(`Total items in JSON array: ${productsJson.length}`);
    
    // Count unique by SKU (codigo_referencia)
    const uniqueSkus = new Set();
    const duplicates = [];
    let emptySkus = 0;
    
    for (const p of productsJson) {
        let sku = p.codigo_referencia;
        if (!sku) {
            emptySkus++;
        } else {
            if (uniqueSkus.has(sku)) {
                duplicates.push(sku);
            } else {
                uniqueSkus.add(sku);
            }
        }
    }
    
    console.log(`Empty/No SKU: ${emptySkus}`);
    console.log(`Unique SKUs: ${uniqueSkus.size}`);
    console.log(`Duplicate SKUs count: ${duplicates.length}`);

    // Check DB
    const { count: dbCount, error } = await supabase.from('products').select('*', { count: 'exact', head: true });
    console.log(`Products in DB: ${dbCount}`);
}

check();
