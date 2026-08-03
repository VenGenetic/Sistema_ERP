import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Bodega que abastece el catálogo público / WhatsApp (misma que usa export_guayaquil_json.js)
const WAREHOUSE_NAME = process.argv[2] || 'Guayaquil';
const SITE_BASE_URL = 'https://www.lvparts.ec';
const PLACEHOLDER_IMAGE = `${SITE_BASE_URL}/sin_imagen.webp`;
const OUTPUT_PATH = path.join(__dirname, '..', 'feeds', 'meta-inventory-feed.csv');

const FEED_COLUMNS = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'link',
  'image_link',
  'brand',
  'quantity_to_sell_on_facebook',
  'product_type',
];

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function firstGalleryImage(gallery) {
  if (Array.isArray(gallery)) {
    const img = gallery.find((item) => item && item.type !== 'video' && item.url);
    return img?.url || null;
  }
  return null;
}

async function main() {
  console.log(`🚀 Generando feed de Meta a partir de la bodega "${WAREHOUSE_NAME}"...`);

  const { data: warehouse, error: whErr } = await supabase
    .from('warehouses')
    .select('id')
    .eq('name', WAREHOUSE_NAME)
    .maybeSingle();

  if (whErr || !warehouse) {
    const { data: all } = await supabase.from('warehouses').select('name');
    console.error(`❌ No se encontró la bodega "${WAREHOUSE_NAME}".`);
    console.error('   Bodegas disponibles:', (all || []).map((w) => w.name).join(', '));
    console.error('   Uso: node scripts/generate-meta-feed.js "Nombre de Bodega"');
    process.exit(1);
  }

  const { data: inventory, error: invErr } = await supabase
    .from('inventory_levels')
    .select(`
      current_stock,
      products (
        sku,
        name,
        price,
        category,
        image_url,
        gallery,
        is_discontinued,
        brands ( name )
      )
    `)
    .eq('warehouse_id', warehouse.id);

  if (invErr) {
    console.error('❌ Error obteniendo inventario:', invErr);
    process.exit(1);
  }

  let missingImageCount = 0;
  let skippedNoPriceCount = 0;
  let skippedDiscontinuedCount = 0;

  const rows = [];

  for (const item of inventory || []) {
    const prod = item.products;
    if (!prod) continue;

    if (prod.is_discontinued) {
      skippedDiscontinuedCount++;
      continue;
    }

    const price = Number(prod.price);
    if (!price || price <= 0) {
      skippedNoPriceCount++;
      continue;
    }

    const stock = Math.max(0, Math.floor(item.current_stock || 0));
    const brandName = prod.brands?.name || 'LV Parts';
    const image = prod.image_url || firstGalleryImage(prod.gallery);
    if (!image) missingImageCount++;

    const sku = prod.sku.trim();
    const name = prod.name.trim();

    const descriptionParts = [name];
    if (brandName) descriptionParts.push(`Marca: ${brandName}`);
    if (prod.category) descriptionParts.push(`Categoría: ${prod.category}`);
    descriptionParts.push('Repuesto disponible en LV Parts Ecuador.');

    rows.push({
      id: sku,
      title: name.slice(0, 150),
      description: descriptionParts.join('. ').slice(0, 5000),
      availability: stock > 0 ? 'in stock' : 'out of stock',
      condition: 'new',
      price: `${price.toFixed(2)} USD`,
      link: `${SITE_BASE_URL}/catalogo?prod=${encodeURIComponent(sku)}`,
      image_link: image || PLACEHOLDER_IMAGE,
      brand: brandName,
      quantity_to_sell_on_facebook: stock,
      product_type: prod.category || '',
    });
  }

  // El SKU es el id del feed y debe ser único. Algunos productos existen dos veces en la
  // base con el mismo SKU (uno con espacios extra al final) — se fusionan sumando el stock.
  const bySku = new Map();
  const duplicateSkus = new Set();
  for (const row of rows) {
    const existing = bySku.get(row.id);
    if (!existing) {
      bySku.set(row.id, row);
      continue;
    }
    duplicateSkus.add(row.id);
    existing.quantity_to_sell_on_facebook += row.quantity_to_sell_on_facebook;
    existing.availability = existing.quantity_to_sell_on_facebook > 0 ? 'in stock' : 'out of stock';
    if (existing.image_link === PLACEHOLDER_IMAGE && row.image_link !== PLACEHOLDER_IMAGE) {
      existing.image_link = row.image_link;
    }
  }
  const dedupedRows = Array.from(bySku.values());

  const lines = [FEED_COLUMNS.join(',')];
  for (const row of dedupedRows) {
    lines.push(FEED_COLUMNS.map((col) => csvEscape(row[col])).join(','));
  }

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, lines.join('\n') + '\n', 'utf-8');

  console.log(`✅ Feed generado: ${dedupedRows.length} productos`);
  console.log(`   ⚠️  Sin imagen (se usó placeholder): ${missingImageCount}`);
  console.log(`   ⏭️  Omitidos por no tener precio: ${skippedNoPriceCount}`);
  console.log(`   ⏭️  Omitidos por estar descontinuados: ${skippedDiscontinuedCount}`);
  if (duplicateSkus.size > 0) {
    console.log(`   🔁 SKUs duplicados en la base (fusionados, stock sumado): ${duplicateSkus.size}`);
    console.log(`      ${Array.from(duplicateSkus).join(', ')}`);
    console.log('      Recomendado: revisar y limpiar estos SKUs duplicados en Products.');
  }
  console.log(`   📄 Archivo: ${OUTPUT_PATH}`);
}

main();
