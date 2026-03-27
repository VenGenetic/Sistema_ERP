import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') }); // Load .env from parent dir

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDependencies() {
    console.log("Checking brands...");
    let { data: brands } = await supabase.from('brands').select('*');
    if (!brands || brands.length === 0) {
        console.log("No brands found. Creating DAYTONA...");
        const res = await supabase.from('brands').insert([{ name: 'DAYTONA' }]).select();
        brands = res.data;
    }
    console.log("Brands:", brands);

    console.log("Checking warehouses...");
    let { data: warehouses } = await supabase.from('warehouses').select('*');
    if (!warehouses || warehouses.length === 0) {
        console.log("No warehouses found. Creating Bodega Principal...");
        const res = await supabase.from('warehouses').insert([{ name: 'Bodega Principal', type: 'principal' }]).select();
        warehouses = res.data;
    }
    console.log("Warehouses:", warehouses);
    
    // Create Default Partner if needed for warehouse (schema: warehouse has partner_id)
    // Wait, let's just create them if they fail, or let's read the exact warehouse row.
}
checkDependencies();
