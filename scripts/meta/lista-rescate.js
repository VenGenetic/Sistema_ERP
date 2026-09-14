/**
 * Lista de rescate: clientes que pidieron una pieza que no habia y que HOY ya esta
 * en stock.
 *
 * Es la venta mas barata que tiene el negocio ahora mismo y no cuesta publicidad.
 * En `product_demands` hay 804 registros de 633 personas distintas que se tomaron el
 * trabajo de decir exactamente que pieza querian y dejar su numero. 204 de esas
 * demandas ya expiraron sin que nadie volviera a hablarles, y 293 siguen pendientes.
 * A precio de venta suman $47.176.
 *
 * El ERP ya notifica cuando entra stock (status -> notified), pero solo mira hacia
 * adelante: las demandas que expiraron antes de que llegara la pieza se quedan ahi.
 * Este script rehace el cruce completo contra el inventario actual y saca la lista
 * de a quien llamar, ordenada por lo que vale la llamada.
 *
 * NO envia nada ni toca la base: imprime y escribe un CSV para trabajarlo a mano
 * desde la bandeja de WhatsApp del ERP.
 *
 * Uso:
 *   node scripts/meta/lista-rescate.js                # todo lo recuperable
 *   node scripts/meta/lista-rescate.js --min=50       # solo piezas de $50 en adelante
 *   node scripts/meta/lista-rescate.js --bodega="Bodega Principal"
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}
const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const args = process.argv.slice(2);
const MIN = Number(args.find((a) => a.startsWith('--min='))?.split('=')[1] || 0);
const BODEGA = args.find((a) => a.startsWith('--bodega='))?.split('=')[1] || 'Guayaquil';
const OUT = path.join(__dirname, '..', '..', 'feeds', 'lista-rescate.csv');

// Demandas que siguen vivas comercialmente. `notified` ya se le aviso al cliente,
// pero si nunca compro y la pieza sigue ahi, vale un segundo intento -- va aparte.
const RECUPERABLES = ['expired', 'pending_stock', 'stock_available'];

async function todo(tabla, cols, mod = (q) => q) {
  let out = [], from = 0; const size = 1000;
  for (;;) {
    const { data, error } = await mod(supabase.from(tabla).select(cols)).range(from, from + size - 1);
    if (error) { console.error(`${tabla}: ${error.message}`); break; }
    out = out.concat(data);
    if (data.length < size) break;
    from += size;
  }
  return out;
}

const csv = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const dias = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

async function main() {
  const { data: bodega } = await supabase
    .from('warehouses').select('id').eq('name', BODEGA).maybeSingle();
  if (!bodega) { console.error(`No existe la bodega "${BODEGA}".`); process.exit(1); }

  const demandas = await todo('product_demands',
    'id,product_id,phone_number,customer_name,status,created_at,notified_at');
  const productos = await todo('products', 'id,sku,name,price,is_discontinued');
  const inventario = await todo('inventory_levels', 'product_id,current_stock',
    (q) => q.eq('warehouse_id', bodega.id).gt('current_stock', 0));

  const pMap = new Map(productos.map((p) => [p.id, p]));
  const stock = new Map();
  for (const i of inventario) {
    stock.set(i.product_id, (stock.get(i.product_id) || 0) + (i.current_stock || 0));
  }

  const listos = [], yaAvisados = [], sinStock = [];
  for (const d of demandas) {
    const p = pMap.get(d.product_id);
    if (!p || p.is_discontinued) continue;
    const precio = Number(p.price) || 0;
    if (precio < MIN) continue;

    const hay = stock.get(d.product_id) || 0;
    const fila = {
      telefono: d.phone_number,
      cliente: d.customer_name || '',
      sku: p.sku,
      pieza: p.name,
      precio,
      stock: hay,
      estado: d.status,
      dias_esperando: dias(d.created_at),
      demanda_id: d.id,
    };

    if (hay <= 0) { sinStock.push(fila); continue; }
    if (d.status === 'notified' || d.notified_at) yaAvisados.push(fila);
    else if (RECUPERABLES.includes(d.status)) listos.push(fila);
  }

  // Ordenar por lo que vale la llamada: primero lo caro, y a igual precio lo que
  // lleva mas tiempo esperando (ese cliente ya casi seguro compro en otro lado,
  // pero es el que mas rabia da perder).
  const orden = (a, b) => b.precio - a.precio || b.dias_esperando - a.dias_esperando;
  listos.sort(orden);
  yaAvisados.sort(orden);
  sinStock.sort(orden);

  const COLS = ['telefono', 'cliente', 'sku', 'pieza', 'precio', 'stock', 'estado', 'dias_esperando', 'demanda_id'];
  const lineas = ['grupo,' + COLS.join(',')];
  for (const f of listos) lineas.push('LLAMAR_YA,' + COLS.map((c) => csv(f[c])).join(','));
  for (const f of yaAvisados) lineas.push('SEGUNDO_INTENTO,' + COLS.map((c) => csv(f[c])).join(','));
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, lineas.join('\n') + '\n', 'utf-8');

  const suma = (a) => a.reduce((s, f) => s + f.precio, 0);
  const personas = (a) => new Set(a.map((f) => f.telefono)).size;

  console.log(`Cruce de demandas contra el stock actual de "${BODEGA}"${MIN ? ` (piezas desde $${MIN})` : ''}\n`);
  console.log(`LLAMAR YA        ${String(listos.length).padStart(4)} piezas  ${String(personas(listos)).padStart(4)} personas   $${suma(listos).toFixed(0)}`);
  console.log(`  -> pidieron la pieza, nunca se les aviso, y hoy SI hay stock.\n`);
  console.log(`SEGUNDO INTENTO  ${String(yaAvisados.length).padStart(4)} piezas  ${String(personas(yaAvisados)).padStart(4)} personas   $${suma(yaAvisados).toFixed(0)}`);
  console.log(`  -> ya se les aviso alguna vez y la pieza sigue en percha.\n`);
  console.log(`SIN STOCK        ${String(sinStock.length).padStart(4)} piezas  ${String(personas(sinStock)).padStart(4)} personas   $${suma(sinStock).toFixed(0)}`);
  console.log(`  -> demanda real que no se puede atender: esto es la lista de reposicion.\n`);

  if (listos.length) {
    console.log('--- Las 15 llamadas que mas valen ---');
    for (const f of listos.slice(0, 15)) {
      console.log(`  $${String(f.precio.toFixed(2)).padStart(7)}  ${String(f.dias_esperando).padStart(3)}d  ${f.telefono.padEnd(15)} ${f.pieza.slice(0, 58)}`);
    }
  }

  // Que reponer: lo que mas gente pide y no hay.
  const faltantes = {};
  for (const f of sinStock) {
    faltantes[f.sku] = faltantes[f.sku] || { n: 0, precio: f.precio, pieza: f.pieza };
    faltantes[f.sku].n++;
  }
  const top = Object.entries(faltantes).sort((a, b) => b[1].n * b[1].precio - a[1].n * a[1].precio).slice(0, 15);
  if (top.length) {
    console.log('\n--- Que reponer primero (personas esperando x precio) ---');
    for (const [sku, v] of top) {
      console.log(`  ${String(v.n).padStart(2)} pers.  $${String(v.precio.toFixed(2)).padStart(7)}  ${sku.padEnd(18)} ${v.pieza.slice(0, 52)}`);
    }
  }

  console.log(`\nCSV: ${OUT}`);
}

main();
