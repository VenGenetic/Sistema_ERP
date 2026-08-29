import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') }); 

// Using the service role key from the environment or previous scripts
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
    console.error('Falta SUPABASE_SERVICE_ROLE_KEY en .env (Supabase -> Project Settings -> API).');
    process.exit(1);
}
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
                ),
                product_tags (
                    tags (
                        name,
                        color
                    )
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
        
        const tags = [];
        if (prod.product_tags && Array.isArray(prod.product_tags)) {
            for (const pt of prod.product_tags) {
                if (pt.tags) {
                    tags.push({ name: pt.tags.name, color: pt.tags.color });
                }
            }
        }
        
        return {
            id: prod.sku,
            codigo_referencia: prod.sku,
            nombre: prod.name,
            marca: prod.brands ? prod.brands.name : "N/A",
            precio: Math.ceil(prod.price || 0),
            categoria: prod.category || "General",
            imagen: prod.reference_image_url || "sin_imagen.jpg",
            stock: item.current_stock > 0,
            tags: tags
        };
    });

    // 4. Guardar a JSON
    const output = {
        "RAW_SCRAPED_DATA": formattedData
    };

    const outputPath = "C:\\Users\\ASUS\\Documents\\Xsistem\\catalogo-motos-main\\catalogo-motos\\public\\data_guayaquil.json";
    writeFileSync(outputPath, JSON.stringify(output, null, 4), 'utf-8');

    console.log(`✅ Exportación completa: ${formattedData.length} productos guardados en ${outputPath}`);
}

exportInventory();
