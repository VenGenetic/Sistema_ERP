import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const PROVIDER_API_URL = Deno.env.get('PROVIDER_API_URL') || ''
const PROVIDER_API_KEY = Deno.env.get('PROVIDER_API_KEY') || ''

// Simple auth verification using Authorization header
serve(async (req: Request) => {
  // Check auth header if we are protecting this webhook trigger
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${Deno.env.get('SYNC_CRON_SECRET')}`) {
     // For local testing, we might bypass this if the secret isn't set, 
     // but in production, we should enforce it.
     if (Deno.env.get('SYNC_CRON_SECRET')) {
         return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
     }
  }

  if (!PROVIDER_API_URL) {
    return new Response(JSON.stringify({ error: 'PROVIDER_API_URL is not set' }), { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // 1. Fetch data from external provider
    const providerResponse = await fetch(PROVIDER_API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PROVIDER_API_KEY}`
      }
    })

    if (!providerResponse.ok) {
        throw new Error(`Provider API error: ${providerResponse.statusText}`)
    }

    const providerData = await providerResponse.json()
    // Assume providerData is an array of products: [{ sku, name, price, stock, ... }]
    
    let updatedCount = 0
    let insertedCount = 0

    // 2. Sync loop (Basic example: you'll need to adjust based on their exact JSON format)
    for (const item of providerData) {
      if (!item.sku) continue;

      // Upsert product in our DB (This is just a skeleton of how you map it)
      const { data: product, error: productError } = await supabase
        .from('products')
        .upsert({
            sku: item.sku,
            name: item.name,
            pvp: item.price || 0,
            status: 'active',
            // Map other fields as necessary
        }, { onConflict: 'sku' })
        .select()
        .single()
      
      if (productError) {
          console.error(`Error upserting product ${item.sku}:`, productError)
          continue;
      }

      // Update inventory (assuming default warehouse 1 for now)
      if (product && item.stock !== undefined) {
         const { error: invError } = await supabase
           .from('inventory_levels')
           .upsert({
               product_id: product.id,
               warehouse_id: 1, // Defaulting to main warehouse
               current_stock: item.stock,
           }, { onConflict: 'product_id,warehouse_id' })
           
         if (invError) {
            console.error(`Error updating stock for ${item.sku}:`, invError)
         }
      }

      updatedCount++
    }

    return new Response(
      JSON.stringify({ 
          success: true, 
          message: 'Sync completed', 
          processed: updatedCount 
      }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error('Sync process failed:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json" }, status: 500 },
    )
  }
})
