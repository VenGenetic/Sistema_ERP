import React, { useEffect, useRef, useState, useCallback } from 'react';
import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';

interface ProductLabelModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: any;
}

// Renders the label to an offscreen canvas and returns it.
// Layout is fully canvas-based so nothing can get clipped.
const renderLabelToCanvas = (product: any): HTMLCanvasElement => {
    // --- Dimensions: 7cm x 4.24cm at 300 DPI to fill A4 with 0 margins ---
    const DPI = 300;
    const MM_TO_INCH = 1 / 25.4;
    const W = Math.round((210 / 3) * MM_TO_INCH * DPI); // ~827px
    const H = Math.round((297 / 7) * MM_TO_INCH * DPI); // ~501px
    const PAD = Math.round(W * 0.04); // Reducir padding interno a ~4% para aprovechar mejor el espacio

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000000';

    // --- BARCODE in the center ---
    const barcodeCanvas = document.createElement('canvas');
    JsBarcode(barcodeCanvas, product.sku, {
        format: 'CODE128',
        displayValue: false,
        width: 3,
        height: Math.round(H * 0.34), // 34% of height
        margin: 0,
        lineColor: '#000000',
        background: '#ffffff',
    });

    const bcW = Math.min(barcodeCanvas.width, W - PAD * 2);
    const bcH = barcodeCanvas.height;
    const bcX = (W - bcW) / 2;
    const bcY = (H - bcH) / 2; // true vertical center

    // --- DESCRIPTION TEXT (above barcode) ---
    const descAreaH = bcY - PAD; // space above barcode minus top padding
    const descMaxW = W - PAD * 2;

    // Auto-fit font size for description
    let descFontSize = Math.round(H * 0.09); // start at ~9% of height
    const MIN_FONT = Math.round(H * 0.048);
    ctx.font = `bold ${descFontSize}px sans-serif`;

    const wrapText = (text: string, maxW: number, fontSize: number) => {
        ctx.font = `bold ${fontSize}px sans-serif`;
        const words = text.split(' ');
        const lines: string[] = [];
        let current = '';
        for (const word of words) {
            const test = current ? `${current} ${word}` : word;
            if (ctx.measureText(test).width > maxW && current) {
                lines.push(current);
                current = word;
            } else {
                current = test;
            }
        }
        if (current) lines.push(current);
        return lines;
    };

    // Shrink font until all lines fit in the available area
    let descLines: string[] = [];
    while (descFontSize >= MIN_FONT) {
        descLines = wrapText(product.name, descMaxW, descFontSize);
        const totalH = descLines.length * descFontSize * 1.25;
        if (totalH <= descAreaH - PAD * 0.5) break;
        descFontSize -= 2;
    }

    // Draw description lines, vertically centered in the top area
    const descLineH = descFontSize * 1.25;
    const descBlockH = descLines.length * descLineH;
    let descY = PAD + (descAreaH - PAD - descBlockH) / 2 + descFontSize;
    ctx.font = `bold ${descFontSize}px sans-serif`;
    ctx.textAlign = 'center';
    for (const line of descLines) {
        ctx.fillText(line, W / 2, descY);
        descY += descLineH;
    }

    // --- Draw Barcode ---
    ctx.drawImage(barcodeCanvas, bcX, bcY, bcW, bcH);

    // --- SKU TEXT (below barcode) ---
    const skuAreaTop = bcY + bcH;
    const skuAreaH = H - skuAreaTop - PAD;

    let skuFontSize = Math.round(H * 0.1);
    const MIN_SKU_FONT = Math.round(H * 0.055);
    while (skuFontSize >= MIN_SKU_FONT) {
        ctx.font = `bold ${skuFontSize}px monospace`;
        const skuW = ctx.measureText(product.sku).width;
        if (skuW <= descMaxW) break;
        skuFontSize -= 2;
    }
    ctx.font = `bold ${skuFontSize}px monospace`;
    ctx.textAlign = 'center';
    const skuY = skuAreaTop + (skuAreaH + skuFontSize) / 2;
    ctx.fillText(product.sku, W / 2, skuY);

    return canvas;
};

export const ProductLabelModal: React.FC<ProductLabelModalProps> = ({ isOpen, onClose, product }) => {
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const labelCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [printQuantity, setPrintQuantity] = useState(1);
    const [activeTab, setActiveTab] = useState<'image' | 'pdf'>('image');
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

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

    const renderPreview = useCallback(() => {
        if (!product) return;
        try {
            const canvas = renderLabelToCanvas(product);
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
    }, [product]);

    useEffect(() => {
        if (isOpen && product) {
            // Small delay to ensure the canvas element is mounted
            const t = setTimeout(renderPreview, 50);
            return () => clearTimeout(t);
        }
    }, [isOpen, product, renderPreview]);

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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined">label</span>
                        Etiqueta de Producto — Optimizada para A4
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col items-center bg-slate-50 dark:bg-slate-950/50 overflow-y-auto">
                    <div className="flex flex-col lg:flex-row gap-8 w-full items-start justify-center">
                        {/* Left: Preview */}
                        <div className="flex flex-col items-center w-full lg:w-1/2">
                            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg mb-4 w-full max-w-sm">
                                <button
                                    onClick={() => setActiveTab('image')}
                                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                        activeTab === 'image' 
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                                >
                                    Etiqueta Sola
                                </button>
                                <button
                                    onClick={() => setActiveTab('pdf')}
                                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                        activeTab === 'pdf' 
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                                >
                                    Vista Previa PDF
                                </button>
                            </div>
                            
                            {activeTab === 'image' ? (
                                <div className="shadow-2xl ring-1 ring-slate-300 dark:ring-slate-700 rounded-sm">
                                    <canvas
                                        ref={previewCanvasRef}
                                        style={{ display: 'block', maxWidth: '100%' }}
                                    />
                                </div>
                            ) : (
                                <div className="w-full h-[400px] border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                    {pdfPreviewUrl ? (
                                        <iframe 
                                            src={pdfPreviewUrl} 
                                            className="w-full h-full"
                                            title="PDF Preview"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                            <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
                                            <span className="text-sm">Generando vista previa...</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Right: PDF Controls */}
                        <div className="flex flex-col gap-6 w-full lg:w-1/2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <span className="material-symbols-outlined">print</span>
                                Impresión en PDF (Hoja A4)
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Genera un archivo PDF tamaño A4 listo para imprimir. Las etiquetas se organizarán automáticamente (hasta 21 por página).
                            </p>
                            
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cantidad de etiquetas a imprimir:</label>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="number" 
                                        min="1" 
                                        max="500"
                                        value={printQuantity} 
                                        onChange={(e) => setPrintQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-24 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                    />
                                    <span className="text-sm text-slate-500">etiquetas</span>
                                </div>
                            </div>

                            <button
                                onClick={handleGeneratePDF}
                                disabled={isGenerating || printQuantity < 1}
                                className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <span className={`material-symbols-outlined ${isGenerating ? 'animate-spin' : ''}`}>
                                    {isGenerating ? 'progress_activity' : 'picture_as_pdf'}
                                </span>
                                {isGenerating ? 'Generando...' : 'Generar PDF A4'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap justify-end gap-3 bg-white dark:bg-slate-900 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors mr-auto"
                    >
                        Cerrar
                    </button>
                    
                    <button
                        onClick={handleDownloadImage}
                        className="px-4 py-2 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 border border-slate-200 dark:border-slate-700"
                        title="Descargar imagen PNG"
                    >
                        <span className="material-symbols-outlined text-[20px]">download</span>
                        Descargar Imagen
                    </button>

                    <button
                        onClick={handleCopyImage}
                        disabled={isGenerating}
                        className={`px-5 py-2 text-white font-medium rounded-lg shadow-sm flex items-center gap-2 transition-colors ${
                            copied
                                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                                : 'bg-primary hover:bg-primary/90 shadow-primary/30'
                        } disabled:opacity-70 disabled:cursor-not-allowed`}
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            {copied ? 'check' : 'content_copy'}
                        </span>
                        {copied ? '¡Copiado!' : 'Copiar Imagen'}
                    </button>
                </div>
            </div>
        </div>
    );
};
