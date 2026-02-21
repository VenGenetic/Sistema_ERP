import React, { useState } from 'react';
import { useCartStore } from '../../store/cartStore';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (paymentAccountId: number) => Promise<void>;
    paymentAccounts: { id: number, name: string }[];
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onProcess, paymentAccounts }) => {
    const { customer, getSubtotal, getTotal } = useCartStore();
    const [selectedAccount, setSelectedAccount] = useState<number>(paymentAccounts[0]?.id || 0);
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    const subtotal = getSubtotal();
    const total = getTotal();

    const handleConfirm = async () => {
        setIsProcessing(true);
        try {
            await onProcess(selectedAccount);
            onClose(); // only close on success
        } catch (e) {
            // error handled by parent
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 bg-slate-50 border-b border-slate-200 text-center">
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Cobrar Venta</h2>
                    <p className="text-slate-500 text-sm mt-1">{customer.name}</p>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Amount */}
                    <div className="flex flex-col items-center justify-center p-6 bg-blue-50 rounded-xl border border-blue-100">
                        <span className="text-blue-500 font-bold uppercase text-sm mb-1">Monto a Pagar</span>
                        <span className="text-5xl font-black text-blue-700 tracking-tighter">
                            ${total.toFixed(2)}
                        </span>
                        <div className="mt-2 text-xs text-blue-400 font-medium">
                            Subtotal: ${subtotal.toFixed(2)}
                        </div>
                    </div>

                    {/* Payment Form */}
                    <div className="space-y-4">
                        <label className="block">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                Método / Cuenta Múltiple
                            </span>
                            <div className="grid grid-cols-1 gap-2">
                                {paymentAccounts.map(acc => (
                                    <div
                                        key={acc.id}
                                        onClick={() => setSelectedAccount(acc.id)}
                                        className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedAccount === acc.id
                                            ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                                            : 'border-slate-200 hover:border-slate-300 bg-white'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedAccount === acc.id ? 'border-blue-500' : 'border-slate-300'
                                            }`}>
                                            {selectedAccount === acc.id && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>}
                                        </div>
                                        <span className={`font-bold ${selectedAccount === acc.id ? 'text-blue-700' : 'text-slate-700'}`}>
                                            {acc.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </label>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 flex gap-3 bg-slate-50">
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="flex-1 py-3 px-4 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isProcessing || !selectedAccount}
                        className="flex-[2] py-3 px-4 bg-blue-600 text-white font-black text-lg uppercase rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center"
                    >
                        {isProcessing ? (
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            'Confirmar Pago'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
