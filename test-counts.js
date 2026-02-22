import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkCounts() {
    console.log("Checking counts...");

    const { count: userCount, error: userErr } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    console.log("Profiles count:", userCount, userErr?.message || "OK");

    const { count: whCount, error: whErr } = await supabase.from('warehouses').select('*', { count: 'exact', head: true });
    console.log("Warehouses count:", whCount, whErr?.message || "OK");

    const { count: accCount, error: accErr } = await supabase.from('accounts').select('*', { count: 'exact', head: true });
    console.log("Accounts count:", accCount, accErr?.message || "OK");

    const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').limit(3);
    console.log("Sample profiles:", profiles, pErr?.message || "OK");
}

checkCounts();
