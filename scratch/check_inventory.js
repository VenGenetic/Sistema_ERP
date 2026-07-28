const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xzsdsmskyosepemalage.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6c2RzbXNreW9zZXBlbWFsYWdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzE5ODMsImV4cCI6MjA4NjkwNzk4M30.G14fWxtjFRmjy2NqZM4fWncD4NbzGC6uT8i3bA0844k';

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
