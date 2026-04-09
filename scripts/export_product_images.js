import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../.env');

// 1. Cargar credenciales del .env
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
const key = envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'] || envVars['VITE_SUPABASE_ANON_KEY'];

if (!url || !key) {
    console.error('❌ Error: Falta VITE_SUPABASE_URL o Key en el archivo .env');
    process.exit(1);
}

const supabase = createClient(url, key);
const exportDir = path.join(__dirname, '../exported_images');

// 2. Parsear link_images.sql para construir el mapa: {fileName -> sku}
//    Cada línea tiene el patrón:
//    UPDATE products SET image_url = '...products/FILENAME.webp' WHERE sku = 'SKU';
function buildSkuMap() {
    const sqlPath = path.join(__dirname, '../link_images.sql');
    if (!fs.existsSync(sqlPath)) {
        console.warn('⚠️  No se encontró link_images.sql - se usará el nombre de archivo como código.');
        return {};
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    const map = {};

    // Regex: captura el nombre del archivo y el SKU de cada UPDATE
    const regex = /\/products\/(.+?)'.*?WHERE sku = '(.+?)'/g;
    let match;
    while ((match = regex.exec(sqlContent)) !== null) {
        const fileName = match[1]; // ej: "CB200WF-001N_cut.webp"
        const sku = match[2];      // ej: "CB200WF-001N"
        map[fileName] = sku;
    }

    return map;
}

async function downloadImage(storagePath, sku) {
    try {
        const { data, error } = await supabase.storage
            .from('product_images')
            .download(storagePath);

        if (error) throw error;

        const buffer = await data.arrayBuffer();
        const fileName = `${sku}.webp`;
        const filePath = path.join(exportDir, fileName);

        fs.writeFileSync(filePath, Buffer.from(buffer));
        return true;
    } catch (error) {
        console.error(`\n  [!] Error al descargar ${sku}: ${error.message}`);
        return false;
    }
}

async function getAllFiles() {
    const allFiles = [];
    let offset = 0;
    const limit = 1000;

    while (true) {
        const { data: files, error } = await supabase.storage
            .from('product_images')
            .list('products', { limit, offset });

        if (error) throw error;
        if (!files || files.length === 0) break;

        allFiles.push(...files);
        if (files.length < limit) break;
        offset += limit;
    }

    return allFiles;
}

async function main() {
    console.log('🚀 Iniciando exportación de imágenes con códigos correctos...\n');

    // Crear carpeta si no existe
    if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
    }
    console.log(`📂 Carpeta de destino: ${exportDir}`);

    // Construir mapa SKU desde link_images.sql
    console.log('🗺️  Construyendo mapa de códigos desde link_images.sql...');
    const skuMap = buildSkuMap();
    console.log(`   → ${Object.keys(skuMap).length} vínculos archivo↔código encontrados.\n`);

    // Obtener todos los archivos del Storage
    console.log('🔍 Listando archivos en el bucket "product_images"...');
    let allFiles;
    try {
        allFiles = await getAllFiles();
    } catch (e) {
        console.error('❌ Error al listar archivos del storage:', e.message);
        return;
    }

    // Filtrar placeholder
    const files = allFiles.filter(f => f.name !== '.emptyFolderPlaceholder');
    console.log(`📦 Encontrados ${files.length} archivos en el storage.\n`);

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const storagePath = `products/${file.name}`;

        // Determinar el código (SKU) correcto:
        // Primero busca en el mapa del SQL; si no está, limpia el nombre del archivo
        let sku;
        if (skuMap[file.name]) {
            sku = skuMap[file.name]; // ✅ Código real del repuesto
        } else {
            // Fallback: limpiar el nombre del archivo (para archivos con nombre de timestamp)
            // Como no podemos saber el SKU real, los marcamos con prefijo "sin_codigo_"
            sku = `sin_codigo_${file.name.replace(/\.[^.]+$/, '').replace('.', '_')}`;
        }

        process.stdout.write(`⏳ [${i + 1}/${files.length}] ${sku}.webp... `);

        const success = await downloadImage(storagePath, sku);
        if (success) {
            successCount++;
            process.stdout.write('✅\n');
        } else {
            failCount++;
        }
    }

    // Estadísticas finales
    const withRealCode = files.filter(f => skuMap[f.name]).length;
    const withFallback = files.length - withRealCode;

    console.log('\n════════════════════════════════');
    console.log('        RESUMEN DE EXPORTACIÓN        ');
    console.log('════════════════════════════════');
    console.log(`✅ Exitosas:                  ${successCount}`);
    console.log(`❌ Fallidas:                  ${failCount}`);
    console.log(`🏷️  Con código real (del SQL):  ${withRealCode}`);
    console.log(`⚠️  Sin código (timestamp):     ${withFallback}`);
    console.log(`📂 Guardadas en:              ${exportDir}`);
    console.log('════════════════════════════════\n');

    if (withFallback > 0) {
        console.log(`ℹ️  Los archivos con prefijo "sin_codigo_" son imágenes subidas`);
        console.log(`   manualmente que no tienen un SKU registrado en link_images.sql.`);
    }
}

main().catch(error => {
    console.error('❌ Error crítico:', error);
});
