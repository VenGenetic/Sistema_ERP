import React, { useState } from 'react';
import { useCartStore } from '../../store/cartStore';

// Ecuador is UTC-5; get today's local date
const todayEcuador = () => {
    const now = new Date();
    const localMs = now.getTime() - 5 * 60 * 60 * 1000;
    return new Date(localMs).toISOString().split('T')[0];
};

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (paymentAccountId: number, shippingExpenseAccountId?: number | null, saleDate?: string) => Promise<void>;
    paymentAccounts: { id: number, name: string }[];
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onProcess, paymentAccounts }) => {
    const { customer, getSubtotal, getTotal, shippingCost } = useCartStore();
    const [selectedAccount, setSelectedAccount] = useState<number>(paymentAccounts[0]?.id || 0);
    const [useSeparateShippingAccount, setUseSeparateShippingAccount] = useState(false);
    const [selectedShippingAccount, setSelectedShippingAccount] = useState<number>(paymentAccounts[0]?.id || 0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [saleDate, setSaleDate] = useState<string>(todayEcuador());

    if (!isOpen) return null;

    const subtotal = getSubtotal();
    const total = getTotal();

    const handleConfirm = async () => {
        setIsProcessing(true);
        try {
            const shippingAccId = (useSeparateShippingAccount && shippingCost > 0) ? selectedShippingAccount : null;
            await onProcess(selectedAccount, shippingAccId, saleDate);
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

                {/* Body — scrollable */}
                <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">

                    {/* Amount + Date picker (always visible at top) */}
                    <div className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all ${
                        saleDate !== todayEcuador() ? 'bg-amber-50 border-amber-300' : 'bg-blue-50 border-blue-100'
                    }`}>
                        <span className={`font-bold uppercase text-sm mb-1 ${saleDate !== todayEcuador() ? 'text-amber-600' : 'text-blue-500'}`}>
                            Monto a Pagar
                        </span>
                        <span className={`text-5xl font-black tracking-tighter ${saleDate !== todayEcuador() ? 'text-amber-700' : 'text-blue-700'}`}>
                            ${total.toFixed(2)}
                        </span>
                        <div className={`mt-1 text-xs font-medium ${saleDate !== todayEcuador() ? 'text-amber-400' : 'text-blue-400'}`}>
                            Subtotal: ${subtotal.toFixed(2)}
                        </div>

                        {/* Fecha inline — siempre visible */}
                        <div className="mt-4 w-full border-t border-white/60 pt-4">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block text-center">
                                Fecha del Registro
                            </span>
                            <div className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                                saleDate !== todayEcuador() ? 'border-amber-400 bg-white' : 'border-slate-200 bg-white'
                            }`}>
                                <span className="material-symbols-outlined text-slate-400 text-[18px]">calendar_today</span>
                                <input
                                    type="date"
                                    value={saleDate}
                                    max={todayEcuador()}
                                    onChange={(e) => setSaleDate(e.target.value)}
                                    className="bg-transparent text-sm font-bold text-slate-700 outline-none"
                                />
                                {saleDate !== todayEcuador() && (
                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                        Día anterior
                                    </span>
                                )}
                            </div>
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

                        {shippingCost > 0 && (
                            <div className="mt-4 border-t border-slate-200 pt-4">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={useSeparateShippingAccount}
                                        onChange={(e) => setUseSeparateShippingAccount(e.target.checked)}
                                        className="w-5 h-5 text-blue-600 rounded bg-white border-slate-300 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-bold text-slate-700">Pagar envío (${shippingCost.toFixed(2)}) desde otra cuenta</span>
                                </label>

                                {useSeparateShippingAccount && (
                                    <div className="mt-3 grid grid-cols-1 gap-2 pl-8">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                                            Cuenta para Gastos de Envío
                                        </span>
                                        {paymentAccounts.map(acc => (
                                            <div
                                                key={`ship-${acc.id}`}
                                                onClick={() => setSelectedShippingAccount(acc.id)}
                                                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedShippingAccount === acc.id
                                                    ? 'border-amber-500 bg-amber-50/50 shadow-sm'
                                                    : 'border-slate-200 hover:border-slate-300 bg-white'
                                                    }`}
                                            >
                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedShippingAccount === acc.id ? 'border-amber-500' : 'border-slate-300'
                                                    }`}>
                                                    {selectedShippingAccount === acc.id && <div className="w-2 h-2 bg-amber-500 rounded-full"></div>}
                                                </div>
                                                <span className={`text-sm font-bold ${selectedShippingAccount === acc.id ? 'text-amber-700' : 'text-slate-700'}`}>
                                                    {acc.name}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
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
