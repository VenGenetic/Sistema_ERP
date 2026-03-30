import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') }); 

// Using the service role key from the environment or previous scripts
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6c2RzbXNreW9zZXBlbWFsYWdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMzMTk4MywiZXhwIjoyMDg2OTA3OTgzfQ.XY-OoGMVyhCcJIbb2sq7VSGL1NnEzZszjs8a6BswizE";
const supabase = createClient(process.env.VITE_SUPABASE_URL, SERVICE_ROLE_KEY);

async function exportInventory() {
    console.log("🚀 Iniciando exportación de inventario para Guayaquil...");

    // 1. Obtener ID de la bodega "Guayaquil"
    const { data: warehouse, error: whErr } = await supabase
        .from('warehouses')
        .select('id')
        .eq('name', 'Guayaquil')
        .maybeSingle();

    if (whErr || !warehouse) {
        console.error("❌ Error: No se encontró la bodega 'Guayaquil'.", whErr);
        return;
    }

    const guayaquilId = warehouse.id;
    console.log(`✅ ID de Bodega Guayaquil: ${guayaquilId}`);

    // 2. Obtener niveles de inventario con stock > 0
    console.log("📦 Obteniendo productos con stock disponible...");
    const { data: inventory, error: invErr } = await supabase
        .from('inventory_levels')
        .select(`
            product_id,
            current_stock,
            products (
                sku,
                name,
                price,
                category,
                reference_image_url,
                brands (
                    name
                )
            )
        `)
        .eq('warehouse_id', guayaquilId)
        .gt('current_stock', 0);

    if (invErr) {
        console.error("❌ Error obteniendo inventario:", invErr);
        return;
    }

    if (!inventory || inventory.length === 0) {
        console.warn("⚠️ No se encontraron productos con stock en Guayaquil.");
        // We'll still save an empty array if that's the case
    }

    // 3. Formatear los datos
    const formattedData = inventory.map(item => {
        const prod = item.products;
        return {
            id: prod.sku,
            codigo_referencia: prod.sku,
            nombre: prod.name,
            marca: prod.brands ? prod.brands.name : "N/A",
            precio: Math.ceil(prod.price || 0),
            categoria: prod.category || "General",
            imagen: prod.reference_image_url || "sin_imagen.jpg",
            stock: item.current_stock > 0
        };
    });

    // 4. Guardar a JSON
    const output = {
        "RAW_SCRAPED_DATA": formattedData
    };

    const outputPath = path.join(__dirname, '..', 'inventario desorganizado', 'data_guayaquil.json');
    writeFileSync(outputPath, JSON.stringify(output, null, 4), 'utf-8');

    console.log(`✅ Exportación completa: ${formattedData.length} productos guardados en ${outputPath}`);
}

exportInventory();
