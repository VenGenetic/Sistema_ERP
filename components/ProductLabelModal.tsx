import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useBackDismiss } from '../hooks/useBackDismiss';
import { jsPDF } from 'jspdf';
import { addToQueue } from '../utils/mobilePrintQueue';
import { renderLabelToCanvas } from '../utils/mobileLabelPrinter';
import { printLabelsOnThermalPrinter, MAX_THERMAL_WIDTH_MM } from '../utils/thermalLabelPrinter';
import { LabelSizeSelector } from './LabelSizeSelector';
import { ThermalPrinterSelector } from './ThermalPrinterSelector';
import { LabelSizePreset } from '../utils/labelPresets';
import {
  Check,
  Copy,
  Download,
  FileText,
  ListPlus,
  Loader2,
  Printer,
  ReceiptText,
  Tag,
  X,
} from 'lucide-react';

interface ProductLabelModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: any;
}

export const ProductLabelModal: React.FC<ProductLabelModalProps> = ({ isOpen, onClose, product }) => {
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const labelCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [printQuantity, setPrintQuantity] = useState(1);
    const [activeTab, setActiveTab] = useState<'image' | 'pdf'>('image');
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
    const [queueAdded, setQueueAdded] = useState(false);
    const [isPrintingThermal, setIsPrintingThermal] = useState(false);
    const [labelSize, setLabelSize] = useState<LabelSizePreset | null>(null);

    const createPDF = useCallback(() => {
        if (!labelCanvasRef.current) return null;
        
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const imgData = labelCanvasRef.current.toDataURL('image/png', 1.0);

        // 0 margins to completely eliminate wasted space at borders
        const startX = 0;
        const startY = 0;
        const cols = 3;
        const rows = 7;
        
        const LABEL_W = 210 / cols; // 70 mm
        const LABEL_H = 297 / rows; // 42.428 mm

        let currentItem = 0;
        
        while (currentItem < printQuantity) {
            if (currentItem > 0 && currentItem % (cols * rows) === 0) {
                pdf.addPage();
            }

            const indexOnPage = currentItem % (cols * rows);
            const col = indexOnPage % cols;
            const row = Math.floor(indexOnPage / cols);

            const x = startX + (col * LABEL_W);
            const y = startY + (row * LABEL_H);

            pdf.setDrawColor(0, 0, 0); // Black for high visibility
            pdf.setLineWidth(0.2); // Thicker line
            pdf.setLineDashPattern([2, 1.5], 0); // Clearer dash pattern
            pdf.rect(x, y, LABEL_W, LABEL_H);
            pdf.setLineDashPattern([], 0);

            pdf.addImage(imgData, 'PNG', x, y, LABEL_W, LABEL_H);
            
            currentItem++;
        }
        return pdf;
    }, [printQuantity]);

    // Update PDF preview URL when tab changes to pdf or quantity changes
    useEffect(() => {
        if (activeTab === 'pdf') {
            const timer = setTimeout(() => {
                const pdf = createPDF();
                if (pdf) {
                    const blob = pdf.output('blob');
                    const url = URL.createObjectURL(blob);
                    setPdfPreviewUrl(url);
                }
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [activeTab, printQuantity, createPDF]);

    // Cleanup object URL
    useEffect(() => {
        return () => {
            if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
        };
    }, [pdfPreviewUrl]);

    const renderPreview = useCallback(async () => {
        if (!product) return;
        try {
            // Preview at the *selected* label size, clamped the same way
            // printLabelsOnThermalPrinter clamps it. Rendering the A4-cell
            // default here (as this used to) meant the preview silently
            // showed a different aspect ratio than what actually printed.
            const canvas = await renderLabelToCanvas(
                product,
                labelSize
                    ? {
                          widthMm: Math.min(labelSize.widthMm, MAX_THERMAL_WIDTH_MM),
                          heightMm: labelSize.heightMm,
                      }
                    : undefined
            );
            labelCanvasRef.current = canvas;

            // Draw a scaled preview in the visible canvas
            if (previewCanvasRef.current) {
                const preview = previewCanvasRef.current;
                const maxW = Math.min(680, window.innerWidth - 80);
                const scale = maxW / canvas.width;
                preview.width = canvas.width * scale;
                preview.height = canvas.height * scale;
                const ctx = preview.getContext('2d')!;
                ctx.scale(scale, scale);
                ctx.drawImage(canvas, 0, 0);
            }
            setCopied(false);
        } catch (error) {
            console.error("Error rendering label:", error);
        }
    }, [product, labelSize]);

    useEffect(() => {
        if (isOpen && product) {
            // Small delay to ensure the canvas element is mounted
            const t = setTimeout(renderPreview, 50);
            return () => clearTimeout(t);
        }
    }, [isOpen, product, renderPreview]);

    // El «atrás» del teléfono cierra este modal en vez de dejar la pantalla.
    useBackDismiss(isOpen && !!product, onClose);

    if (!isOpen || !product) return null;

    const handleCopyImage = async () => {
        if (!labelCanvasRef.current) return;
        setIsGenerating(true);
        try {
            labelCanvasRef.current.toBlob(async (blob) => {
                if (blob) {
                    try {
                        const item = new ClipboardItem({ 'image/png': blob });
                        await navigator.clipboard.write([item]);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 3000);
                    } catch (err) {
                        console.error('Error al copiar al portapapeles: ', err);
                        alert('No se pudo copiar al portapapeles. Prueba usar el botón de Descargar.');
                    }
                }
                setIsGenerating(false);
            }, 'image/png', 1.0);
        } catch (error) {
            console.error('Error generating image:', error);
            alert('Error al generar la imagen.');
            setIsGenerating(false);
        }
    };

    const handleDownloadImage = () => {
        if (!labelCanvasRef.current) return;
        labelCanvasRef.current.toBlob((blob) => {
            if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `etiqueta_${product.sku}.png`;
                a.click();
                URL.revokeObjectURL(url);
            }
        }, 'image/png', 1.0);
    };

    const handleGeneratePDF = () => {
        if (!labelCanvasRef.current || printQuantity < 1) return;
        setIsGenerating(true);
        try {
            const pdf = createPDF();
            if (pdf) {
                pdf.save(`etiquetas_${product.sku}_qty${printQuantity}.pdf`);
            }
        } catch (error) {
            console.error('Error al generar PDF: ', error);
            alert('Ocurrió un error al generar el PDF.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePrintThermal = async () => {
        if (!product || printQuantity < 1 || !labelSize) return;
        setIsPrintingThermal(true);
        try {
            await printLabelsOnThermalPrinter(
                [{ sku: product.sku, name: product.name, quantity: printQuantity }],
                { widthMm: labelSize.widthMm, heightMm: labelSize.heightMm },
                undefined,
                { gapMm: labelSize.gapMm }
            );
        } catch (error) {
            console.error('Error al imprimir en térmica:', error);
            alert('Ocurrió un error al enviar la etiqueta a la impresora térmica.');
        } finally {
            setIsPrintingThermal(false);
        }
    };

    const handleOpenPDF = () => {
        if (!labelCanvasRef.current || printQuantity < 1) return;
        setIsGenerating(true);
        try {
            const pdf = createPDF();
            if (pdf) {
                const blob = pdf.output('blob');
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
            }
        } catch (error) {
            console.error('Error al abrir PDF: ', error);
            alert('Ocurrió un error al abrir el PDF.');
        } finally {
            setIsGenerating(false);
        }
    };

    /*
        Anclado abajo en el teléfono (MASTER.md: las ventanas entran por
        abajo, al alcance del pulgar) y centrado a partir de `sm`, que es
        el escritorio. La versión grande no cambia.
    */
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4 backdrop-blur-sm">
            <div className="bg-surface rounded-2xl shadow-lg w-full max-w-3xl overflow-hidden flex flex-col max-h-[90dvh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-subtle shrink-0">
                    <h2 className="text-xl font-bold text-fg flex items-center gap-2">
                        <Tag size={18} aria-hidden="true" />
                        Etiqueta de Producto
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-fg-subtle hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-surface-hover transition-colors"
                    >
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col items-center bg-surface-2 overflow-y-auto">
                    <div className="flex flex-col lg:flex-row gap-8 w-full items-start justify-center">
                        {/* Left: Preview */}
                        <div className="flex flex-col items-center w-full lg:w-1/2">
                            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg mb-4 w-full max-w-sm">
                                <button
                                    onClick={() => setActiveTab('image')}
                                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${ activeTab === 'image' ? 'bg-white dark:bg-slate-700 text-fg shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200' }`}
                                >
                                    Etiqueta Sola
                                </button>
                                <button
                                    onClick={() => setActiveTab('pdf')}
                                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${ activeTab === 'pdf' ? 'bg-white dark:bg-slate-700 text-fg shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200' }`}
                                >
                                    Vista Previa PDF
                                </button>
                            </div>
                            
                            {activeTab === 'image' ? (
                                <div className="shadow-xl ring-1 ring-slate-300 dark:ring-slate-700 rounded-sm">
                                    <canvas
                                        ref={previewCanvasRef}
                                        style={{ display: 'block', maxWidth: '100%' }}
                                    />
                                </div>
                            ) : (
                                <div className="w-full h-[400px] border border-strong rounded-lg overflow-hidden bg-surface-3 flex items-center justify-center">
                                    {pdfPreviewUrl ? (
                                        <iframe 
                                            src={pdfPreviewUrl} 
                                            className="w-full h-full"
                                            title="PDF Preview"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-fg-subtle">
                                            <Loader2 size={28} className="animate-spin" aria-hidden="true" />
                                            <span className="text-sm">Generando vista previa...</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Right: Print Controls */}
                        <div className="flex flex-col gap-6 w-full lg:w-1/2 bg-surface p-6 rounded-xl border border-subtle shadow-sm">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-fg">Cantidad de etiquetas a imprimir:</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        max="500"
                                        value={printQuantity}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || 1;
                                            setPrintQuantity(Math.max(1, val));
                                        }}
                                        className="w-24 px-3 py-2 bg-surface-2 border border-subtle rounded-lg text-fg font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                    />
                                    <span className="text-sm text-fg-muted">etiquetas</span>
                                </div>
                            </div>

                            {/* Thermal printer (primary) */}
                            <div className="flex flex-col gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <h3 className="font-semibold text-fg flex items-center gap-2">
                                    <ReceiptText size={18} aria-hidden="true" />
                                    Impresora Térmica
                                </h3>
                                <p className="text-sm text-fg-muted">
                                    Envía cada etiqueta directamente a la impresora térmica, sin generar un PDF.
                                </p>
                                <LabelSizeSelector value={labelSize} onChange={setLabelSize} />
                                <ThermalPrinterSelector />
                                <button
                                    onClick={handlePrintThermal}
                                    disabled={isPrintingThermal || printQuantity < 1 || !labelSize}
                                    className="w-full py-3 bg-success hover:bg-success text-white font-medium rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isPrintingThermal ? <Loader2 size={18} className={`${isPrintingThermal ? 'animate-spin' : ''}`} aria-hidden="true" /> : <Printer size={18} className={`${isPrintingThermal ? 'animate-spin' : ''}`} aria-hidden="true" />}
                                    {isPrintingThermal ? 'Enviando...' : 'Imprimir en Térmica'}
                                </button>
                            </div>

                            {/* A4 PDF (legacy / sticker sheets) */}
                            <div className="flex flex-col gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <h3 className="font-semibold text-fg flex items-center gap-2">
                                    <FileText size={18} aria-hidden="true" />
                                    PDF en Hoja A4
                                </h3>
                                <p className="text-sm text-fg-muted">
                                    Genera un archivo PDF tamaño A4 (hasta 21 etiquetas por página), útil para hojas de stickers pre-cortadas.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button
                                        onClick={handleGeneratePDF}
                                        disabled={isGenerating || printQuantity < 1}
                                        className="flex-1 py-3 bg-primary-soft hover:bg-primary-soft text-primary border border-primary/20 font-medium rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        <Download size={20} aria-hidden="true" />
                                        Descargar
                                    </button>
                                    <button
                                        onClick={handleOpenPDF}
                                        disabled={isGenerating || printQuantity < 1}
                                        className="flex-1 py-3 bg-primary hover:bg-primary text-white font-medium rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isGenerating ? <Loader2 size={18} className={`${isGenerating ? 'animate-spin' : ''}`} aria-hidden="true" /> : <Printer size={18} className={`${isGenerating ? 'animate-spin' : ''}`} aria-hidden="true" />}
                                        {isGenerating ? 'Generando...' : 'Imprimir PDF'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-subtle flex flex-wrap justify-end gap-3 bg-surface shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-fg-muted font-medium hover:bg-surface-hover rounded-lg transition-colors mr-auto"
                    >
                        Cerrar
                    </button>

                    <button
                        onClick={() => {
                            addToQueue(
                                { id: product.id, sku: product.sku, name: product.name, image_url: product.image_url },
                                printQuantity
                            );
                            setQueueAdded(true);
                            if (navigator.vibrate) navigator.vibrate(50);
                            setTimeout(() => setQueueAdded(false), 2500);
                        }}
                        className={`px-4 py-2 font-medium rounded-lg transition-colors flex items-center gap-2 border ${ queueAdded ? 'bg-warning-soft text-warning border-warning/20 dark:border-warning' : 'text-warning hover:bg-warning-soft border-warning/20 dark:border-warning' }`}
                        title="Agregar estas etiquetas a la cola de impresión"
                    >
                        {queueAdded ? <Check size={20} aria-hidden="true" /> : <ListPlus size={20} aria-hidden="true" />}
                        {queueAdded ? `¡${printQuantity} agregadas a la cola!` : `Agregar ${printQuantity} a Cola`}
                    </button>
                    
                    <button
                        onClick={handleDownloadImage}
                        className="px-4 py-2 text-fg font-medium hover:bg-surface-hover rounded-lg transition-colors flex items-center gap-2 border border-subtle"
                        title="Descargar imagen PNG"
                    >
                        <Download size={20} aria-hidden="true" />
                        Descargar
                    </button>

                    <button
                        onClick={handlePrintThermal}
                        disabled={isPrintingThermal || printQuantity < 1 || !labelSize}
                        className="px-4 py-2 text-fg font-medium hover:bg-surface-hover rounded-lg transition-colors flex items-center gap-2 border border-subtle disabled:opacity-70 disabled:cursor-not-allowed"
                        title="Imprimir en la impresora térmica"
                    >
                        {isPrintingThermal ? <Loader2 size={20} className={`${isPrintingThermal ? 'animate-spin' : ''}`} aria-hidden="true" /> : <Printer size={20} className={`${isPrintingThermal ? 'animate-spin' : ''}`} aria-hidden="true" />}
                        Imprimir Térmica
                    </button>

                    <button
                        onClick={handleCopyImage}
                        disabled={isGenerating}
                        className={`px-5 py-2 text-white font-medium rounded-lg shadow-sm flex items-center gap-2 transition-colors ${ copied ? 'bg-success hover:bg-success shadow-success/30' : 'bg-primary hover:bg-primary/90 shadow-primary/30' } disabled:opacity-70 disabled:cursor-not-allowed`}
                    >
                        {copied ? <Check size={20} aria-hidden="true" /> : <Copy size={20} aria-hidden="true" />}
                        {copied ? '¡Copiado!' : 'Copiar Imagen'}
                    </button>
                </div>
            </div>
        </div>
    );
};
