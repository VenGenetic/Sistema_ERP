import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    getPrintQueue,
    updateQueueItemQty,
    removeFromQueue,
    clearQueue,
    getQueueTotalLabels,
    getQueuePageCount,
    generateQueuePDF,
    downloadQueuePDF,
    PrintQueueItem
} from '../utils/mobilePrintQueue';
import { renderLabelToCanvas } from '../utils/mobileLabelPrinter';
import { getThumbnailUrl } from '../utils/image';

interface PrintQueuePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onQueueUpdated?: (queue: PrintQueueItem[]) => void;
    isMobile?: boolean;
}

export const PrintQueuePreviewModal: React.FC<PrintQueuePreviewModalProps> = ({
    isOpen,
    onClose,
    onQueueUpdated,
    isMobile = false,
}) => {
    const [queue, setQueue] = useState<PrintQueueItem[]>([]);
    const [labelImages, setLabelImages] = useState<Record<string, string>>({});
    const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Cargar cola cuando se abre el modal. force=true: el modal debe reflejar
    // lo que pueda haber cambiado en otra pestaña/dispositivo, no la caché
    // en memoria que usan las pantallas del modo móvil para responder rápido.
    useEffect(() => {
        if (isOpen) {
            const loadQueue = async () => {
                const items = await getPrintQueue(true);
                setQueue(items);
                setShowClearConfirm(false);
            };
            loadQueue();
        }
    }, [isOpen]);

    // Generar y cachear imágenes PNG en base64 para los lienzos de las etiquetas.
    // Usa el updater funcional de setState (en vez de leer `labelImages` del
    // closure) para no tener que incluir `labelImages` en las dependencias:
    // eso evitaba que el efecto se re-disparara a sí mismo cada vez que
    // cacheaba una nueva etiqueta, re-recorriendo la cola completa de más.
    const requestedSkusRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;

        const missing = queue.filter((item) => !requestedSkusRef.current.has(item.sku));
        if (missing.length === 0) return;
        missing.forEach((item) => requestedSkusRef.current.add(item.sku));

        (async () => {
            for (const item of missing) {
                try {
                    const canvas = await renderLabelToCanvas({ sku: item.sku, name: item.name });
                    if (cancelled) return;
                    const dataUrl = canvas.toDataURL('image/png', 1.0);
                    setLabelImages((prev) => ({ ...prev, [item.sku]: dataUrl }));
                } catch (err) {
                    console.error('Error generando etiqueta para SKU:', item.sku, err);
                }
            }
        })();

        return () => { cancelled = true; };
    }, [queue, isOpen]);

    // Calcular todas las etiquetas individuales ordenadas para rellenar las páginas A4
    const allLabels = useMemo(() => {
        const list: Array<{ sku: string; name: string }> = [];
        queue.forEach((item) => {
            for (let i = 0; i < item.quantity; i++) {
                list.push({ sku: item.sku, name: item.name });
            }
        });
        return list;
    }, [queue]);

    // Agrupar en hojas A4 de 21 etiquetas (3 columnas por 7 filas)
    const pages = useMemo(() => {
        const PER_PAGE = 21;
        const pageList: Array<Array<{ sku: string; name: string }>> = [];
        for (let i = 0; i < allLabels.length; i += PER_PAGE) {
            pageList.push(allLabels.slice(i, i + PER_PAGE));
        }
        return pageList;
    }, [allLabels]);

    const totalLabels = getQueueTotalLabels(queue);
    const totalPages = getQueuePageCount(queue);

    // Acciones de edición de cola
    const handleQtyChange = useCallback(async (id: number, newQty: number) => {
        const updated = await updateQueueItemQty(id, Math.max(1, newQty));
        setQueue(updated);
        onQueueUpdated?.(updated);
    }, [onQueueUpdated]);

    const handleRemoveItem = useCallback(async (id: number) => {
        const updated = await removeFromQueue(id);
        setQueue(updated);
        onQueueUpdated?.(updated);
    }, [onQueueUpdated]);

    const handleClearQueue = useCallback(async () => {
        await clearQueue();
        setQueue([]);
        setShowClearConfirm(false);
        onQueueUpdated?.([]);
        if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
    }, [onQueueUpdated]);

    // Acciones de impresión y descarga
    const handleDownload = async () => {
        if (queue.length === 0 || isProcessing) return;
        setIsProcessing(true);
        try {
            await downloadQueuePDF(queue);
        } catch (error: any) {
            alert('Error al descargar: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePrintNow = async () => {
        if (queue.length === 0 || isProcessing) return;
        setIsProcessing(true);
        try {
            const pdf = await generateQueuePDF(queue);
            pdf.autoPrint();
            const blob = pdf.output('blob');
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            if (navigator.vibrate) navigator.vibrate([40, 20, 40]);
        } catch (error: any) {
            alert('Error al intentar imprimir: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className={`fixed inset-0 z-50 flex ${
                isMobile 
                    ? 'flex-col bg-slate-50 dark:bg-slate-950 w-full h-full' 
                    : 'items-center justify-center bg-black/65 backdrop-blur-xs p-4'
            }`}
        >
            <div 
                className={`bg-white dark:bg-slate-900 flex flex-col overflow-hidden shadow-2xl ${
                    isMobile 
                        ? 'w-full h-full border-none rounded-none' 
                        : 'w-full max-w-6xl max-h-[90vh] rounded-3xl border border-slate-200 dark:border-slate-800'
                }`}
            >
                {/* ── Header ────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-850 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
                            <span className="material-symbols-outlined text-[24px]">print</span>
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                Vista Previa de Impresión (A4)
                            </h2>
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                <span>{totalLabels} etiqueta{totalLabels !== 1 ? 's' : ''} en total</span>
                                <span>·</span>
                                <span className="text-amber-600 dark:text-amber-400 font-bold">{totalPages} hoja{totalPages !== 1 ? 's' : ''} A4</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Cerrar vista previa"
                    >
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                </div>

                {/* ── Mobile / Small Screens Tab Selector ────────── */}
                <div className="lg:hidden flex border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-1.5 gap-1 shrink-0">
                    <button
                        onClick={() => setActiveTab('preview')}
                        className={`flex-1 py-2 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'preview'
                                ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                        Hojas A4 ({pages.length || 0})
                    </button>
                    <button
                        onClick={() => setActiveTab('edit')}
                        className={`flex-1 py-2 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'edit'
                                ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[18px]">edit_note</span>
                        Editar Cola ({queue.length})
                    </button>
                </div>

                {/* ── Main Body (Two columns on desktop, tabs on mobile/small screens) ── */}
                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950/60">
                    
                    {/* ── Left Column: Queue Items List & Editor ────── */}
                    <div 
                        className={`w-full lg:w-[400px] xl:w-[440px] flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shrink-0 ${
                            activeTab === 'edit' ? 'flex' : 'hidden lg:flex'
                        }`}
                    >
                        {/* Subheader */}
                        <div className="p-3.5 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/40">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-base">list</span>
                                Productos en cola ({queue.length})
                            </span>
                            
                            {queue.length > 0 && (
                                !showClearConfirm ? (
                                    <button
                                        onClick={() => setShowClearConfirm(true)}
                                        className="text-[11px] font-bold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 transition-opacity active:opacity-70"
                                    >
                                        <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
                                        Vaciar cola
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-rose-500 font-bold">¿Seguro?</span>
                                        <button 
                                            onClick={handleClearQueue} 
                                            className="text-[10px] font-extrabold text-white bg-rose-500 px-2 py-0.5 rounded shadow-xs hover:bg-rose-600"
                                        >
                                            Sí
                                        </button>
                                        <button 
                                            onClick={() => setShowClearConfirm(false)} 
                                            className="text-[10px] font-extrabold text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded hover:bg-slate-300 dark:hover:bg-slate-600"
                                        >
                                            No
                                        </button>
                                    </div>
                                )
                            )}
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                            {queue.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 my-auto">
                                    <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">queue</span>
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">La cola de impresión está vacía</p>
                                    <p className="text-[11px] text-slate-400 mt-1 max-w-[220px]">Agrega repuestos desde el catálogo o buscador para verlos aquí y en las hojas de impresión.</p>
                                </div>
                            ) : (
                                queue.map((item) => (
                                    <div 
                                        key={item.sku} 
                                        className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/70 dark:border-slate-750 transition-all hover:border-slate-300 dark:hover:border-slate-700"
                                    >
                                        {/* Thumbnail */}
                                        {item.image_url ? (
                                            <img 
                                                src={getThumbnailUrl(item.image_url, 100)} 
                                                alt={item.name} 
                                                className="w-11 h-11 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 bg-white" 
                                            />
                                        ) : (
                                            <div className="w-11 h-11 bg-slate-200/60 dark:bg-slate-700/60 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                                                <span className="material-symbols-outlined text-lg">image</span>
                                            </div>
                                        )}

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[10px] font-mono font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-200/50 dark:border-blue-800/50">
                                                {item.sku}
                                            </span>
                                            <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate mt-1">
                                                {item.name}
                                            </p>
                                        </div>

                                        {/* Qty Editor */}
                                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0">
                                            <button 
                                                type="button"
                                                onClick={() => handleQtyChange(item.id, item.quantity - 1)} 
                                                className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center text-xs font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                title="Disminuir cantidad"
                                            >
                                                −
                                            </button>
                                            <input
                                                type="number"
                                                min="1"
                                                step="1"
                                                value={item.quantity}
                                                onChange={(e) => handleQtyChange(item.id, parseInt(e.target.value) || 1)}
                                                className="w-9 h-6 text-center bg-transparent border-none text-xs font-black text-slate-900 dark:text-white p-0 focus:ring-0"
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => handleQtyChange(item.id, item.quantity + 1)} 
                                                className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center text-xs font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                title="Aumentar cantidad"
                                            >
                                                +
                                            </button>
                                        </div>

                                        {/* Delete */}
                                        <button 
                                            type="button"
                                            onClick={() => handleRemoveItem(item.id)} 
                                            className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-colors shrink-0" 
                                            title="Eliminar de la cola"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* ── Right Column: A4 Sheets Virtual Preview ──── */}
                    <div 
                        className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center bg-slate-100/80 dark:bg-slate-950/70 ${
                            activeTab === 'preview' ? 'flex' : 'hidden lg:flex'
                        }`}
                    >
                        {queue.length === 0 ? (
                            <div className="my-auto flex flex-col items-center text-slate-400 max-w-sm text-center">
                                <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 mb-3 animate-pulse">note_add</span>
                                <h3 className="font-extrabold text-base text-slate-700 dark:text-slate-300">Sin hojas para mostrar</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Agrega repuestos a tu cola y aquí verás la simulación exacta de cómo saldrán ordenados en tus hojas A4.</p>
                            </div>
                        ) : (
                            <div className="w-full flex flex-col items-center pb-8">
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-6 text-center max-w-md bg-white dark:bg-slate-800 py-1.5 px-4 rounded-full border border-slate-200 dark:border-slate-750 shadow-xs">
                                    💡 <span className="font-bold">Vista previa en vivo:</span> Así saldrá en papel impreso con líneas de corte (3 × 7 = 21 por hoja).
                                </p>

                                {pages.map((page, pageIndex) => (
                                    <div key={pageIndex} className="w-full max-w-[560px] mb-10 last:mb-2 transition-all">
                                        {/* Page badge */}
                                        <div className="flex items-center justify-between mb-2 px-1 text-xs font-black text-slate-600 dark:text-slate-300">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-amber-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shadow-xs">
                                                    {pageIndex + 1}
                                                </span>
                                                <span>Hoja A4 #{pageIndex + 1}</span>
                                            </div>
                                            <span className="text-[11px] text-slate-400 font-bold">
                                                {page.length} / 21 etiquetas en esta hoja
                                            </span>
                                        </div>

                                        {/* Physical A4 Sheet representation */}
                                        <div className="w-full aspect-[210/297] bg-white text-black rounded-sm shadow-xl dark:shadow-2xl dark:shadow-black/70 border border-slate-300/80 dark:border-slate-700 p-3 sm:p-4 grid grid-cols-3 grid-rows-7 gap-0 relative overflow-hidden ring-4 ring-black/5 dark:ring-white/5">
                                            {Array.from({ length: 21 }).map((_, slotIdx) => {
                                                const label = page[slotIdx];
                                                return (
                                                    <div 
                                                        key={slotIdx} 
                                                        className="border border-dashed border-slate-300/90 flex items-center justify-center p-1 sm:p-1.5 relative overflow-hidden bg-white group select-none"
                                                    >
                                                        {label ? (
                                                            labelImages[label.sku] ? (
                                                                <img 
                                                                    src={labelImages[label.sku]} 
                                                                    alt={label.sku} 
                                                                    className="w-full h-full object-contain pointer-events-none drop-shadow-2xs" 
                                                                />
                                                            ) : (
                                                                <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
                                                                    <span className="material-symbols-outlined animate-spin text-lg text-amber-500">progress_activity</span>
                                                                </div>
                                                            )
                                                        ) : (
                                                            <div className="w-full h-full flex flex-col items-center justify-center text-[10px] sm:text-xs text-slate-250 font-bold bg-slate-50/50">
                                                                <span>Vacío</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Footer / Actions Bar ─────────────────────────── */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-center order-3 sm:order-1"
                    >
                        Cerrar
                    </button>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto order-1 sm:order-2">
                        <button
                            type="button"
                            onClick={handleDownload}
                            disabled={queue.length === 0 || isProcessing}
                            className="flex-1 sm:flex-none px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 rounded-2xl font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none"
                            title="Descargar archivo PDF"
                        >
                            <span className="material-symbols-outlined text-[18px] text-blue-500 dark:text-blue-400">download</span>
                            Descargar PDF ({totalLabels})
                        </button>

                        <button
                            type="button"
                            onClick={handlePrintNow}
                            disabled={queue.length === 0 || isProcessing}
                            className="flex-1 sm:flex-none px-7 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-black text-xs sm:text-sm shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                            title="Abrir cuadro de impresión en vivo"
                        >
                            {isProcessing ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                    <span>Procesando...</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-lg">print</span>
                                    <span>Imprimir Ahora ({totalPages} hoja{totalPages !== 1 ? 's' : ''})</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
