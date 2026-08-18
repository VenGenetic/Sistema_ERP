/**
 * mobilePrintQueue.ts
 * Manages a persistent print queue in Supabase (with fallback/migration from localStorage).
 * Users can accumulate multiple products with custom quantities,
 * then generate a single consolidated PDF with all labels.
 */
// jsPDF (y jsbarcode, que entra por mobileLabelPrinter) solo hacen falta al
// generar el PDF de la cola. Importados arriba del todo se llevaban por delante
// 145 kB comprimidos en CADA carga del modo móvil: MobileLayout importa de aquí
// `getPrintQueue` únicamente para pintar el número del badge, y eso bastaba para
// arrastrar el chunk entero. Se cargan bajo demanda, igual que `xlsx`/`jszip` en
// el resto del proyecto (ver vite.config.ts).
import type { jsPDF } from 'jspdf';
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

/**
 * Error de escritura en la cola.
 *
 * supabase-js NO lanza cuando el servidor rechaza la operación (RLS, columna
 * inexistente, fila ajena...): devuelve `{ error }` y sigue. Las mutaciones de
 * abajo avisaban del fallo por un evento de ventana y luego **retornaban
 * normalmente**, así que el `try/catch` de quien las llamaba nunca se enteraba:
 * ejecutaba su mensaje de éxito y pisaba el aviso de error. El teléfono decía
 * "agregado a la cola" y la computadora no veía ninguna etiqueta.
 *
 * Ahora se lanza. El fallo tira la caché para que la próxima lectura traiga la
 * verdad del servidor, y la pantalla se entera por donde ya lo esperaba.
 */
export class PrintQueueError extends Error {
    readonly action: string;

    constructor(action: string, detail: unknown) {
        super((detail as any)?.message || 'No se pudo guardar el cambio en la cola de impresión.');
        this.name = 'PrintQueueError';
        this.action = action;
    }
}

/** Tira la caché y devuelve el error a lanzar. */
const queueFailure = (action: string, detail: unknown): PrintQueueError => {
    console.error(`Error de la cola de impresión (${action}):`, detail);
    cachedQueue = null;
    notifyQueueChanged();
    return new PrintQueueError(action, detail);
};

// ── Sincronización en vivo entre dispositivos ──────────
// La cola se arma desde el teléfono y se imprime desde la computadora, así que
// los dos tienen que ver la misma lista sin recargar. Un canal de Realtime
// escucha los cambios de las filas propias y, ante cualquiera, tira la caché y
// avisa por el mismo evento que ya usan las pantallas locales -- de modo que a
// los consumidores les da igual si el cambio vino de este dispositivo o del
// otro.
//
// Requiere que print_queue_items esté en la publicación supabase_realtime
// (migración 20260814090000): sin eso el canal se suscribe igual pero no llega
// ningún evento.
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let realtimeUserId: string | null = null;

const teardownRealtime = () => {
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }
    realtimeUserId = null;
};

const ensureRealtime = (userId: string) => {
    // Un solo canal por usuario: getPrintQueue() llama aquí en cada lectura y
    // varias pantallas leen a la vez.
    if (realtimeChannel && realtimeUserId === userId) return;
    teardownRealtime();

    realtimeUserId = userId;
    realtimeChannel = supabase
        .channel(`print-queue-${userId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'print_queue_items',
                filter: `user_id=eq.${userId}`,
            },
            () => {
                // Se invalida en vez de aplicar el payload: la fila cruda trae
                // product_id, no el sku/nombre/imagen que la lista muestra
                // (vienen del join con products).
                cachedQueue = null;
                notifyQueueChanged();
            }
        )
        .subscribe();
};

// La caché vive en el módulo, así que sobrevive a un cambio de sesión: entrar
// y salir no recarga la SPA. Sin invalidarla aquí, la cola leída con la sesión
// anterior seguía sirviéndose después -- vacía tras un cierre de sesión, o
// peor, la de otro usuario si dos personas usan la misma máquina.
if (typeof window !== 'undefined') {
    supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
            cachedQueue = null;
            // El canal queda atado al usuario anterior; se recrea en la
            // siguiente lectura ya con la sesión nueva.
            if (event === 'SIGNED_OUT') teardownRealtime();
            notifyQueueChanged();
        }
    });
}

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
            // Sin sesión no se sabe de quién es la cola, así que se devuelve
            // vacía sin guardarla: cachear ese [] lo volvía la respuesta a
            // toda lectura posterior, y la cola parecía borrada al volver a
            // entrar (el login no recarga la SPA, la caché del módulo sigue viva).
            cachedQueue = null;
            teardownRealtime();
            return [];
        }

        ensureRealtime(userData.user.id);
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

        // `products` llega en null cuando el repuesto se eliminó (o quedó fuera
        // de lo que deja ver RLS) después de encolarlo. Antes se leía
        // `item.products.sku` a pelo: el TypeError subía hasta el catch de abajo
        // y la cola ENTERA se devolvía vacía, como si el usuario la hubiera
        // borrado. Se descarta solo la fila huérfana.
        cachedQueue = (data as any[])
            .filter(item => item.products)
            .map((item: any) => ({
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

        const { error } = existingLocal
            ? await supabase
                .from('print_queue_items')
                .update({ quantity: newQty })
                .eq('user_id', userData.user.id)
                .eq('product_id', product.id)
            : await supabase
                .from('print_queue_items')
                .insert({
                    user_id: userData.user.id,
                    product_id: product.id,
                    quantity: newQty
                });

        // Si el servidor lo rechazó, no se toca la caché: mostrar la etiqueta
        // "ya encolada" cuando no llegó a guardarse es peor que no mostrarla.
        if (error) throw queueFailure('agregar', error);

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
        if (e instanceof PrintQueueError) throw e;
        throw queueFailure('agregar', e);
    }
};

// ── Remove single item ────────────────────────────────
export const removeFromQueue = async (product_id: number): Promise<PrintQueueItem[]> => {
    try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
            const { error } = await supabase
                .from('print_queue_items')
                .delete()
                .eq('user_id', userData.user.id)
                .eq('product_id', product_id);
            if (error) throw queueFailure('quitar', error);
        }
        if (cachedQueue) {
            cachedQueue = cachedQueue.filter(item => item.id !== product_id);
        }
        notifyQueueChanged();
        return cachedQueue ?? await getPrintQueue();
    } catch (e) {
        if (e instanceof PrintQueueError) throw e;
        throw queueFailure('quitar', e);
    }
};

// ── Update quantity ────────────────────────────────────
export const updateQueueItemQty = async (product_id: number, newQty: number): Promise<PrintQueueItem[]> => {
    const q = Math.max(1, newQty);
    try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
            const { error } = await supabase
                .from('print_queue_items')
                .update({ quantity: q })
                .eq('user_id', userData.user.id)
                .eq('product_id', product_id);
            if (error) throw queueFailure('cambiar la cantidad', error);
        }
        if (cachedQueue) {
            cachedQueue = cachedQueue.map(item =>
                item.id === product_id ? { ...item, quantity: q } : item
            );
        }
        notifyQueueChanged();
        return cachedQueue ?? await getPrintQueue();
    } catch (e) {
        if (e instanceof PrintQueueError) throw e;
        throw queueFailure('cambiar la cantidad', e);
    }
};

// ── Clear all ──────────────────────────────────────────
export const clearQueue = async (): Promise<void> => {
    try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
            const { error } = await supabase
                .from('print_queue_items')
                .delete()
                .eq('user_id', userData.user.id);
            if (error) throw queueFailure('vaciar', error);
        }
        cachedQueue = [];
        notifyQueueChanged();
    } catch (e) {
        if (e instanceof PrintQueueError) throw e;
        throw queueFailure('vaciar', e);
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
export const generateQueuePDF = async (queue: PrintQueueItem[]): Promise<jsPDF> => {
    if (!queue || queue.length === 0) throw new Error('La cola está vacía');

    const [{ jsPDF: JsPDF }, { renderLabelToCanvas }] = await Promise.all([
        import('jspdf'),
        import('./mobileLabelPrinter'),
    ]);

    const pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const cols = 3;
    const rows = 7;
    const LABEL_W = 210 / cols;
    const LABEL_H = 297 / rows;
    const perPage = cols * rows; // 21

    const canvasCache = new Map<string, string>();
    let globalIndex = 0;

    for (const item of queue) {
        if (!canvasCache.has(item.sku)) {
            const canvas = await renderLabelToCanvas({ sku: item.sku, name: item.name });
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
export const downloadQueuePDF = async (queue: PrintQueueItem[]): Promise<void> => {
    const pdf = await generateQueuePDF(queue);
    const total = getQueueTotalLabels(queue);
    pdf.save(`etiquetas_cola_x${total}.pdf`);

    if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
    }
};
