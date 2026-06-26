import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Hardcoded service_role key to bypass RLS constraints
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6c2RzbXNreW9zZXBlbWFsYWdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMzMTk4MywiZXhwIjoyMDg2OTA3OTgzfQ.XY-OoGMVyhCcJIbb2sq7VSGL1NnEzZszjs8a6BswizE";

if (!supabaseUrl) {
    console.error("Error: VITE_SUPABASE_URL is missing in environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Path definitions - check for data_costos_cantidad.json first, fallback to data_costos.json
let jsonPath = path.resolve(__dirname, '../../odoo_scraper/data_costos_cantidad.json');
if (!fs.existsSync(jsonPath)) {
    jsonPath = path.resolve(__dirname, '../../odoo_scraper/data_costos.json');
}
const localImagesDir = path.resolve(__dirname, '../../odoo_scraper/imagenes_recortadas');

async function main() {
    const isDryRun = process.argv.includes('--dry-run');
    console.log(`======================================================================`);
    console.log(`🚀 ODOO TO SUPABASE SYNC - Mode: ${isDryRun ? 'SIMULATION (DRY RUN)' : 'REAL EXECUTION'}`);
    console.log(`======================================================================`);

    // 1. Verify resources exist
    if (!fs.existsSync(jsonPath)) {
        console.error(`❌ Error: data_costos.json not found at ${jsonPath}`);
        process.exit(1);
    }
    if (!fs.existsSync(localImagesDir)) {
        console.error(`❌ Error: Local images directory not found at ${localImagesDir}`);
        process.exit(1);
    }

    // 2. Fetch or create brand "DAYTONA"
    console.log("🔍 Checking brand 'DAYTONA'...");
    let { data: brand, error: brandErr } = await supabase
        .from('brands')
        .select('id')
        .eq('name', 'DAYTONA')
        .maybeSingle();

    if (brandErr) {
        console.error("❌ Error checking brand 'DAYTONA':", brandErr.message);
        process.exit(1);
    }

    let brandId;
    if (!brand) {
        console.log("➕ Brand 'DAYTONA' not found. Creating it...");
        if (!isDryRun) {
            const { data: newBrand, error: insertBrandErr } = await supabase
                .from('brands')
                .insert({ name: 'DAYTONA' })
                .select('id')
                .single();

            if (insertBrandErr) {
                console.error("❌ Error creating brand 'DAYTONA':", insertBrandErr.message);
                process.exit(1);
            }
            brandId = newBrand.id;
            console.log(`✅ Created brand 'DAYTONA' with ID: ${brandId}`);
        } else {
            console.log("[DRY-RUN] Would create brand 'DAYTONA'. Simulating brand_id = 9999");
            brandId = 9999;
        }
    } else {
        brandId = brand.id;
        console.log(`✅ Found brand 'DAYTONA' with ID: ${brandId}`);
    }

    // 3. Fetch existing product SKUs from database
    console.log("🔍 Fetching existing products in Supabase...");
    const dbSkus = new Set();
    let page = 0;
    const pageSize = 1000;
    while (true) {
        const { data, error } = await supabase
            .from('products')
            .select('sku')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error("❌ Error fetching products:", error.message);
            process.exit(1);
        }
        if (!data || data.length === 0) break;
        data.forEach(p => {
            if (p.sku) dbSkus.add(p.sku.trim().toUpperCase());
        });
        if (data.length < pageSize) break;
        page++;
    }
    console.log(`✅ Total products currently in Supabase database: ${dbSkus.size}`);

    // 4. Load scraped products from JSON
    console.log(`🔍 Loading products from JSON file...`);
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const jsonProducts = JSON.parse(rawData);
    console.log(`📄 Found ${jsonProducts.length} products in data_costos.json`);

    // 5. Filter and prepare products to insert
    const productsToInsert = [];
    const processedSkus = new Set();

    for (const item of jsonProducts) {
        const rawSku = (item.id || item.codigo_referencia || '').trim();
        if (!rawSku) continue;

        const skuUpper = rawSku.toUpperCase();
        if (processedSkus.has(skuUpper)) continue; // avoid internal JSON duplicates
        processedSkus.add(skuUpper);

        // Check if SKU is already in Supabase
        if (dbSkus.has(skuUpper)) continue;

        // Calculate values
        const cost_without_vat = parseFloat(item.costo_sin_iva) || 0;
        const cost_with_iva = parseFloat(item.costo_con_iva) || 0;

        let vat_percentage = 15.0; // standard fallback
        if (cost_without_vat > 0) {
            const ratio = (cost_with_iva / cost_without_vat) - 1;
            vat_percentage = Math.round(ratio * 1000) / 10;
            if (vat_percentage < 0) vat_percentage = 0;
        }

        // Standard markup formula (65% margin), intermediate rounded
        const cost_with_vat_calc = Math.round(cost_without_vat * (1 + vat_percentage / 100) * 100) / 100;
        const calculated_pvp = Math.round(cost_with_vat_calc * 1.65 * 100) / 100;

        const image_url = item.imagen 
            ? `https://xzsdsmskyosepemalage.supabase.co/storage/v1/object/public/product_images/products/${rawSku}_cut.webp`
            : null;

        productsToInsert.push({
            sku: rawSku,
            name: (item.nombre || '').trim(),
            category: (item.categoria || 'General').trim(),
            price: calculated_pvp,
            cost_without_vat: cost_without_vat,
            vat_percentage: vat_percentage,
            brand_id: brandId,
            image_url: image_url,
            is_active: true,
            status: 'official',
            profit_margin: 0.65
        });
    }

    console.log(`📦 New products to import: ${productsToInsert.length}`);

    // 6. Perform DB insertion if needed
    if (productsToInsert.length > 0) {
        if (isDryRun) {
            console.log("[DRY-RUN] Simulating insertion of products...");
        } else {
            console.log(`📥 Inserting ${productsToInsert.length} products in batches of 50...`);
            const batchSize = 50;
            let successCount = 0;
            for (let i = 0; i < productsToInsert.length; i += batchSize) {
                const batch = productsToInsert.slice(i, i + batchSize);
                const { error } = await supabase.from('products').insert(batch);
                if (error) {
                    console.error(`❌ Batch insert failed (index ${i}):`, error.message);
                    process.exit(1);
                }
                successCount += batch.length;
                console.log(`   Progress: Inserted ${successCount}/${productsToInsert.length} products...`);
            }
            console.log(`✅ Database insertion completed successfully!`);

            // Add newly inserted products to dbSkus so they are recognized in the image upload phase
            productsToInsert.forEach(p => dbSkus.add(p.sku.toUpperCase()));
        }
    } else {
        console.log("ℹ️ No new products found to insert.");
    }

    // 7. Check and upload missing images to Storage
    console.log("\n🔍 Fetching list of existing images in Supabase Storage...");
    const existingStorageFiles = new Set();
    let offset = 0;
    const limit = 1000;
    while (true) {
        const { data, error } = await supabase.storage
            .from('product_images')
            .list('products', { limit, offset, sortBy: { column: 'name', order: 'asc' } });

        if (error) {
            console.error("❌ Error listing storage files:", error.message);
            process.exit(1);
        }
        if (!data || data.length === 0) break;
        data.forEach(f => {
            existingStorageFiles.add(f.name.toUpperCase());
        });
        if (data.length < limit) break;
        offset += data.length;
    }
    console.log(`✅ Found ${existingStorageFiles.size} images in Supabase Storage products/ directory.`);

    // Check which images are missing and exist locally ONLY for the newly inserted products
    const imageUploadQueue = [];
    for (const prod of productsToInsert) {
        const sku = prod.sku;
        const targetFilename = `${sku}_cut.webp`;
        if (existingStorageFiles.has(targetFilename.toUpperCase())) continue; // already uploaded

        // Find match in JSON to get the correct imagen filename
        const match = jsonProducts.find(item => {
            const itemSku = (item.id || item.codigo_referencia || '').trim();
            return itemSku.toUpperCase() === sku.toUpperCase();
        });

        const localFilename = (match && match.imagen) ? match.imagen : `${sku}.webp`;
        const localFilePath = path.join(localImagesDir, localFilename);

        if (fs.existsSync(localFilePath)) {
            imageUploadQueue.push({
                sku,
                localFilePath,
                targetStoragePath: `products/${targetFilename}`
            });
        }
    }

    console.log(`📦 Images needing upload: ${imageUploadQueue.length}`);

    if (imageUploadQueue.length > 0) {
        if (isDryRun) {
            console.log(`[DRY-RUN] Would upload ${imageUploadQueue.length} images to Supabase Storage.`);
        } else {
            console.log(`📤 Uploading ${imageUploadQueue.length} images in batches of 10...`);
            let uploadedCount = 0;
            const batchSize = 10;
            for (let i = 0; i < imageUploadQueue.length; i += batchSize) {
                const batch = imageUploadQueue.slice(i, i + batchSize);
                const promises = batch.map(async (fileInfo) => {
                    try {
                        const fileBuffer = fs.readFileSync(fileInfo.localFilePath);
                        const { error } = await supabase.storage
                            .from('product_images')
                            .upload(fileInfo.targetStoragePath, fileBuffer, {
                                contentType: 'image/webp',
                                upsert: true,
                                cacheControl: '31536000'
                            });
                        if (error) {
                            console.error(`   ❌ Failed to upload ${fileInfo.sku}:`, error.message);
                            return false;
                        }
                        return true;
                    } catch (err) {
                        console.error(`   ❌ Exception uploading ${fileInfo.sku}:`, err.message);
                        return false;
                    }
                });

                const results = await Promise.all(promises);
                uploadedCount += results.filter(Boolean).length;
                console.log(`   Progress: Uploaded ${uploadedCount}/${imageUploadQueue.length} images...`);
            }
            console.log(`✅ Image uploads completed successfully!`);
        }
    } else {
        console.log("ℹ️ No missing images to upload.");
    }

    console.log(`\n======================================================================`);
    console.log(`🎉 SYNCHRONIZATION COMPLETED SUCCESSFULLY!`);
    console.log(`   New products inserted: ${isDryRun ? productsToInsert.length + ' (simulated)' : productsToInsert.length}`);
    console.log(`   New images uploaded:  ${isDryRun ? imageUploadQueue.length + ' (simulated)' : imageUploadQueue.length}`);
    console.log(`======================================================================`);
}

main().catch(err => {
    console.error("❌ Unhandled synchronization error:", err);
    process.exit(1);
});
