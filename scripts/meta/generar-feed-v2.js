/**
 * Feed de catalogo para Meta (Advantage+ Catalog Ads) -- version 2.
 *
 * Reemplaza a scripts/generate-meta-feed.js. Diferencias que importan para
 * que el anuncio traiga COMPRADORES y no curiosos:
 *
 *  1. product_type real. El feed viejo mandaba "General" o vacio en 955 de 993
 *     filas. Meta usa product_type para armar los sets de productos y para
 *     entender a quien mostrarle que. Sin eso, Advantage+ reparte al azar.
 *  2. custom_label_0..4 con rango de ticket, margen, modelo de moto, cilindraje
 *     y rotacion. Son los ejes sobre los que se pueden crear conjuntos de
 *     anuncios distintos y pujar mas por lo caro y rentable.
 *  3. Titulo reescrito como lo busca el cliente ("Tanque de gasolina Daytona
 *     Tekken Evo 250cc") en vez del nombre interno de bodega en mayusculas.
 *  4. Solo entra lo que se puede vender YA: con stock, con precio, con imagen
 *     real y con precio >= MIN_PRECIO. Un anuncio de una pieza de $3 paga el
 *     mismo click que uno de $280 y deja $1 de margen.
 *
 * Uso:
 *   node scripts/meta/generar-feed-v2.js                 # bodega Guayaquil
 *   node scripts/meta/generar-feed-v2.js "Bodega Principal"
 *   node scripts/meta/generar-feed-v2.js Guayaquil --min-precio=0   # incluir todo
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tipoPieza, modelos, cilindraje, rangoTicket, rangoMargen } from './clasificador.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const args = process.argv.slice(2);
const WAREHOUSE_NAME = args.find((a) => !a.startsWith('--')) || 'Guayaquil';
const minArg = args.find((a) => a.startsWith('--min-precio='));
// $12: por debajo de eso el margen (34% promedio) no cubre ni un click de $0.40
// con una tasa de cierre razonable. Se puede bajar con --min-precio=0.
const MIN_PRECIO = minArg ? Number(minArg.split('=')[1]) : 12;

const SITE = 'https://www.lvparts.ec';
const OUT = path.join(__dirname, '..', '..', 'feeds', 'meta-catalogo-v2.csv');

const COLUMNAS = [
  'id', 'title', 'description', 'availability', 'condition', 'price', 'link',
  'image_link', 'brand', 'quantity_to_sell_on_facebook', 'product_type',
  'google_product_category', 'custom_label_0', 'custom_label_1',
  'custom_label_2', 'custom_label_3', 'custom_label_4',
];

// Taxonomia de Google que Meta tambien entiende. 3403 = Vehicles & Parts >
// Vehicle Parts & Accessories > Motor Vehicle Parts. Ayuda al matching de audiencia.
const GOOGLE_CAT = '3403';

function csv(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function primeraImagenGaleria(gallery) {
  if (!Array.isArray(gallery)) return null;
  return gallery.find((i) => i && i.type !== 'video' && i.url)?.url || null;
}

/**
 * El nombre en bodega viene en mayusculas, con abreviaturas y el color pegado al
 * final ("PLACA TANQUE (I-D) TEKKEN EVO/AXXO TRACKER 250CC N-VERDE"). En un anuncio
 * eso se lee como un codigo de almacen. Aqui se arma un titulo en el idioma del
 * cliente: <pieza> <marca> <modelo> <cc>.
 */
function titulo(nombre, marca, mods, cc) {
  const pieza = tipoPieza(nombre).split(' > ').pop();
  const partes = [pieza];
  if (marca && marca !== 'LV Parts') partes.push(marca);
  if (mods.length) partes.push(mods.slice(0, 2).join(' / '));
  if (cc) partes.push(`${cc}cc`);
  const t = partes.join(' ');
  // Si el titulo derivado queda demasiado pobre, se cae al nombre original.
  return (t.length < 12 ? nombre : t).slice(0, 150);
}

function descripcion(nombre, mods, cc, precio, stock) {
  const l = [];
  l.push(nombre.replace(/\s+/g, ' ').trim() + '.');
  if (mods.length) l.push(`Compatible con: ${mods.join(', ')}${cc ? ` ${cc}cc` : ''}.`);
  l.push('Repuesto original Daytona, nuevo, con garantia.');
  l.push(stock > 0 ? 'Disponible hoy en nuestra tienda de Guayaquil.' : 'Bajo pedido.');
  l.push(`Precio $${precio.toFixed(2)}. Envios a todo el Ecuador.`);
  return l.join(' ').slice(0, 5000);
}

async function main() {
  console.log(`Generando feed v2 desde la bodega "${WAREHOUSE_NAME}" (precio minimo $${MIN_PRECIO})...`);

  const { data: warehouse } = await supabase
    .from('warehouses').select('id').eq('name', WAREHOUSE_NAME).maybeSingle();
  if (!warehouse) {
    const { data: all } = await supabase.from('warehouses').select('name');
    console.error(`No existe la bodega "${WAREHOUSE_NAME}". Hay: ${(all || []).map((w) => w.name).join(', ')}`);
    process.exit(1);
  }

  const { data: inventory, error } = await supabase
    .from('inventory_levels')
    .select(`current_stock, products (sku, name, price, cost_without_vat, category,
             image_url, gallery, is_discontinued, brands ( name ))`)
    .eq('warehouse_id', warehouse.id);
  if (error) { console.error('Error leyendo inventario:', error.message); process.exit(1); }

  const descartes = { descontinuado: 0, sin_precio: 0, sin_stock: 0, precio_bajo: 0, sin_imagen: 0 };
  const filas = [];

  for (const item of inventory || []) {
    const p = item.products;
    if (!p) continue;
    if (p.is_discontinued) { descartes.descontinuado++; continue; }

    const precio = Number(p.price);
    if (!precio || precio <= 0) { descartes.sin_precio++; continue; }
    if (precio < MIN_PRECIO) { descartes.precio_bajo++; continue; }

    const stock = Math.max(0, Math.floor(item.current_stock || 0));
    if (stock <= 0) { descartes.sin_stock++; continue; }

    const imagen = p.image_url || primeraImagenGaleria(p.gallery);
    // Sin foto no se anuncia. Una tarjeta de catalogo con placeholder quema
    // presupuesto y ademas baja la calidad percibida de toda la cuenta.
    if (!imagen) { descartes.sin_imagen++; continue; }

    const nombre = p.name.trim();
    const marca = p.brands?.name || 'Daytona';
    const mods = modelos(nombre);
    const cc = cilindraje(nombre);

    filas.push({
      id: p.sku.trim(),
      title: titulo(nombre, marca, mods, cc),
      description: descripcion(nombre, mods, cc, precio, stock),
      availability: 'in stock',
      condition: 'new',
      price: `${precio.toFixed(2)} USD`,
      link: `${SITE}/catalogo?prod=${encodeURIComponent(p.sku.trim())}`,
      image_link: imagen,
      brand: marca,
      quantity_to_sell_on_facebook: stock,
      product_type: tipoPieza(nombre),
      google_product_category: GOOGLE_CAT,
      custom_label_0: rangoTicket(precio),                       // bajo/medio/alto/premium
      custom_label_1: rangoMargen(precio, Number(p.cost_without_vat)),
      custom_label_2: mods[0] || 'sin_modelo',                   // modelo principal
      custom_label_3: cc ? `${cc}cc` : 'sin_cc',
      custom_label_4: stock >= 5 ? 'stock_amplio' : stock >= 2 ? 'stock_medio' : 'ultima_unidad',
    });
  }

  // El SKU es el id del feed y debe ser unico. Hay productos duplicados en la
  // base con el mismo SKU (uno con espacios al final); se fusionan sumando stock.
  const porSku = new Map();
  let duplicados = 0;
  for (const f of filas) {
    const prev = porSku.get(f.id);
    if (!prev) { porSku.set(f.id, f); continue; }
    duplicados++;
    prev.quantity_to_sell_on_facebook += f.quantity_to_sell_on_facebook;
  }
  const finales = [...porSku.values()];

  const lineas = [COLUMNAS.join(',')];
  for (const f of finales) lineas.push(COLUMNAS.map((c) => csv(f[c])).join(','));
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, lineas.join('\n') + '\n', 'utf-8');

  // Resumen: sirve para decidir la estructura de campañas.
  const porTipo = {}, porTicket = {}, porModelo = {};
  let valor = 0;
  for (const f of finales) {
    porTipo[f.product_type] = (porTipo[f.product_type] || 0) + 1;
    porTicket[f.custom_label_0] = (porTicket[f.custom_label_0] || 0) + 1;
    porModelo[f.custom_label_2] = (porModelo[f.custom_label_2] || 0) + 1;
    valor += parseFloat(f.price) * f.quantity_to_sell_on_facebook;
  }
  const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);

  console.log(`\nFeed generado: ${finales.length} productos anunciables  ->  ${OUT}`);
  console.log(`Valor del catalogo anunciado: $${valor.toFixed(0)}`);
  console.log(`Descartados: ${JSON.stringify(descartes)}${duplicados ? `  (SKUs fusionados: ${duplicados})` : ''}`);
  console.log('\nPor rango de ticket (custom_label_0):');
  for (const [k, v] of top(porTicket, 9)) console.log(`   ${String(v).padStart(4)}  ${k}`);
  console.log('\nTop tipos de pieza (product_type):');
  for (const [k, v] of top(porTipo, 12)) console.log(`   ${String(v).padStart(4)}  ${k}`);
  console.log('\nTop modelos de moto (custom_label_2):');
  for (const [k, v] of top(porModelo, 12)) console.log(`   ${String(v).padStart(4)}  ${k}`);
}

main();
