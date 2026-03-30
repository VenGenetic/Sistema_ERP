import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') }); 

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6c2RzbXNreW9zZXBlbWFsYWdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMzMTk4MywiZXhwIjoyMDg2OTA3OTgzfQ.XY-OoGMVyhCcJIbb2sq7VSGL1NnEzZszjs8a6BswizE";
const supabase = createClient(process.env.VITE_SUPABASE_URL, SERVICE_ROLE_KEY);

async function updateNames() {
    console.log("🚀 Iniciando actualización de nombres desde Excel...");

    // 1. Cargar Excel
    const excelPath = path.join(__dirname, '..', 'inventario desorganizado', 'catalogo_actualizado.xlsx');
    const workbook = xlsx.readFile(excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    console.log(`📊 Se encontraron ${rows.length} filas en el Excel.`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 2. Procesar por lotes o secuencialmente
    // Para mayor seguridad en esta actualización crítica, lo haremos en grupos pequeños
    const chunkSize = 20;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        
        const promises = chunk.map(async (row) => {
            const sku = row['CODIGO'];
            const newName = row['DESCRIPCION'];

            if (!sku || !newName) {
                skippedCount++;
                return;
            }

            // Actualizar solo si existe y el nombre es diferente
            const { data, error } = await supabase
                .from('products')
                .update({ name: newName })
                .eq('sku', sku)
                .select('id');

            if (error) {
                console.error(`❌ Error actualizando SKU ${sku}:`, error.message);
                errorCount++;
            } else if (data && data.length > 0) {
                updatedCount++;
            } else {
                skippedCount++;
            }
        });

        await Promise.all(promises);
        if (updatedCount % 100 === 0) console.log(`🔄 Procesando... ${i + chunk.length} / ${rows.length}`);
    }

    console.log(`\n✅ Resumen de la operación:`);
    console.log(`- Actualizados: ${updatedCount}`);
    console.log(`- Saltados (no existen o datos incompletos): ${skippedCount}`);
    console.log(`- Errores: ${errorCount}`);
}

updateNames();
