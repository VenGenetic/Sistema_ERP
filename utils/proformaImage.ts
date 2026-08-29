/**
 * Convierte la hoja de la proforma en un PNG listo para mandar por
 * WhatsApp.
 *
 * Se manda como IMAGEN y no como PDF a propósito: en WhatsApp una imagen
 * se ve en el chat sin abrir nada, y un PDF exige descargarlo -- muchos
 * clientes simplemente no lo abren. Es la misma decisión que ya tomaba la
 * proforma del POS, que ofrece "copiar como imagen".
 *
 * `html2canvas` se importa DINÁMICAMENTE: pesa ~200 kB y solo hace falta
 * cuando alguien manda una proforma. Cargarlo arriba lo metería en el
 * bundle principal de todas las páginas (ver la nota de vite.config.ts
 * sobre no importar librerías pesadas al tope).
 */

/** Escala de captura. 3x da una imagen nítida al hacer zoom en el teléfono. */
const ESCALA = 3;

export async function capturarProformaComoArchivo(
    nodo: HTMLElement,
    nombreArchivo: string,
): Promise<File> {
    const { default: html2canvas } = await import('html2canvas');

    // La hoja puede estar fuera de pantalla y las fotos vienen de Storage.
    // Esperarlas evita capturar recuadros vacíos si alguien pulsa Enviar
    // inmediatamente después de agregar el último repuesto.
    const imagenes = Array.from(nodo.querySelectorAll('img'));
    await Promise.all(imagenes.map(async (imagen) => {
        if (imagen.complete) return;
        await Promise.race([
            new Promise<void>((resolver) => {
                imagen.addEventListener('load', () => resolver(), { once: true });
                imagen.addEventListener('error', () => resolver(), { once: true });
            }),
            new Promise<void>((resolver) => window.setTimeout(resolver, 4_000)),
        ]);
    }));

    const canvas = await html2canvas(nodo, {
        useCORS: true,
        scale: ESCALA,
        // Fondo blanco explícito: el nodo se captura fuera de pantalla y
        // sin esto queda transparente, que en WhatsApp se ve negro.
        backgroundColor: '#ffffff',
    });

    const blob = await new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, 'image/png'));
    if (!blob) throw new Error('No se pudo generar la imagen de la proforma.');

    return new File([blob], nombreArchivo, { type: 'image/png' });
}

/**
 * El texto que acompaña a la imagen: el TOTAL y la nota. Nada más.
 *
 * El detalle de los repuestos NO se repite acá. Ya está en la hoja, bien
 * maquetado, con SKU, cantidad y disponibilidad: escribirlo otra vez
 * debajo le deja al cliente la misma lista dos veces —una prolija y otra
 * en viñetas— y en el teléfono esa segunda lista empuja la foto fuera de
 * la pantalla, que es justo lo que se le quería mostrar.
 *
 * El total sí va en texto, porque es el dato que el cliente después busca
 * en el chat, copia o le reenvía a alguien, y una imagen no se puede
 * buscar ni copiar. La nota va con él porque suele ser una condición
 * (garantía, plazo de entrega) que conviene poder releer sin abrir la foto.
 */
export function resumenDeProforma(params: { total: number; nota: string }): string {
    const lineas = [`*Total: $${params.total.toFixed(2)}*`];
    if (params.nota.trim()) lineas.push('', params.nota.trim());
    return lineas.join('\n');
}
