/**
 * Importación de conversiones offline a Google Ads: le devuelve a Google las
 * ventas que ocurren en WhatsApp y en el mostrador.
 *
 * EL PROBLEMA QUE RESUELVE
 * ------------------------
 * La campaña de Performance Max reportó 1.625 conversiones en 30 días, con un
 * gasto de $150. El ERP registra 312 ventas en toda su historia. Esas 1.625 no
 * son ventas: son clics de botón, llamadas y pedidos de ruta, que es lo que
 * cuenta por defecto una campaña de "visitas a la tienda".
 *
 * Google optimiza contra lo que se le devuelve. Mientras eso sea "alguien tocó
 * un botón", va a seguir buscando gente que toca botones -- y cada día que pasa
 * lo hace mejor. Este script cierra el circuito: sube la venta real, con su
 * valor y con el `gclid` del clic que la produjo.
 *
 * Es el equivalente de `scripts/meta/enviar-conversiones.js` para Google. Los dos
 * leen la MISMA definición de venta (`scripts/atribucion/ventas.js`) para que las
 * dos plataformas optimicen contra los mismos números.
 *
 * CÓMO ATA LA VENTA AL ANUNCIO
 * ----------------------------
 *  - CON gclid (o gbraid/wbraid en iOS): Google ata la venta al clic exacto y
 *    sabe qué anuncio, qué término y qué creativo la produjo. Es la señal buena.
 *    El gclid llega por el puente web -> WhatsApp (migración 0077 del repo
 *    `agente/` + `attribution.ts` en lvparts.ec).
 *  - SIN gclid: se usa "conversiones mejoradas para clientes potenciales", que
 *    manda el teléfono hasheado y deja que Google lo empareje. Empareja peor,
 *    pero recupera las ventas cuyo clic se perdió.
 *
 * REQUISITO EN LA CUENTA
 * ----------------------
 * Hace falta una acción de conversión de tipo "importación". Este script la
 * busca por nombre y la crea si no existe:
 *     node scripts/google/enviar-conversiones.js --crear-accion
 *
 * Uso:
 *   node scripts/google/enviar-conversiones.js                 # simulacro
 *   node scripts/google/enviar-conversiones.js --dias=30
 *   node scripts/google/enviar-conversiones.js --enviar        # sube de verdad
 *   node scripts/google/enviar-conversiones.js --crear-accion  # crea la acción
 *
 * Por defecto NO sube nada: imprime lo que subiría.
 */
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import {
  ventasAtribuibles,
  leadsCalificados,
  clicsDeGoogle,
} from '../atribucion/ventas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// `publicidad/` es CommonJS y tiene las credenciales de Google Ads ya resueltas.
// Se reutiliza en vez de duplicar la configuración en dos carpetas.
const RUTA_PUBLICIDAD = path.join(__dirname, '..', '..', '..', '..', 'publicidad');
const RUTA_CONFIG = path.join(RUTA_PUBLICIDAD, 'config.js');
// El require se ancla en publicidad/ para que `google-ads-api` se resuelva
// contra los node_modules de ESA carpeta, que es donde está instalado.
const require = createRequire(path.join(RUTA_PUBLICIDAD, 'package.json'));

const args = process.argv.slice(2);
const ENVIAR = args.includes('--enviar');
const CREAR_ACCION = args.includes('--crear-accion');
const DIAS = Number(args.find((a) => a.startsWith('--dias='))?.split('=')[1] || 7);
const DESDE = new Date(Date.now() - DIAS * 86400000);

/** Nombre de la acción de conversión en Google Ads. Si se cambia, se crea otra. */
const NOMBRE_ACCION_VENTA = 'Venta LV Parts (ERP)';
const NOMBRE_ACCION_LEAD = 'Lead calificado LV Parts (ERP)';

const sha256 = (s) => createHash('sha256').update(String(s).trim().toLowerCase()).digest('hex');

function cargarConfig() {
  try {
    return require(RUTA_CONFIG);
  } catch (err) {
    console.error(`No se pudo cargar ${RUTA_CONFIG}`);
    console.error('Este script reutiliza las credenciales de la carpeta publicidad/.');
    console.error('Revisá que exista publicidad/.env (ver publicidad/.env.example).');
    process.exit(1);
  }
}

/**
 * Google pide la fecha como 'yyyy-MM-dd HH:mm:ss+|-HH:mm'. Ecuador es UTC-5 fijo
 * y no usa horario de verano, así que el offset es constante.
 */
function fechaGoogle(iso) {
  const d = new Date(new Date(iso).getTime() - 5 * 3600000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} `
    + `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}-05:00`;
}

/** Las acciones de conversión de importación que ya existen en la cuenta. */
async function accionesExistentes(customer) {
  const filas = await customer.query(`
    SELECT conversion_action.id, conversion_action.name,
           conversion_action.type, conversion_action.status,
           conversion_action.resource_name
    FROM conversion_action
    WHERE conversion_action.type = 'UPLOAD_CLICKS'
  `);
  const mapa = new Map();
  for (const f of filas) {
    mapa.set(f.conversion_action.name, f.conversion_action.resource_name);
  }
  return mapa;
}

/**
 * Crea las dos acciones de conversión si faltan.
 *
 * La venta va con `category: PURCHASE` y valor variable; el lead con
 * `category: QUALIFIED_LEAD`. Las dos se cuentan UNA vez por clic: una persona
 * que compra dos veces el mismo mes no debe inflar la señal de un solo anuncio.
 */
async function crearAcciones(customer, enums) {
  const existentes = await accionesExistentes(customer);
  const aCrear = [];

  for (const [nombre, categoria] of [
    [NOMBRE_ACCION_VENTA, enums.ConversionActionCategory.PURCHASE],
    [NOMBRE_ACCION_LEAD, enums.ConversionActionCategory.QUALIFIED_LEAD],
  ]) {
    if (existentes.has(nombre)) {
      console.log(`Ya existe: ${nombre}`);
      continue;
    }
    aCrear.push({
      name: nombre,
      type: enums.ConversionActionType.UPLOAD_CLICKS,
      category: categoria,
      status: enums.ConversionActionStatus.ENABLED,
      counting_type: enums.ConversionActionCountingType.ONE_PER_CLICK,
      click_through_lookback_window_days: 90,
      value_settings: { always_use_default_value: false },
    });
  }

  if (!aCrear.length) {
    console.log('\nNo hay nada que crear.');
    return;
  }

  const res = await customer.conversionActions.create(aCrear);
  console.log('\nCreadas:', JSON.stringify(res, null, 2));
  console.log('\nIMPORTANTE: en Google Ads hay que marcarlas como objetivo PRINCIPAL');
  console.log('de la campaña y quitar de ahí las de clic de botón, llamada y ruta.');
}

/**
 * Arma una conversión para subir.
 *
 * El gclid y el teléfono hasheado son excluyentes: si se mandan los dos, Google
 * rechaza la fila. Con gclid la atribución es exacta; sin él, se cae a
 * conversiones mejoradas y Google empareja por teléfono.
 */
function armarConversion({ accion, clic, telefono, valor, cuando, orderId }) {
  const base = {
    conversion_action: accion,
    conversion_date_time: fechaGoogle(cuando),
    conversion_value: Number(valor || 0),
    currency_code: 'USD',
    // Si se vuelve a subir el mismo rango, Google descarta el duplicado en vez
    // de contar la venta dos veces.
    order_id: orderId,
  };

  if (clic?.gclid) return { ...base, gclid: clic.gclid };
  if (clic?.gbraid) return { ...base, gbraid: clic.gbraid };
  if (clic?.wbraid) return { ...base, wbraid: clic.wbraid };

  // Conversiones mejoradas: sin id de clic, con el teléfono hasheado.
  return {
    ...base,
    user_identifiers: [{ hashed_phone_number: sha256('+' + telefono) }],
  };
}

async function main() {
  if (CREAR_ACCION) {
    const { crearCliente } = cargarConfig();
    const { enums } = require('google-ads-api');
    await crearAcciones(crearCliente(), enums);
    return;
  }

  console.log(`Conversiones offline a Google -- últimos ${DIAS} días (desde ${DESDE.toISOString().slice(0, 10)})`);
  console.log(ENVIAR ? '>> MODO ENVÍO REAL\n' : '>> SIMULACRO: no se sube nada. Usar --enviar para mandarlo.\n');

  const clics = await clicsDeGoogle();
  const { ventas, sinTelefono, noVenta, totalOrdenes } = await ventasAtribuibles(DESDE);
  const leads = await leadsCalificados(DESDE);

  const conClic = ventas.filter((v) => clics.has(v.telefono)).length;
  const valorTotal = ventas.reduce((s, v) => s + v.valor, 0);

  console.log(`Órdenes del período      : ${totalOrdenes}`);
  console.log(`  descartadas (borrador/cancelada): ${noVenta}`);
  console.log(`  sin teléfono del comprador     : ${sinTelefono}`);
  console.log(`Ventas atribuibles       : ${ventas.length}   $${valorTotal.toFixed(2)}`);
  console.log(`Leads calificados        : ${leads.length}`);
  console.log('');
  console.log(`Con id de clic de Google : ${conClic} de ${ventas.length}` +
    (ventas.length ? `  (${((100 * conClic) / ventas.length).toFixed(1)}%)` : ''));
  console.log('  Es el número de salud del sistema: mide qué parte de las ventas');
  console.log('  se puede atar al anuncio exacto en vez de a un teléfono.');

  if (sinTelefono) {
    console.log(`\n${sinTelefono} de ${totalOrdenes} órdenes no se pueden atribuir porque la venta`);
    console.log('quedó contra CONSUMIDOR FINAL. Esas ventas son invisibles para Google:');
    console.log('cobrar desde el chat (botón "Cobrar en el POS") ya ata el teléfono solo.');
  }

  if (!ventas.length && !leads.length) {
    console.log('\nNada que subir.');
    return;
  }

  if (!ENVIAR) {
    const ejemplo = ventas[0] || leads[0];
    console.log('\nEjemplo de la conversión que se subiría:');
    console.log(JSON.stringify(armarConversion({
      accion: `customers/<cuenta>/conversionActions/<id de "${NOMBRE_ACCION_VENTA}">`,
      clic: clics.get(ejemplo.telefono),
      telefono: ejemplo.telefono,
      valor: ejemplo.valor,
      cuando: ejemplo.cuando,
      orderId: `orden-${ejemplo.id}`,
    }), null, 2));
    return;
  }

  const { crearCliente } = cargarConfig();
  const customer = crearCliente();
  const acciones = await accionesExistentes(customer);
  const accionVenta = acciones.get(NOMBRE_ACCION_VENTA);
  const accionLead = acciones.get(NOMBRE_ACCION_LEAD);

  if (!accionVenta) {
    console.error(`\nFalta la acción de conversión "${NOMBRE_ACCION_VENTA}" en la cuenta.`);
    console.error('Creala con:  node scripts/google/enviar-conversiones.js --crear-accion');
    process.exit(1);
  }

  const conversiones = [
    ...ventas.map((v) => armarConversion({
      accion: accionVenta,
      clic: clics.get(v.telefono),
      telefono: v.telefono,
      valor: v.valor,
      cuando: v.cuando,
      orderId: `orden-${v.id}`,
    })),
    ...(accionLead ? leads.map((l) => armarConversion({
      accion: accionLead,
      clic: clics.get(l.telefono),
      telefono: l.telefono,
      valor: l.valor,
      cuando: l.cuando,
      orderId: `demanda-${l.id}`,
    })) : []),
  ];

  // Google acepta hasta 2.000 conversiones por petición.
  let ok = 0;
  for (let i = 0; i < conversiones.length; i += 2000) {
    const lote = conversiones.slice(i, i + 2000);
    try {
      const res = await customer.conversionUploads.uploadClickConversions({
        conversions: lote,
        // Sube las que estén bien en vez de rechazar el lote entero por una fila
        // mala: una venta con un gclid vencido no debe tumbar a las otras 40.
        partial_failure: true,
      });
      const fallos = res?.partial_failure_error?.message;
      ok += lote.length - (fallos ? 1 : 0);
      console.log(`Lote ${Math.floor(i / 2000) + 1}: ${lote.length} conversiones enviadas`);
      if (fallos) console.log(`  con rechazos parciales: ${fallos}`);
    } catch (err) {
      console.error(`Lote ${Math.floor(i / 2000) + 1} falló: ${err?.message || err}`);
    }
  }

  console.log(`\nSubidas: ${ok}/${conversiones.length}`);
  console.log('Google tarda hasta 3 horas en reflejarlas en la interfaz.');
}

main().catch((err) => {
  console.error('\nFALLÓ:', err?.errors?.[0]?.message || err?.message || err);
  if (String(err).includes('invalid_grant')) {
    console.error('\n>>> El refresh token de Google venció. Corré:  node publicidad/get_refresh_token.js');
  }
  process.exit(1);
});
