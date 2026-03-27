import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("--- Checking Profiles ---");
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
    if (pErr) console.error(pErr);
    else console.log(profiles);

    console.log("--- Checking Products ---");
    const { data: products, error: prErr } = await supabase.from('products').select('*');
    if (prErr) console.error(prErr);
    else console.log(`Found ${products.length} products.`);

    console.log("--- Checking Inventory Levels ---");
    const { data: inventory, error: iErr } = await supabase.from('inventory_levels').select('*');
    if (iErr) console.error(iErr);
    else console.log(`Found ${inventory.length} inventory records. Total stock:`, inventory.reduce((acc, curr) => acc + curr.current_stock, 0));

    console.log("--- Checking Orders ---");
    const { data: orders, error: oErr } = await supabase.from('orders').select('*');
    if (oErr) console.error(oErr);
    else console.log(`Found ${orders.length} orders.`);
}

run();
