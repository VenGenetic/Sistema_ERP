/**
 * Clasificador de repuestos a partir del nombre del producto.
 *
 * Los nombres en la base siguen un patron bastante estable:
 *   "<TIPO DE PIEZA> <MODELO DE MOTO> <CILINDRAJE>CC <COLOR>"
 * p.ej. "TELESCOPICAS (I-D) GP1 250/TUNDRA VELOCE 250CC BUJE 12MM B/I"
 *
 * `products.category` no sirve para Meta: 490 SKUs con stock dicen "General",
 * 465 estan en null. Sin product_type real el catalogo de Meta no puede segmentar
 * y las Advantage+ Catalog ads terminan mostrando cualquier cosa a cualquiera.
 * Este modulo deriva tipo de pieza, modelos compatibles y cilindraje del nombre.
 */

// Orden IMPORTA: lo mas especifico primero, se toma la primera coincidencia.
const TIPOS = [
  ['Suspension > Telescopicas',       [/telescopic/i, /barras? de suspension/i]],
  ['Suspension > Monoshock',          [/monoshock/i, /amortiguador/i]],
  ['Suspension > Mesa de direccion',  [/mesa (de )?direccion/i, /\btija\b/i]],
  ['Motor > Cilindro y piston',       [/cilindro y piston/i, /cilindro-piston/i, /\bcilindro\b/i, /\bpiston\b/i]],
  ['Motor > Culata',                  [/culata/i, /cabezote/i]],
  ['Motor > Cigueñal',                [/cigue[nñ]al/i]],
  ['Motor > Embrague',                [/embrague/i, /\bclutch\b/i, /disco[s]? de friccion/i]],
  ['Motor > Valvulas y arbol',        [/valvula/i, /arbol de leva/i, /balancin/i]],
  ['Motor > Empaques y retenes',      [/empaque/i, /\breten\b/i, /kit de junta/i]],
  ['Motor > Tapas y protectores',     [/tapa motor/i, /tapa de motor/i, /protec.{0,4} motor/i]],
  ['Motor > Arranque',                [/arranque/i, /bendix/i]],
  ['Motor > Radiador',                [/radiador/i, /bomba de agua/i]],
  ['Motor > Carburacion e inyeccion', [/carburador/i, /inyector/i, /cuerpo de acelera/i, /\btbi\b/i]],
  ['Motor > Filtros',                 [/filtro/i]],
  ['Motor > Lubricacion',             [/\baceite\b/i, /lubricante/i]],
  ['Transmision > Kit de arrastre',   [/kit de arrastre/i, /kit arrastre/i]],
  ['Transmision > Piñon y corona',    [/pi[nñ]on/i, /corona/i, /\bcatalina\b/i]],
  ['Transmision > Cadena',            [/cadena/i]],
  ['Transmision > Caja de cambios',   [/caja de cambio/i, /\bpi[nñ]oneria\b/i, /horquilla de cambio/i]],
  ['Frenos > Pastillas y zapatas',    [/pastilla/i, /zapata/i, /banda de freno/i]],
  ['Frenos > Disco',                  [/disco (de )?freno/i, /disco del/i, /disco post/i]],
  ['Frenos > Bomba y mordaza',        [/bomba (de )?freno/i, /mordaza/i, /caliper/i]],
  ['Frenos > Otros',                  [/freno/i]],
  ['Ruedas > Aros',                   [/\baro\b/i, /\baros\b/i, /\brin\b/i, /magnecio/i, /magnesio/i]],
  ['Ruedas > Llantas',                [/llanta/i, /neumatico/i]],
  ['Ruedas > Rodamientos y ejes',     [/rodamiento/i, /\beje\b/i, /ruliman/i]],
  ['Electrico > Faro',                [/\bfaro\b/i, /mascarilla/i, /\bhalogeno\b/i]],
  ['Electrico > Velocimetro',         [/velocimetro/i, /tablero/i, /\bodometro\b/i]],
  ['Electrico > Stop y direccionales',[/\bstop\b/i, /direccional/i, /guia luz/i, /luz post/i]],
  ['Electrico > CDI y bobina',        [/\bcdi\b/i, /bobina/i, /\bstator\b/i, /regulador/i, /rectificador/i, /\bmagneto\b/i]],
  ['Electrico > Bateria',             [/bateria/i]],
  ['Electrico > Switches y cables',   [/switch/i, /\bllaves\b/i, /\barnes\b/i, /\bcable\b/i, /\bsensor\b/i, /\bboya\b/i]],
  // Placas ANTES que Tanque: "PLACA TANQUE (I-D)" es la cacha lateral que va
  // sobre el tanque, no el tanque. Al reves quedaban 22 placas anunciadas como
  // tanques de gasolina -- el cliente llega esperando otra pieza y se cae la venta.
  ['Carroceria > Placas',             [/placa tanque/i, /placa lat/i, /\bplaca\b/i]],
  ['Carroceria > Tanque',             [/tanque/i]],
  ['Carroceria > Guardafango',        [/guardafango/i, /guardabarro/i]],
  ['Carroceria > Carenaje',           [/carenaje/i, /\bcubierta\b/i, /\bcacha\b/i, /\bdeflector\b/i]],
  ['Carroceria > Asiento',            [/asiento/i, /\bsillin\b/i]],
  ['Carroceria > Porta placas',       [/porta placa/i, /portaplaca/i]],
  ['Carroceria > Estribos',           [/estribo/i, /\bpedal\b/i, /\bposapie\b/i]],
  ['Carroceria > Parrilla y baul',    [/parrilla/i, /\bbaul\b/i, /\bmaleta\b/i]],
  ['Escape',                          [/escape/i, /silenciador/i, /\bmofle\b/i]],
  ['Manubrio y mandos',               [/manubrio/i, /manigueta/i, /\bmaneral\b/i, /pu[nñ]o/i, /acelerador/i, /espejo/i]],
  ['Accesorios del piloto',           [/\bcasco\b/i, /guantes?/i, /chompa/i, /\bchaleco\b/i, /rodillera/i]],
];

// Modelos de moto detectables en el nombre. La clave es como aparece en el SKU/nombre;
// el valor es el nombre limpio que va al anuncio y que el cliente escribe en WhatsApp.
const MODELOS = [
  [/\bGP1[- ]?RR?\b/i,        'GP1-R'],
  [/\bGP1\b/i,                'GP1'],
  [/WING\s*EVO\s*(II|2)/i,    'Wing Evo 2'],
  [/WING\s*EVO/i,             'Wing Evo'],
  [/\bWEV2?\b/i,              'Wing Evo'],
  [/TEKKEN\s*EVO/i,           'Tekken Evo'],
  [/TEKKEN\s*DISCOVERY/i,     'Tekken Discovery'],
  [/TEKKEN\s*TRACKER/i,       'Tekken Tracker'],
  [/\bTEKKEN\b/i,             'Tekken'],
  [/SCRAMBLER\s*CLASICA/i,    'Scrambler Clasica'],
  [/SCRAMBLER\s*REVOLUTION/i, 'Scrambler Revolution'],
  [/\bSCRAMBLER\b/i,          'Scrambler'],
  [/\bXPOWER\b/i,             'XPower'],
  [/SUPER\s*WOLF/i,           'Super Wolf'],
  [/WOLF\s*EVOLUTION/i,       'Wolf Evolution'],
  [/\bWOLF\b/i,               'Wolf'],
  [/\bGTR\s*ROADSTER\b/i,     'GTR Roadster'],
  [/\bGTR\b/i,                'GTR 200'],
  [/ADVENTURE[- ]?R/i,        'Adventure-R'],
  [/S1\s*ADVENTURE/i,         'S1 Adventure'],
  [/\bADVENTURE\b/i,          'Adventure'],
  [/\bPREDATOR\b/i,           'Predator'],
  [/\bSPITFIRE\b/i,           'Spitfire'],
  [/\bWORKFORCE\b/i,          'Workforce'],
  [/\bCROSSFIRE\b/i,          'Crossfire'],
  [/\bXTREEM\b/i,             'Xtreem'],
  [/\bEVEREST\b/i,            'Everest'],
  [/\bCHIEF\s*I{1,2}\s*PRO\b/i, 'Chief II Pro'],
  [/\bCHIEF\b/i,              'Chief'],
  [/TUNDRA\s*VELOCE/i,        'Tundra Veloce'],
  [/\bTUNDRA\b/i,             'Tundra'],
  [/\bARTIC\b/i,              'Artic'],
  [/\bCOBRA\b/i,              'Cobra'],
  [/\bTHUNDER\b/i,            'Thunder'],
  [/\bRANGER\b/i,             'Ranger'],
  [/\bAXXO\b/i,               'Axxo'],
  [/\bSHINERAY\b|\bSHM\b/i,   'Shineray'],
  [/\bPEGASSO\b/i,            'Pegasso'],
  [/\bFACTORY\b/i,            'Factory'],
  [/\bDRAKON\b/i,             'Drakon'],
  [/\bBOMBER\b/i,             'Bomber'],
  [/\bSR71\b/i,               'SR71'],
  [/\bDUKK\b/i,               'Dukk'],
  [/\bEAGLE\b/i,              'Eagle'],
  [/\bSCORPION\b/i,           'Scorpion'],
  [/\bNATIVA\b/i,             'Nativa'],
  [/\bCX7\b/i,                'CX7'],
  [/\bHORNET\b/i,             'Hornet'],
  [/\bVENOM\b/i,              'Venom'],
  [/\bSHARK\s*(I{1,3}|[123])\b/i, 'Shark'],
  [/\bSHARK\b/i,              'Shark'],
  [/\bFORCE\b/i,              'Force'],
  [/\bAGILITY\b/i,            'Agility'],
  [/\bS1\s*ADV/i,             'S1 Adventure'],
  [/\bDELTA\b/i,              'Delta'],
  [/\bPANTHER\b/i,            'Panther'],
  [/\bINDY\b/i,               'Indy'],
  [/\bXTZ\b/i,                'XTZ'],
  [/\bBULL\b/i,               'Bull'],
  [/\bSENGO\b/i,              'Sengo'],
  [/\bREVOLUTION\b/i,         'Revolution'],
  [/\bPREDATOR\b/i,           'Predator'],
  [/\bSTIFF\b/i,              'Stiff'],
  [/\bWIND\b/i,               'Wind'],
];

function tipoPieza(nombre) {
  for (const [tipo, patrones] of TIPOS) {
    if (patrones.some((re) => re.test(nombre))) return tipo;
  }
  return 'Repuestos > Otros';
}

function modelos(nombre) {
  const out = [];
  for (const [re, limpio] of MODELOS) {
    if (re.test(nombre) && !out.includes(limpio)) out.push(limpio);
  }
  return out;
}

function cilindraje(nombre) {
  // "250CC", "300 CC", "125cc" -- se queda con el mayor, que suele ser el de la moto
  const encontrados = [...nombre.matchAll(/(\d{2,4})\s*CC\b/gi)].map((m) => Number(m[1]));
  if (!encontrados.length) return null;
  return Math.max(...encontrados);
}

// Rango de ticket: Meta lo usa como custom_label para pujar distinto por gama.
// Los cortes salen de la venta real: ticket promedio $215, margen bruto 34%.
function rangoTicket(precio) {
  if (precio < 15) return 'bajo';       // consumible: no rentable anunciarlo solo
  if (precio < 40) return 'medio';
  if (precio < 90) return 'alto';
  return 'premium';                      // $90+ : aqui esta el cliente que buscamos
}

function rangoMargen(precio, costo) {
  if (!costo || !precio) return 'margen_desconocido';
  const m = (precio - costo) / precio;
  if (m < 0.2) return 'margen_bajo';
  if (m < 0.32) return 'margen_medio';
  return 'margen_alto';
}

export { tipoPieza, modelos, cilindraje, rangoTicket, rangoMargen, TIPOS, MODELOS };
