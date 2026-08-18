/**
 * mobilePrintHistory.ts
 * Historial local de los últimos repuestos enviados a la cola de etiquetas.
 *
 * Vivía dentro de `mobileLabelPrinter.ts`, junto al dibujo de la etiqueta. El
 * problema era de peso, no de orden: ese módulo importa `jsbarcode` de forma
 * estática, así que el catálogo móvil —que solo quiere anotar "este repuesto se
 * encoló"— se descargaba también el generador de códigos de barras (~15 kB
 * comprimidos) sin llegar a dibujar uno. Aquí no hay más dependencia que
 * localStorage.
 */

const HISTORY_KEY = 'mobile_print_history';
const MAX_HISTORY = 15;

export interface PrintHistoryItem {
    id: number;
    sku: string;
    name: string;
    image_url?: string;
    printedAt: number; // timestamp
    quantity: number;
}

export const getPrintHistory = (): PrintHistoryItem[] => {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

export const addToPrintHistory = (
    product: { id: number; sku: string; name: string; image_url?: string },
    quantity: number
): void => {
    try {
        const history = getPrintHistory();
        // Remove existing entry for same product if any
        const filtered = history.filter(h => h.id !== product.id);
        filtered.unshift({
            id: product.id,
            sku: product.sku,
            name: product.name,
            image_url: product.image_url,
            printedAt: Date.now(),
            quantity,
        });
        // Keep only latest N
        const trimmed = filtered.slice(0, MAX_HISTORY);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    } catch (e) {
        console.error('Error saving print history:', e);
    }
};
