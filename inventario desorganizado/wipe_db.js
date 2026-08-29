import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') }); 

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
    console.error('Falta SUPABASE_SERVICE_ROLE_KEY en .env (Supabase -> Project Settings -> API).');
    process.exit(1);
}
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
