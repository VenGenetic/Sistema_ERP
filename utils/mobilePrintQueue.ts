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
export const getPrintQueue = async (): Promise<PrintQueueItem[]> => {
    try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return [];

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
            return [];
        }

        return data.map((item: any) => ({
            id: item.product_id,
            sku: item.products.sku,
            name: item.products.name,
            image_url: item.products.image_url,
            quantity: item.quantity,
            addedAt: new Date(item.created_at).getTime()
        }));
    } catch (err) {
        console.error('getPrintQueue Error:', err);
        return [];
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
        
        // Fetch existing to add
        const { data: existing } = await supabase
            .from('print_queue_items')
            .select('quantity')
            .eq('user_id', userData.user.id)
            .eq('product_id', product.id)
            .maybeSingle();

        if (existing) {
            await supabase
                .from('print_queue_items')
                .update({ quantity: existing.quantity + q })
                .eq('user_id', userData.user.id)
                .eq('product_id', product.id);
        } else {
            await supabase
                .from('print_queue_items')
                .insert({
                    user_id: userData.user.id,
                    product_id: product.id,
                    quantity: q
                });
        }
    } catch (e) {
        console.error('Error in addToQueue:', e);
    }
    
    // Return updated queue
    return await getPrintQueue();
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
    } catch (e) {
        console.error('Error in removeFromQueue:', e);
    }
    return await getPrintQueue();
};

// ── Update quantity ────────────────────────────────────
export const updateQueueItemQty = async (product_id: number, newQty: number): Promise<PrintQueueItem[]> => {
    try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
            await supabase
                .from('print_queue_items')
                .update({ quantity: Math.max(1, newQty) })
                .eq('user_id', userData.user.id)
                .eq('product_id', product_id);
        }
    } catch (e) {
        console.error('Error in updateQueueItemQty:', e);
    }
    return await getPrintQueue();
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
