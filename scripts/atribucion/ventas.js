/**
 * Qué es una venta de LV Parts, y de qué anuncio vino. Una sola definición.
 *
 * POR QUÉ ESTE ARCHIVO
 * --------------------
 * Meta y Google tienen que recibir EXACTAMENTE la misma lista de ventas. Si cada
 * script decide por su cuenta qué cuenta como venta, las dos plataformas
 * optimizan contra números distintos y la reconciliación del reporte semanal deja
 * de significar algo. Peor: el día que cambie una regla de negocio (un estado de
 * orden nuevo, otra forma de normalizar el teléfono) se arregla en un lado y se
 * olvida el otro.
 *
 * Acá vive la definición. `scripts/meta/` y `scripts/google/` la consumen.
 *
 * LO QUE NO HACE
 * --------------
 * No envía nada a ninguna plataforma ni escribe en la base. Sólo lee y normaliza.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

export const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Estados de orden que NO son una venta. Todo lo demás sí lo es.
 *
 * Va en negativo a propósito: si mañana aparece un estado nuevo, lo peor que
 * pasa es que una venta real se reporte, no que se pierda en silencio.
 */
export const ESTADOS_NO_VENTA = new Set(['Borrador', 'Cancelado']);

/** Teléfono ecuatoriano a E.164 sin '+', que es lo que piden las dos plataformas. */
export function e164(tel) {
  if (!tel) return null;
  let d = String(tel).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('0')) d = '593' + d.slice(1);
  else if (d.length === 9 && d.startsWith('9')) d = '593' + d;
  return d.length >= 10 && d.length <= 15 ? d : null;
}

/** Nombre partido y normalizado: sin tildes, sin "WhatsApp - 09...", en minúsculas. */
export function partirNombre(nombre) {
  if (!nombre) return {};
  const limpio = String(nombre).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/whatsapp\s*-?\s*\d*/i, '').replace(/[^a-zA-Z\s]/g, ' ')
    .trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!limpio.length) return {};
  return { fn: limpio[0], ln: limpio.length > 1 ? limpio[limpio.length - 1] : undefined };
}

/**
 * Trae una tabla entera en páginas de 1.000, que es el tope de PostgREST.
 *
 * El `.order('id')` NO es cosmético: sin ORDER BY explícito, PostgREST no
 * garantiza que dos páginas consecutivas vean las filas en el mismo orden.
 * Con `products` (~5.900 filas, siempre pagina) eso significa filas
 * duplicadas o SALTADAS entre página y página -- y una fila saltada acá es
 * un lead reportado en $0, o una venta real contada como "sin teléfono".
 * Es un error que no se ve: el script termina bien y el número sale mal.
 *
 * Y si una página falla se LANZA, no se sigue. Devolver la tabla a medias
 * hacía que cada cliente faltante se contara como "sin teléfono": un hipo
 * de red se convertía en conversiones no reportadas, en silencio.
 */
export async function todo(tabla, cols, mod = (q) => q) {
  let out = [];
  let desde = 0;
  const tam = 1000;
  for (;;) {
    const { data, error } = await mod(supabase.from(tabla).select(cols))
      .order('id', { ascending: true })
      .range(desde, desde + tam - 1);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    out = out.concat(data);
    if (data.length < tam) break;
    desde += tam;
  }
  return out;
}

/**
 * Las ventas del período que se pueden atribuir a alguien.
 *
 * El ERP no guarda el teléfono en la orden: la venta de mostrador va contra
 * "CONSUMIDOR FINAL". Sólo sirven las órdenes cuyo cliente tiene teléfono -- las
 * que nacieron de un chat. Las demás no se pueden atar a ningún clic, y mandarlas
 * sin identificador sólo ensucia la señal.
 *
 * Devuelve además `sinTelefono`, que es una cifra de negocio, no un detalle
 * técnico: cada una de esas ventas es una señal que las plataformas nunca
 * reciben, y se arregla pidiendo el número en el POS.
 */
export async function ventasAtribuibles(desde) {
  const clientes = await todo('customers', 'id,phone,name');
  const porId = new Map(clientes.map((c) => [c.id, c]));

  const ordenes = await todo(
    'orders',
    'id,customer_id,total_amount,status,created_at',
    (q) => q.gte('created_at', desde.toISOString()),
  );

  const ventas = [];
  let sinTelefono = 0;
  let noVenta = 0;

  for (const o of ordenes) {
    if (ESTADOS_NO_VENTA.has(o.status)) { noVenta++; continue; }
    const cliente = porId.get(o.customer_id);
    const tel = e164(cliente?.phone);
    if (!tel) { sinTelefono++; continue; }
    ventas.push({
      id: o.id,
      telefono: tel,
      nombre: cliente?.name || '',
      valor: Number(o.total_amount || 0),
      cuando: o.created_at,
    });
  }

  return { ventas, sinTelefono, noVenta, totalOrdenes: ordenes.length };
}

/**
 * Teléfono -> id del clic de Meta (`ctwa_clid`).
 *
 * Lo captura el agente del primer mensaje de quien viene de un anuncio de clic a
 * WhatsApp (migración 0076 del repo `agente/`). Si la tabla todavía no existe se
 * devuelve un mapa vacío: los eventos salen igual, sólo que emparejando por
 * teléfono, que es como salían antes.
 */
export async function clicsDeMeta() {
  const { data, error } = await supabase
    .from('agent_ad_clicks')
    .select('ctwa_clid, clicked_at, agent_conversations!inner(phone_number)')
    .not('ctwa_clid', 'is', null)
    .order('clicked_at', { ascending: false });

  if (error) {
    console.log(`   (sin atribución de Meta: ${error.message})`);
    return new Map();
  }

  // Si alguien volvió por varios anuncios vale el clic MÁS RECIENTE. La consulta
  // ya viene de nuevo a viejo, así que basta el primero que se ve de cada número.
  const mapa = new Map();
  for (const r of data ?? []) {
    const tel = e164(r.agent_conversations?.phone_number);
    if (tel && !mapa.has(tel)) mapa.set(tel, r.ctwa_clid);
  }
  return mapa;
}

/**
 * Teléfono -> identificadores de clic de Google (`gclid`, `gbraid`, `wbraid`).
 *
 * Vienen del salto lvparts.ec -> WhatsApp: el sitio guarda el clic con un token
 * corto y el agente resuelve ese token contra la conversación (migración 0077).
 * Una fila sólo sirve cuando ya tiene `conversation_id`: hasta entonces el clic
 * existe pero todavía no se sabe de quién es.
 */
export async function clicsDeGoogle() {
  const { data, error } = await supabase
    .from('web_ad_clicks')
    .select('gclid, gbraid, wbraid, created_at, agent_conversations!inner(phone_number)')
    .not('conversation_id', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.log(`   (sin atribución de Google: ${error.message})`);
    console.log('   Aplicar la migración 0077 del repo agente/ y desplegar lvparts.ec.');
    return new Map();
  }

  const mapa = new Map();
  for (const r of data ?? []) {
    const tel = e164(r.agent_conversations?.phone_number);
    if (!tel || mapa.has(tel)) continue;
    // gbraid/wbraid reemplazan al gclid en el tráfico de iOS app->web.
    const id = r.gclid || r.gbraid || r.wbraid;
    if (!id) continue;
    mapa.set(tel, {
      gclid: r.gclid || null,
      gbraid: r.gbraid || null,
      wbraid: r.wbraid || null,
      cuando: r.created_at,
    });
  }
  return mapa;
}

/**
 * Leads calificados: pidieron una pieza concreta y dejaron su número.
 *
 * Es mucho mejor señal que "abrió el chat" y hay bastante más volumen que de
 * compras, así que le da a las plataformas con qué aprender mientras las ventas
 * atribuidas suben. El valor del lead es el precio de la pieza pedida.
 */
export async function leadsCalificados(desde) {
  const demandas = await todo(
    'product_demands',
    'id,product_id,phone_number,customer_name,created_at',
    (q) => q.gte('created_at', desde.toISOString()),
  );
  const productos = await todo('products', 'id,price,name');
  const porId = new Map(productos.map((p) => [p.id, p]));

  const leads = [];
  for (const d of demandas) {
    const tel = e164(d.phone_number);
    if (!tel) continue;
    const p = porId.get(d.product_id);
    leads.push({
      id: d.id,
      telefono: tel,
      nombre: d.customer_name || '',
      valor: Number(p?.price || 0),
      pieza: p?.name || '',
      cuando: d.created_at,
    });
  }
  return leads;
}
