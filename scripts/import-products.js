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
// Hardcoded service_role key to bypass Row Level Security constraints
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6c2RzbXNreW9zZXBlbWFsYWdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMzMTk4MywiZXhwIjoyMDg2OTA3OTgzfQ.XY-OoGMVyhCcJIbb2sq7VSGL1NnEzZszjs8a6BswizE";

if (!supabaseUrl) {
    console.error("Error: VITE_SUPABASE_URL is missing from environment.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Paths
const jsonPath = path.resolve(__dirname, '../../odoo_scraper/data_costos.json');

async function main() {
    const isDryRun = process.argv.includes('--dry-run');
    console.log(`==================================================`);
    console.log(`IMPORT PRODUCTS RUN - Mode: ${isDryRun ? 'SIMULATION (DRY RUN)' : 'REAL INSERTION'}`);
    console.log(`==================================================`);

    // 1. Verify JSON file existence and load it
    if (!fs.existsSync(jsonPath)) {
        console.error(`Error: JSON data file not found at ${jsonPath}`);
        process.exit(1);
    }

    console.log(`Loading JSON data from: ${jsonPath}`);
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const jsonProducts = JSON.parse(rawData);
    console.log(`Total products in JSON file: ${jsonProducts.length}`);

    // 2. Fetch or create brand "DAYTONA"
    console.log("Checking brand 'DAYTONA'...");
    let { data: brand, error: brandErr } = await supabase
        .from('brands')
        .select('id, name')
        .eq('name', 'DAYTONA')
        .maybeSingle();

    if (brandErr) {
        console.error("Error checking brand:", brandErr.message);
        process.exit(1);
    }

    let brandId;
    if (!brand) {
        console.log("Brand 'DAYTONA' not found. Creating it...");
        if (!isDryRun) {
            const { data: newBrand, error: insertBrandErr } = await supabase
                .from('brands')
                .insert({ name: 'DAYTONA' })
                .select('id')
                .single();

            if (insertBrandErr) {
                console.error("Error creating brand 'DAYTONA':", insertBrandErr.message);
                process.exit(1);
            }
            brandId = newBrand.id;
            console.log(`Created brand 'DAYTONA' with ID: ${brandId}`);
        } else {
            console.log("[DRY-RUN] Would create brand 'DAYTONA'. Simulating brand_id = 9999");
            brandId = 9999;
        }
    } else {
        brandId = brand.id;
        console.log(`Found existing brand 'DAYTONA' with ID: ${brandId}`);
    }

    // 3. Fetch all existing product SKUs from Supabase to avoid duplicates
    console.log("Fetching existing products from Supabase (to check for duplicates)...");
    const existingSkusSet = new Set();
    let page = 0;
    const pageSize = 1000;
    while (true) {
        const { data, error } = await supabase
            .from('products')
            .select('sku')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error("Error fetching existing products:", error.message);
            process.exit(1);
        }

        if (!data || data.length === 0) break;
        data.forEach(p => {
            if (p.sku) {
                existingSkusSet.add(p.sku.trim().toUpperCase());
            }
        });

        if (data.length < pageSize) break;
        page++;
    }
    console.log(`Found ${existingSkusSet.size} existing products in Supabase.`);

    // 4. Process and filter JSON products
    const productsToInsert = [];
    const skippedSkus = [];
    const jsonDuplicates = new Set();
    const processedSkus = new Set();

    let discrepanciesCount = 0;

    for (const item of jsonProducts) {
        const rawSku = (item.id || item.codigo_referencia || '').trim();
        if (!rawSku) {
            console.warn("[WARN] Skipping item without reference code/id:", item);
            continue;
        }

        const skuUpper = rawSku.toUpperCase();

        // Check for duplicates inside the JSON itself
        if (processedSkus.has(skuUpper)) {
            jsonDuplicates.add(skuUpper);
            continue;
        }
        processedSkus.add(skuUpper);

        // Check if product already exists in database
        if (existingSkusSet.has(skuUpper)) {
            skippedSkus.push(rawSku);
            continue;
        }

        // Parse metrics
        const cost_without_vat = parseFloat(item.costo_sin_iva) || 0;
        const cost_with_iva = parseFloat(item.costo_con_iva) || 0;
        const json_pvp = parseFloat(item.pvp) || 0;

        // Calculate VAT percentage
        let vat_percentage = 15.0; // default fallback
        if (cost_without_vat > 0) {
            const ratio = (cost_with_iva / cost_without_vat) - 1;
            // Rounded to 1 decimal place (e.g. 15.0, 12.0)
            vat_percentage = Math.round(ratio * 1000) / 10;
            if (vat_percentage < 0) vat_percentage = 0;
        }

        // Calculate PVP using standard system markup formula (65% profit margin)
        // Formula: cost_with_vat * 1.65
        const cost_with_vat_calc = Math.round(cost_without_vat * (1 + vat_percentage / 100) * 100) / 100;
        const calculated_pvp = Math.round(cost_with_vat_calc * 1.65 * 100) / 100;

        // Discrepancy checks (alerting if difference is notable)
        const diff = Math.abs(calculated_pvp - json_pvp);
        if (diff > 0.05) {
            discrepanciesCount++;
            if (discrepanciesCount <= 10) {
                console.log(`[DISCREPANCY] SKU ${rawSku}: System calculated PVP = ${calculated_pvp}, JSON PVP = ${json_pvp} (Diff: ${diff.toFixed(2)})`);
            }
        }

        // Image URL mapping
        const image_url = item.imagen 
            ? `https://xzsdsmskyosepemalage.supabase.co/storage/v1/object/public/product_images/products/${rawSku}_cut.webp` 
            : null;

        // Prepare database row
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

    console.log(`\nProcessed ${processedSkus.size} unique products from JSON.`);
    console.log(`Skipped (already in DB): ${skippedSkus.length}`);
    console.log(`Duplicates in JSON file: ${jsonDuplicates.size}`);
    console.log(`Discrepancies in PVP (> $0.05): ${discrepanciesCount}`);
    console.log(`Products to import: ${productsToInsert.length}`);

    if (discrepanciesCount > 10) {
        console.log(`... and ${discrepanciesCount - 10} more discrepancies logged.`);
    }

    if (productsToInsert.length === 0) {
        console.log("\nNo new products to import. Process finished.");
        return;
    }

    if (isDryRun) {
        console.log("\n--- SIMULATION SAMPLE (First 5 products) ---");
        console.log(JSON.stringify(productsToInsert.slice(0, 5), null, 2));
        console.log("------------------------------------------");
        console.log(`Dry run completed. ${productsToInsert.length} products would be inserted.`);
        return;
    }

    // 5. Real batch insert (50 records at a time)
    console.log(`\nStarting real insertion of ${productsToInsert.length} products in batches of 50...`);
    const batchSize = 50;
    let successCount = 0;

    for (let i = 0; i < productsToInsert.length; i += batchSize) {
        const batch = productsToInsert.slice(i, i + batchSize);
        
        const { error } = await supabase
            .from('products')
            .insert(batch);

        if (error) {
            console.error(`[ERROR] Batch insert failed (index ${i} to ${i + batch.length - 1}):`, error.message);
            console.error(JSON.stringify(error, null, 2));
            process.exit(1);
        }

        successCount += batch.length;
        console.log(`Inserted ${successCount}/${productsToInsert.length} products...`);
    }

    console.log(`\n==================================================`);
    console.log(`IMPORT COMPLETED SUCCESSFULLY!`);
    console.log(`Inserted products: ${successCount}`);
    console.log(`==================================================`);
}

main().catch(error => {
    console.error("Unhandled script error:", error);
    process.exit(1);
});
