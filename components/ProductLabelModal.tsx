import React, { useEffect, useRef, useState, useCallback } from 'react';
import JsBarcode from 'jsbarcode';

interface ProductLabelModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: any;
}

// Renders the label to an offscreen canvas and returns it.
// Layout is fully canvas-based so nothing can get clipped.
const renderLabelToCanvas = (product: any): HTMLCanvasElement => {
    // --- Dimensions: 6cm x 4cm at 300 DPI ---
    const DPI = 300;
    const CM_TO_INCH = 1 / 2.54;
    const W = Math.round(6 * CM_TO_INCH * DPI); // 709px
    const H = Math.round(4 * CM_TO_INCH * DPI); // 472px
    const PAD = Math.round(W * 0.065); // ~46px padding on each side

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
                        // Fallback: trigger download
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `etiqueta_${product.sku}.png`;
                        a.click();
                        URL.revokeObjectURL(url);
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined">label</span>
                        Etiqueta de Producto — 6×4 cm / 300 DPI
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Preview */}
                <div className="p-6 flex flex-col items-center bg-slate-50 dark:bg-slate-950/50 overflow-y-auto">
                    <p className="text-sm text-slate-500 mb-4 text-center max-w-md">
                        Vista previa — la imagen copiada tendrá alta resolución (709×472 px, 300 DPI).
                    </p>
                    <div className="shadow-2xl ring-1 ring-slate-300 dark:ring-slate-700 rounded-sm">
                        <canvas
                            ref={previewCanvasRef}
                            style={{ display: 'block', maxWidth: '100%' }}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Cerrar
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
                        <span className={`material-symbols-outlined text-[20px] ${isGenerating ? 'animate-spin' : ''}`}>
                            {isGenerating ? 'progress_activity' : copied ? 'check' : 'content_copy'}
                        </span>
                        {isGenerating ? 'Generando...' : copied ? '¡Copiado!' : 'Copiar Imagen'}
                    </button>
                </div>
            </div>
        </div>
    );
};
