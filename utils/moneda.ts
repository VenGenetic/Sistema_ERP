/**
 * Formato de dinero del sistema, en un solo lugar.
 *
 * Hasta ahora cada pantalla armaba el suyo y convivían dos formatos
 * incompatibles: Finanzas, el Dashboard y el registro diario mostraban
 * `$1,234.56` (locale en-US) mientras Productos, el catálogo móvil y la
 * analítica mostraban `$1.234,56` (locale es-EC). El mismo saldo se leía
 * distinto según por dónde se entrara, y `1.234` en una pantalla significaba
 * mil doscientos y en la otra uno con veintitrés.
 *
 * Se estandariza en es-EC, que es como se escriben las cifras acá y el que ya
 * usaba la mayor parte del sistema.
 *
 * Nota: esto NO es el precio que se le canta al cliente por WhatsApp — ese va
 * redondeado al dólar entero y vive en `utils/precioCliente.ts`.
 */

const LOCALE = 'es-EC';

const cache = new Map<string, Intl.NumberFormat>();

function formateador(moneda: string): Intl.NumberFormat {
    let f = cache.get(moneda);
    if (!f) {
        f = new Intl.NumberFormat(LOCALE, {
            style: 'currency',
            currency: moneda,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        cache.set(moneda, f);
    }
    return f;
}

/** `$1.234,56`. Un valor nulo o no numérico se muestra como cero, no como NaN. */
export function formatearMoneda(valor: number | null | undefined, moneda: string = 'USD'): string {
    const n = Number(valor);
    return formateador(moneda || 'USD').format(Number.isFinite(n) ? n : 0);
}

/** Alias corto, que es como ya se llamaba en la mayoría de las pantallas. */
export const money = formatearMoneda;
