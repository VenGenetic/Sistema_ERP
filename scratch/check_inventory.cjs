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
    console.log("Fetching profiles...");
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('*');
    
    if (pError) {
        console.error('Profiles Error:', pError);
    } else {
        console.log('Profiles:', profiles);
    }
}

run();
