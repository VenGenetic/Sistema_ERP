import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../.env');

// Read environment variables
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        envVars[key] = value;
    }
});

const url = envVars['VITE_SUPABASE_URL'];
// Use Service Role Key if available, otherwise fallback to Anon Key
const key = envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'] || envVars['VITE_SUPABASE_ANON_KEY'];

if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or Key in .env');
    process.exit(1);
}

const supabase = createClient(url, key);

// The source directory containing the images
const imagesDir = 'C:\\Users\\ASUS\\Documents\\catalogo-motos-main\\catalogo-motos\\public\\imagenes_repuestos';

async function processBatch(filesBatch) {
    const results = [];
    for (const fileName of filesBatch) {
        const sku = fileName.replace('_cut.webp', '');
        const filePath = path.join(imagesDir, fileName);
        const fileBuffer = fs.readFileSync(filePath);
        const storagePath = `products/${fileName}`;
        
        // 1. Upload to Supabase Storage (Bucket: product_images) UNCONDITIONALLY
        const { error: uploadError } = await supabase.storage
            .from('product_images')
            .upload(storagePath, fileBuffer, {
                contentType: 'image/webp',
                upsert: true
            });

        if (uploadError) {
            console.error(`[ERROR] Failed to upload ${fileName}:`, uploadError.message);
            results.push({ sku, status: 'error', message: uploadError.message });
            continue;
        }

        // 2. Get the Public URL
        const { data: publicUrlData } = supabase.storage
            .from('product_images')
            .getPublicUrl(storagePath);
            
        const imageUrl = publicUrlData.publicUrl;

        // 3. Link the URL to the product directly by matching SKU (if it exists)
        // By doing this, any existing product with this SKU gets the image URL.
        const { error: updateError, count } = await supabase
            .from('products')
            .update({ image_url: imageUrl })
            .eq('sku', sku)
            .select('*');

        if (updateError) {
            console.error(`[WARN] DB link failed for ${sku} (maybe not present yet):`, updateError.message);
            results.push({ sku, status: 'uploaded_only' });
        } else if (count === 0) {
            console.log(`[UPLOADED] ${fileName} -> Stored. (No product mapped yet)`);
            results.push({ sku, status: 'uploaded_only' });
        } else {
            console.log(`[SUCCESS] ${fileName} -> Stored & Linked to Product!`);
            results.push({ sku, status: 'linked' });
        }
    }
    return results;
}

async function main() {
    console.log(`Starting bulk image upload process to: ${url}`);
    
    if (!fs.existsSync(imagesDir)) {
        console.error(`Error: Directory not found at ${imagesDir}`);
        return;
    }

    const files = fs.readdirSync(imagesDir);
    const webpFiles = files.filter(f => f.endsWith('_cut.webp'));

    console.log(`Found ${webpFiles.length} image files to process. Using concurrency to speed up...`);

    const BATCH_SIZE = 10;
    let successCount = 0;
    let uploadedOnlyCount = 0;
    let errorCount = 0;

    for (let i = 0; i < webpFiles.length; i += BATCH_SIZE) {
        const batch = webpFiles.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(webpFiles.length / BATCH_SIZE)}...`);
        const batchResults = await processBatch(batch);
        
        for (const res of batchResults) {
            if (res.status === 'linked') successCount++;
            else if (res.status === 'uploaded_only') uploadedOnlyCount++;
            else if (res.status === 'error') errorCount++;
        }
    }

    console.log('\n--- UPLOAD SUMMARY ---');
    console.log(`Total files found: ${webpFiles.length}`);
    console.log(`Successfully UPLOADED AND LINKED to existing products: ${successCount}`);
    console.log(`Successfully UPLOADED to Cloud (ready for future products): ${uploadedOnlyCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('----------------------');
}

main().catch(console.error);
