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

async function main() {
    console.log(`Starting image upload process connecting to: ${url}`);
    
    // Check if directory exists
    if (!fs.existsSync(imagesDir)) {
        console.error(`Error: Directory not found at ${imagesDir}`);
        return;
    }

    const files = fs.readdirSync(imagesDir);
    const webpFiles = files.filter(f => f.endsWith('_cut.webp'));

    console.log(`Found ${webpFiles.length} image files to process.`);

    let successCount = 0;
    let errorCount = 0;
    let notFoundCount = 0;

    for (const fileName of webpFiles) {
        // Assume format is '(codigo)_cut.webp' as requested
        const sku = fileName.replace('_cut.webp', '');
        
        // 1. Check if the product exists in the DB first
        const { data: product, error: findError } = await supabase
            .from('products')
            .select('id, sku')
            .eq('sku', sku)
            .single();

        if (findError || !product) {
            console.log(`[SKIPPED] File ${fileName} - No product found matching SKU '${sku}'.`);
            notFoundCount++;
            continue;
        }

        // 2. Read the image file as a Buffer
        const filePath = path.join(imagesDir, fileName);
        const fileBuffer = fs.readFileSync(filePath);
        
        // 3. Upload to Supabase Storage (Bucket: product_images)
        const storagePath = `products/${fileName}`;
        
        console.log(`[UPLOADING] ${fileName} for SKU ${sku}...`);
        const { error: uploadError } = await supabase.storage
            .from('product_images')
            .upload(storagePath, fileBuffer, {
                contentType: 'image/webp',
                upsert: true
            });

        if (uploadError) {
            console.error(`[ERROR] Failed to upload ${fileName}:`, uploadError.message);
            errorCount++;
            continue;
        }

        // 4. Get the Public URL
        const { data: publicUrlData } = supabase.storage
            .from('product_images')
            .getPublicUrl(storagePath);
            
        const imageUrl = publicUrlData.publicUrl;

        // 5. Link the URL to the product
        const { error: updateError } = await supabase
            .from('products')
            .update({ image_url: imageUrl })
            .eq('id', product.id);

        if (updateError) {
            console.error(`[ERROR] Failed to link URL to product ${sku}:`, updateError.message);
            errorCount++;
        } else {
            console.log(`[SUCCESS] Linked image to product ${sku}.`);
            successCount++;
        }
    }

    console.log('\n--- SUMMARY ---');
    console.log(`Total files found: ${webpFiles.length}`);
    console.log(`Successfully linked: ${successCount}`);
    console.log(`Products not found: ${notFoundCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('----------------');
    console.log('NOTE: If you got "row-level security" errors updating products, ensure your DB policies allow this or temporarily use VITE_SUPABASE_SERVICE_ROLE_KEY.');
}

main().catch(console.error);
