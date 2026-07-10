import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const tables = [
        'roles', 'profiles', 'partners', 'warehouses', 'products', 
        'inventory_levels', 'inventory_logs', 'orders', 'order_items', 
        'accounts', 'transactions', 'transaction_lines', 'system_events', 
        'brands', 'customers', 'lost_demand', 'api_keys', 'point_ledger', 
        'global_pool', 'commission_ledger', 'product_compatibilities', 
        'tags', 'product_tags', 'customer_requests', 'product_demands'
    ];

    console.log("--- Table Row Counts ---");
    for (const table of tables) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
        
        if (error) {
            console.error(`Error for ${table}:`, error.message);
        } else {
            console.log(`${table}: ${count} rows`);
        }
    }
}

run();
