
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env');
    process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAccounts() {
    const { data, error } = await supabase
        .from('accounts')
        .select('*');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Accounts:', JSON.stringify(data, null, 2));
    }
}

checkAccounts(); 
