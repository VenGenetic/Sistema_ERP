/**
 * mobilePrintQueue.ts
 * Manages a persistent print queue (draft) in localStorage.
 * Users can accumulate multiple products with custom quantities,
 * then generate a single consolidated PDF with all labels.
 */
import { renderLabelToCanvas } from './mobileLabelPrinter';
import { jsPDF } from 'jspdf';

// ── Types ──────────────────────────────────────────────
export interface PrintQueueItem {
    id: number;
    sku: string;
    name: string;
    image_url?: string;
    quantity: number;       // any positive integer (1, 2, 5, etc.)
    addedAt: number;        // timestamp
}

// ── Constants ──────────────────────────────────────────
const QUEUE_KEY = 'mobile_print_queue';

// ── Read ───────────────────────────────────────────────
export const getPrintQueue = (): PrintQueueItem[] => {
    try {
        const raw = localStorage.getItem(QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

// ── Write helpers ──────────────────────────────────────
const saveQueue = (queue: PrintQueueItem[]): void => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

// ── Add / merge ────────────────────────────────────────
/** If a product with the same SKU already exists, its quantity is SUMMED. */
export const addToQueue = (
    product: { id: number; sku: string; name: string; image_url?: string },
    quantity: number
): PrintQueueItem[] => {
    const queue = getPrintQueue();
    const existing = queue.find(q => q.sku === product.sku);

    if (existing) {
        existing.quantity += quantity;
        existing.addedAt = Date.now();
    } else {
        queue.push({
            id: product.id,
            sku: product.sku,
            name: product.name,
            image_url: product.image_url,
            quantity: Math.max(1, quantity),
            addedAt: Date.now(),
        });
    }
    saveQueue(queue);
    return queue;
};

// ── Remove single item ────────────────────────────────
export const removeFromQueue = (sku: string): PrintQueueItem[] => {
    const queue = getPrintQueue().filter(q => q.sku !== sku);
    saveQueue(queue);
    return queue;
};

// ── Update quantity ────────────────────────────────────
export const updateQueueItemQty = (sku: string, newQty: number): PrintQueueItem[] => {
    const queue = getPrintQueue();
    const item = queue.find(q => q.sku === sku);
    if (item) {
        item.quantity = Math.max(1, newQty);
    }
    saveQueue(queue);
    return queue;
};

// ── Clear all ──────────────────────────────────────────
export const clearQueue = (): void => {
    localStorage.removeItem(QUEUE_KEY);
};

// ── Totals ─────────────────────────────────────────────
export const getQueueTotalLabels = (queue?: PrintQueueItem[]): number => {
    const q = queue || getPrintQueue();
    return q.reduce((acc, item) => acc + item.quantity, 0);
};

export const getQueuePageCount = (queue?: PrintQueueItem[]): number => {
    const total = getQueueTotalLabels(queue);
    return Math.ceil(total / 21); // 3 cols × 7 rows = 21 per A4
};

// ── Generate consolidated PDF ──────────────────────────
/**
 * Generates a single PDF containing all labels from the queue.
 * Different products are rendered sequentially, filling 3×7 A4 pages.
 * Returns the jsPDF instance (caller can save or open).
 */
export const generateQueuePDF = (queue?: PrintQueueItem[]): jsPDF => {
    const items = queue || getPrintQueue();
    if (items.length === 0) throw new Error('La cola está vacía');

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const cols = 3;
    const rows = 7;
    const LABEL_W = 210 / cols;
    const LABEL_H = 297 / rows;
    const perPage = cols * rows; // 21

    // Pre-render all label canvases (one per unique product)
    const canvasCache = new Map<string, string>();

    let globalIndex = 0; // tracks the position across all pages

    for (const item of items) {
        // Get or create cached label image
        if (!canvasCache.has(item.sku)) {
            const canvas = renderLabelToCanvas({ sku: item.sku, name: item.name });
            canvasCache.set(item.sku, canvas.toDataURL('image/png', 1.0));
        }
        const imgData = canvasCache.get(item.sku)!;

        for (let i = 0; i < item.quantity; i++) {
            // Add new page if needed (skip for the very first label)
            if (globalIndex > 0 && globalIndex % perPage === 0) {
                pdf.addPage();
            }

            const indexOnPage = globalIndex % perPage;
            const col = indexOnPage % cols;
            const row = Math.floor(indexOnPage / cols);
            const x = col * LABEL_W;
            const y = row * LABEL_H;

            // Dashed cut guide
            pdf.setDrawColor(0, 0, 0);
            pdf.setLineWidth(0.2);
            pdf.setLineDashPattern([2, 1.5], 0);
            pdf.rect(x, y, LABEL_W, LABEL_H);
            pdf.setLineDashPattern([], 0);

            // Label image
            pdf.addImage(imgData, 'PNG', x, y, LABEL_W, LABEL_H);
            globalIndex++;
        }
    }

    return pdf;
};

// ── Download consolidated PDF ──────────────────────────
export const downloadQueuePDF = (queue?: PrintQueueItem[]): void => {
    const items = queue || getPrintQueue();
    const pdf = generateQueuePDF(items);
    const total = getQueueTotalLabels(items);
    pdf.save(`etiquetas_cola_x${total}.pdf`);

    if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
    }
};
