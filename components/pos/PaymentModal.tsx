import React, { useState } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useShallow } from 'zustand/react/shallow';
import {
  Calendar,
} from 'lucide-react';

// Ecuador is UTC-5; get today's local date
const todayEcuador = () => {
    const now = new Date();
    const localMs = now.getTime() - 5 * 60 * 60 * 1000;
    return new Date(localMs).toISOString().split('T')[0];
};

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcess: (paymentAccountId: number, saleDate?: string, shippingAddress?: string, shippingCost?: number, printReceipt?: boolean) => Promise<void>;
    paymentAccounts: { id: number, name: string }[];
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onProcess, paymentAccounts }) => {
    const { customer, getSubtotal, getTotal } = useCartStore(
        useShallow((state) => ({
            customer: state.customer,
            getSubtotal: state.getSubtotal,
            getTotal: state.getTotal,
        }))
    );
    const [selectedAccount, setSelectedAccount] = useState<number>(paymentAccounts[0]?.id || 0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [saleDate, setSaleDate] = useState<string>(todayEcuador());
    
    const [isDelivery, setIsDelivery] = useState(false);
    const [shippingAddress, setShippingAddress] = useState('');
    const [shippingCost, setShippingCost] = useState(0);
    const [printReceipt, setPrintReceipt] = useState(true);

    if (!isOpen) return null;

    const subtotal = getSubtotal();
    const total = getTotal() + (isDelivery ? shippingCost : 0);

    const handleConfirm = async () => {
        setIsProcessing(true);
        try {
            await onProcess(selectedAccount, saleDate, isDelivery ? shippingAddress : 'POS Walk-in', isDelivery ? shippingCost : 0, printReceipt);
            onClose(); // only close on success
        } catch (e) {
            // error handled by parent
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-surface rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90dvh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 bg-slate-50 dark:bg-slate-800 border-b border-subtle text-center">
                    <h2 className="text-2xl font-bold text-fg tracking-tight">Cobrar Venta</h2>
                    <p className="text-fg-muted text-sm mt-1">{customer.name}</p>
                </div>

                {/* Body — scrollable */}
                <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">

                    {/* Amount + Date picker (always visible at top) */}
                    <div className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all ${ saleDate !== todayEcuador() ? 'bg-warning-soft border-warning/20' : 'bg-primary-soft border-primary/20' }`}>
                        <span className={`font-bold text-sm mb-1 ${saleDate !== todayEcuador() ? 'text-warning' : 'text-primary'}`}>
                            Monto a Pagar
                        </span>
                        <span className={`text-5xl font-bold tracking-tighter ${saleDate !== todayEcuador() ? 'text-warning' : 'text-primary'}`}>
                            ${total.toFixed(2)}
                        </span>
                        <div className={`mt-1 text-xs font-medium ${saleDate !== todayEcuador() ? 'text-warning' : 'text-primary'}`}>
                            Subtotal: ${subtotal.toFixed(2)}
                        </div>

                        {/* Fecha inline — siempre visible */}
                        <div className="mt-4 w-full border-t border-white/60 pt-4">
                            <span className="text-[11px] font-bold text-fg-muted uppercase tracking-wider mb-1.5 block text-center">
                                Fecha del Registro
                            </span>
                            <div className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${ saleDate !== todayEcuador() ? 'border-warning bg-white dark:bg-surface dark:bg-surface' : 'border-slate-200 bg-white' }`}>
                                <Calendar size={18} className="text-fg-subtle" aria-hidden="true" />
                                <input
                                    type="date"
                                    value={saleDate}
                                    max={todayEcuador()}
                                    onChange={(e) => setSaleDate(e.target.value)}
                                    className="bg-transparent text-sm font-bold text-fg outline-none"
                                />
                                {saleDate !== todayEcuador() && (
                                    <span className="text-2xs font-bold text-warning-soft-fg bg-warning-soft px-2 py-0.5 rounded-full whitespace-nowrap">
                                        Día anterior
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Payment Form */}
                    <div className="space-y-4">
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-subtle">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={isDelivery} 
                                    onChange={(e) => setIsDelivery(e.target.checked)} 
                                    className="w-4 h-4 text-primary rounded border-strong"
                                />
                                <span className="font-bold text-fg">¿Es entrega a domicilio?</span>
                            </label>
                            
                            {isDelivery && (
                                <div className="mt-4 space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-fg-muted uppercase mb-1">Dirección / Detalles</label>
                                        <input type="text" value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} className="w-full border border-strong rounded p-2 text-sm outline-none focus:border-primary" placeholder="Ej: Calle Principal 123" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-fg-muted uppercase mb-1">Costo de Envío ($)</label>
                                        <input type="number" step="0.01" min="0" value={shippingCost} onChange={e => setShippingCost(parseFloat(e.target.value) || 0)} className="w-full border border-strong rounded p-2 text-sm outline-none focus:border-primary" placeholder="0.00" />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-subtle">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={printReceipt} 
                                    onChange={(e) => setPrintReceipt(e.target.checked)} 
                                    className="w-4 h-4 text-primary rounded border-strong"
                                />
                                <span className="font-bold text-fg">Imprimir Recibo (Impresora Térmica)</span>
                            </label>
                        </div>

                        <label className="block">
                            <span className="text-xs font-bold text-fg-muted uppercase tracking-wider mb-2 block">
                                Método / Cuenta Múltiple
                            </span>
                            <div className="grid grid-cols-1 gap-2">
                                {paymentAccounts.map(acc => (
                                    <div
                                        key={acc.id}
                                        onClick={() => setSelectedAccount(acc.id)}
                                        className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedAccount === acc.id ? 'border-primary bg-primary-soft/50 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white dark:bg-surface' }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedAccount === acc.id ? 'border-primary' : 'border-slate-300' }`}>
                                            {selectedAccount === acc.id && <div className="w-2.5 h-2.5 bg-primary rounded-full"></div>}
                                        </div>
                                        <span className={`font-bold ${selectedAccount === acc.id ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {acc.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </label>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-subtle flex gap-3 bg-slate-50 dark:bg-slate-800">
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="flex-1 py-3 px-4 bg-white dark:bg-surface border border-strong text-fg font-bold rounded-xl hover:bg-surface-hover transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isProcessing || !selectedAccount}
                        className="flex-[2] py-3 px-4 bg-primary text-white font-bold text-lg rounded-xl hover:bg-primary shadow-md shadow-primary/30 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center"
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
