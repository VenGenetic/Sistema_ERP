/**
 * Conversions API de Meta: le devuelve a Meta las ventas y los leads calificados
 * que ocurren FUERA de Facebook (en WhatsApp y en el mostrador).
 *
 * EL PROBLEMA QUE RESUELVE
 * ------------------------
 * La campana actual es click-to-WhatsApp. Lo unico que Meta llega a ver es
 * "se abrio una conversacion". Entonces optimiza para eso: busca gente con alta
 * probabilidad de abrir un chat. Gente que abre chats y no compra es abundante y
 * barata, asi que el algoritmo la encuentra en cantidad -- 2.070 conversaciones,
 * 2,6% con señal de compra, contra 6,9% de las que llegan solas.
 *
 * Meta nunca se entera de quien termino comprando, porque la venta ocurre en
 * WhatsApp y se cobra en el POS. Este script cierra ese circuito: manda de vuelta
 * el evento `Purchase` con el valor real y el telefono hasheado. Con eso Meta
 * puede, por fin, optimizar por COMPRA en vez de por conversacion abierta.
 *
 * Es la pieza que mas mueve la aguja de todo el paquete. Las audiencias y el feed
 * ayudan; esto cambia el objetivo mismo de la subasta.
 *
 * CONFIGURACION (.env) -- pedir en Meta Events Manager:
 *   META_PIXEL_ID=           # Events Manager > Origenes de datos > tu pixel > ID
 *   META_CAPI_TOKEN=         # ese mismo pixel > Configuracion > Generar token
 *   META_TEST_EVENT_CODE=    # opcional, para verlos llegar en "Eventos de prueba"
 *
 * Uso:
 *   node scripts/meta/enviar-conversiones.js                 # simulacro, NO envia
 *   node scripts/meta/enviar-conversiones.js --dias=30
 *   node scripts/meta/enviar-conversiones.js --enviar        # envia de verdad
 *   node scripts/meta/enviar-conversiones.js --enviar --test # usa el test_event_code
 *
 * Por defecto NO envia nada: imprime lo que mandaria. Hay que pasar --enviar
 * explicitamente. Los datos personales viajan siempre hasheados en SHA-256, que
 * es lo que Meta exige y lo unico que necesita para hacer el match.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { createHash } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
        META_PIXEL_ID, META_CAPI_TOKEN, META_TEST_EVENT_CODE } = process.env;

if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}
const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const args = process.argv.slice(2);
const ENVIAR = args.includes('--enviar');
const USAR_TEST = args.includes('--test');
const DIAS = Number(args.find((a) => a.startsWith('--dias='))?.split('=')[1] || 7);
const DESDE = new Date(Date.now() - DIAS * 86400000);

const API = 'https://graph.facebook.com/v21.0';

const sha256 = (s) => createHash('sha256').update(String(s).trim().toLowerCase()).digest('hex');

function e164(tel) {
  if (!tel) return null;
  let d = String(tel).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('0')) d = '593' + d.slice(1);
  else if (d.length === 9 && d.startsWith('9')) d = '593' + d;
  return d.length >= 10 && d.length <= 15 ? d : null;
}

// Meta pide el nombre separado y normalizado: sin tildes, minusculas, sin titulos.
function partirNombre(nombre) {
  if (!nombre) return {};
  const limpio = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/whatsapp\s*-?\s*\d*/i, '').replace(/[^a-zA-Z\s]/g, ' ')
    .trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!limpio.length) return {};
  return { fn: limpio[0], ln: limpio.length > 1 ? limpio[limpio.length - 1] : undefined };
}

/**
 * Telefono -> ctwa_clid del anuncio que trajo a esa persona.
 *
 * Es la diferencia entre un match bueno y uno pobre. Sin el id del clic, Meta
 * tiene que emparejar la compra con un telefono hasheado y adivinar a que
 * anuncio atribuirla; con el, sabe exactamente de que clic salio la venta.
 * Los datos los captura el agente de WhatsApp (migracion 0076 del repo
 * `agente/`): si esa tabla todavia no existe, los eventos salen igual, solo
 * que emparejando peor -- que es como salian antes de todo esto.
 */
async function clidPorTelefono() {
  const { data, error } = await supabase
    .from('agent_ad_clicks')
    .select('ctwa_clid, clicked_at, agent_conversations!inner(phone_number)')
    .not('ctwa_clid', 'is', null)
    .order('clicked_at', { ascending: false });

  if (error) {
    console.log(`   (sin atribucion de anuncio: ${error.message})`);
    console.log('   Aplicar la migracion 0076 en el repo agente/ para habilitarla.\n');
    return new Map();
  }

  // Si alguien volvio por varios anuncios, manda el clic MAS RECIENTE anterior
  // a la venta. Como la consulta ya viene ordenada de nuevo a viejo, basta con
  // quedarse con el primero que se ve de cada telefono.
  const mapa = new Map();
  for (const r of data ?? []) {
    const tel = e164(r.agent_conversations?.phone_number);
    if (tel && !mapa.has(tel)) mapa.set(tel, r.ctwa_clid);
  }
  return mapa;
}

/**
 * Arma un evento de la Conversions API.
 *
 * La forma del evento cambia segun haya id de clic o no, y no es cosmetico:
 *
 *  - CON ctwa_clid, Meta acepta `business_messaging` + `messaging_channel:
 *    whatsapp`. Es el formato pensado para las campanas de clic a WhatsApp y
 *    ata la conversion al CLIC exacto, asi que se sabe que anuncio la produjo.
 *  - SIN el, hay que caer a `phone_call` y que Meta empareje por telefono
 *    hasheado. Funciona, pero empareja peor y no dice de que anuncio salio.
 *
 * Mandar `business_messaging` sin clid seria un evento invalido, de ahi que la
 * eleccion sea automatica y no una opcion configurable.
 */
function armarEvento({ nombre, cuando, id, tel, fn, ln, clid, custom }) {
  const user_data = {
    ph: [sha256(tel)],
    country: [sha256('ec')],
    ...(fn ? { fn: [sha256(fn)] } : {}),
    ...(ln ? { ln: [sha256(ln)] } : {}),
    // El clid NO se hashea: es un identificador de Meta, no un dato personal.
    ...(clid ? { ctwa_clid: clid } : {}),
  };
  return {
    event_name: nombre,
    event_time: Math.floor(new Date(cuando).getTime() / 1000),
    event_id: id,
    action_source: clid ? 'business_messaging' : 'phone_call',
    ...(clid ? { messaging_channel: 'whatsapp' } : {}),
    user_data,
    custom_data: custom,
  };
}

/**
 * Igual que `todo` en scripts/atribucion/ventas.js, y por los mismos dos
 * motivos: sin `.order('id')` PostgREST puede duplicar o SALTAR filas entre
 * páginas (una venta real contada como "sin teléfono"), y una página fallida
 * devolvía la tabla a medias sin que nadie se enterara.
 *
 * Que esté duplicado acá es deuda conocida -- ver la nota del final de este
 * archivo sobre consumir el módulo compartido.
 */
async function todo(tabla, cols, mod = (q) => q) {
  let out = [], from = 0; const size = 1000;
  for (;;) {
    const { data, error } = await mod(supabase.from(tabla).select(cols))
      .order('id', { ascending: true })
      .range(from, from + size - 1);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    out = out.concat(data);
    if (data.length < size) break;
    from += size;
  }
  return out;
}

/**
 * El ERP no guarda el telefono en la orden: la venta de mostrador va contra
 * "CONSUMIDOR FINAL". Solo sirven las ordenes cuyo customer tiene telefono
 * (las que nacieron de un chat de WhatsApp). Las demas no se pueden atribuir
 * y mandarlas sin identificador solo ensucia la señal.
 */
async function eventosDeCompra(clids) {
  const clientes = await todo('customers', 'id,phone,name,identification_number');
  const cli = new Map(clientes.map((c) => [c.id, c]));
  const ordenes = await todo('orders', 'id,customer_id,total_amount,status,created_at',
    (q) => q.gte('created_at', DESDE.toISOString()));

  const eventos = [];
  let sinTelefono = 0;
  for (const o of ordenes) {
    if (o.status === 'Borrador' || o.status === 'Cancelado') continue;
    const c = cli.get(o.customer_id);
    const tel = e164(c?.phone);
    if (!tel) { sinTelefono++; continue; }
    const { fn, ln } = partirNombre(c?.name);
    eventos.push(armarEvento({
      nombre: 'Purchase',
      cuando: o.created_at,
      id: `order-${o.id}`,   // deduplicacion si se reenvia el mismo rango
      tel, fn, ln,
      clid: clids.get(tel),
      custom: { currency: 'USD', value: Number(o.total_amount || 0) },
    }));
  }
  const conClid = eventos.filter((e) => e.user_data.ctwa_clid).length;
  return { eventos, sinTelefono, totalOrdenes: ordenes.length, conClid };
}

/**
 * Lead calificado: pidio una pieza concreta que no habia en stock y dejo su
 * numero. Es mucho mejor señal que "abrio el chat" y hay 10x mas volumen que
 * de compras, asi que le da a Meta con que aprender mientras las compras suben.
 * Se manda como `Lead` con el precio de la pieza pedida como valor.
 */
async function eventosDeLead(clids) {
  const demandas = await todo('product_demands', 'id,product_id,phone_number,customer_name,created_at',
    (q) => q.gte('created_at', DESDE.toISOString()));
  const productos = await todo('products', 'id,price,name');
  const pMap = new Map(productos.map((p) => [p.id, p]));

  const eventos = [];
  for (const d of demandas) {
    const tel = e164(d.phone_number);
    if (!tel) continue;
    const { fn, ln } = partirNombre(d.customer_name);
    const precio = Number(pMap.get(d.product_id)?.price || 0);
    eventos.push(armarEvento({
      nombre: 'Lead',
      cuando: d.created_at,
      id: `demanda-${d.id}`,
      tel, fn, ln,
      clid: clids.get(tel),
      custom: { currency: 'USD', value: precio, content_name: pMap.get(d.product_id)?.name || '' },
    }));
  }
  return eventos;
}

async function enviarLote(lote) {
  const body = {
    data: lote,
    ...(USAR_TEST && META_TEST_EVENT_CODE ? { test_event_code: META_TEST_EVENT_CODE } : {}),
  };
  const res = await fetch(`${API}/${META_PIXEL_ID}/events?access_token=${META_CAPI_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

async function main() {
  console.log(`Conversions API -- ultimos ${DIAS} dias (desde ${DESDE.toISOString().slice(0, 10)})`);
  console.log(ENVIAR ? '>> MODO ENVIO REAL\n' : '>> SIMULACRO: no se envia nada. Usar --enviar para mandarlo.\n');

  const clids = await clidPorTelefono();
  const { eventos: compras, sinTelefono, totalOrdenes, conClid } = await eventosDeCompra(clids);
  const leads = await eventosDeLead(clids);
  const todosLosEventos = [...compras, ...leads];

  const valor = compras.reduce((s, e) => s + e.custom_data.value, 0);
  const leadsConClid = leads.filter((e) => e.user_data.ctwa_clid).length;
  console.log(`Purchase : ${String(compras.length).padStart(4)} eventos   $${valor.toFixed(2)}`);
  console.log(`Lead     : ${String(leads.length).padStart(4)} eventos`);
  console.log('');
  const totalClid = conClid + leadsConClid;
  console.log(`Con id de clic (ctwa_clid): ${totalClid} de ${todosLosEventos.length}` +
    (todosLosEventos.length ? `  (${((100 * totalClid) / todosLosEventos.length).toFixed(1)}%)` : ''));
  console.log('  Es el numero de salud de todo el sistema: mide que porcion de las');
  console.log('  conversiones se puede atar al anuncio exacto en vez de a un telefono.');
  if (totalClid === 0) {
    console.log('  En 0 -> todavia se empareja solo por telefono hasheado. Sube solo a');
    console.log('  medida que entren leads nuevos con la migracion 0076 ya aplicada.');
  }
  if (sinTelefono) {
    console.log(`\n${sinTelefono} de ${totalOrdenes} ordenes no se pueden atribuir: el cliente no`);
    console.log(`tiene telefono (venta de mostrador a "CONSUMIDOR FINAL"). Pedir el numero`);
    console.log(`en el POS es, por si solo, la mejora mas barata de la cuenta publicitaria:`);
    console.log(`cada una de esas ventas es una señal que Meta hoy no recibe.`);
  }

  if (!todosLosEventos.length) { console.log('\nNada que enviar.'); return; }

  if (!ENVIAR) {
    console.log('\nEjemplo del evento que se enviaria (datos ya hasheados):');
    console.log(JSON.stringify(todosLosEventos[0], null, 2));
    return;
  }

  if (!META_PIXEL_ID || !META_CAPI_TOKEN) {
    console.error('\nFalta META_PIXEL_ID o META_CAPI_TOKEN en .env. Se sacan en');
    console.error('Events Manager > Origenes de datos > (tu pixel) > Configuracion.');
    process.exit(1);
  }

  // Meta acepta hasta 1.000 eventos por peticion.
  let ok = 0;
  for (let i = 0; i < todosLosEventos.length; i += 1000) {
    const lote = todosLosEventos.slice(i, i + 1000);
    try {
      const r = await enviarLote(lote);
      ok += r.events_received ?? lote.length;
      console.log(`Lote ${i / 1000 + 1}: ${r.events_received ?? lote.length} eventos recibidos`);
    } catch (e) {
      console.error(`Lote ${i / 1000 + 1} fallo: ${e.message}`);
    }
  }
  console.log(`\nTotal aceptado por Meta: ${ok}/${todosLosEventos.length}`);
}

main();
