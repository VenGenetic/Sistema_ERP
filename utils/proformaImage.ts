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
 * Resumen en texto de la proforma.
 *
 * Va ADEMÁS de la imagen, no en lugar de ella: la imagen no se puede
 * copiar ni buscar, y el cliente muchas veces quiere reenviarle el total a
 * alguien o buscarlo después en el chat. El texto también es lo que queda
 * legible en el historial del ERP.
 */
export function resumenDeProforma(params: {
    items: Array<{ name: string; quantity: number; unitPrice: number }>;
    envio: number | null;
    total: number;
    nota: string;
}): string {
    const lineas = params.items.map(
        (i) =>
            `• ${i.name}` +
            (i.quantity > 1 ? ` x${i.quantity}` : '') +
            ` — $${(i.quantity * i.unitPrice).toFixed(2)}`,
    );
    if (params.envio !== null) lineas.push(`• Envío — $${params.envio.toFixed(2)}`);
    lineas.push('', `*Total: $${params.total.toFixed(2)}*`);
    if (params.nota.trim()) lineas.push('', params.nota.trim());
    return lineas.join('\n');
}
