/**
 * El formato de texto de WhatsApp, entendido de verdad.
 *
 * Hasta ahora el hilo mostraba los mensajes crudos: un cliente escribía
 * `*urgente*` y en la bandeja se leía con los asteriscos puestos. Peor al
 * revés -- lo que el vendedor manda formateado le llega bien al cliente,
 * pero en el ERP queda ilegible, así que nadie lo usaba y las cotizaciones
 * de tres repuestos salían como un párrafo corrido.
 *
 * Las reglas son las de WhatsApp, no las de Markdown. Las diferencias que
 * importan:
 *
 *   *negrita*        un asterisco, no dos
 *   _cursiva_
 *   ~tachado~
 *   `código`         en línea
 *   ```              bloque de código, con la marca en su propia línea
 *   > cita
 *   * item / - item  lista con viñetas
 *   1. item          lista numerada
 *
 * El criterio de cuándo una marca ABRE es deliberadamente estricto, y es
 * lo que evita el desastre clásico: un precio escrito `12*3` o un SKU con
 * guion bajo no pueden convertir media conversación en cursiva. Una marca
 * solo abre si no tiene una letra o un número pegado antes, si lo que
 * sigue no es un espacio, y si más adelante hay un cierre válido. Si algo
 * de eso falla, el carácter se dibuja tal cual se escribió.
 */

/** Un trozo de texto ya formateado. Se anida: negrita con cursiva adentro. */
export type NodoTexto =
    | { tipo: 'texto'; texto: string }
    | { tipo: 'negrita'; hijos: NodoTexto[] }
    | { tipo: 'cursiva'; hijos: NodoTexto[] }
    | { tipo: 'tachado'; hijos: NodoTexto[] }
    /** Sin formato adentro: dentro de código, un asterisco es un asterisco. */
    | { tipo: 'codigo'; texto: string };

/** Un bloque de nivel línea. */
export type BloqueTexto =
    | { tipo: 'parrafo'; hijos: NodoTexto[] }
    | { tipo: 'cita'; hijos: NodoTexto[] }
    | { tipo: 'lista'; ordenada: boolean; items: NodoTexto[][] }
    | { tipo: 'bloqueCodigo'; texto: string };

const MARCAS: Record<string, 'negrita' | 'cursiva' | 'tachado'> = {
    '*': 'negrita',
    _: 'cursiva',
    '~': 'tachado',
};

/** Letra o número en cualquier alfabeto: al lado de una marca, la anula. */
const ALFANUMERICO = /[\p{L}\p{N}]/u;

/**
 * Dónde cierra la marca que abre en `inicio`, o -1 si no cierra.
 *
 * El cierre tiene que tener contenido que no sea espacio pegado antes y no
 * puede tener una letra pegada después. Es lo que hace que `_a_b` no abra
 * cursiva y que `hola _ mundo _` se quede como está.
 */
function buscarCierre(texto: string, inicio: number, marca: string): number {
    // Lo que sigue a la marca de apertura no puede ser espacio ni la misma
    // marca: `* hola*` y `**` no abren nada.
    const siguiente = texto[inicio + 1];
    if (siguiente === undefined || siguiente === ' ' || siguiente === marca) return -1;

    for (let i = inicio + 2; i < texto.length; i++) {
        if (texto[i] !== marca) continue;
        if (texto[i - 1] === ' ') continue;              // "hola *mundo *" no cierra
        const despues = texto[i + 1];
        if (despues !== undefined && ALFANUMERICO.test(despues)) continue; // "*a*b" no cierra
        return i;
    }
    return -1;
}

/** El texto de una línea, con las marcas de formato resueltas. */
function parsearInline(texto: string): NodoTexto[] {
    const salida: NodoTexto[] = [];
    let buffer = '';
    let i = 0;

    const volcar = () => {
        if (buffer) {
            salida.push({ tipo: 'texto', texto: buffer });
            buffer = '';
        }
    };

    while (i < texto.length) {
        const ch = texto[i];

        // Código en línea. Va primero porque adentro no se formatea nada.
        if (ch === '`') {
            const fin = texto.indexOf('`', i + 1);
            if (fin > i + 1) {
                volcar();
                salida.push({ tipo: 'codigo', texto: texto.slice(i + 1, fin) });
                i = fin + 1;
                continue;
            }
        }

        if (MARCAS[ch]) {
            // Con una letra o un número pegado antes, no es una marca: es un
            // `SKU_123` o un `12*3`.
            const anterior = i > 0 ? texto[i - 1] : '';
            if (!ALFANUMERICO.test(anterior)) {
                const cierre = buscarCierre(texto, i, ch);
                if (cierre !== -1) {
                    volcar();
                    salida.push({ tipo: MARCAS[ch], hijos: parsearInline(texto.slice(i + 1, cierre)) });
                    i = cierre + 1;
                    continue;
                }
            }
        }

        buffer += ch;
        i++;
    }

    volcar();
    return salida;
}

const CITA = /^>\s?(.*)$/;
/* Pide espacio DESPUÉS de la viñeta: sin eso, una línea que es solo
   `*urgente*` se leería como un item de lista vacío. */
const VINETA = /^[ \t]*[*-][ \t]+(.*)$/;
const NUMERADA = /^[ \t]*\d{1,3}[.)][ \t]+(.*)$/;

/**
 * Parte el mensaje en bloques.
 *
 * Cuando no hay ningún bloque especial -- que es el caso de casi todos los
 * mensajes -- devuelve un único párrafo con el texto entero, así el hilo
 * se dibuja exactamente como antes.
 */
export function parsearWhatsApp(texto: string): BloqueTexto[] {
    const lineas = texto.split('\n');
    const bloques: BloqueTexto[] = [];
    let i = 0;

    /* Las líneas normales se juntan en un solo párrafo conservando sus
       saltos: la burbuja ya usa `white-space: pre-wrap`, así que el salto
       se dibuja solo y no hace falta un bloque por línea. */
    let parrafo: string[] = [];
    const cerrarParrafo = () => {
        if (parrafo.length === 0) return;
        bloques.push({ tipo: 'parrafo', hijos: parsearInline(parrafo.join('\n')) });
        parrafo = [];
    };

    while (i < lineas.length) {
        const linea = lineas[i];

        // ---- Bloque de código ------------------------------------------
        if (linea.trim().startsWith('```')) {
            const resto = linea.trim().slice(3);
            const cuerpo: string[] = [];
            // ```código``` en una sola línea.
            if (resto.endsWith('```') && resto.length >= 3) {
                cerrarParrafo();
                bloques.push({ tipo: 'bloqueCodigo', texto: resto.slice(0, -3) });
                i++;
                continue;
            }
            let j = i + 1;
            let cerrado = false;
            if (resto) cuerpo.push(resto);
            while (j < lineas.length) {
                if (lineas[j].trim().endsWith('```')) {
                    const ultimo = lineas[j].trim().slice(0, -3);
                    if (ultimo) cuerpo.push(ultimo);
                    cerrado = true;
                    break;
                }
                cuerpo.push(lineas[j]);
                j++;
            }
            // Sin cierre no es un bloque: son tres acentos sueltos y se
            // dibujan tal cual, que es lo que hace WhatsApp.
            if (!cerrado) {
                parrafo.push(linea);
                i++;
                continue;
            }
            cerrarParrafo();
            bloques.push({ tipo: 'bloqueCodigo', texto: cuerpo.join('\n') });
            i = j + 1;
            continue;
        }

        // ---- Cita ------------------------------------------------------
        if (CITA.test(linea)) {
            cerrarParrafo();
            const dentro: string[] = [];
            while (i < lineas.length) {
                const m = lineas[i].match(CITA);
                if (!m) break;
                dentro.push(m[1]);
                i++;
            }
            bloques.push({ tipo: 'cita', hijos: parsearInline(dentro.join('\n')) });
            continue;
        }

        // ---- Listas ----------------------------------------------------
        const esVineta = VINETA.test(linea);
        const esNumerada = !esVineta && NUMERADA.test(linea);
        if (esVineta || esNumerada) {
            cerrarParrafo();
            const patron = esVineta ? VINETA : NUMERADA;
            const items: NodoTexto[][] = [];
            while (i < lineas.length) {
                const m = lineas[i].match(patron);
                if (!m) break;
                items.push(parsearInline(m[1]));
                i++;
            }
            bloques.push({ tipo: 'lista', ordenada: esNumerada, items });
            continue;
        }

        parrafo.push(linea);
        i++;
    }

    cerrarParrafo();
    return bloques.length > 0 ? bloques : [{ tipo: 'parrafo', hijos: [{ tipo: 'texto', texto }] }];
}

/**
 * ¿Vale la pena parsear esto?
 *
 * Un vistazo barato para no recorrer cien mensajes por carácter cuando
 * ninguno tiene formato, que es lo habitual.
 */
export function tieneFormato(texto: string | null | undefined): boolean {
    if (!texto) return false;
    return /[*_~`]/.test(texto) || /^[ \t]*(>|[*-][ \t]|\d{1,3}[.)][ \t])/m.test(texto);
}

/**
 * El texto sin las marcas, para donde no se puede dibujar formato: la
 * vista previa de la lista, la tarjetita de la cita, el buscador.
 *
 * Mostrar `*urgente*` en la vista previa de un chat es exactamente el
 * problema que este archivo viene a resolver, solo que en otro lugar.
 */
export function textoPlano(texto: string | null | undefined): string {
    if (!texto) return '';
    if (!tieneFormato(texto)) return texto;

    const aplanar = (nodos: NodoTexto[]): string =>
        nodos
            .map((n) => (n.tipo === 'texto' || n.tipo === 'codigo' ? n.texto : aplanar(n.hijos)))
            .join('');

    return parsearWhatsApp(texto)
        .map((b) => {
            if (b.tipo === 'bloqueCodigo') return b.texto;
            if (b.tipo === 'lista') return b.items.map((it) => `• ${aplanar(it)}`).join('\n');
            return aplanar(b.hijos);
        })
        .join('\n');
}

/* -------------------------------------------------------------------------- */
/*  ESCRIBIR CON FORMATO                                                       */
/* -------------------------------------------------------------------------- */

/** Lo que hay que hacerle a la caja de texto para aplicar una marca. */
export interface CambioDeFormato {
    texto: string;
    /** Dónde queda el cursor (o la selección) después. */
    inicio: number;
    fin: number;
}

/**
 * Envuelve la selección con una marca, o la quita si ya la tenía.
 *
 * Sin selección, deja las dos marcas puestas y el cursor en el medio, que
 * es lo que hace cualquier editor: se aprieta Ctrl+B y se empieza a
 * escribir en negrita.
 */
export function alternarMarca(
    texto: string,
    inicio: number,
    fin: number,
    marca: string,
): CambioDeFormato {
    const largo = marca.length;
    const seleccion = texto.slice(inicio, fin);

    // Ya envuelta: se quita. Se mira por dentro y por fuera de la selección,
    // porque da lo mismo haber seleccionado las marcas o solo el texto.
    if (seleccion.startsWith(marca) && seleccion.endsWith(marca) && seleccion.length > largo * 2) {
        const limpio = seleccion.slice(largo, -largo);
        return {
            texto: texto.slice(0, inicio) + limpio + texto.slice(fin),
            inicio,
            fin: inicio + limpio.length,
        };
    }
    if (texto.slice(inicio - largo, inicio) === marca && texto.slice(fin, fin + largo) === marca) {
        return {
            texto: texto.slice(0, inicio - largo) + seleccion + texto.slice(fin + largo),
            inicio: inicio - largo,
            fin: fin - largo,
        };
    }

    const envuelto = `${marca}${seleccion}${marca}`;
    return {
        texto: texto.slice(0, inicio) + envuelto + texto.slice(fin),
        inicio: inicio + largo,
        fin: inicio + largo + seleccion.length,
    };
}

/** Los atajos, en un solo lugar para que el hint y el manejador no se separen. */
export const ATAJOS_DE_FORMATO: ReadonlyArray<{
    tecla: string;
    conShift: boolean;
    marca: string;
    nombre: string;
    hint: string;
}> = [
    { tecla: 'b', conShift: false, marca: '*', nombre: 'Negrita', hint: 'Ctrl+B' },
    { tecla: 'i', conShift: false, marca: '_', nombre: 'Cursiva', hint: 'Ctrl+I' },
    { tecla: 'x', conShift: true, marca: '~', nombre: 'Tachado', hint: 'Ctrl+Shift+X' },
    { tecla: 'm', conShift: true, marca: '`', nombre: 'Monoespaciado', hint: 'Ctrl+Shift+M' },
];
