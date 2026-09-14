/**
 * Exporta audiencias para Meta Ads a partir del historial real de WhatsApp y del ERP.
 *
 * POR QUE EXISTE ESTE SCRIPT
 * --------------------------
 * Hoy la cuenta de Meta optimiza a ciegas. La campana es click-to-WhatsApp y el
 * unico evento que Meta ve es "alguien abrio un chat". Meta entonces busca mas
 * gente que abra chats -- y eso es exactamente lo que entrega: 2.070 conversaciones
 * abiertas de las cuales solo el 2,6% mostro alguna señal de compra, contra 6,9%
 * de las conversaciones organicas. El anuncio esta comprando curiosos baratos.
 *
 * Meta no puede corregir eso solo, porque nadie le ha dicho nunca como es un
 * comprador de LV Parts. Estos CSV son esa informacion:
 *
 *   compradores.csv     -> semilla para Lookalike basado en VALOR (1%).
 *                          Lleva columna `value`: Meta pondera y busca gente
 *                          parecida a los que MAS gastaron, no a cualquiera.
 *   alta-intencion.csv  -> pidieron una pieza concreta y cara. Retargeting.
 *   excluir.csv         -> abrieron el chat y no hubo nada. Se excluyen de todos
 *                          los conjuntos para dejar de pagar por el mismo perfil.
 *
 * PRIVACIDAD: los telefonos salen ya hasheados en SHA-256 (formato E.164 sin '+'),
 * que es lo que Meta acepta y recomienda. El archivo que se sube no contiene
 * ningun numero legible. La columna `value` y `country` van en claro porque Meta
 * las necesita asi.
 *
 * Uso:
 *   node scripts/meta/exportar-audiencias.js
 *   node scripts/meta/exportar-audiencias.js --dias=180
 *   node scripts/meta/exportar-audiencias.js --en-claro   # para revisar, NO subir
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { createHash } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const args = process.argv.slice(2);
const DIAS = Number(args.find((a) => a.startsWith('--dias='))?.split('=')[1] || 365);
const EN_CLARO = args.includes('--en-claro');
const OUT_DIR = path.join(__dirname, '..', '..', 'feeds', 'audiencias-meta');
const DESDE = new Date(Date.now() - DIAS * 86400000).toISOString();

// --- Señales de texto -------------------------------------------------------
// Salen de leer las 4.238 conversaciones reales, no de un manual generico.

// Cerro o casi cerro. Lo mas valioso que existe en la base.
const COMPRA = /\b(lo llevo|me lo llev|ya voy|voy (para|a pasar|en camino)|sep[aá]rame|me lo separa|ya (le )?transfer|hice la transferencia|ya deposit|ya pagu|comprobante|le mando el comprobante|factura a nombre|ya lo compr|me lo envi[oó])\b/i;

// Intencion fuerte: esta comprando, todavia no cerro.
const INTENCION = /\b(cu[aá]nto (me )?(cuesta|sale|vale|queda)|qu[eé] precio|me (lo )?reserva|tiene (en )?stock|hay disponible|me hace factura|acepta transferencia|pago con|env[ií]o a|cu[aá]nto el env[ií]o|c[oó]mo hago para comprar|lo necesito|me urge)\b/i;

// Compra por volumen: taller o revendedor. El cliente mas rentable que existe.
const MAYORISTA = /\b(al por mayor|por mayor|mayorista|precio de taller|tengo (un |mi )?taller|soy mec[aá]nico|distribuidor|para rev|varias unidades|docena|cantidad)\b/i;

// Ruido: abrio el chat, pregunto una obviedad y no volvio.
const RUIDO = /^(hola|buenas?|buen(os|as)? (d[ií]as?|tardes?|noches?)|gracias|ok|listo|\.|\?|si|s[ií]|👍|😍|👋)[\s!.,]*$/i;

function e164(tel) {
  if (!tel) return null;
  let d = String(tel).replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  // Ecuador: 0987654321 -> 593987654321 ; 987654321 -> 593987654321
  if (d.length === 10 && d.startsWith('0')) d = '593' + d.slice(1);
  else if (d.length === 9 && d.startsWith('9')) d = '593' + d;
  if (d.length < 10 || d.length > 15) return null;
  return d;
}

const sha256 = (s) => createHash('sha256').update(String(s).trim().toLowerCase()).digest('hex');

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

function escribir(nombre, filas, cabecera) {
  const lineas = [cabecera.join(',')];
  for (const f of filas) lineas.push(cabecera.map((c) => f[c] ?? '').join(','));
  const p = path.join(OUT_DIR, nombre);
  writeFileSync(p, lineas.join('\n') + '\n', 'utf-8');
  return p;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Leyendo historial de los ultimos ${DIAS} dias...\n`);

  const convs = await todo('agent_conversations',
    'id,phone_number,customer_name,is_group,first_message_at,last_inbound_at,etapa',
    (q) => q.gte('last_message_at', DESDE));
  const msgs = await todo('agent_messages', 'conversation_id,direction,body,created_at');
  const demandas = await todo('product_demands', 'product_id,phone_number,status,created_at');
  const productos = await todo('products', 'id,sku,name,price');
  const pedidos = await todo('orders', 'id,customer_id,total_amount,status,created_at');
  const clientes = await todo('customers', 'id,phone,name');

  const pMap = new Map(productos.map((p) => [p.id, p]));
  const porConv = new Map();
  for (const m of msgs) {
    if (!porConv.has(m.conversation_id)) porConv.set(m.conversation_id, []);
    porConv.get(m.conversation_id).push(m);
  }

  // Un mismo telefono puede tener varias conversaciones: se acumula por persona.
  const personas = new Map();
  const persona = (tel) => {
    const k = e164(tel);
    if (!k) return null;
    if (!personas.has(k)) {
      personas.set(k, { tel: k, nombre: '', compra: 0, intencion: 0, mayorista: 0,
                        msgsCliente: 0, valorPedido: 0, valorReal: 0, demandas: 0, ultimo: null });
    }
    return personas.get(k);
  };

  // 1) Señales de la conversacion
  for (const c of convs) {
    if (c.is_group) continue;
    const p = persona(c.phone_number);
    if (!p) continue;
    if (c.customer_name && !p.nombre) p.nombre = c.customer_name;
    if (!p.ultimo || (c.last_inbound_at || '') > p.ultimo) p.ultimo = c.last_inbound_at;

    const entrantes = (porConv.get(c.id) || []).filter((m) => m.direction === 'inbound');
    p.msgsCliente += entrantes.length;
    const texto = entrantes.map((m) => m.body || '').join('\n');
    if (COMPRA.test(texto)) p.compra++;
    if (INTENCION.test(texto)) p.intencion++;
    if (MAYORISTA.test(texto)) p.mayorista++;
  }

  // 2) Demandas registradas: pidieron una pieza CONCRETA que no habia.
  //    Es la señal de intencion mas limpia de toda la base -- alguien se tomo el
  //    trabajo de decir exactamente que queria y dejar su numero esperando.
  for (const d of demandas) {
    const p = persona(d.phone_number);
    if (!p) continue;
    p.demandas++;
    const prod = pMap.get(d.product_id);
    if (prod?.price) p.valorPedido += Number(prod.price);
  }

  // 3) Compra real registrada en el ERP (match por telefono del cliente).
  const clientePorTel = new Map();
  for (const c of clientes) { const k = e164(c.phone); if (k) clientePorTel.set(c.id, k); }
  for (const o of pedidos) {
    if (o.status === 'Borrador' || o.status === 'Cancelado') continue;
    const tel = clientePorTel.get(o.customer_id);
    if (!tel) continue;               // venta de mostrador sin telefono: no sirve aqui
    const p = persona(tel);
    if (p) p.valorReal += Number(o.total_amount || 0);
  }

  // --- Valor por persona ----------------------------------------------------
  // Meta usa `value` para ponderar el Lookalike: cuanto mas alto, mas peso tiene
  // esa persona como modelo. Prioridad: venta real > demanda concreta > señal de
  // texto. El ticket promedio real es $215, asi que ese es el ancla.
  const TICKET = 215;
  for (const p of personas.values()) {
    p.valor = p.valorReal > 0
      ? p.valorReal
      : p.valorPedido > 0
        ? p.valorPedido
        : p.compra > 0 ? TICKET : 0;
    if (p.mayorista > 0) p.valor *= 2;   // un taller recompra todos los meses
    p.valor = Math.round(p.valor * 100) / 100;
  }

  const lista = [...personas.values()];

  // --- Segmentacion ---------------------------------------------------------
  const compradores = lista
    .filter((p) => p.valorReal > 0 || p.compra > 0 || (p.demandas > 0 && p.valorPedido >= 40))
    .sort((a, b) => b.valor - a.valor);

  const yaComprador = new Set(compradores);
  const altaIntencion = lista
    .filter((p) => !yaComprador.has(p) && (p.demandas > 0 || (p.intencion > 0 && p.msgsCliente >= 3)))
    .sort((a, b) => b.valor - a.valor);

  // Excluir: abrio chat, no pidio nada concreto y casi no escribio.
  const excluir = lista.filter((p) =>
    p.compra === 0 && p.intencion === 0 && p.demandas === 0 && p.valorReal === 0 && p.msgsCliente <= 2);

  const mayoristas = lista.filter((p) => p.mayorista > 0).sort((a, b) => b.valor - a.valor);

  const fila = (p) => ({
    phone: EN_CLARO ? p.tel : sha256(p.tel),
    country: EN_CLARO ? 'ec' : sha256('ec'),
    value: p.valor || '',
  });

  const CAB = ['phone', 'country', 'value'];
  const f1 = escribir('compradores.csv', compradores.map(fila), CAB);
  const f2 = escribir('alta-intencion.csv', altaIntencion.map(fila), CAB);
  const f3 = escribir('excluir.csv', excluir.map(fila), ['phone', 'country']);
  const f4 = escribir('mayoristas-talleres.csv', mayoristas.map(fila), CAB);

  const suma = (a) => a.reduce((s, p) => s + p.valor, 0);
  console.log(`Personas unicas con telefono valido: ${lista.length}\n`);
  console.log(`compradores.csv          ${String(compradores.length).padStart(5)}  valor total $${suma(compradores).toFixed(0)}`);
  console.log(`alta-intencion.csv       ${String(altaIntencion.length).padStart(5)}  valor total $${suma(altaIntencion).toFixed(0)}`);
  console.log(`mayoristas-talleres.csv  ${String(mayoristas.length).padStart(5)}  valor total $${suma(mayoristas).toFixed(0)}`);
  console.log(`excluir.csv              ${String(excluir.length).padStart(5)}`);
  console.log(`\nArchivos en: ${OUT_DIR}`);
  if (EN_CLARO) console.log('\n*** OJO: generados EN CLARO para revision. No subir asi a Meta. ***');

  if (compradores.length < 100) {
    console.log(`\nAviso: Meta necesita ~100 coincidencias para crear un Lookalike y`);
    console.log(`funciona mucho mejor con 1.000+. Con ${compradores.length} conviene subir`);
    console.log(`compradores.csv + alta-intencion.csv juntos como una sola audiencia semilla.`);
  }
  console.log(f1 && f2 && f3 && f4 ? '' : '');
}

main();
