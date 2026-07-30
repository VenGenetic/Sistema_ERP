import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { getThumbnailUrl } from '../../utils/image';
import { printLabelsQuick, addToPrintHistory, getPrintHistory, PrintHistoryItem } from '../../utils/mobileLabelPrinter';
import { useMobileProducts, searchProducts } from '../../utils/mobileSearchEngine';
import MobileSearchBar from '../../components/mobile/MobileSearchBar';
import {
    getPrintQueue, addToQueue, removeFromQueue, updateQueueItemQty,
    clearQueue, getQueueTotalLabels, getQueuePageCount, downloadQueuePDF,
    PrintQueueItem
} from '../../utils/mobilePrintQueue';
import { PrintQueuePreviewModal } from '../../components/PrintQueuePreviewModal';

const MobileLabels: React.FC = () => {
    const { products: allProducts, loading: catalogLoading } = useMobileProducts();
    const [searchTerm, setSearchTerm] = useState('');
    const [printHistory, setPrintHistory] = useState<PrintHistoryItem[]>([]);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [customQtyMap, setCustomQtyMap] = useState<Record<string, number>>({});
    const [reprintLoading, setReprintLoading] = useState(false);

    // ── Tab State ──────────────────────────────────────
    const [activeTab, setActiveTab] = useState<'quick' | 'queue'>('quick');

    // ── Queue State ────────────────────────────────────
    const [queue, setQueue] = useState<PrintQueueItem[]>([]);
    const [queueSearchTerm, setQueueSearchTerm] = useState('');
    const [debouncedQueueSearch, setDebouncedQueueSearch] = useState('');
    const [queueQtyMap, setQueueQtyMap] = useState<Record<string, number>>({});
    const [isGenerating, setIsGenerating] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const queueDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounce queue search
    useEffect(() => {
        if (queueDebounceRef.current) clearTimeout(queueDebounceRef.current);
        queueDebounceRef.current = setTimeout(() => {
            setDebouncedQueueSearch(queueSearchTerm);
        }, 250);
        return () => { if (queueDebounceRef.current) clearTimeout(queueDebounceRef.current); };
    }, [queueSearchTerm]);

    useEffect(() => {
        loadHistory();
        const loadQueue = async () => {
            const q = await getPrintQueue();
            setQueue(q);
        };
        loadQueue();
    }, []);

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
            await printLabelsQuick(prod, qty);
            addToPrintHistory(prod, qty);
            loadHistory();
            
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }

            setSuccessMessage(`✓ ${qty} etiquetas de ${prod.sku} descargadas`);
            
            setTimeout(() => {
                setSuccessMessage(null);
                handleClear();
            }, 1500);
        } catch (err) {
            console.error('Error printing:', err);
            alert('Error al imprimir etiquetas');
        }
    };

    const handleReprint = async (historyItem: PrintHistoryItem) => {
        setReprintLoading(true);
        try {
            let prod = allProducts.find(p => p.id === historyItem.id || p.sku === historyItem.sku);
            if (!prod) {
                const { data } = await supabase
                    .from('products')
                    .select('*, inventory_levels(*)')
                    .eq('id', historyItem.id)
                    .eq('is_active', true)
                    .limit(1);
                if (data && data.length > 0) prod = data[0];
            }
                
            if (prod) {
                handlePrint(prod, historyItem.quantity || 3);
            } else {
                alert('Producto no encontrado');
            }
        } catch (err) {
            console.error(err);
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

    const getCustomQty = (id: string) => customQtyMap[id] || 3;
    const setProductCustomQty = (id: string, val: number) => {
        setCustomQtyMap(prev => ({ ...prev, [id]: Math.max(3, val) }));
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

    const handleAddToQueue = async (prod: any) => {
        const qty = getQueueQty(String(prod.id));
        const updated = await addToQueue(
            { id: prod.id, sku: prod.sku, name: prod.name, image_url: prod.image_url },
            qty
        );
        setQueue(updated);
        if (navigator.vibrate) navigator.vibrate(50);
        setSuccessMessage(`✓ ${qty} etiqueta(s) de ${prod.sku} agregadas a la cola`);
        setTimeout(() => setSuccessMessage(null), 1800);
        setQueueSearchTerm('');
        setQueueQtyMap(prev => { const n = { ...prev }; delete n[String(prod.id)]; return n; });
    };

    const handleRemoveFromQueue = async (id: number) => {
        const updated = await removeFromQueue(id);
        setQueue(updated);
        if (navigator.vibrate) navigator.vibrate(30);
    };

    const handleUpdateQueueQty = async (id: number, newQty: number) => {
        const updated = await updateQueueItemQty(id, newQty);
        setQueue(updated);
    };

    const handleClearQueue = async () => {
        await clearQueue();
        setQueue([]);
        setShowClearConfirm(false);
        if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
    };

    const handleGeneratePDF = () => {
        if (queue.length === 0) return;
        setIsGenerating(true);
        try {
            downloadQueuePDF(queue);
            setSuccessMessage(`✓ PDF con ${getQueueTotalLabels(queue)} etiquetas descargado`);
            setTimeout(() => setSuccessMessage(null), 2500);
        } catch (err: any) {
            alert('Error al generar PDF: ' + err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const totalLabels = getQueueTotalLabels(queue);
    const totalPages = getQueuePageCount(queue);

    return (
        <div className="flex flex-col min-h-screen bg-slate-950 pb-56 font-sans">
            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes slide-down { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); } 50% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); } }
                .animate-fade-in { animation: fade-in 0.25s ease-out forwards; }
                .animate-slide-down { animation: slide-down 0.25s ease-out forwards; }
                .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.2) forwards; }
                .animate-pulse-glow { animation: pulse-glow 2s infinite; }
            `}</style>
            
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-400 p-4 pt-6 shadow-lg text-slate-950 rounded-b-3xl mb-1 z-20">
                <h1 className="text-2xl font-black flex items-center gap-2 tracking-tight">
                    <span className="material-symbols-outlined text-[28px] font-variation-fill-1">print</span>
                    Impresión de Etiquetas
                </h1>
                <p className="text-slate-950/70 text-xs mt-1 font-semibold">
                    Impresión rápida o arma tu cola de impresión personalizada
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
                                : 'text-slate-400 hover:bg-slate-800'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[16px]">bolt</span>
                        Rápida
                    </button>
                    <button
                        onClick={() => setActiveTab('queue')}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 relative ${
                            activeTab === 'queue'
                                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                                : 'text-slate-400 hover:bg-slate-800'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[16px]">queue</span>
                        Cola
                        {queue.length > 0 && activeTab !== 'queue' && (
                            <span className="absolute -top-1.5 -right-1 min-w-[20px] h-[20px] flex items-center justify-center bg-amber-500 text-slate-950 text-[10px] font-black rounded-full border-2 border-slate-900 animate-pulse-glow">
                                {queue.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Toast de Éxito (shared) */}
            {successMessage && (
                <div className="mx-4 mt-2 animate-slide-down bg-emerald-500 text-white px-4 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 z-40 border border-emerald-400">
                    <span className="material-symbols-outlined text-[24px]">check_circle</span>
                    <span className="font-bold text-sm">{successMessage}</span>
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
                                <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-2">search_off</span>
                                <h3 className="text-base font-bold text-slate-200">No se encontró repuesto</h3>
                                <p className="text-xs text-slate-400 mt-1 max-w-[240px] mx-auto">
                                    Verifica si el nombre o código está bien escrito, o intenta con palabras clave más cortas.
                                </p>
                            </div>
                        )}

                        {/* Lista de Resultados de Búsqueda */}
                        {matchedProducts.length > 0 && (
                            <div className="animate-fade-in flex flex-col gap-4 my-1">
                                <div className="flex items-center justify-between px-1 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    <span>{matchedProducts.length} repuesto(s) encontrado(s)</span>
                                    <span className="text-emerald-600 dark:text-emerald-400">Listo para imprimir</span>
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
                                                        className="w-[72px] h-[72px] object-cover rounded-2xl border border-slate-100 dark:border-slate-700 shrink-0 shadow-sm"
                                                    />
                                                ) : (
                                                    <div className="w-[72px] h-[72px] bg-slate-100 dark:bg-slate-700/60 rounded-2xl flex items-center justify-center text-slate-400 shrink-0">
                                                        <span className="material-symbols-outlined text-3xl">image</span>
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 text-xs font-mono font-extrabold rounded-lg border border-amber-500/20">
                                                            {prod.sku}
                                                        </span>
                                                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                                                            stock > 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                                                        }`}>
                                                            Stock: {stock}
                                                        </span>
                                                    </div>
                                                    <h3 className="font-bold text-white text-sm leading-snug line-clamp-2">
                                                        {prod.name}
                                                    </h3>
                                                    {prod.brands?.name && (
                                                        <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                                                            {prod.brands.name}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Botones Rápidos 3, 6, 21 */}
                                            <div className="grid grid-cols-3 gap-2.5 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handlePrint(prod, 3)}
                                                    className="active:scale-95 transition-all bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-2xl flex flex-col items-center justify-center py-3 gap-0.5 border border-amber-500/25 shadow-xs"
                                                >
                                                    <span className="material-symbols-outlined text-xl">print</span>
                                                    <span className="font-black text-base">3</span>
                                                    <span className="text-[9px] uppercase tracking-tighter opacity-75">etiquetas</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePrint(prod, 6)}
                                                    className="active:scale-95 transition-all bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded-2xl flex flex-col items-center justify-center py-3 gap-0.5 border border-cyan-500/25 shadow-xs"
                                                >
                                                    <span className="material-symbols-outlined text-xl">print</span>
                                                    <span className="font-black text-base">6</span>
                                                    <span className="text-[9px] uppercase tracking-tighter opacity-75">etiquetas</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePrint(prod, 21)}
                                                    className="active:scale-95 transition-all bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 rounded-2xl flex flex-col items-center justify-center py-3 gap-0.5 border border-emerald-500/25 shadow-xs"
                                                >
                                                    <span className="material-symbols-outlined text-xl">print</span>
                                                    <span className="font-black text-base">21</span>
                                                    <span className="text-[9px] uppercase tracking-tighter opacity-75">hoja A4</span>
                                                </button>
                                            </div>

                                            {/* Fila Cantidad Personalizada */}
                                            <div className="bg-slate-50 dark:bg-slate-900/80 p-2 px-3 rounded-2xl border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3 mt-0.5">
                                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Otro número:</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-900 shadow-inner h-11">
                                                        <button 
                                                            type="button"
                                                            className="px-2.5 h-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 font-bold"
                                                            onClick={() => setProductCustomQty(String(prod.id), currentQty - 3)}
                                                        >
                                                            -
                                                        </button>
                                                        <input 
                                                            type="number"
                                                            min="3"
                                                            step="3"
                                                            value={currentQty}
                                                            onChange={(e) => setProductCustomQty(String(prod.id), parseInt(e.target.value) || 3)}
                                                            className="w-12 text-center bg-transparent border-none focus:ring-0 text-slate-800 dark:text-white font-bold text-sm p-0"
                                                        />
                                                        <button 
                                                            type="button"
                                                            className="px-2.5 h-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 font-bold"
                                                            onClick={() => setProductCustomQty(String(prod.id), currentQty + 3)}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePrint(prod, currentQty)}
                                                        className="active:scale-95 transition-transform bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-white text-white dark:text-slate-900 px-4 h-11 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm"
                                                    >
                                                        <span>Imprimir</span>
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
                                        <span className="material-symbols-outlined text-slate-400">history</span>
                                        Impresiones Recientes
                                    </h2>
                                    {printHistory.length > 0 && (
                                        <span className="text-[11px] font-semibold text-slate-400">Toca 🖨️ para reimprimir</span>
                                    )}
                                </div>
                                
                                {printHistory.length === 0 ? (
                                    <div className="text-center py-8 px-4 text-slate-400 bg-slate-900 rounded-3xl border border-slate-800 shadow-xs">
                                        <span className="material-symbols-outlined text-4xl opacity-30 mb-1">print_disabled</span>
                                        <p className="font-semibold text-sm">No hay impresiones recientes</p>
                                        <p className="text-xs text-slate-400 mt-0.5">Cuando imprimas etiquetas, aparecerán aquí para fácil acceso.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2.5">
                                        {printHistory.map((item, index) => (
                                            <div key={`${item.id}-${index}`} className="bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-800 flex items-center gap-3 transition-colors hover:border-emerald-500/50">
                                                {item.image_url ? (
                                                    <img
                                                        src={getThumbnailUrl(item.image_url, 200)}
                                                        alt={item.name}
                                                        loading="lazy"
                                                        className="w-12 h-12 object-cover rounded-xl border border-slate-100 dark:border-slate-700 shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                                                        <span className="material-symbols-outlined text-xl">image</span>
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-mono font-extrabold text-slate-600 dark:text-slate-300 truncate">
                                                            {item.sku}
                                                        </span>
                                                        <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap ml-auto">
                                                            {timeAgo(item.printedAt)}
                                                        </span>
                                                    </div>
                                                    <p className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate mt-0.5">
                                                        {item.name}
                                                    </p>
                                                    <span className="inline-block text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md mt-1">
                                                        {item.quantity} etiquetas
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleReprint(item)}
                                                    className="active:scale-90 p-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-2xl transition-all shrink-0 border border-emerald-200/60 dark:border-emerald-800"
                                                    title={`Reimprimir ${item.quantity} etiquetas`}
                                                >
                                                    <span className="material-symbols-outlined text-xl">print</span>
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
                                <div className="flex items-center justify-between px-1 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    <span>{queueMatchedProducts.length} resultado(s)</span>
                                    <span className="text-amber-600 dark:text-amber-400">Agregar a la cola</span>
                                </div>

                                {queueMatchedProducts.map((prod) => {
                                    const stock = getStock(prod);
                                    const currentQty = getQueueQty(String(prod.id));
                                    const alreadyInQueue = queue.find(q => q.sku === prod.sku);

                                    return (
                                        <div key={prod.id} className="bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-800 flex flex-col gap-2.5 transition-all">
                                            <div className="flex gap-3 items-center">
                                                {prod.image_url ? (
                                                    <img src={getThumbnailUrl(prod.image_url, 200)} alt={prod.name} loading="lazy" className="w-14 h-14 object-cover rounded-xl border border-slate-100 dark:border-slate-700 shrink-0 shadow-sm" />
                                                ) : (
                                                    <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700/60 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                                                        <span className="material-symbols-outlined text-2xl">image</span>
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 text-[11px] font-mono font-extrabold rounded-lg border border-amber-500/20">
                                                            {prod.sku}
                                                        </span>
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg ${stock > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                                                            Stock: {stock}
                                                        </span>
                                                        {alreadyInQueue && (
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                                Ya en cola: {alreadyInQueue.quantity}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="font-bold text-white text-xs leading-snug line-clamp-2">{prod.name}</h3>
                                                </div>
                                            </div>

                                            {/* Quantity selector + Add button */}
                                            <div className="flex items-center justify-between gap-2 bg-amber-50/60 dark:bg-amber-900/10 p-2 px-3 rounded-xl border border-amber-200/60 dark:border-amber-800/40">
                                                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Cantidad:</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center border border-amber-300/60 dark:border-amber-700 rounded-xl overflow-hidden bg-slate-900 shadow-inner h-11">
                                                        <button
                                                            type="button"
                                                            className="px-2.5 h-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 font-bold"
                                                            onClick={() => setQueueProductQty(String(prod.id), currentQty - 1)}
                                                        >
                                                            −
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            step="1"
                                                            value={currentQty}
                                                            onChange={(e) => setQueueProductQty(String(prod.id), parseInt(e.target.value) || 1)}
                                                            className="w-12 text-center bg-transparent border-none focus:ring-0 text-slate-800 dark:text-white font-bold text-sm p-0"
                                                        />
                                                        <button
                                                            type="button"
                                                            className="px-2.5 h-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 font-bold"
                                                            onClick={() => setQueueProductQty(String(prod.id), currentQty + 1)}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddToQueue(prod)}
                                                        className="active:scale-95 transition-all bg-amber-500 hover:bg-amber-600 text-white px-4 h-11 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">add</span>
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
                                <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-1">search_off</span>
                                <h3 className="text-sm font-bold text-slate-200">No se encontró repuesto</h3>
                            </div>
                        )}

                        {/* ── Queue Items List ────────────────── */}
                        {(!queueSearchTerm || queueMatchedProducts.length === 0) && (
                            <div className="mt-2 animate-fade-in">
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-amber-500">playlist_add_check</span>
                                        Cola de Impresión
                                        {queue.length > 0 && (
                                            <span className="text-[11px] font-extrabold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-lg">
                                                {queue.length} item{queue.length !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </h2>
                                </div>

                                {queue.length === 0 ? (
                                    <div className="text-center py-10 px-4 bg-slate-900 rounded-3xl border-2 border-dashed border-amber-300/60 dark:border-amber-800/40 shadow-xs">
                                        <span className="material-symbols-outlined text-5xl text-amber-300 dark:text-amber-700 mb-2">queue</span>
                                        <h3 className="font-bold text-sm text-slate-200">La cola está vacía</h3>
                                        <p className="text-xs text-slate-400 mt-1 max-w-[260px] mx-auto leading-relaxed">
                                            Busca repuestos arriba, elige la cantidad que necesitas de cada uno, y agrégalos a la cola. Cuando termines, genera un solo PDF con todas las etiquetas.
                                        </p>
                                        <div className="mt-4 flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
                                            <span className="material-symbols-outlined text-sm">info</span>
                                            <span className="text-[11px] font-semibold">La cola se guarda automáticamente</span>
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
                                                    <img src={getThumbnailUrl(item.image_url, 200)} alt={item.name} loading="lazy" className="w-12 h-12 object-cover rounded-xl border border-slate-100 dark:border-slate-700 shrink-0" />
                                                ) : (
                                                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                                                        <span className="material-symbols-outlined text-xl">image</span>
                                                    </div>
                                                )}

                                                <div className="flex-1 min-w-0">
                                                    <span className="text-[11px] font-mono font-extrabold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20">
                                                        {item.sku}
                                                    </span>
                                                    <p className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate mt-0.5">{item.name}</p>

                                                    {/* Inline qty editor */}
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUpdateQueueQty(item.id, item.quantity - 1)}
                                                            className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all font-bold text-sm"
                                                        >
                                                            −
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            step="1"
                                                            value={item.quantity}
                                                            onChange={(e) => handleUpdateQueueQty(item.id, parseInt(e.target.value) || 1)}
                                                            className="w-10 h-10 text-center bg-amber-50 dark:bg-amber-900/20 border border-amber-300/60 dark:border-amber-700/60 rounded-lg text-amber-800 dark:text-amber-300 font-black text-xs focus:ring-0 p-0"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUpdateQueueQty(item.id, item.quantity + 1)}
                                                            className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all font-bold text-sm"
                                                        >
                                                            +
                                                        </button>
                                                        <span className="text-[10px] text-slate-400 font-semibold ml-0.5">etiq.</span>
                                                    </div>
                                                </div>

                                                {/* Delete button */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveFromQueue(item.id)}
                                                    className="active:scale-90 p-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 text-rose-500 dark:text-rose-400 rounded-xl transition-all shrink-0 border border-rose-200/60 dark:border-rose-800/50"
                                                    title="Eliminar de la cola"
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Floating Bottom Bar (when queue has items) ── */}
                        {queue.length > 0 && (
                            <div className="fixed bottom-[88px] left-2 right-2 z-40 animate-slide-up">
                                <div className="max-w-md mx-auto bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-800 p-3 px-4">
                                    {/* Summary row */}
                                    <div className="flex items-center justify-between mb-2.5">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-amber-400 text-lg">receipt_long</span>
                                            <div>
                                                <span className="text-xs font-black text-white">{totalLabels} etiqueta{totalLabels !== 1 ? 's' : ''}</span>
                                                <span className="text-[10px] text-slate-500 ml-1.5">({totalPages} hoja{totalPages !== 1 ? 's' : ''} A4)</span>
                                            </div>
                                        </div>
                                        {/* Clear all */}
                                        {!showClearConfirm ? (
                                            <button
                                                type="button"
                                                onClick={() => setShowClearConfirm(true)}
                                                className="text-[11px] font-bold text-rose-400 hover:text-rose-300 active:opacity-70 flex items-center gap-0.5"
                                            >
                                                <span className="material-symbols-outlined text-sm">delete_sweep</span>
                                                Vaciar
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-rose-400 font-bold">¿Seguro?</span>
                                                <button onClick={handleClearQueue} className="text-[11px] font-extrabold text-white bg-rose-500 px-2.5 py-1 rounded-lg active:scale-95">Sí</button>
                                                <button onClick={() => setShowClearConfirm(false)} className="text-[11px] font-extrabold text-slate-300 bg-slate-700 px-2.5 py-1 rounded-lg active:scale-95">No</button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Generate PDF / Preview button */}
                                    <button
                                        type="button"
                                        onClick={() => setIsPreviewModalOpen(true)}
                                        className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500 text-slate-950 rounded-xl font-extrabold text-sm shadow-lg shadow-amber-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-lg">visibility</span>
                                        Vista Previa e Imprimir ({totalLabels} etiq.)
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
