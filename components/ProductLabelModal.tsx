import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import html2canvas from 'html2canvas';

interface ProductLabelModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: any;
}

export const ProductLabelModal: React.FC<ProductLabelModalProps> = ({ isOpen, onClose, product }) => {
    const labelRef = useRef<HTMLDivElement>(null);
    const barcodeRef = useRef<SVGSVGElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen && product && barcodeRef.current) {
            try {
                JsBarcode(barcodeRef.current, product.sku, {
                    format: "CODE128",
                    displayValue: false,
                    width: 3,
                    height: 120,
                    margin: 0,
                    lineColor: "#000000",
                    background: "#ffffff"
                });
                setCopied(false);
            } catch (error) {
                console.error("Error generating barcode:", error);
            }
        }
    }, [isOpen, product]);

    if (!isOpen || !product) return null;

    const handleCopyImage = async () => {
        if (!labelRef.current) return;
        setIsGenerating(true);
        try {
            const canvas = await html2canvas(labelRef.current, {
                scale: 1, 
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
            });

            canvas.toBlob(async (blob) => {
                if (blob) {
                    try {
                        const item = new ClipboardItem({ 'image/png': blob });
                        await navigator.clipboard.write([item]);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 3000);
                    } catch (err) {
                        console.error('Error al copiar al portapapeles: ', err);
                        alert('No se pudo copiar al portapapeles directamente. Haz clic derecho en la imagen y selecciona "Copiar imagen".');
                    }
                }
            }, 'image/png', 1.0);
        } catch (error) {
            console.error('Error generating image:', error);
            alert('Error al generar la imagen.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined">label</span>
                        Etiqueta de Producto (6x4 cm)
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                
                <div className="p-6 flex flex-col items-center bg-slate-50 dark:bg-slate-950/50 overflow-y-auto">
                    <p className="text-sm text-slate-500 mb-6 text-center max-w-md">
                        Esta etiqueta está configurada con proporciones de 6 cm (ancho) x 4 cm (alto) a 300 DPI. Presiona "Copiar Imagen" para guardarla en el portapapeles.
                    </p>

                    <div className="relative shadow-2xl ring-1 ring-slate-200 dark:ring-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-800">
                        {/* Escala real 709x472 pero mostrada al 80% o más pequeña si la pantalla es chica */}
                        <div 
                            ref={labelRef} 
                            style={{ 
                                width: '709px', 
                                height: '472px',
                                boxSizing: 'border-box'
                            }}
                            className="bg-white flex flex-col items-center justify-between py-10 px-10 text-black mx-auto transform origin-top-left sm:scale-75 md:scale-100 mb-[-118px] sm:mb-[-118px] md:mb-0"
                        >
                            <div className="w-full text-center shrink-0">
                                <h1 className="font-bold text-black" style={{ fontSize: '38px', lineHeight: '1.2', maxHeight: '140px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', margin: 0, padding: 0 }}>
                                    {product.name}
                                </h1>
                            </div>

                            <div className="flex flex-col items-center justify-center grow w-full my-4">
                                <svg ref={barcodeRef} style={{ maxWidth: '100%', height: 'auto' }}></svg>
                            </div>

                            <div className="w-full text-center shrink-0">
                                <span className="font-bold font-mono tracking-wider" style={{ fontSize: '46px', color: '#000' }}>
                                    {product.sku}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

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
