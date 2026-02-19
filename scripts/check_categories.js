import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkCategories() {
    console.log("Checking categories...");
    // Load env vars
    const envPath = path.resolve(__dirname, '../.env');
    let env = {};
    try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join('=').trim();
                env[key] = val;
            }
        });
    } catch (e) {
        console.error("Error reading .env:", e);
        return;
    }

    const supabaseUrl = env.VITE_SUPABASE_URL;
    const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase credentials');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate as temp user to read data
    const email = `temp_check_${Date.now()}@example.com`;
    const password = 'TempPassword123!';

    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
    });

    if (authError) {
        // Try sign in?
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) console.error('Auth error:', authError);
    }

    // Get categories
    const { data, error } = await supabase
        .from('accounts')
        .select('category');

    if (error) {
        console.error('Error fetching categories:', error);
        return;
    }

    const categories = [...new Set(data.map(d => d.category))];
    console.log('Distinct Categories found in DB:', categories);
}

checkCategories();
