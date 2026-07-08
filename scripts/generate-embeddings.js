import { createClient } from '@supabase/supabase-js';
import { RawImage, AutoProcessor, CLIPVisionModelWithProjection } from '@huggingface/transformers';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Using the service role key from the codebase to bypass RLS
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6c2RzbXNreW9zZXBlbWFsYWdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMzMTk4MywiZXhwIjoyMDg2OTA3OTgzfQ.XY-OoGMVyhCcJIbb2sq7VSGL1NnEzZszjs8a6BswizE";

if (!supabaseUrl) {
    console.error("❌ Error: VITE_SUPABASE_URL is missing in environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log("🚀 Starting Image Embedding Generator...");
    console.log("📦 Loading CLIP model (Xenova/clip-vit-base-patch32)...");
    
    let processor, vision_model;
    try {
        processor = await AutoProcessor.from_pretrained('Xenova/clip-vit-base-patch32');
        vision_model = await CLIPVisionModelWithProjection.from_pretrained('Xenova/clip-vit-base-patch32', {
            device: 'cpu' // Run on CPU for compatibility
        });
        console.log("✅ Model loaded successfully!");
    } catch (err) {
        console.error("❌ Failed to load model:", err.message);
        process.exit(1);
    }

    // Fetch products needing embeddings
    console.log("🔍 Fetching products without embeddings...");
    const { data: products, error } = await supabase
        .from('products')
        .select('id, sku, name, image_url')
        .is('image_embedding', null)
        .not('image_url', 'is', null)
        .eq('is_active', true);

    if (error) {
        console.error("❌ Error fetching products:", error.message);
        process.exit(1);
    }

    console.log(`📋 Found ${products.length} products to process.`);

    if (products.length === 0) {
        console.log("🎉 All products are already embedded. Nothing to do!");
        return;
    }

    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        console.log(`[${i + 1}/${products.length}] Processing product: ${product.sku} - ${product.name}`);
        console.log(`   Image URL: ${product.image_url}`);

        try {
            // Read image
            const image = await RawImage.read(product.image_url);
            
            // Generate features
            const image_inputs = await processor(image);
            const { image_embeds } = await vision_model(image_inputs);
            
            // Convert Float32Array to standard JS Array of numbers
            const embedding = Array.from(image_embeds.data);

            if (embedding.length !== 512) {
                throw new Error(`Invalid embedding size: expected 512, got ${embedding.length}`);
            }

            // Update database
            const { error: updateError } = await supabase
                .from('products')
                .update({ image_embedding: embedding })
                .eq('id', product.id);

            if (updateError) {
                console.error(`   ❌ DB Update error for SKU ${product.sku}:`, updateError.message);
            } else {
                console.log(`   ✅ Successfully updated SKU ${product.sku} embedding.`);
            }

        } catch (err) {
            console.error(`   ❌ Error processing SKU ${product.sku}:`, err.message);
        }
    }

    console.log("🏁 Embedding generation finished!");
}

main();
