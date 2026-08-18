import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { getThumbnailUrl } from '../../utils/image';
import { addToPrintHistory, getPrintHistory, PrintHistoryItem } from '../../utils/mobilePrintHistory';
import { useMobileProducts, searchProducts } from '../../utils/mobileSearchEngine';
import MobileSearchBar from '../../components/mobile/MobileSearchBar';
import { CheckCircle2, Eye, History, ImageOff, Info, Layers, ListChecks, Minus, Plus, Printer, Receipt, SearchX, SlidersHorizontal, Trash2, TriangleAlert, Zap } from 'lucide-react';
import {
    getPrintQueue, addToQueue, removeFromQueue, updateQueueItemQty,
    clearQueue, getQueueTotalLabels,
    PrintQueueItem
} from '../../utils/mobilePrintQueue';
import { PrintQueuePreviewModal } from '../../components/PrintQueuePreviewModal';

/**
 * Cantidades de un toque.
 *
 * 21 no es una preferencia: son las etiquetas que entran en una hoja A4
 * (3 columnas × 7 filas), así que imprimir 21 no desperdicia papel. Las otras
 * dos sí son costumbre y cambian según el trabajo del día, por eso se guardan.
 */
const QUICK_QTY_KEY = 'mobile:labelQuickQty';
const DEFAULT_QUICK_QTY = [3, 6, 21];

const readQuickQty = (): number[] => {
    try {
        const saved = JSON.parse(localStorage.getItem(QUICK_QTY_KEY) || 'null');
        if (Array.isArray(saved) && saved.length === 3 && saved.every(n => Number.isInteger(n) && n > 0)) {
            return saved;
        }
    } catch { /* valor corrupto: se usa el de siempre */ }
    return DEFAULT_QUICK_QTY;
};

const MobileLabels: React.FC = () => {
    const { products: allProducts, loading: catalogLoading } = useMobileProducts();
    const [searchTerm, setSearchTerm] = useState('');
    const [printHistory, setPrintHistory] = useState<PrintHistoryItem[]>([]);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    // Los fallos de la cola se decían con `alert()`, que en el teléfono tapa la
    // pantalla y hay que descartar a mano; ahora comparten sitio con el aviso
    // de éxito y se retiran solos.
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [customQtyMap, setCustomQtyMap] = useState<Record<string, number>>({});
    const [reprintLoading, setReprintLoading] = useState(false);

    // ── Tab State ──────────────────────────────────────
    const [activeTab, setActiveTab] = useState<'quick' | 'queue'>('quick');
    const [quickQty, setQuickQty] = useState<number[]>(readQuickQty);
    const [isEditingQuickQty, setIsEditingQuickQty] = useState(false);

    const saveQuickQty = (index: number, value: number) => {
        setQuickQty(prev => {
            const next = prev.map((v, i) => (i === index ? Math.max(1, value) : v));
            try { localStorage.setItem(QUICK_QTY_KEY, JSON.stringify(next)); } catch { /* modo privado */ }
            return next;
        });
    };

    // ── Queue State ────────────────────────────────────
    const [queue, setQueue] = useState<PrintQueueItem[]>([]);
    const [queueSearchTerm, setQueueSearchTerm] = useState('');
    const [debouncedQueueSearch, setDebouncedQueueSearch] = useState('');
    const [queueQtyMap, setQueueQtyMap] = useState<Record<string, number>>({});
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const queueDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Un solo temporizador para los avisos: encadenar dos acciones hacía que el
    // primero borrara el mensaje del segundo, y el último seguía vivo tras salir.
    const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clearSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const flash = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
        if (messageTimer.current) clearTimeout(messageTimer.current);
        setSuccessMessage(kind === 'ok' ? text : null);
        setErrorMessage(kind === 'error' ? text : null);
        messageTimer.current = setTimeout(() => {
            setSuccessMessage(null);
            setErrorMessage(null);
        }, kind === 'ok' ? 1800 : 4000);
    }, []);

    useEffect(() => () => {
        if (messageTimer.current) clearTimeout(messageTimer.current);
        if (clearSearchTimer.current) clearTimeout(clearSearchTimer.current);
    }, []);

    // Debounce queue search
    useEffect(() => {
        if (queueDebounceRef.current) clearTimeout(queueDebounceRef.current);
        queueDebounceRef.current = setTimeout(() => {
            setDebouncedQueueSearch(queueSearchTerm);
        }, 250);
        return () => { if (queueDebounceRef.current) clearTimeout(queueDebounceRef.current); };
    }, [queueSearchTerm]);

    const loadQueue = useCallback(async () => {
        const q = await getPrintQueue();
        setQueue(q);
    }, []);

    useEffect(() => {
        loadHistory();
        loadQueue();
    }, [loadQueue]);

    // La cola es compartida con la computadora: si allá se imprime o se vacía,
    // el cambio llega por Realtime y se refleja acá sin recargar.
    useEffect(() => {
        window.addEventListener('print-queue-changed', loadQueue);
        return () => window.removeEventListener('print-queue-changed', loadQueue);
    }, [loadQueue]);

    const loadHistory = () => {
        setPrintHistory(getPrintHistory());
    };

    // ── Quick Print Logic (unchanged) ──────────────────
    const matchedProducts = useMemo(() => {
        if (!searchTerm || searchTerm.trim().length < 2) return [];
        return searchProducts(allProducts, searchTerm.trim(), 2).slice(0, 15);
    }, [allProducts, searchTerm]);

    const handleClear = () => {
        setSearchTerm('');
    };

    const handlePrint = async (prod: any, qty: number) => {
        try {
            const updated = await addToQueue(
                { id: prod.id, sku: prod.sku, name: prod.name, image_url: prod.image_url },
                qty
            );
            setQueue(updated);
            addToPrintHistory(prod, qty);
            loadHistory();

            if (navigator.vibrate) {
                navigator.vibrate(50);
            }

            flash(`${qty} etiqueta${qty !== 1 ? 's' : ''} de ${prod.sku} en la cola`);
            // Pausa antes de vaciar la búsqueda: da tiempo a leer la
            // confirmación con el repuesto todavía en pantalla, y luego deja el
            // campo listo para el siguiente escaneo. El temporizador se guarda
            // para poder cancelarlo al desmontar.
            if (clearSearchTimer.current) clearTimeout(clearSearchTimer.current);
            clearSearchTimer.current = setTimeout(handleClear, 1500);
        } catch (err: any) {
            console.error('Error al agregar a la cola:', err);
            flash(`No se pudo agregar ${prod.sku} a la cola: ${err?.message || 'error de conexión'}`, 'error');
        }
    };

    const handleReprint = async (historyItem: PrintHistoryItem) => {
        setReprintLoading(true);
        try {
            let prod = allProducts.find(p => p.id === historyItem.id || p.sku === historyItem.sku);
            if (!prod) {
                const { data } = await supabase
                    .from('products')
                    .select('id, sku, name, image_url, inventory_levels(current_stock)')
                    .eq('id', historyItem.id)
                    .eq('is_active', true)
                    .limit(1);
                if (data && data.length > 0) prod = data[0];
            }

            if (prod) {
                // Con `await`: sin él, el `finally` apagaba el indicador de
                // carga antes de que la cola llegara siquiera a escribirse.
                await handlePrint(prod, historyItem.quantity || 3);
            } else {
                flash(`${historyItem.sku} ya no está en el catálogo`, 'error');
            }
        } catch (err: any) {
            console.error(err);
            flash(err?.message || 'No se pudo repetir el agregado', 'error');
        } finally {
            setReprintLoading(false);
        }
    };

    const timeAgo = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return `Hace ${seconds} seg`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `Hace ${minutes} min`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `Hace ${hours} h`;
        return `Hace ${Math.floor(hours / 24)} d`;
    };

    const getStock = (prod: any) => {
        if (!prod || !prod.inventory_levels || prod.inventory_levels.length === 0) return 0;
        return prod.inventory_levels.reduce((acc: number, curr: any) => acc + (curr.current_stock || 0), 0);
    };

    const getCustomQty = (id: string) => customQtyMap[id] || 1;
    const setProductCustomQty = (id: string, val: number) => {
        setCustomQtyMap(prev => ({ ...prev, [id]: Math.max(1, val) }));
    };

    // ── Queue Logic ────────────────────────────────────
    const queueMatchedProducts = useMemo(() => {
        if (!debouncedQueueSearch || debouncedQueueSearch.trim().length < 2) return [];
        return searchProducts(allProducts, debouncedQueueSearch.trim(), 2).slice(0, 10);
    }, [allProducts, debouncedQueueSearch]);

    const getQueueQty = (id: string) => queueQtyMap[id] || 1;
    const setQueueProductQty = (id: string, val: number) => {
        setQueueQtyMap(prev => ({ ...prev, [id]: Math.max(1, val) }));
    };

    /*
        Los cuatro manejadores de abajo llamaban a la cola sin `try`. Cualquier
        fallo (sin red, sesión caducada) escapaba como promesa rechazada sin
        capturar: nada en pantalla, y la lista se quedaba mostrando el estado
        anterior como si la operación hubiera salido bien.
    */
    const handleAddToQueue = async (prod: any) => {
        const qty = getQueueQty(String(prod.id));
        try {
            const updated = await addToQueue(
                { id: prod.id, sku: prod.sku, name: prod.name, image_url: prod.image_url },
                qty
            );
            setQueue(updated);
            if (navigator.vibrate) navigator.vibrate(50);
            flash(`${qty} etiqueta${qty !== 1 ? 's' : ''} de ${prod.sku} en la cola`);
            setQueueSearchTerm('');
            setQueueQtyMap(prev => { const n = { ...prev }; delete n[String(prod.id)]; return n; });
        } catch (err: any) {
            flash(`No se pudo agregar ${prod.sku}: ${err?.message || 'error de conexión'}`, 'error');
        }
    };

    const handleRemoveFromQueue = async (id: number) => {
        try {
            const updated = await removeFromQueue(id);
            setQueue(updated);
            if (navigator.vibrate) navigator.vibrate(30);
        } catch (err: any) {
            flash(err?.message || 'No se pudo quitar de la cola', 'error');
        }
    };

    const handleUpdateQueueQty = async (id: number, newQty: number) => {
        try {
            const updated = await updateQueueItemQty(id, newQty);
            setQueue(updated);
        } catch (err: any) {
            flash(err?.message || 'No se pudo cambiar la cantidad', 'error');
        }
    };

    const handleClearQueue = async () => {
        setShowClearConfirm(false);
        try {
            await clearQueue();
            setQueue(await getPrintQueue());
            if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
        } catch (err: any) {
            flash(err?.message || 'No se pudo vaciar la cola', 'error');
        }
    };

    const totalLabels = getQueueTotalLabels(queue);

    return (
        <div className="flex flex-col min-h-full bg-slate-950 pb-mobile-page-bar font-sans">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-400 p-4 pt-6 shadow-lg text-slate-950 rounded-b-3xl mb-1 z-20">
                <h1 className="text-2xl font-black flex items-center gap-2 tracking-tight">
                    <Printer size={28} aria-hidden="true" />
                    Impresión de Etiquetas
                </h1>
                <p className="text-slate-950/70 text-xs mt-1 font-semibold">
                    Agrega repuestos a la cola, rápido o con cantidad personalizada
                </p>
            </div>

            {/* ── Tab Switcher ────────────────────────── */}
            <div className="sticky top-0 z-30 px-4 pt-3 pb-1 bg-slate-950/95 backdrop-blur-lg">
                <div className="flex bg-slate-900 rounded-2xl p-1 border border-slate-800 shadow-sm">
                    <button
                        onClick={() => setActiveTab('quick')}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                            activeTab === 'quick'
                                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                                : 'text-slate-400 active:bg-slate-800'
                        }`}
                    >
                        <Zap size={16} aria-hidden="true" />
                        Rápida
                    </button>
                    <button
                        onClick={() => setActiveTab('queue')}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 relative ${
                            activeTab === 'queue'
                                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                                : 'text-slate-400 active:bg-slate-800'
                        }`}
                    >
                        <Layers size={16} aria-hidden="true" />
                        Cola
                        {queue.length > 0 && activeTab !== 'queue' && (
                            <span className="absolute -top-1.5 -right-1 min-w-[20px] h-[20px] flex items-center justify-center bg-amber-500 text-slate-950 text-xs font-black rounded-full border-2 border-slate-900 animate-pulse-glow">
                                {queue.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Aviso compartido: éxito o error. `role="status"` para que el
                lector de pantalla lo anuncie sin robar el foco. */}
            {(successMessage || errorMessage) && (
                <div
                    role="status"
                    aria-live="polite"
                    className={`mx-4 mt-2 animate-slide-down px-4 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 z-40 border text-white ${
                        errorMessage
                            ? 'bg-rose-600 border-rose-400'
                            : 'bg-emerald-500 border-emerald-400'
                    }`}
                >
                    {errorMessage
                        ? <TriangleAlert size={24} aria-hidden="true" />
                        : <CheckCircle2 size={24} aria-hidden="true" />}
                    <span className="font-bold text-sm">{errorMessage || successMessage}</span>
                </div>
            )}

            <div className="flex-1 p-4 flex flex-col gap-4">

                {/* ════════════════════════════════════════ */}
                {/* TAB 1: IMPRESIÓN RÁPIDA (original)      */}
                {/* ════════════════════════════════════════ */}
                {activeTab === 'quick' && (
                    <>
                        {/* Barra de Búsqueda Inteligente */}
                        <div className="relative z-30">
                            <MobileSearchBar
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                                products={allProducts}
                                placeholder="Escanea o escribe (ej: pastilla freno del)..."
                                onClear={handleClear}
                                autoFocus={true}
                            />
                        </div>

                        {/* Loading Estado Inicial Catalogo */}
                        {(catalogLoading || reprintLoading) && allProducts.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-400">
                                <div className="animate-spin rounded-full h-10 w-10 border-4 border-amber-500 border-t-transparent"></div>
                                <span className="text-xs font-semibold uppercase tracking-wider animate-pulse">Cargando catálogo inteligente...</span>
                            </div>
                        )}

                        {/* Sin Resultados */}
                        {searchTerm.trim().length >= 2 && matchedProducts.length === 0 && !catalogLoading && (
                            <div className="animate-fade-in bg-slate-900 rounded-3xl p-8 text-center border border-slate-800 my-2 shadow-sm">
                                <SearchX size={48} className="text-slate-600 mb-2" aria-hidden="true" />
                                <h3 className="text-base font-bold text-slate-200">No se encontró repuesto</h3>
                                <p className="text-xs text-slate-400 mt-1 max-w-[240px] mx-auto">
                                    Verifica si el nombre o código está bien escrito, o intenta con palabras clave más cortas.
                                </p>
                            </div>
                        )}

                        {/* Lista de Resultados de Búsqueda */}
                        {matchedProducts.length > 0 && (
                            <div className="animate-fade-in flex flex-col gap-4 my-1">
                                <div className="flex items-center justify-between px-1 text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                                    <span>{matchedProducts.length} repuesto(s) encontrado(s)</span>
                                    <span className="text-emerald-400">Listo para agregar</span>
                                </div>

                                {matchedProducts.map((prod) => {
                                    const stock = getStock(prod);
                                    const currentQty = getCustomQty(String(prod.id));

                                    return (
                                        <div key={prod.id} className="bg-slate-900 p-4 rounded-3xl shadow-md border border-slate-800 flex flex-col gap-3 transition-all">
                                            {/* Cabecera del Producto */}
                                            <div className="flex gap-3.5 items-center">
                                                {prod.image_url ? (
                                                    <img
                                                        src={getThumbnailUrl(prod.image_url, 200)}
                                                        alt={prod.name}
                                                        loading="lazy"
                                                        className="w-[72px] h-[72px] object-cover rounded-2xl border border-slate-700 shrink-0 shadow-sm"
                                                    />
                                                ) : (
                                                    <div className="w-[72px] h-[72px] bg-slate-700/60 rounded-2xl flex items-center justify-center text-slate-400 shrink-0">
                                                        <ImageOff size={30} aria-hidden="true" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 text-xs font-mono font-extrabold rounded-lg border border-amber-500/20">
                                                            {prod.sku}
                                                        </span>
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                                                            stock > 0 ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'
                                                        }`}>
                                                            Stock: {stock}
                                                        </span>
                                                    </div>
                                                    <h3 className="font-bold text-white text-sm leading-snug line-clamp-2">
                                                        {prod.name}
                                                    </h3>
                                                    {prod.brands?.name && (
                                                        <p className="text-xs text-slate-400 font-semibold mt-0.5">
                                                            {prod.brands.name}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/*
                                                Botones rápidos.

                                                El color ya no distingue cantidades: verde y cian
                                                significan "hay stock" y "equivalentes" en el resto
                                                del modo móvil, y aquí competían con el badge de
                                                stock que está tres líneas más arriba. Los tres son
                                                ámbar, que es el color de la impresión.
                                            */}
                                            <div className="grid grid-cols-3 gap-2.5 pt-1">
                                                {quickQty.map((qty, i) => (
                                                    isEditingQuickQty ? (
                                                        <label key={i} className="bg-slate-800 rounded-2xl flex flex-col items-center justify-center py-2 gap-1 border border-slate-700">
                                                            <span className="text-xs uppercase tracking-tight text-slate-400">Botón {i + 1}</span>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                inputMode="numeric"
                                                                value={qty}
                                                                onChange={(e) => saveQuickQty(i, parseInt(e.target.value) || 1)}
                                                                aria-label={`Cantidad del botón ${i + 1}`}
                                                                className="w-16 min-h-[44px] text-center bg-slate-900 border border-slate-700 rounded-xl text-white font-black text-base"
                                                            />
                                                        </label>
                                                    ) : (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onClick={() => handlePrint(prod, qty)}
                                                            className="active:scale-95 transition-all bg-amber-500/10 active:bg-amber-500/20 text-amber-300 rounded-2xl flex flex-col items-center justify-center min-h-[76px] py-3 gap-0.5 border border-amber-500/25 shadow-xs"
                                                        >
                                                            <Printer size={20} aria-hidden="true" />
                                                            <span className="font-black text-base">{qty}</span>
                                                            <span className="text-xs uppercase tracking-tight opacity-75">etiquetas</span>
                                                        </button>
                                                    )
                                                ))}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => setIsEditingQuickQty(v => !v)}
                                                className="self-start min-h-[44px] px-3 -my-1 rounded-xl text-xs font-semibold text-slate-400 active:text-amber-300 flex items-center gap-1.5"
                                            >
                                                <SlidersHorizontal size={13} aria-hidden="true" />
                                                {isEditingQuickQty ? 'Listo' : 'Cambiar cantidades'}
                                            </button>

                                            {/* Fila Cantidad Personalizada */}
                                            <div className="bg-slate-900/80 p-2 px-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 mt-0.5">
                                                <span className="text-xs font-bold text-slate-400">Otro número:</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center border border-slate-700 rounded-xl overflow-hidden bg-slate-900 shadow-inner h-12">
                                                        <button
                                                            type="button"
                                                            className="w-11 h-full flex items-center justify-center text-slate-300 active:bg-slate-700"
                                                            onClick={() => setProductCustomQty(String(prod.id), currentQty - 1)}
                                                            aria-label="Una etiqueta menos"
                                                        >
                                                            <Minus size={16} aria-hidden="true" />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            step="1"
                                                            inputMode="numeric"
                                                            value={currentQty}
                                                            onChange={(e) => setProductCustomQty(String(prod.id), parseInt(e.target.value) || 1)}
                                                            aria-label={`Cantidad de etiquetas de ${prod.sku}`}
                                                            className="w-12 h-full text-center bg-transparent border-none focus:ring-0 text-white font-bold text-base p-0"
                                                        />
                                                        <button
                                                            type="button"
                                                            className="w-11 h-full flex items-center justify-center text-slate-300 active:bg-slate-700"
                                                            onClick={() => setProductCustomQty(String(prod.id), currentQty + 1)}
                                                            aria-label="Una etiqueta más"
                                                        >
                                                            <Plus size={16} aria-hidden="true" />
                                                        </button>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePrint(prod, currentQty)}
                                                        className="active:scale-95 transition-transform bg-slate-200 active:bg-white text-slate-900 px-4 h-12 rounded-xl font-bold text-sm flex items-center gap-1.5 shadow-sm"
                                                    >
                                                        <span>Agregar</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Historial de Impresiones Recientes */}
                        {(!searchTerm || matchedProducts.length === 0) && (
                            <div className="mt-4 animate-fade-in z-10">
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                                        <History size={20} className="text-slate-400" aria-hidden="true" />
                                        Agregados Recientemente
                                    </h2>
                                    {printHistory.length > 0 && (
                                        <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                                            Toca
                                            <Printer size={13} className="text-emerald-400" aria-hidden="true" />
                                            para repetir
                                        </span>
                                    )}
                                </div>

                                {printHistory.length === 0 ? (
                                    <div className="text-center py-8 px-4 text-slate-400 bg-slate-900 rounded-3xl border border-slate-800 shadow-xs">
                                        <Printer size={36} className="opacity-30 mb-1" aria-hidden="true" />
                                        <p className="font-semibold text-sm">No hay agregados recientes</p>
                                        <p className="text-xs text-slate-400 mt-0.5">Cuando agregues etiquetas a la cola, aparecerán aquí para fácil acceso.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2.5">
                                        {printHistory.map((item, index) => (
                                            <div key={`${item.id}-${index}`} className="bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-800 flex items-center gap-3 transition-colors active:border-emerald-500/50">
                                                {item.image_url ? (
                                                    <img
                                                        src={getThumbnailUrl(item.image_url, 200)}
                                                        alt={item.name}
                                                        loading="lazy"
                                                        className="w-12 h-12 object-cover rounded-xl border border-slate-700 shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                                                        <ImageOff size={20} aria-hidden="true" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-mono font-extrabold text-slate-300 truncate">
                                                            {item.sku}
                                                        </span>
                                                        <span className="text-xs font-medium text-slate-400 whitespace-nowrap ml-auto">
                                                            {timeAgo(item.printedAt)}
                                                        </span>
                                                    </div>
                                                    <p className="font-bold text-xs text-slate-100 truncate mt-0.5">
                                                        {item.name}
                                                    </p>
                                                    <span className="inline-block text-xs font-extrabold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-md mt-1">
                                                        {item.quantity} etiquetas
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleReprint(item)}
                                                    className="active:scale-90 min-w-[44px] min-h-[44px] flex items-center justify-center bg-emerald-900/30 active:bg-emerald-900/50 text-emerald-300 rounded-2xl transition-all shrink-0 border border-emerald-800"
                                                    aria-label={`Agregar otras ${item.quantity} etiquetas de ${item.sku} a la cola`}
                                                >
                                                    <Printer size={20} aria-hidden="true" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* ════════════════════════════════════════ */}
                {/* TAB 2: COLA DE IMPRESIÓN (nuevo)        */}
                {/* ════════════════════════════════════════ */}
                {activeTab === 'queue' && (
                    <>
                        {/* Buscador para agregar a la cola */}
                        <div className="relative z-30">
                            <MobileSearchBar
                                searchTerm={queueSearchTerm}
                                setSearchTerm={setQueueSearchTerm}
                                products={allProducts}
                                placeholder="Buscar repuesto para agregar a la cola..."
                                onClear={() => setQueueSearchTerm('')}
                                autoFocus={false}
                            />
                        </div>

                        {/* Loading */}
                        {catalogLoading && allProducts.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-400">
                                <div className="animate-spin rounded-full h-10 w-10 border-4 border-amber-500 border-t-transparent"></div>
                                <span className="text-xs font-semibold uppercase tracking-wider animate-pulse">Cargando catálogo...</span>
                            </div>
                        )}

                        {/* Search Results → Add to Queue */}
                        {queueMatchedProducts.length > 0 && (
                            <div className="animate-fade-in flex flex-col gap-3">
                                <div className="flex items-center justify-between px-1 text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                                    <span>{queueMatchedProducts.length} resultado(s)</span>
                                    <span className="text-amber-400">Agregar a la cola</span>
                                </div>

                                {queueMatchedProducts.map((prod) => {
                                    const stock = getStock(prod);
                                    const currentQty = getQueueQty(String(prod.id));
                                    const alreadyInQueue = queue.find(q => q.sku === prod.sku);

                                    return (
                                        <div key={prod.id} className="bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-800 flex flex-col gap-2.5 transition-all">
                                            <div className="flex gap-3 items-center">
                                                {prod.image_url ? (
                                                    <img src={getThumbnailUrl(prod.image_url, 200)} alt={prod.name} loading="lazy" className="w-14 h-14 object-cover rounded-xl border border-slate-700 shrink-0 shadow-sm" />
                                                ) : (
                                                    <div className="w-14 h-14 bg-slate-700/60 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                                                        <ImageOff size={24} aria-hidden="true" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 text-xs font-mono font-extrabold rounded-lg border border-amber-500/20">
                                                            {prod.sku}
                                                        </span>
                                                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-lg ${stock > 0 ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'}`}>
                                                            Stock: {stock}
                                                        </span>
                                                        {alreadyInQueue && (
                                                            <span className="text-xs font-bold px-1.5 py-0.5 rounded-lg bg-amber-900/30 text-amber-400">
                                                                Ya en cola: {alreadyInQueue.quantity}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="font-bold text-white text-xs leading-snug line-clamp-2">{prod.name}</h3>
                                                </div>
                                            </div>

                                            {/* Quantity selector + Add button */}
                                            <div className="flex items-center justify-between gap-2 bg-amber-900/10 p-2 px-3 rounded-xl border border-amber-800/40">
                                                <span className="text-xs font-bold text-amber-400">Cantidad:</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center border border-amber-700 rounded-xl overflow-hidden bg-slate-900 shadow-inner h-12">
                                                        <button
                                                            type="button"
                                                            className="w-11 h-full flex items-center justify-center text-slate-300 active:bg-slate-700"
                                                            onClick={() => setQueueProductQty(String(prod.id), currentQty - 1)}
                                                            aria-label="Una etiqueta menos"
                                                        >
                                                            <Minus size={16} aria-hidden="true" />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            step="1"
                                                            inputMode="numeric"
                                                            value={currentQty}
                                                            onChange={(e) => setQueueProductQty(String(prod.id), parseInt(e.target.value) || 1)}
                                                            aria-label={`Cantidad de etiquetas de ${prod.sku}`}
                                                            className="w-12 h-full text-center bg-transparent border-none focus:ring-0 text-white font-bold text-base p-0"
                                                        />
                                                        <button
                                                            type="button"
                                                            className="w-11 h-full flex items-center justify-center text-slate-300 active:bg-slate-700"
                                                            onClick={() => setQueueProductQty(String(prod.id), currentQty + 1)}
                                                            aria-label="Una etiqueta más"
                                                        >
                                                            <Plus size={16} aria-hidden="true" />
                                                        </button>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddToQueue(prod)}
                                                        className="active:scale-95 transition-all bg-amber-500 active:bg-amber-600 text-slate-950 px-4 h-12 rounded-xl font-bold text-sm flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                                                    >
                                                        <Plus size={16} aria-hidden="true" />
                                                        Agregar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* No search results */}
                        {queueSearchTerm.trim().length >= 2 && queueMatchedProducts.length === 0 && !catalogLoading && (
                            <div className="animate-fade-in bg-slate-900 rounded-3xl p-6 text-center border border-slate-800 my-1 shadow-sm">
                                <SearchX size={36} className="text-slate-600 mb-1" aria-hidden="true" />
                                <h3 className="text-sm font-bold text-slate-200">No se encontró repuesto</h3>
                            </div>
                        )}

                        {/* ── Queue Items List ────────────────── */}
                        {(!queueSearchTerm || queueMatchedProducts.length === 0) && (
                            <div className="mt-2 animate-fade-in">
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                                        <ListChecks size={20} className="text-amber-500" aria-hidden="true" />
                                        Cola de Impresión
                                        {queue.length > 0 && (
                                            <span className="text-xs font-extrabold bg-amber-900/30 text-amber-400 px-2 py-0.5 rounded-lg">
                                                {queue.length} item{queue.length !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </h2>
                                </div>

                                {queue.length === 0 ? (
                                    <div className="text-center py-10 px-4 bg-slate-900 rounded-3xl border-2 border-dashed border-amber-800/40 shadow-xs">
                                        <Layers size={48} className="text-amber-700 mb-2" aria-hidden="true" />
                                        <h3 className="font-bold text-sm text-slate-200">La cola está vacía</h3>
                                        <p className="text-xs text-slate-400 mt-1 max-w-[260px] mx-auto leading-relaxed">
                                            Busca repuestos arriba, elige la cantidad que necesitas de cada uno, y agrégalos a la cola. Cuando termines, genera un solo PDF con todas las etiquetas.
                                        </p>
                                        <div className="mt-4 flex items-center justify-center gap-2 text-amber-400">
                                            <Info size={14} aria-hidden="true" />
                                            <span className="text-xs font-semibold">La cola se guarda automáticamente</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2.5">
                                        {queue.map((item, idx) => (
                                            <div
                                                key={item.sku}
                                                className="animate-fade-in bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-800 flex items-center gap-3 transition-all"
                                                style={{ animationDelay: `${idx * 40}ms` }}
                                            >
                                                {item.image_url ? (
                                                    <img src={getThumbnailUrl(item.image_url, 200)} alt={item.name} loading="lazy" className="w-12 h-12 object-cover rounded-xl border border-slate-700 shrink-0" />
                                                ) : (
                                                    <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                                                        <ImageOff size={20} aria-hidden="true" />
                                                    </div>
                                                )}

                                                <div className="flex-1 min-w-0">
                                                    <span className="text-xs font-mono font-extrabold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20">
                                                        {item.sku}
                                                    </span>
                                                    <p className="font-bold text-xs text-slate-100 truncate mt-0.5" title={item.name}>{item.name}</p>

                                                    {/* Inline qty editor */}
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUpdateQueueQty(item.id, item.quantity - 1)}
                                                            className="w-11 h-11 rounded-lg bg-slate-700 text-slate-200 flex items-center justify-center active:bg-slate-600 active:scale-95 transition-all"
                                                            aria-label={`Una etiqueta menos de ${item.sku}`}
                                                        >
                                                            <Minus size={16} aria-hidden="true" />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            step="1"
                                                            inputMode="numeric"
                                                            value={item.quantity}
                                                            onChange={(e) => handleUpdateQueueQty(item.id, parseInt(e.target.value) || 1)}
                                                            aria-label={`Etiquetas de ${item.sku}`}
                                                            className="w-14 h-11 text-center bg-amber-900/20 border border-amber-700/60 rounded-lg text-amber-300 font-black text-base focus:ring-0 p-0"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUpdateQueueQty(item.id, item.quantity + 1)}
                                                            className="w-11 h-11 rounded-lg bg-slate-700 text-slate-200 flex items-center justify-center active:bg-slate-600 active:scale-95 transition-all"
                                                            aria-label={`Una etiqueta más de ${item.sku}`}
                                                        >
                                                            <Plus size={16} aria-hidden="true" />
                                                        </button>
                                                        <span className="text-xs text-slate-400 font-semibold ml-0.5">etiq.</span>
                                                    </div>
                                                </div>

                                                {/* Delete button */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveFromQueue(item.id)}
                                                    className="active:scale-90 min-w-[44px] min-h-[44px] flex items-center justify-center bg-rose-900/20 active:bg-rose-900/40 text-rose-400 rounded-xl transition-all shrink-0 border border-rose-800/50"
                                                    aria-label={`Quitar ${item.sku} de la cola`}
                                                >
                                                    <Trash2 size={18} aria-hidden="true" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Floating Bottom Bar (when queue has items) ── */}
                        {queue.length > 0 && (
                            <div className="fixed bottom-above-nav left-2 right-2 z-40 animate-slide-up">
                                <div className="max-w-md mx-auto bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-800 p-3 px-4">
                                    {/* Summary row */}
                                    <div className="flex items-center justify-between mb-2.5">
                                        <div className="flex items-center gap-2">
                                            <Receipt size={18} className="text-amber-400" aria-hidden="true" />
                                            <div>
                                                <span className="text-xs font-black text-white">{totalLabels} etiqueta{totalLabels !== 1 ? 's' : ''}</span>
                                                <span className="text-xs text-slate-500 ml-1.5">en la cola</span>
                                            </div>
                                        </div>
                                        {/* Clear all */}
                                        {!showClearConfirm ? (
                                            <button
                                                type="button"
                                                onClick={() => setShowClearConfirm(true)}
                                                className="min-h-[44px] px-3 -my-2 rounded-lg text-xs font-bold text-rose-400 active:text-rose-300 active:bg-rose-500/10 flex items-center gap-1.5"
                                            >
                                                <Trash2 size={14} aria-hidden="true" />
                                                Vaciar
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs text-rose-400 font-bold">¿Seguro?</span>
                                                <button onClick={handleClearQueue} className="min-h-[44px] px-3 text-xs font-extrabold text-white bg-rose-500 rounded-lg active:scale-95">Sí</button>
                                                <button onClick={() => setShowClearConfirm(false)} className="min-h-[44px] px-3 text-xs font-extrabold text-slate-300 bg-slate-700 rounded-lg active:scale-95">No</button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Revisar la cola antes de imprimirla desde la computadora */}
                                    <button
                                        type="button"
                                        onClick={() => setIsPreviewModalOpen(true)}
                                        className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 active:from-amber-600 active:to-amber-500 text-slate-950 rounded-xl font-extrabold text-sm shadow-lg shadow-amber-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                    >
                                        <Eye size={18} aria-hidden="true" />
                                        Revisar cola ({totalLabels} etiq.)
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                <PrintQueuePreviewModal
                    isOpen={isPreviewModalOpen}
                    onClose={() => setIsPreviewModalOpen(false)}
                    onQueueUpdated={(updated) => setQueue(updated)}
                    isMobile={true}
                />
            </div>
        </div>
    );
};

export default MobileLabels;
