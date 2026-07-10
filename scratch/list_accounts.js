import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("--- Checking Accounts ---");
    const { data: accounts, error } = await supabase.from('accounts').select('*').order('position');
    if (error) console.error(error);
    else console.log(accounts);
}

run();
