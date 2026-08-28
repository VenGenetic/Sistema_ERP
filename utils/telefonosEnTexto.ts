/**
 * Encontrar los teléfonos que vienen ESCRITOS dentro de un mensaje.
 *
 * Pasa todo el día: el cliente manda «llámame al 0999123456», o «este es
 * el número de mi hermano, él la va a retirar». Hasta ahora eso era texto
 * muerto: había que seleccionarlo con el mouse, copiarlo, pegarlo en el
 * buscador y rezar para que el chat existiera. Marcándolos se puede tocar
 * el número y saltar al chat de esa persona -- o abrirle uno.
 *
 * El criterio de qué es un teléfono es DELIBERADAMENTE estrecho. Un falso
 * positivo acá no es un detalle estético: subraya un precio o un código de
 * repuesto como si fuera un teléfono y, si alguien lo toca, le abre un
 * chat contra un número que no existe. Así que solo se aceptan las formas
 * ecuatorianas reales:
 *
 *   - celular:  09XXXXXXXX · 9XXXXXXXX · +593 9X XXX XXXX · 5939XXXXXXXX
 *   - fijo:     0[2-7]XXXXXXX · +593 [2-7]XXXXXXX
 *
 * y siempre con el número entero aislado: si tiene otro dígito pegado
 * antes o después, no es un teléfono. Eso es lo que deja fuera los LID de
 * WhatsApp (14-15 dígitos), que son el falso positivo peligroso porque
 * empiezan por 9 bastante seguido.
 */

import { normalizePhoneEC } from './phone';

/*
    Los separadores son espacio, punto y guion: los que la gente usa al
    escribir un número. NO se usa `\s`, que incluye el salto de línea: un
    teléfono no se parte en dos renglones, y con `\s` dos números en
    líneas seguidas se fusionaban en uno solo inexistente.

    El grupo 1 es el carácter que va ANTES (o el principio del texto). Se
    usa en vez de un lookbehind `(?<!\d)` porque el lookbehind no existe
    en Safari viejo y ahí el módulo entero no carga: la pantalla queda en
    blanco por un subrayado. El grupo 2 es el teléfono.
*/
const TELEFONO_EC = /(^|[^\d])((?:(?:\+[ ]?)?593[ .-]?)?(?:0?9(?:[ .-]?\d){8}|0[2-7](?:[ .-]?\d){7}))(?!\d)/g;

/**
 * Cómo tiene que quedar un teléfono ecuatoriano ya normalizado: 593 + 9
 * dígitos de celular, o 593 + 8 de fijo. Es el filtro final, después de
 * limpiar el número; ataja los casos que la expresión de arriba deja
 * pasar por los prefijos opcionales (`5930991234567`, por ejemplo).
 */
const NORMALIZADO_VALIDO = /^593(?:9\d{8}|[2-7]\d{7})$/;

/** ¿Este texto es un teléfono ecuatoriano al que se le puede escribir? */
export function esTelefonoEC(texto: string | null | undefined): boolean {
    if (!texto) return false;
    return NORMALIZADO_VALIDO.test(normalizePhoneEC(texto));
}

export type TrozoDeTexto =
    /** Texto común y corriente. */
    | { tipo: 'texto'; texto: string }
    /**
     * Un teléfono. `texto` es como lo escribió la persona (se muestra tal
     * cual: cambiárselo confunde) y `numero` es el normalizado, que es con
     * el que se busca en la base.
     */
    | { tipo: 'telefono'; texto: string; numero: string };

/**
 * Parte el texto de un mensaje en trozos, marcando los teléfonos.
 *
 * Devuelve SIEMPRE al menos un trozo (el texto entero) para que quien
 * dibuje no tenga que distinguir el caso «no había ninguno».
 */
export function partirPorTelefonos(texto: string): TrozoDeTexto[] {
    if (!texto) return [{ tipo: 'texto', texto: '' }];

    const trozos: TrozoDeTexto[] = [];
    let desde = 0;

    // La expresión es global y guarda `lastIndex` entre llamadas: sin
    // reiniciarlo, la segunda burbuja empezaría a buscar por la mitad.
    TELEFONO_EC.lastIndex = 0;

    let m: RegExpExecArray | null;
    while ((m = TELEFONO_EC.exec(texto)) !== null) {
        const crudo = m[2];
        const numero = normalizePhoneEC(crudo);

        // El inicio real del teléfono: después del carácter de borde que
        // la expresión tuvo que consumir para saber que no había un dígito
        // pegado adelante.
        const inicio = m.index + m[1].length;

        if (!NORMALIZADO_VALIDO.test(numero)) continue;

        if (inicio > desde) trozos.push({ tipo: 'texto', texto: texto.slice(desde, inicio) });
        trozos.push({ tipo: 'telefono', texto: crudo, numero });
        desde = inicio + crudo.length;
    }

    if (desde < texto.length) trozos.push({ tipo: 'texto', texto: texto.slice(desde) });
    return trozos.length > 0 ? trozos : [{ tipo: 'texto', texto }];
}

/** ¿Hay al menos un teléfono acá adentro? Evita partir de gusto. */
export function tieneTelefono(texto: string | null | undefined): boolean {
    if (!texto) return false;
    TELEFONO_EC.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TELEFONO_EC.exec(texto)) !== null) {
        if (NORMALIZADO_VALIDO.test(normalizePhoneEC(m[2]))) return true;
    }
    return false;
}
