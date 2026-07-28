const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xzsdsmskyosepemalage.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6c2RzbXNreW9zZXBlbWFsYWdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzE5ODMsImV4cCI6MjA4NjkwNzk4M30.G14fWxtjFRmjy2NqZM4fWncD4NbzGC6uT8i3bA0844k';

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
