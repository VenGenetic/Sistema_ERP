/**
 * Emparejar una guía de Servientrega con el cliente que la espera.
 *
 * EL FLUJO REAL, tal como se ve en los datos:
 *
 *   1. El vendedor le pide los datos al cliente con una plantilla fija
 *      («Para poder coordinar tu envío por Servientrega Ecuador 📦✨…»).
 *   2. El cliente contesta en su chat con nombre, cédula, dirección,
 *      ciudad y teléfono -- casi siempre con etiquetas, casi nunca con el
 *      mismo formato dos veces.
 *   3. Se despacha, y Servientrega manda la guía a NUESTRO WhatsApp: una
 *      foto del comprobante con este pie de mensaje.
 *   4. Hay que reenviarle esa foto al cliente correcto.
 *
 * QUÉ TRAE LA GUÍA, medido sobre los mensajes reales:
 *
 *     *¡Hola EDUARDO G.!*
 *     📦 *Guía:* 9035740886
 *     📍 *Destino:* GUAYAQUIL
 *     🏠 *Dirección de entrega:* JOSE DE ANTEPARAN 4519 Y ROSENDO AVILES…
 *
 * Es decir: nombre ABREVIADO (nombre de pila + inicial del apellido),
 * ciudad y dirección. NO trae cédula ni teléfono. Se parsean igual por si
 * algún día vienen, pero hoy el cruce se juega con esos tres campos.
 *
 * POR QUÉ NO ALCANZA UN SOLO CAMPO: la ciudad la comparten decenas de
 * clientes y el nombre de pila también. Por eso hacen falta DOS campos
 * coincidentes, y por eso `elegirDestinatario` se niega a decidir cuando
 * empatan dos clientes distintos: mandarle a alguien la guía de otro
 * expone su dirección y su teléfono, y no se puede deshacer.
 */

/** Cuántos campos tienen que coincidir para considerarlo el destinatario. */
export const UMBRAL_COINCIDENCIAS = 2;

/** Los cinco datos con los que se identifica un envío. */
export type CampoDeEnvio = 'nombre' | 'cedula' | 'telefono' | 'ciudad' | 'direccion';

export interface GuiaServientrega {
    /** El número de guía. Es lo que la vuelve única y evita reenviarla dos veces. */
    numero: string | null;
    /** Como viene en la guía: «EDUARDO G.» */
    nombre: string | null;
    ciudad: string | null;
    direccion: string | null;
    cedula: string | null;
    telefono: string | null;
}

export interface DatosDelCliente {
    nombres: string[];
    cedulas: string[];
    telefonos: string[];
    ciudades: string[];
    direcciones: string[];
}

/* -------------------------------------------------------------------------- */
/*  NORMALIZACIÓN                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Sin tildes, sin mayúsculas, sin espacios de más.
 *
 * La guía llega en MAYÚSCULAS y sin tildes; el cliente escribe «Baños de
 * Agua Santa» o «banos». Comparar en crudo no acierta nunca.
 */
export function normalizar(texto: string): string {
    return texto
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9ñ\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Solo los dígitos. */
const digitos = (t: string) => t.replace(/\D/g, '');

/**
 * Los últimos 9 dígitos: el número local sin el 0 ni el +593.
 *
 * Es el mismo criterio que usa `CustomerPanel` para vincular un chat con
 * un cliente del ERP, y por la misma razón: los teléfonos se escriben de
 * mil formas («0995198440», «+593 96 408 0468», «593985009414»).
 */
export function colaTelefono(numero: string): string {
    return digitos(numero).slice(-9);
}

/**
 * Palabras que no distinguen a nadie y arruinarían el cruce de direcciones:
 * si «calle» contara, dos direcciones cualesquiera coincidirían.
 */
const VACIAS = new Set([
    'calle', 'av', 'ave', 'avenida', 'y', 'de', 'del', 'la', 'el', 'los', 'las',
    'entre', 'ref', 'referencia', 'sector', 'barrio', 'ciudadela', 'cdla', 'mz',
    'manzana', 'villa', 'casa', 'sn', 's', 'n', 'numero', 'no', 'frente', 'a',
    'con', 'en', 'por', 'para', 'exacta', 'direccion', 'entrega', 'servientrega',
    'oficina', 'agencia', 'provincia', 'canton', 'cerca', 'junto', 'al', 'un',
    'una', 'color', 'planta', 'tipo', 'atras', 'detras', 'sobre',
]);

/** Las palabras de un texto que sí sirven para distinguir. */
function fichas(texto: string): Set<string> {
    return new Set(
        normalizar(texto)
            .split(' ')
            .filter((p) => p.length >= 4 && !VACIAS.has(p)),
    );
}

/* -------------------------------------------------------------------------- */
/*  LEER LA GUÍA                                                               */
/* -------------------------------------------------------------------------- */

/**
 * ¿Este mensaje es una guía de Servientrega?
 *
 * Tres señales, y alcanza con una. La tercera -- un rótulo «Guía:» seguido
 * de un número largo -- es la que sostiene todo si el transportista cambia
 * la redacción: las dos primeras dependen de frases exactas y bastaría que
 * reescriban la plantilla para que el reenvío dejara de funcionar EN
 * SILENCIO, sin que nadie note que los clientes no reciben su guía.
 *
 * El número pide 8 dígitos o más para no confundir un precio ni un
 * teléfono con una guía.
 */
export function esGuia(body: string | null | undefined): boolean {
    if (!body) return false;
    const t = normalizar(body);
    if (t.includes('ha sido generado')) return true;
    if (t.includes('servientrega') && /gu[ií]a/i.test(body) && /\d{8,}/.test(body)) return true;
    return /gu[ií]a\s*\*?\s*:\s*\*?\s*\d{8,}/i.test(body);
}

/**
 * Saca lo que se pueda del pie de la guía.
 *
 * Los rótulos se buscan con el texto en crudo (traen negritas de WhatsApp
 * y emoji) pero de forma tolerante: `*Guía:*`, `Guia:`, `📦 *Guía:*` y
 * `Guía :` tienen que caer todos en el mismo lugar.
 */
export function parsearGuia(body: string | null | undefined): GuiaServientrega {
    const vacia: GuiaServientrega = {
        numero: null, nombre: null, ciudad: null, direccion: null, cedula: null, telefono: null,
    };
    if (!body) return vacia;

    const campo = (etiquetas: string[]): string | null => {
        for (const e of etiquetas) {
            const re = new RegExp(`${e}\\s*\\*?\\s*:\\s*\\*?\\s*([^\\n]+)`, 'i');
            const m = body.match(re);
            if (m?.[1]) {
                const limpio = m[1].replace(/\*/g, '').trim();
                if (limpio) return limpio;
            }
        }
        return null;
    };

    // «*¡Hola EDUARDO G.!*» -> «EDUARDO G.»
    const saludo = body.match(/¡?\s*hola\s+([^!\n*]+)\s*!/i);

    const telefonoCrudo = campo(['tel[eé]fono', 'celular', 'contacto']);

    return {
        numero: (campo(['gu[ií]a', 'n[uú]mero de gu[ií]a', 'tracking']) ?? '').replace(/\D/g, '') || null,
        nombre: saludo?.[1]?.replace(/\*/g, '').trim() || campo(['destinatario', 'nombre']),
        ciudad: campo(['destino', 'ciudad']),
        direccion: campo(['direcci[oó]n de entrega', 'direcci[oó]n']),
        cedula: (campo(['c[eé]dula', 'identificaci[oó]n', 'ruc']) ?? '').replace(/\D/g, '') || null,
        telefono: telefonoCrudo ? colaTelefono(telefonoCrudo) || null : null,
    };
}

/* -------------------------------------------------------------------------- */
/*  LEER LO QUE ESCRIBIÓ EL CLIENTE                                            */
/* -------------------------------------------------------------------------- */

/** Cédula 10 dígitos, RUC 13. Sirve para reconocerla suelta, sin rótulo. */
const CEDULA_SUELTA = /(?<!\d)(\d{10}|\d{13})(?!\d)/g;

/** Un celular ecuatoriano: 09 y ocho dígitos más. También mide 10. */
const CELULAR_EC = /^09\d{8}$/;

/** Dos a cinco palabras alfabéticas: la forma de un nombre completo. */
const PARECE_NOMBRE = /^[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){1,4}$/i;

/**
 * ¿Estos diez dígitos son una cédula ecuatoriana de verdad?
 *
 * Hace falta porque un celular ecuatoriano TAMBIÉN tiene diez dígitos, y
 * medido sobre los chats reales eso ensuciaba el cruce: el «0995198440»
 * que alguien mandó como teléfono entraba a la lista de cédulas, y una
 * guía con cédula podía casar contra el teléfono de otra persona.
 *
 * Se valida con el dígito verificador oficial (módulo 10): los dos
 * primeros dígitos son la provincia (01-24, o 30 para el exterior), el
 * tercero es menor que 6 en una persona natural, y el último se calcula
 * duplicando las posiciones impares.
 */
export function esCedulaEcuatoriana(valor: string): boolean {
    if (!/^\d{10}$/.test(valor)) return false;

    const provincia = Number(valor.slice(0, 2));
    if (provincia < 1 || (provincia > 24 && provincia !== 30)) return false;
    // Tercer dígito: 0-5 es persona natural. 6 y 9 son otros tipos y no se
    // usan como identificación de un cliente de mostrador.
    if (Number(valor[2]) > 5) return false;

    let suma = 0;
    for (let i = 0; i < 9; i++) {
        let n = Number(valor[i]);
        // Las posiciones impares (1.ª, 3.ª, …) se duplican.
        if (i % 2 === 0) {
            n *= 2;
            if (n > 9) n -= 9;
        }
        suma += n;
    }
    const verificador = (10 - (suma % 10)) % 10;
    return verificador === Number(valor[9]);
}

/**
 * Junta los datos que el cliente dejó en su chat.
 *
 * Se recorren TODOS sus mensajes entrantes, no solo el último: la gente
 * manda el nombre en un mensaje, la dirección en otro y el teléfono
 * cuando se lo vuelven a pedir.
 *
 * Se acumulan listas y no un valor único a propósito: un cliente puede
 * dar dos direcciones (la de la casa y la de la oficina de Servientrega) y
 * la guía puede haberse hecho con cualquiera de las dos.
 */
/** Los rótulos de cada campo, tal como los escribe la gente. */
const ROTULOS: ReadonlyArray<{ campo: keyof DatosDelCliente; re: RegExp }> = [
    // El orden importa: «número de teléfono» tiene que ganarle a «número».
    { campo: 'nombres', re: /^(?:nombres?\s*(?:completos?)?|raz[oó]n\s*social|apellidos?\s*y\s*nombres?)\b/i },
    { campo: 'cedulas', re: /^(?:n[uú]mero\s+de\s+)?(?:c[eé]dula|c\.?i\.?|ruc|identificaci[oó]n|documento)\b(?:\s*(?:o|\/)\s*ruc)?/i },
    { campo: 'telefonos', re: /^(?:n[uú]mero\s+de\s+)?(?:tel[eé]fono|celular|cel|whatsapp|contacto)\b(?:\s*(?:y\/?o|\/)\s*(?:celular|tel[eé]fono))?/i },
    { campo: 'ciudades', re: /^(?:ciudad|cant[oó]n|provincia)\b(?:\s*y\s*provincia)?/i },
    { campo: 'direcciones', re: /^(?:direcci[oó]n|dir\.?|domicilio)\b(?:\s*(?:exacta|de\s+entrega|y\s+referencia)?)*/i },
];

/**
 * Deja una línea comparable: le saca viñetas, emoji, negritas y espacios
 * raros del principio.
 *
 * Los clientes copian la plantilla con sus emoji («✅ Nombres completos:»,
 * «🆔 Número de Cédula o RUC:») o contestan con viñetas. Sin esto, el
 * rótulo nunca queda al principio de la línea y no se reconoce ninguno.
 */
function limpiarLinea(linea: string): string {
    return linea
        .replace(/[*_~`]/g, '')
        // Cualquier cosa que no sea letra, número o paréntesis al principio:
        // emoji, viñetas, guiones, el espacio invisible que mete WhatsApp.
        .replace(/^[^\p{L}\p{N}(]+/u, '')
        .trim();
}

/**
 * Junta los datos que el cliente dejó en su chat.
 *
 * Se recorren TODOS sus mensajes entrantes, no solo el último: la gente
 * manda el nombre en un mensaje, la dirección en otro y el teléfono
 * cuando se lo vuelven a pedir.
 *
 * Se acumulan listas y no un valor único a propósito: un cliente puede
 * dar dos direcciones (la de la casa y la de la oficina de Servientrega) y
 * la guía puede haberse hecho con cualquiera de las dos.
 *
 * VA LÍNEA POR LÍNEA y no con una expresión regular sobre el mensaje
 * entero. Es lo que permite aceptar el rótulo SIN dos puntos, que medido
 * sobre los chats reales es la mitad de los casos: «Dirección carretera
 * comuna sancan…», «Teléfono 0979740531». Exigiendo los dos puntos se
 * perdían la dirección y el teléfono de esa gente, y sin esos dos campos
 * el cruce con la guía nunca llegaba al umbral.
 */
export function datosDelCliente(mensajes: Array<{ body: string | null }>): DatosDelCliente {
    const datos: DatosDelCliente = {
        nombres: [], cedulas: [], telefonos: [], ciudades: [], direcciones: [],
    };

    const agregar = (campo: keyof DatosDelCliente, valor: string | null | undefined) => {
        const v = valor?.trim().replace(/\s+/g, ' ');
        if (!v) return;
        if (campo === 'cedulas') {
            const d = digitos(v);
            if (d.length !== 10 && d.length !== 13) return;
            if (!datos.cedulas.includes(d)) datos.cedulas.push(d);
            return;
        }
        if (campo === 'telefonos') {
            const c = colaTelefono(v);
            if (c.length !== 9) return;
            if (!datos.telefonos.includes(c)) datos.telefonos.push(c);
            return;
        }
        if (!datos[campo].includes(v)) datos[campo].push(v);
    };

    for (const m of mensajes) {
        if (!m.body) continue;
        const lineas = m.body.split('\n').map(limpiarLinea);
        const traeDatos = /c[eé]dula|direcci[oó]n|ciudad|tel[eé]fono|celular|nombres?\s/i.test(m.body);

        for (let i = 0; i < lineas.length; i++) {
            const linea = lineas[i];
            if (!linea) continue;

            const rotulo = ROTULOS.find((r) => r.re.test(linea));
            if (rotulo) {
                // Lo que queda después del rótulo y de un «:» opcional.
                let valor = linea.replace(rotulo.re, '').replace(/^\s*:?\s*/, '').trim();
                /* Rótulo solo en su línea: el valor está en la siguiente,
                   salvo que la siguiente sea otro rótulo. Es la forma del
                   formulario con emoji, donde cada dato va debajo. */
                if (!valor) {
                    const siguiente = lineas[i + 1];
                    if (siguiente && !ROTULOS.some((r) => r.re.test(siguiente))) {
                        valor = siguiente;
                        i++;
                    }
                }
                if (valor) agregar(rotulo.campo, valor);
                continue;
            }

            /* Sin rótulo hay que ser estricto: acá nadie dice qué es cada
               número. Solo entra lo que pasa el dígito verificador y no
               tiene forma de celular. */
            for (const suelto of linea.matchAll(CEDULA_SUELTA)) {
                const d = suelto[1];
                if (CELULAR_EC.test(d)) continue;
                if (d.length === 13 || esCedulaEcuatoriana(d)) agregar('cedulas', d);
            }

            /* El nombre sin rótulo, pero SOLO en la primera línea de un
               mensaje que ya trae datos de envío. Mucha gente contesta la
               plantilla poniendo el nombre arriba y rotulando el resto.
               Fuera de ese contexto no se toca: la primera línea de un
               mensaje cualquiera no es un nombre. */
            if (traeDatos && i === 0 && !linea.includes(':') && PARECE_NOMBRE.test(linea)) {
                agregar('nombres', linea);
            }
        }
    }

    return datos;
}

/* -------------------------------------------------------------------------- */
/*  CRUZAR                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * ¿El nombre de la guía es este cliente?
 *
 * La guía abrevia: «EDUARDO G.» por «Eduardo Gómez Salinas». Así que se
 * pide que el nombre de pila coincida entero y que la inicial que sigue
 * sea la de alguno de sus apellidos. Solo el nombre de pila no alcanza:
 * hay demasiados Luis.
 */
export function coincideNombre(deLaGuia: string, delCliente: string): boolean {
    const g = normalizar(deLaGuia).split(' ').filter(Boolean);
    const c = normalizar(delCliente).split(' ').filter(Boolean);
    if (g.length === 0 || c.length === 0) return false;

    if (g[0] !== c[0]) return false;
    // «EDUARDO» a secas contra «Eduardo Gómez»: coincide el pila y no hay
    // nada más que comparar.
    if (g.length === 1) return true;

    const inicial = g[1][0];
    return c.slice(1).some((parte) => parte[0] === inicial);
}

/** Dos direcciones son la misma si comparten dos palabras que distingan. */
export function coincideDireccion(deLaGuia: string, delCliente: string): boolean {
    const a = fichas(deLaGuia);
    const b = fichas(delCliente);
    let comunes = 0;
    for (const f of a) if (b.has(f)) comunes++;
    return comunes >= 2;
}

/** La ciudad de la guía aparece en lo que escribió el cliente (o al revés). */
export function coincideCiudad(deLaGuia: string, delCliente: string): boolean {
    const a = normalizar(deLaGuia);
    const b = normalizar(delCliente);
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a);
}

export interface Coincidencia {
    /** Cuántos de los cinco campos coincidieron. */
    puntos: number;
    campos: CampoDeEnvio[];
}

/**
 * Cuántos datos de la guía coinciden con los que dejó el cliente.
 *
 * Un campo que la guía no trae NO suma ni resta: no se puede premiar ni
 * castigar por un dato que Servientrega nunca escribió.
 */
export function compararConCliente(guia: GuiaServientrega, cliente: DatosDelCliente): Coincidencia {
    const campos: CampoDeEnvio[] = [];

    if (guia.cedula && cliente.cedulas.includes(guia.cedula)) campos.push('cedula');
    if (guia.telefono && cliente.telefonos.includes(guia.telefono)) campos.push('telefono');
    if (guia.nombre && cliente.nombres.some((n) => coincideNombre(guia.nombre!, n))) campos.push('nombre');
    if (guia.ciudad && cliente.ciudades.some((c) => coincideCiudad(guia.ciudad!, c))) campos.push('ciudad');
    if (guia.direccion && cliente.direcciones.some((d) => coincideDireccion(guia.direccion!, d))) {
        campos.push('direccion');
    }

    return { puntos: campos.length, campos };
}

export interface Candidato {
    conversationId: number;
    coincidencia: Coincidencia;
}

export type Decision =
    | { tipo: 'enviar'; destinatario: Candidato }
    | { tipo: 'ambiguo'; empatados: Candidato[] }
    | { tipo: 'sin_candidato' };

/**
 * A quién se le manda esta guía.
 *
 * Se manda sola cuando hay UN candidato con más coincidencias que todos
 * los demás. Cuando dos empatan en el máximo, no: la guía lleva impresos
 * el nombre y la dirección de una persona, así que mandársela a otra no
 * es un mensaje de más, es filtrarle los datos de un tercero -- y no se
 * puede deshacer. Ese caso queda para que una persona elija.
 *
 * El empate es el escenario realista y no una rareza: `ciudad` la
 * comparten decenas de clientes, así que dos personas de Guayaquil que se
 * llamen igual de pila llegan las dos a dos campos.
 */
export function elegirDestinatario(candidatos: Candidato[]): Decision {
    const buenos = candidatos.filter((c) => c.coincidencia.puntos >= UMBRAL_COINCIDENCIAS);
    if (buenos.length === 0) return { tipo: 'sin_candidato' };
    if (buenos.length === 1) return { tipo: 'enviar', destinatario: buenos[0] };

    const max = Math.max(...buenos.map((c) => c.coincidencia.puntos));
    const punteros = buenos.filter((c) => c.coincidencia.puntos === max);
    if (punteros.length === 1) return { tipo: 'enviar', destinatario: punteros[0] };
    return { tipo: 'ambiguo', empatados: punteros };
}
