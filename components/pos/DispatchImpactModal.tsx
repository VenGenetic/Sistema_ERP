import React from 'react';
import { Package, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface DispatchPreviewData {
    customerName: string;
    items: {
        productName: string;
        quantity: number;
        warehouseName: string;
    }[];
}

interface DispatchImpactModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isProcessing: boolean;
    data: DispatchPreviewData | null;
}

const DispatchImpactModal: React.FC<DispatchImpactModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    isProcessing,
    data
}) => {
    if (!isOpen || !data) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                        <Package className="text-blue-600" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Previsualización de Despacho</h2>
                        <p className="text-xs text-slate-500 font-medium">Confirme la salida de mercancía física de bodega.</p>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Customer Info */}
                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">
                        <span className="text-sm font-bold text-blue-800">Cliente:</span>
                        <span className="text-sm font-black text-blue-900">{data.customerName}</span>
                    </div>

                    {/* Inventory Impact */}
                    <div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <AlertCircle size={14} className="text-amber-500" />
                            Impacto en Inventario (Salida)
                        </h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                            {data.items.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2.5 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center text-[10px] font-bold text-slate-500">
                                            {item.quantity}u
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-700">{item.productName}</p>
                                            <p className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">Bodega: {item.warehouseName}</p>
                                        </div>
                                    </div>
                                    <div className="text-red-500 font-bold text-xs">
                                        -{item.quantity}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Warning Note */}
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
                        <Info className="text-amber-500 shrink-0" size={18} />
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                            Al confirmar, el sistema generará los <strong>Inventory Logs</strong> correspondientes y actualizará el estado de la orden a <strong>"Partially Fulfilled"</strong> o <strong>"Completed"</strong>. Asegúrese de que la mercancía esté lista para salir.
                        </p>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-white transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className="flex-[2] py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-black uppercase rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (
                            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                        ) : (
                            <>
                                <CheckCircle size={20} />
                                Confirmar Salida
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DispatchImpactModal;
