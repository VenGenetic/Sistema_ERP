
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixCategories() {
    const accountsToFix = [
        'B. Guayaquil',
        'B. Pichincha',
        'Caja Chica',
        'Caja Grande',
        'B. Pacífico',
        'Compra de mercadería'
    ];

    console.log('Attempting to update categories for:', accountsToFix);

    for (const name of accountsToFix) {
        const { data, error } = await supabase
            .from('accounts')
            .update({ category: 'asset' })
            .eq('name', name)
            .select();

        if (error) {
            console.error(`Error updating ${name}:`, error.message);
        } else {
            console.log(`Updated ${name}:`, data);
        }
    }
}

fixCategories();
