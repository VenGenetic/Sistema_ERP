const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env');
    process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Fetching inventory groups...");
    const { data: groups, error: gError } = await supabase
        .from('inventory_groups')
        .select('*');
    
    if (gError) {
        console.error('Groups Error:', gError);
    } else {
        console.log('Groups:', groups);
    }

    console.log("Fetching inventory group items...");
    const { data: items, error: iError } = await supabase
        .from('inventory_group_items')
        .select('*')
        .limit(5);

    if (iError) {
        console.error('Items Error:', iError);
    } else {
        console.log('Sample Items:', items);
    }
}

run();
