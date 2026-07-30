/**
 * mobilePrintQueue.ts
 * Manages a persistent print queue in Supabase (with fallback/migration from localStorage).
 * Users can accumulate multiple products with custom quantities,
 * then generate a single consolidated PDF with all labels.
 */
import { renderLabelToCanvas } from './mobileLabelPrinter';
import { jsPDF } from 'jspdf';
import { supabase } from '../supabaseClient';

// ── Types ──────────────────────────────────────────────
export interface PrintQueueItem {
    id: number;           // product_id
    sku: string;
    name: string;
    image_url?: string;
    quantity: number;
    addedAt?: number;
}

// ── Constants ──────────────────────────────────────────
const QUEUE_KEY = 'mobile_print_queue';

// ── In-memory cache ────────────────────────────────────
// Avoids a full round-trip (auth check + joined SELECT) after every single
// mutation (add/remove/qty change). Mutations below update this cache
// optimistically once the write succeeds, instead of re-fetching from
// Supabase. This matters most on mobile: the "Labels" queue screen has
// rapid-fire +/- quantity taps, and each one used to cost 2 network
// round-trips just to redraw the same list. Consumers that need a
// guaranteed-fresh read (e.g. opening the desktop preview modal) can pass
// force=true to getPrintQueue().
let cachedQueue: PrintQueueItem[] | null = null;

// Notify listeners (e.g. the mobile bottom-nav badge) that the queue changed
// without them needing to poll or re-fetch from the network.
const notifyQueueChanged = () => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('print-queue-changed'));
    }
};

// ── Migration from Local Storage ───────────────────────
export const migrateLocalQueueToSupabase = async (userId: string) => {
    try {
        const raw = localStorage.getItem(QUEUE_KEY);
        if (raw) {
            const localQueue: PrintQueueItem[] = JSON.parse(raw);
            if (localQueue.length > 0) {
                // Upsert items into supabase
                const upsertData = localQueue.map(item => ({
                    user_id: userId,
                    product_id: item.id,
                    quantity: item.quantity
                }));
                
                const { error } = await supabase
                    .from('print_queue_items')
                    .upsert(upsertData, { onConflict: 'user_id, product_id' });
                    
                if (!error) {
                    localStorage.removeItem(QUEUE_KEY);
                    console.log('Migrated local queue to Supabase');
                } else {
                    console.error('Error migrating queue:', error);
                }
            } else {
                localStorage.removeItem(QUEUE_KEY);
            }
        }
    } catch (e) {
        console.error('Failed to migrate local queue:', e);
    }
};

// ── Read ───────────────────────────────────────────────
// force=true skips the in-memory cache and always re-fetches from Supabase
// (use when correctness matters more than speed, e.g. opening a modal that
// must reflect what another tab/device may have changed).
export const getPrintQueue = async (force = false): Promise<PrintQueueItem[]> => {
    if (!force && cachedQueue !== null) {
        return cachedQueue;
    }

    try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
            cachedQueue = [];
            return cachedQueue;
        }

        await migrateLocalQueueToSupabase(userData.user.id);

        const { data, error } = await supabase
            .from('print_queue_items')
            .select(`
                quantity,
                created_at,
                product_id,
                products (
                    sku,
                    name,
                    image_url
                )
            `)
            .eq('user_id', userData.user.id)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching print queue:', error);
            return cachedQueue ?? [];
        }

        cachedQueue = data.map((item: any) => ({
            id: item.product_id,
            sku: item.products.sku,
            name: item.products.name,
            image_url: item.products.image_url,
            quantity: item.quantity,
            addedAt: new Date(item.created_at).getTime()
        }));
        return cachedQueue;
    } catch (err) {
        console.error('getPrintQueue Error:', err);
        return cachedQueue ?? [];
    }
};

// ── Add / merge ────────────────────────────────────────
export const addToQueue = async (
    product: { id: number; sku: string; name: string; image_url?: string },
    quantity: number
): Promise<PrintQueueItem[]> => {
    try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return await getPrintQueue();

        const q = Math.max(1, quantity);

        // Make sure we have a queue to read the "already in queue?" state
        // from locally, instead of an extra SELECT round-trip.
        if (cachedQueue === null) await getPrintQueue();
        const existingLocal = cachedQueue?.find(item => item.id === product.id);
        const newQty = (existingLocal?.quantity || 0) + q;

        if (existingLocal) {
            await supabase
                .from('print_queue_items')
                .update({ quantity: newQty })
                .eq('user_id', userData.user.id)
                .eq('product_id', product.id);
        } else {
            await supabase
                .from('print_queue_items')
                .insert({
                    user_id: userData.user.id,
                    product_id: product.id,
                    quantity: newQty
                });
        }

        if (cachedQueue) {
            if (existingLocal) {
                cachedQueue = cachedQueue.map(item =>
                    item.id === product.id ? { ...item, quantity: newQty } : item
                );
            } else {
                cachedQueue = [...cachedQueue, {
                    id: product.id,
                    sku: product.sku,
                    name: product.name,
                    image_url: product.image_url,
                    quantity: newQty,
                    addedAt: Date.now(),
                }];
            }
        }
        notifyQueueChanged();
        return cachedQueue ?? await getPrintQueue();
    } catch (e) {
        console.error('Error in addToQueue:', e);
        return await getPrintQueue(true);
    }
};

// ── Remove single item ────────────────────────────────
export const removeFromQueue = async (product_id: number): Promise<PrintQueueItem[]> => {
    try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
            await supabase
                .from('print_queue_items')
                .delete()
                .eq('user_id', userData.user.id)
                .eq('product_id', product_id);
        }
        if (cachedQueue) {
            cachedQueue = cachedQueue.filter(item => item.id !== product_id);
        }
        notifyQueueChanged();
        return cachedQueue ?? await getPrintQueue();
    } catch (e) {
        console.error('Error in removeFromQueue:', e);
        return await getPrintQueue(true);
    }
};

// ── Update quantity ────────────────────────────────────
export const updateQueueItemQty = async (product_id: number, newQty: number): Promise<PrintQueueItem[]> => {
    const q = Math.max(1, newQty);
    try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
            await supabase
                .from('print_queue_items')
                .update({ quantity: q })
                .eq('user_id', userData.user.id)
                .eq('product_id', product_id);
        }
        if (cachedQueue) {
            cachedQueue = cachedQueue.map(item =>
                item.id === product_id ? { ...item, quantity: q } : item
            );
        }
        notifyQueueChanged();
        return cachedQueue ?? await getPrintQueue();
    } catch (e) {
        console.error('Error in updateQueueItemQty:', e);
        return await getPrintQueue(true);
    }
};

// ── Clear all ──────────────────────────────────────────
export const clearQueue = async (): Promise<void> => {
    try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
            await supabase
                .from('print_queue_items')
                .delete()
                .eq('user_id', userData.user.id);
        }
        cachedQueue = [];
        notifyQueueChanged();
    } catch (e) {
        console.error('Error in clearQueue:', e);
    }
};

// ── Totals ─────────────────────────────────────────────
export const getQueueTotalLabels = (queue: PrintQueueItem[]): number => {
    return queue.reduce((acc, item) => acc + item.quantity, 0);
};

export const getQueuePageCount = (queue: PrintQueueItem[]): number => {
    const total = getQueueTotalLabels(queue);
    return Math.ceil(total / 21); // 3 cols × 7 rows = 21 per A4
};

// ── Generate consolidated PDF ──────────────────────────
export const generateQueuePDF = (queue: PrintQueueItem[]): jsPDF => {
    if (!queue || queue.length === 0) throw new Error('La cola está vacía');

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const cols = 3;
    const rows = 7;
    const LABEL_W = 210 / cols;
    const LABEL_H = 297 / rows;
    const perPage = cols * rows; // 21

    const canvasCache = new Map<string, string>();
    let globalIndex = 0; 

    for (const item of queue) {
        if (!canvasCache.has(item.sku)) {
            const canvas = renderLabelToCanvas({ sku: item.sku, name: item.name });
            canvasCache.set(item.sku, canvas.toDataURL('image/png', 1.0));
        }
        const imgData = canvasCache.get(item.sku)!;

        for (let i = 0; i < item.quantity; i++) {
            if (globalIndex > 0 && globalIndex % perPage === 0) {
                pdf.addPage();
            }

            const indexOnPage = globalIndex % perPage;
            const col = indexOnPage % cols;
            const row = Math.floor(indexOnPage / cols);
            const x = col * LABEL_W;
            const y = row * LABEL_H;

            pdf.setDrawColor(0, 0, 0);
            pdf.setLineWidth(0.2);
            pdf.setLineDashPattern([2, 1.5], 0);
            pdf.rect(x, y, LABEL_W, LABEL_H);
            pdf.setLineDashPattern([], 0);

            pdf.addImage(imgData, 'PNG', x, y, LABEL_W, LABEL_H);
            globalIndex++;
        }
    }

    return pdf;
};

// ── Download consolidated PDF ──────────────────────────
export const downloadQueuePDF = (queue: PrintQueueItem[]): void => {
    const pdf = generateQueuePDF(queue);
    const total = getQueueTotalLabels(queue);
    pdf.save(`etiquetas_cola_x${total}.pdf`);

    if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
    }
};
