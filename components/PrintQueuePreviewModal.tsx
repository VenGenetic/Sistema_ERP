import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useBackDismiss } from '../hooks/useBackDismiss';
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
import { printLabelsOnThermalPrinter } from '../utils/thermalLabelPrinter';
import { LabelSizeSelector } from './LabelSizeSelector';
import { ThermalPrinterSelector } from './ThermalPrinterSelector';
import { LabelSizePreset } from '../utils/labelPresets';
import { getThumbnailUrl } from '../utils/image';
import {
  Download,
  Eye,
  FilePen,
  FilePlus,
  Image as ImageIcon,
  Layers,
  List,
  Loader2,
  Monitor,
  Printer,
  ReceiptText,
  Trash,
  Trash2,
  X,
} from 'lucide-react';

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
    // En el teléfono la cola sólo se arma y se revisa (la impresión ocurre en la
    // computadora), así que se entra por la lista editable; la simulación de
    // hojas A4 sólo describe el PDF, que es una acción de escritorio.
    const [activeTab, setActiveTab] = useState<'preview' | 'edit'>(isMobile ? 'edit' : 'preview');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [labelSize, setLabelSize] = useState<LabelSizePreset | null>(null);

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

    const handlePrintThermal = async () => {
        if (queue.length === 0 || isProcessing || !labelSize) return;
        setIsProcessing(true);
        try {
            await printLabelsOnThermalPrinter(
                queue.map((item) => ({ sku: item.sku, name: item.name, quantity: item.quantity })),
                { widthMm: labelSize.widthMm, heightMm: labelSize.heightMm },
                undefined,
                { gapMm: labelSize.gapMm }
            );
            if (navigator.vibrate) navigator.vibrate([40, 20, 40]);
        } catch (error: any) {
            alert('Error al imprimir en térmica: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    // El «atrás» del teléfono cierra este modal en vez de dejar la pantalla.
    useBackDismiss(isOpen, onClose);

    if (!isOpen) return null;

    return (
        <div 
            className={`fixed inset-0 z-50 flex ${ isMobile ? 'flex-col bg-surface-2 w-full h-full' : 'items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4' }`}
        >
            <div 
                className={`bg-surface flex flex-col overflow-hidden shadow-2xl ${ isMobile ? 'w-full h-full border-none rounded-none' : 'w-full max-w-6xl max-h-[90dvh] rounded-3xl border border-subtle dark:border-slate-800' }`}
            >
                {/* ── Header ────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-subtle bg-gradient-to-r from-slate-50 to-slate-100/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-warning/10 text-warning flex items-center justify-center shrink-0 shadow-xs">
                            <Printer size={24} aria-hidden="true" />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-fg tracking-tight flex items-center gap-2">
                                Vista Previa de Impresión (A4)
                            </h2>
                            <div className="flex items-center gap-2 text-xs text-fg-muted font-medium">
                                <span>{totalLabels} etiqueta{totalLabels !== 1 ? 's' : ''} en total</span>
                                <span>·</span>
                                <span className="text-warning font-bold">{totalPages} hoja{totalPages !== 1 ? 's' : ''} A4</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 text-fg-subtle hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-surface-hover transition-colors"
                        title="Cerrar vista previa"
                    >
                        <X size={24} aria-hidden="true" />
                    </button>
                </div>

                {/* ── Mobile / Small Screens Tab Selector ────────── */}
                <div className="lg:hidden flex border-b border-subtle bg-slate-100 dark:bg-slate-950 p-1.5 gap-1 shrink-0">
                    <button
                        onClick={() => setActiveTab('preview')}
                        className={`flex-1 py-2 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${ activeTab === 'preview' ? 'bg-white dark:bg-slate-800 text-warning shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200' }`}
                    >
                        <Eye size={18} aria-hidden="true" />
                        Hojas A4 ({pages.length || 0})
                    </button>
                    <button
                        onClick={() => setActiveTab('edit')}
                        className={`flex-1 py-2 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${ activeTab === 'edit' ? 'bg-white dark:bg-slate-800 text-warning shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200' }`}
                    >
                        <FilePen size={18} aria-hidden="true" />
                        Editar Cola ({queue.length})
                    </button>
                </div>

                {/* ── Main Body (Two columns on desktop, tabs on mobile/small screens) ── */}
                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row bg-surface-2">
                    
                    {/* ── Left Column: Queue Items List & Editor ────── */}
                    <div 
                        className={`w-full lg:w-[400px] xl:w-[440px] flex flex-col border-r border-subtle bg-surface overflow-hidden shrink-0 ${ activeTab === 'edit' ? 'flex' : 'hidden lg:flex' }`}
                    >
                        {/* Subheader */}
                        <div className="p-3.5 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/40">
                            <span className="text-xs font-bold uppercase tracking-wider text-fg-muted flex items-center gap-1.5">
                                <List size={16} aria-hidden="true" />
                                Productos en cola ({queue.length})
                            </span>
                            
                            {queue.length > 0 && (
                                !showClearConfirm ? (
                                    <button
                                        onClick={() => setShowClearConfirm(true)}
                                        className="text-[11px] font-bold text-danger hover:text-danger flex items-center gap-1 transition-opacity active:opacity-70"
                                    >
                                        <Trash size={15} aria-hidden="true" />
                                        Vaciar cola
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-1">
                                        <span className="text-2xs text-danger font-bold">¿Seguro?</span>
                                        <button 
                                            onClick={handleClearQueue} 
                                            className="text-2xs font-bold text-white bg-danger px-2 py-0.5 rounded shadow-xs hover:bg-danger"
                                        >
                                            Sí
                                        </button>
                                        <button 
                                            onClick={() => setShowClearConfirm(false)} 
                                            className="text-2xs font-bold text-fg-muted bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded hover:bg-slate-300 dark:hover:bg-slate-600"
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
                                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-fg-subtle my-auto">
                                    <Layers size={32} className="text-fg-subtle mb-2" aria-hidden="true" />
                                    <p className="text-xs font-bold text-fg-muted">La cola de impresión está vacía</p>
                                    <p className="text-[11px] text-fg-subtle mt-1 max-w-[220px]">Agrega repuestos desde el catálogo o buscador para verlos aquí y en las hojas de impresión.</p>
                                </div>
                            ) : (
                                queue.map((item) => (
                                    <div 
                                        key={item.sku} 
                                        className="flex items-center gap-3 p-2.5 bg-surface-2 rounded-2xl border border-slate-200/70 dark:border-subtle transition-all hover:border-slate-300 dark:hover:border-slate-700"
                                    >
                                        {/* Thumbnail */}
                                        {item.image_url ? (
                                            <img 
                                                src={getThumbnailUrl(item.image_url, 100)} 
                                                alt={item.name} 
                                                className="w-11 h-11 object-cover rounded-xl border border-subtle shrink-0 bg-white" 
                                            />
                                        ) : (
                                            <div className="w-11 h-11 bg-slate-200/60 dark:bg-slate-700/60 rounded-xl flex items-center justify-center text-fg-subtle shrink-0">
                                                <ImageIcon size={18} aria-hidden="true" />
                                            </div>
                                        )}

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <span className="text-2xs font-mono font-bold text-primary-soft-fg bg-primary-soft px-1.5 py-0.5 rounded border border-primary/20">
                                                {item.sku}
                                            </span>
                                            <p
                                                className="text-xs font-bold text-fg truncate mt-1"
                                                title={item.name}
                                            >
                                                {item.name}
                                            </p>
                                        </div>

                                        {/* Qty Editor */}
                                        <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-subtle shadow-2xs shrink-0">
                                            <button 
                                                type="button"
                                                onClick={() => handleQtyChange(item.id, item.quantity - 1)} 
                                                className="w-6 h-6 rounded-lg bg-surface-3 text-fg flex items-center justify-center text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
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
                                                className="w-9 h-6 text-center bg-transparent border-none text-xs font-bold text-fg p-0 focus:ring-0"
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => handleQtyChange(item.id, item.quantity + 1)} 
                                                className="w-6 h-6 rounded-lg bg-surface-3 text-fg flex items-center justify-center text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                title="Aumentar cantidad"
                                            >
                                                +
                                            </button>
                                        </div>

                                        {/* Delete */}
                                        <button 
                                            type="button"
                                            onClick={() => handleRemoveItem(item.id)} 
                                            className="p-2 text-danger hover:text-danger hover:bg-danger-soft rounded-xl transition-colors shrink-0" 
                                            title="Eliminar de la cola"
                                        >
                                            <Trash2 size={18} aria-hidden="true" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* ── Right Column: A4 Sheets Virtual Preview ──── */}
                    <div 
                        className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center bg-slate-100/80 dark:bg-slate-950/70 ${ activeTab === 'preview' ? 'flex' : 'hidden lg:flex' }`}
                    >
                        {queue.length === 0 ? (
                            <div className="my-auto flex flex-col items-center text-fg-subtle max-w-sm text-center">
                                <FilePlus size={18} className="text-6xl text-fg-subtle mb-3" aria-hidden="true" />
                                <h3 className="font-bold text-base text-fg">Sin hojas para mostrar</h3>
                                <p className="text-xs text-fg-muted mt-1">Agrega repuestos a tu cola y aquí verás la simulación exacta de cómo saldrán ordenados en tus hojas A4.</p>
                            </div>
                        ) : (
                            <div className="w-full flex flex-col items-center pb-8">
                                <p className="text-xs text-fg-muted font-medium mb-6 text-center max-w-md bg-surface py-1.5 px-4 rounded-full border border-subtle shadow-xs">
                                    💡 <span className="font-bold">Vista previa en vivo:</span> Así saldrá en papel impreso con líneas de corte (3 × 7 = 21 por hoja).
                                </p>

                                {pages.map((page, pageIndex) => (
                                    <div key={pageIndex} className="w-full max-w-[560px] mb-10 last:mb-2 transition-all">
                                        {/* Page badge */}
                                        <div className="flex items-center justify-between mb-2 px-1 text-xs font-bold text-fg-muted">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-warning text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shadow-xs">
                                                    {pageIndex + 1}
                                                </span>
                                                <span>Hoja A4 #{pageIndex + 1}</span>
                                            </div>
                                            <span className="text-[11px] text-fg-subtle font-bold">
                                                {page.length} / 21 etiquetas en esta hoja
                                            </span>
                                        </div>

                                        {/* Physical A4 Sheet representation */}
                                        <div className="w-full aspect-[210/297] bg-white text-black rounded-sm shadow-lg dark:shadow-xl dark:shadow-black/70 border border-slate-300/80 dark:border-slate-700 p-3 sm:p-4 grid grid-cols-3 grid-rows-7 gap-0 relative overflow-hidden ring-4 ring-black/5 dark:ring-white/5">
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
                                                                <div className="flex flex-col items-center justify-center gap-1 text-fg-subtle">
                                                                    <Loader2 size={18} className="animate-spin text-warning" aria-hidden="true" />
                                                                </div>
                                                            )
                                                        ) : (
                                                            <div className="w-full h-full flex flex-col items-center justify-center text-2xs sm:text-xs text-fg-subtle font-bold bg-slate-50/50">
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

                {/* La impresión térmica pasa por QZ Tray, que sólo corre en la
                    computadora conectada a la impresora -- desde el teléfono
                    estos controles no tendrían a quién hablarle, así que ahí se
                    muestra en su lugar dónde termina el trabajo. */}
                {!isMobile && (
                    <div className="px-4 pt-3 bg-surface border-t border-slate-100 dark:border-slate-800 shrink-0">
                        <div className="max-w-xs ml-auto flex flex-col gap-3">
                            <LabelSizeSelector value={labelSize} onChange={setLabelSize} />
                            <ThermalPrinterSelector />
                        </div>
                    </div>
                )}

                {isMobile && (
                    <div className="px-4 py-3 bg-surface border-t border-slate-100 dark:border-slate-800 shrink-0">
                        <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-primary-soft border border-primary/20">
                            <Monitor size={18} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
                            <p className="text-xs font-medium text-fg-muted leading-relaxed">
                                La cola queda guardada. Para imprimir las etiquetas, abre esta misma
                                cola en la computadora conectada a la impresora térmica.
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Footer / Actions Bar ─────────────────────────── */}
                <div className="p-4 border-t border-subtle bg-surface flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-fg-muted hover:bg-surface-hover rounded-xl transition-colors text-center order-3 sm:order-1"
                    >
                        Cerrar
                    </button>

                    {!isMobile && (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto order-1 sm:order-2">
                            <button
                                type="button"
                                onClick={handleDownload}
                                disabled={queue.length === 0 || isProcessing}
                                className="flex-1 sm:flex-none px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-surface-3 text-fg rounded-2xl font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none"
                                title="Descargar archivo PDF"
                            >
                                <Download size={18} className="text-primary" aria-hidden="true" />
                                Descargar PDF ({totalLabels})
                            </button>

                            <button
                                type="button"
                                onClick={handlePrintThermal}
                                disabled={queue.length === 0 || isProcessing || !labelSize}
                                className="flex-1 sm:flex-none px-7 py-3 bg-success hover:from-success hover:to-success text-white rounded-2xl font-bold text-xs sm:text-sm shadow-lg shadow-success/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                                title="Imprimir en la impresora térmica"
                            >
                                {isProcessing ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                        <span>Procesando...</span>
                                    </>
                                ) : (
                                    <>
                                        <ReceiptText size={18} aria-hidden="true" />
                                        <span>Imprimir Térmica ({totalLabels})</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={handlePrintNow}
                                disabled={queue.length === 0 || isProcessing}
                                className="flex-1 sm:flex-none px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-surface-3 text-fg rounded-2xl font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none"
                                title="Abrir cuadro de impresión A4 en vivo"
                            >
                                <Printer size={18} className="text-warning" aria-hidden="true" />
                                A4 ({totalPages} hoja{totalPages !== 1 ? 's' : ''})
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
