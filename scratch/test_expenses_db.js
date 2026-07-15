import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("--- Checking daily_expenses Table ---");
    const { data, error } = await supabase.from('daily_expenses').select('*').limit(5);
    if (error) {
        console.error("❌ Error querying daily_expenses:", error.message);
    } else {
        console.log("✅ Successfully connected to daily_expenses! Found rows:", data.length);
        console.log(data);
    }
}

run();
