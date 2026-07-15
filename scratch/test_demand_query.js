import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
    try {
        // Find a valid product first
        const { data: prods } = await supabase.from('products').select('id, name').limit(1);
        if (!prods || prods.length === 0) {
            console.log("No products found in DB.");
            return;
        }
        const productId = prods[0].id;
        console.log(`Using product: ${prods[0].name} (ID: ${productId})`);

        // Insert an active demand
        console.log("Inserting a 'pending_stock' (active) demand...");
        const { data: activeDemand, error: activeErr } = await supabase
            .from('product_demands')
            .insert([{
                product_id: productId,
                phone_number: '1234567890',
                customer_name: 'Test Active',
                status: 'pending_stock'
            }])
            .select();
        
        if (activeErr) {
            console.error("Error inserting active demand:", activeErr);
        } else {
            console.log("Inserted active demand:", activeDemand);
        }

        // Insert a inactive demand (cancelled) with a different phone number
        console.log("Inserting a 'cancelled' (inactive) demand...");
        const { data: inactiveDemand, error: inactiveErr } = await supabase
            .from('product_demands')
            .insert([{
                product_id: productId,
                phone_number: '0987654321',
                customer_name: 'Test Inactive',
                status: 'cancelled'
            }])
            .select();

        if (inactiveErr) {
            console.error("Error inserting inactive demand:", inactiveErr);
        } else {
            console.log("Inserted inactive demand:", inactiveDemand);
        }

        // Query product with all demands (unfiltered)
        const { data: resAll, error: errAll } = await supabase
            .from('products')
            .select(`
                id,
                name,
                product_demands(count)
            `)
            .eq('id', productId);

        console.log("\nUnfiltered count results:", JSON.stringify(resAll, null, 2));

        // Query product with only active demands (filtered)
        const { data: resActive, error: errActive } = await supabase
            .from('products')
            .select(`
                id,
                name,
                product_demands(count)
            `)
            .in('product_demands.status', ['pending_stock', 'stock_available'])
            .eq('id', productId);

        console.log("\nFiltered count results:", JSON.stringify(resActive, null, 2));

        // Clean up
        console.log("\nCleaning up...");
        const { error: delErr } = await supabase
            .from('product_demands')
            .delete()
            .eq('product_id', productId);
        
        if (delErr) {
            console.error("Error during cleanup:", delErr);
        } else {
            console.log("Cleanup success.");
        }

    } catch (e) {
        console.error("Catch error:", e);
    }
}

test();
