
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xzsdsmskyosepemalage.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6c2RzbXNreW9zZXBlbWFsYWdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzE5ODMsImV4cCI6MjA4NjkwNzk4M30.G14fWxtjFRmjy2NqZM4fWncD4NbzGC6uT8i3bA0844k';

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
