import React from 'react';
import { AlertCircle, ArrowRight, DollarSign, Package, ShieldCheck } from 'lucide-react';

interface ImpactPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    data: {
        customerName: string;
        subtotal: number;
        total: number;
        shippingCost: number;
        items: { name: string; quantity: number; status: string }[];
        accounting: { account: string; type: 'debit' | 'credit'; amount: number }[];
    };
    isProcessing: boolean;
}

export const ImpactPreviewModal: React.FC<ImpactPreviewModalProps> = ({ isOpen, onClose, onConfirm, data, isProcessing }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#161b22] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0d1117]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Previsualización de Impacto</h2>
                            <p className="text-sm text-slate-500">Revise los movimientos contables e inventario antes de confirmar.</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Inventory Impact */}
                    <section>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Package size={14} /> Impacto en Inventario
                        </h3>
                        <div className="bg-slate-50 dark:bg-[#0d1117] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-100/50 dark:bg-slate-800/50 text-slate-500 text-left">
                                    <tr>
                                        <th className="px-4 py-2 font-semibold">Item</th>
                                        <th className="px-4 py-2 font-semibold text-center">Cant.</th>
                                        <th className="px-4 py-2 font-semibold text-right">Efecto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {data.items.map((item, idx) => (
                                        <tr key={idx} className="text-slate-700 dark:text-slate-300">
                                            <td className="px-4 py-3">
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-[10px] text-slate-400 uppercase">{item.status}</div>
                                            </td>
                                            <td className="px-4 py-3 text-center">{item.quantity}</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={item.status === 'in_stock' ? 'text-amber-600 font-bold' : 'text-blue-500 font-bold'}>
                                                    {item.status === 'in_stock' ? `- ${item.quantity} (Stock)` : 'Reserva (Draft)'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Financial Impact */}
                    <section>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <DollarSign size={14} /> Movimientos Contables (Partida Doble)
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            {/* Debits */}
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-green-600 uppercase ml-1">Débitos (Entrada de Valor)</p>
                                {data.accounting.filter(a => a.type === 'debit').map((a, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-lg">
                                        <span className="text-sm font-medium text-green-800 dark:text-green-400">{a.account}</span>
                                        <span className="text-sm font-bold text-green-700 dark:text-green-300">${a.amount.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                            {/* Credits */}
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-blue-600 uppercase ml-1">Créditos (Origen/Obligación)</p>
                                {data.accounting.filter(a => a.type === 'credit').map((a, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg">
                                        <span className="text-sm font-medium text-blue-800 dark:text-blue-400">{a.account}</span>
                                        <span className="text-sm font-bold text-blue-700 dark:text-blue-300">${a.amount.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0d1117] flex justify-between items-center">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium"
                    >
                        Cancelar y Revisar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all transform active:scale-95 disabled:opacity-50"
                    >
                        {isProcessing ? (
                            <>
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                                <span>Procesando...</span>
                            </>
                        ) : (
                            <>
                                <span>Confirmar Ejecución</span>
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
