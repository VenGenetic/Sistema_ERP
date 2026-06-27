import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';

interface ProductDemand {
    id: number;
    phone_number: string;
    customer_name: string | null;
    status: string;
    created_at: string;
    product?: {
        name: string;
        sku: string;
        image_url?: string | null;
        importer_stock?: number;
        inventory_levels?: { current_stock: number }[];
    } | null;
}

interface ShareDemandModalProps {
    isOpen: boolean;
    onClose: () => void;
    demand: ProductDemand | null;
}

export const ShareDemandModal: React.FC<ShareDemandModalProps> = ({
    isOpen,
    onClose,
    demand
}) => {
    const printRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(false);

    if (!isOpen || !demand) return null;

    const getStockValue = (prod: any) => {
        if (!prod) return 0;
        const local = prod.inventory_levels ? prod.inventory_levels.reduce((acc: number, lvl: any) => acc + (lvl.current_stock || 0), 0) : 0;
        return local + (prod.importer_stock || 0);
    };

    const getStatusText = (status: string) => {
        if (status === 'pending_stock') return 'Esperando Stock';
        if (status === 'stock_available') return 'Stock Disponible';
        if (status === 'notified') return 'Notificado';
        if (status === 'cancelled') return 'Cancelado';
        return status;
    };

    const handleCopyImage = async () => {
        if (!printRef.current) return;
        setLoading(true);
        try {
            const canvas = await html2canvas(printRef.current, {
                useCORS: true,
                scale: 2, // Higher resolution
                backgroundColor: '#ffffff'
            });

            canvas.toBlob(async (blob) => {
                if (!blob) throw new Error('No se pudo generar la imagen');
                
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    alert('Imagen copiada al portapapeles con éxito. Puedes pegarla donde quieras.');
                    onClose();
                } catch (clipboardError) {
                    console.error('Clipboard error:', clipboardError);
                    alert('La API del portapapeles bloqueó la copia o no es compatible. Por favor intenta usando Google Chrome o Edge.');
                }
            }, 'image/png', 1.0);
        } catch (error) {
            console.error('Error copiando imagen:', error);
            alert('Error al generar la imagen. Intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    const totalStock = getStockValue(demand.product);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0c1117] rounded-xl shadow-2xl overflow-hidden flex flex-col w-[450px]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-[#161b22]">
                    <h2 className="text-lg font-bold tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-[20px] text-blue-500">share</span>
                        Compartir Solicitud
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Contenido (El div que será capturado) */}
                <div className="p-6 bg-slate-100 flex justify-center items-center">
                    <div 
                        ref={printRef}
                        className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative"
                        style={{ width: '400px', height: '400px', padding: '0', boxSizing: 'border-box' }}
                    >
                        {/* Decorative Top Border */}
                        <div className="h-2 w-full bg-blue-500"></div>
                        
                        <div className="flex-1 flex flex-col p-6">
                            
                            {/* Product Info Section */}
                            <div className="flex gap-4 items-center mb-6">
                                {demand.product?.image_url ? (
                                    <div className="w-24 h-24 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 flex-shrink-0 flex items-center justify-center">
                                        <img 
                                            src={demand.product.image_url} 
                                            alt={demand.product.sku} 
                                            className="w-full h-full object-contain"
                                            crossOrigin="anonymous" 
                                        />
                                    </div>
                                ) : (
                                    <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 border border-slate-200 text-slate-400">
                                        <span className="material-symbols-outlined text-4xl">inventory_2</span>
                                    </div>
                                )}
                                
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-xs font-bold text-blue-500 tracking-wider uppercase mb-1">{demand.product?.sku}</span>
                                    <h3 className="text-base font-semibold text-slate-800 leading-tight line-clamp-3">{demand.product?.name || 'Producto Desconocido'}</h3>
                                </div>
                            </div>

                            <hr className="border-slate-100 my-1" />

                            {/* Client Info Section */}
                            <div className="py-4 flex-1 flex flex-col justify-center">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-slate-400 text-sm">person</span>
                                    {demand.customer_name && demand.customer_name.trim() !== '' ? (
                                        <span className="text-slate-700 font-medium">{demand.customer_name}</span>
                                    ) : (
                                        <span className="text-slate-300 italic">No registrado</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-slate-400 text-sm">call</span>
                                    <span className="text-slate-700 font-bold font-mono">{demand.phone_number}</span>
                                </div>
                            </div>

                            <hr className="border-slate-100 my-1" />

                            {/* Footer Info Section */}
                            <div className="pt-4 grid grid-cols-2 gap-4">
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Estado</span>
                                    <span className="text-sm font-semibold text-slate-700">{getStatusText(demand.status)}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Stock Actual</span>
                                    <span className={`text-sm font-bold ${totalStock > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                        {totalStock > 0 ? `${totalStock} unidades` : 'Agotado'}
                                    </span>
                                </div>
                                <div className="flex flex-col col-span-2 mt-1">
                                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Fecha de Solicitud</span>
                                    <span className="text-sm text-slate-600">{new Date(demand.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                </div>
                            </div>
                            
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-[#0c1117]">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleCopyImage}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                                Generando...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[18px]">content_copy</span>
                                Copiar como Imagen
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
