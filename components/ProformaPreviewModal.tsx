import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { useProformaStore } from '../store/useProformaStore';
import { ProformaStockInfo, STOCK_STATUS_LABELS } from '../utils/proformaStock';
import {
  Copy,
  Download,
  FileText,
  Loader2,
  X,
} from 'lucide-react';

interface ProformaPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    stockInfo: Record<number, ProformaStockInfo>;
}

const BUSINESS_NAME = 'LV Parts';
const BUSINESS_URL = 'https://www.lvparts.ec/';

const STOCK_STATUS_STYLE: Record<string, string> = {
    in_stock: 'bg-success-soft text-success',
    backorder: 'bg-warning-soft text-warning',
    out_of_stock: 'bg-danger-soft text-danger',
};

export const ProformaPreviewModal: React.FC<ProformaPreviewModalProps> = ({ isOpen, onClose, stockInfo }) => {
    const printRef = useRef<HTMLDivElement>(null);
    const [copying, setCopying] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const items = useProformaStore(s => s.items);
    const shippingEnabled = useProformaStore(s => s.shippingEnabled);
    const shippingCost = useProformaStore(s => s.shippingCost);
    const getItemsTotal = useProformaStore(s => s.getItemsTotal);
    const getTotal = useProformaStore(s => s.getTotal);

    if (!isOpen) return null;

    const today = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    const fileDate = new Date().toISOString().slice(0, 10);
    const loading = copying || downloading;

    // Captures printRef at high resolution. printRef and its direct parent must
    // stay free of overflow/max-height constraints so the capture isn't clipped
    // to a fixed box — any on-screen scrolling for long proformas happens on the
    // outer modal shell instead (see the scrollable wrapper below).
    const captureCanvas = async () => {
        if (!printRef.current) return null;
        return html2canvas(printRef.current, {
            useCORS: true,
            scale: 4, // Super high resolution
            backgroundColor: '#ffffff',
        });
    };

    const handleCopyImage = async () => {
        setCopying(true);
        try {
            const canvas = await captureCanvas();
            if (!canvas) return;
            canvas.toBlob(async (blob) => {
                if (!blob) throw new Error('No se pudo generar la imagen');
                try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    alert('Imagen copiada al portapapeles con éxito. Puedes pegarla donde quieras.');
                } catch (clipboardError) {
                    console.error('Clipboard error:', clipboardError);
                    alert('La API del portapapeles bloqueó la copia o no es compatible. Por favor intenta usando Google Chrome o Edge, o usa "Descargar Imagen".');
                }
            }, 'image/png', 1.0);
        } catch (error) {
            console.error('Error copiando imagen:', error);
            alert('Error al generar la imagen. Intenta nuevamente.');
        } finally {
            setCopying(false);
        }
    };

    const handleDownloadImage = async () => {
        setDownloading(true);
        try {
            const canvas = await captureCanvas();
            if (!canvas) return;
            canvas.toBlob((blob) => {
                if (!blob) throw new Error('No se pudo generar la imagen');
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `proforma-${fileDate}.png`;
                a.click();
                URL.revokeObjectURL(url);
            }, 'image/png', 1.0);
        } catch (error) {
            console.error('Error descargando imagen:', error);
            alert('Error al generar la imagen. Intenta nuevamente.');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-surface rounded-xl shadow-xl w-full max-w-[750px] max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="sticky top-0 z-10 px-6 py-4 border-b border-subtle flex justify-between items-center bg-surface-2">
                    <h2 className="text-lg font-bold tracking-tight text-fg flex items-center gap-2">
                        <FileText size={20} className="text-success" aria-hidden="true" />
                        Vista Previa de Proforma
                    </h2>
                    <button onClick={onClose} className="text-fg-subtle hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>

                {/*
                    Documento capturable — ancho fijo, alto natural.

                    `on-paper` (definida en index.html) fuerza la paleta clara en
                    todo este subárbol. Sin ella, con el tema oscuro activo los
                    tokens `text-fg` / `text-fg-muted` resolvían a casi blanco
                    (232 235 240) sobre el `bg-white` fijo del documento, y las
                    descripciones de los repuestos salían ilegibles en la imagen
                    que se envía al cliente. El modal que envuelve al documento sí
                    sigue el tema del usuario: sólo la hoja va siempre en claro.
                */}
                <div className="p-6 bg-surface-3 flex justify-center">
                    <div ref={printRef} className="on-paper bg-white" style={{ width: '650px' }}>
                        <div className="border border-subtle rounded-xl overflow-hidden">
                            <div className="h-2 w-full bg-success"></div>

                            <div className="p-8">
                                {/* Business header */}
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-2xl font-bold text-fg">{BUSINESS_NAME}</h3>
                                        <span className="text-sm text-success font-semibold">{BUSINESS_URL}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="inline-block text-[11px] font-bold tracking-widest uppercase text-white bg-slate-800 px-3 py-1 rounded-full">
                                            Proforma
                                        </span>
                                        <p className="text-xs text-fg-muted mt-2">{today}</p>
                                    </div>
                                </div>

                                {/* Items table */}
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="border-b-2 border-slate-800">
                                            <th className="text-left py-2 font-bold text-fg text-xs uppercase tracking-wide">SKU</th>
                                            <th className="text-left py-2 font-bold text-fg text-xs uppercase tracking-wide">Descripción</th>
                                            <th className="text-center py-2 font-bold text-fg text-xs uppercase tracking-wide">Cant</th>
                                            <th className="text-right py-2 font-bold text-fg text-xs uppercase tracking-wide">P. Unit</th>
                                            <th className="text-right py-2 font-bold text-fg text-xs uppercase tracking-wide">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item) => {
                                            const status = stockInfo[item.productId]?.status;
                                            return (
                                                <tr key={item.id} className="border-b border-slate-100">
                                                    <td className="py-2.5 font-mono text-[11px] font-bold text-fg-muted">{item.sku}</td>
                                                    <td className="py-2.5 text-fg font-medium">
                                                        {item.name}
                                                        {status && (
                                                            <span className={`ml-2 inline-block text-[12px] font-bold px-1.5 py-0.5 rounded-full align-middle ${STOCK_STATUS_STYLE[status]}`}>
                                                                {STOCK_STATUS_LABELS[status]}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 text-center text-fg">{item.quantity}</td>
                                                    <td className="py-2.5 text-right text-fg">${item.unitPrice.toFixed(2)}</td>
                                                    <td className="py-2.5 text-right font-bold text-fg">${(item.quantity * item.unitPrice).toFixed(2)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {/* Totals */}
                                <div className="mt-4 flex justify-end">
                                    <div className="w-64">
                                        <div className="flex justify-between py-1 text-sm text-fg-muted">
                                            <span>Subtotal</span>
                                            <span className="font-semibold">${getItemsTotal().toFixed(2)}</span>
                                        </div>
                                        {shippingEnabled && (
                                            <div className="flex justify-between py-1 text-sm text-fg-muted">
                                                <span>Envío</span>
                                                <span className="font-semibold">${shippingCost.toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between py-2 mt-1 border-t-2 border-slate-800 text-base">
                                            <span className="font-bold text-fg">Total</span>
                                            <span className="font-bold text-success">${getTotal().toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                                    <span className="text-xs font-bold text-success">{BUSINESS_URL}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="sticky bottom-0 px-6 py-4 border-t border-subtle flex justify-end gap-3 bg-surface">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-fg-muted bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        Cerrar
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadImage}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-fg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {downloading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                                Generando...
                            </>
                        ) : (
                            <>
                                <Download size={18} aria-hidden="true" />
                                Descargar Imagen
                            </>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={handleCopyImage}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-success hover:bg-success rounded-lg transition-colors shadow-sm disabled:opacity-50"
                    >
                        {copying ? (
                            <>
                                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                                Generando...
                            </>
                        ) : (
                            <>
                                <Copy size={18} aria-hidden="true" />
                                Copiar como Imagen
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
