import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') }); 

const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6c2RzbXNreW9zZXBlbWFsYWdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMzMTk4MywiZXhwIjoyMDg2OTA3OTgzfQ.XY-OoGMVyhCcJIbb2sq7VSGL1NnEzZszjs8a6BswizE";
const supabase = createClient(process.env.VITE_SUPABASE_URL, SERVICE_ROLE_KEY);

async function wipeTable(tableName) {
    console.log(`Deleting ${tableName}...`);
    while (true) {
        const { data, error } = await supabase.from(tableName).select('id').limit(1000);
        if (error) { console.error(error); break; }
        if (!data || data.length === 0) break;
        
        const ids = data.map(d => d.id);
        const { error: delErr } = await supabase.from(tableName).delete().in('id', ids);
        if (delErr) { console.error("Del Error:", delErr); break; }
    }
}

async function wipe() {
    await wipeTable('transaction_lines');
    await wipeTable('transactions');
    await wipeTable('order_items');
    await wipeTable('orders');
    await wipeTable('lost_demand');
    await wipeTable('product_entries_history');
    await wipeTable('inventory_logs');
    await wipeTable('inventory_levels');
    await wipeTable('products');

    console.log("Database successfully wiped.");
}

wipe();
