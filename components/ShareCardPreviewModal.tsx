import React, { useEffect, useState } from 'react';
import { Copy, ImageDown, Loader2, X } from 'lucide-react';
import { deliverProductCard, renderProductCard, ShareCardOutcome, ShareCardProduct } from '../utils/productShareCard';

interface ShareCardPreviewModalProps {
    isOpen: boolean;
    product: ShareCardProduct | null;
    onClose: () => void;
    onDelivered: (outcome: ShareCardOutcome, product: ShareCardProduct) => void;
}

/**
 * Muestra la ficha del repuesto ya dibujada antes de copiarla/compartirla, en
 * vez de entregarla a ciegas apenas se hace clic en el botón. El canvas se
 * genera una sola vez al abrir y se reutiliza para la entrega -- confirmar no
 * vuelve a dibujar la ficha.
 */
export const ShareCardPreviewModal: React.FC<ShareCardPreviewModalProps> = ({
    isOpen,
    product,
    onClose,
    onDelivered,
}) => {
    const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [rendering, setRendering] = useState(false);
    const [delivering, setDelivering] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !product) {
            setCanvas(null);
            setPreviewUrl(null);
            setError(null);
            return;
        }
        let cancelled = false;
        setRendering(true);
        setError(null);
        renderProductCard(product)
            .then((c) => {
                if (cancelled) return;
                setCanvas(c);
                setPreviewUrl(c.toDataURL('image/png'));
            })
            .catch((err: any) => {
                if (cancelled) return;
                setError(err?.message || 'No se pudo generar la ficha');
            })
            .finally(() => {
                if (!cancelled) setRendering(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen, product]);

    if (!isOpen || !product) return null;

    const handleConfirm = async () => {
        if (!canvas) return;
        setDelivering(true);
        try {
            const outcome = await deliverProductCard(canvas, product);
            onDelivered(outcome, product);
            if (outcome !== 'cancelled') onClose();
        } catch (err: any) {
            setError(err?.message || 'No se pudo copiar la ficha');
        } finally {
            setDelivering(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-surface rounded-t-2xl sm:rounded-xl shadow-xl overflow-hidden flex flex-col w-full max-w-[480px] max-h-[92dvh]">
                <div className="px-6 py-4 border-b border-subtle flex justify-between items-center bg-surface-2">
                    <h2 className="text-lg font-bold tracking-tight text-fg flex items-center gap-2">
                        <ImageDown size={20} className="text-primary" aria-hidden="true" />
                        Vista previa de la ficha
                    </h2>
                    <button onClick={onClose} className="text-fg-subtle hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>

                <div className="p-4 sm:p-6 bg-surface-3 overflow-y-auto flex items-center justify-center min-h-[280px]">
                    {rendering && (
                        <div className="flex flex-col items-center gap-2 text-fg-subtle py-12">
                            <Loader2 size={28} className="animate-spin" aria-hidden="true" />
                            <span className="text-sm font-medium">Generando ficha...</span>
                        </div>
                    )}
                    {!rendering && error && (
                        <div className="text-sm font-medium text-danger py-12 text-center">{error}</div>
                    )}
                    {!rendering && !error && previewUrl && (
                        <img
                            src={previewUrl}
                            alt={product.name}
                            className="w-full max-w-[360px] rounded-lg border border-subtle shadow-sm mx-auto"
                        />
                    )}
                </div>

                <div className="px-6 py-4 border-t border-subtle flex justify-end gap-3 bg-surface">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={delivering}
                        className="px-4 py-2 text-sm font-medium text-fg-muted bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={delivering || rendering || !canvas}
                        className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-primary rounded-lg transition-colors shadow-sm disabled:opacity-50"
                    >
                        {delivering ? (
                            <>
                                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                                Copiando...
                            </>
                        ) : (
                            <>
                                <Copy size={18} aria-hidden="true" />
                                Copiar ficha
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
