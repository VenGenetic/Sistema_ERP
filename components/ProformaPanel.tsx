import React, { useState } from 'react';
import { useProformaStore } from '../store/useProformaStore';
import { ProformaPreviewModal } from './ProformaPreviewModal';

export const ProformaPanel: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const items = useProformaStore(s => s.items);
    const shippingEnabled = useProformaStore(s => s.shippingEnabled);
    const shippingCost = useProformaStore(s => s.shippingCost);
    const removeItem = useProformaStore(s => s.removeItem);
    const updateQuantity = useProformaStore(s => s.updateQuantity);
    const updateUnitPrice = useProformaStore(s => s.updateUnitPrice);
    const setShippingEnabled = useProformaStore(s => s.setShippingEnabled);
    const setShippingCost = useProformaStore(s => s.setShippingCost);
    const clear = useProformaStore(s => s.clear);
    const getTotal = useProformaStore(s => s.getTotal);

    if (items.length === 0) return null;

    return (
        <>
            {/* Collapsed FAB */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed top-6 right-6 z-40 bg-teal-500 hover:bg-teal-600 text-white w-14 h-14 rounded-full shadow-2xl shadow-teal-500/40 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                    title="Ver proforma"
                >
                    <span className="material-symbols-outlined text-2xl">request_quote</span>
                    <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] flex items-center justify-center bg-white text-teal-600 text-[11px] font-black rounded-full shadow-md border-2 border-teal-500">
                        {items.length}
                    </span>
                </button>
            )}

            {/* Expanded Panel */}
            {isOpen && (
                <div className="fixed top-6 right-6 z-40 w-[380px] max-h-[70vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden animate-in slide-in-from-top-4">
                    {/* Panel Header */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-teal-50 to-teal-100/50 dark:from-teal-900/20 dark:to-teal-900/10">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-teal-600 dark:text-teal-400">request_quote</span>
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Proforma</h3>
                            <span className="text-xs font-bold bg-teal-200 dark:bg-teal-800 text-teal-800 dark:text-teal-200 px-2 py-0.5 rounded-full">
                                {items.length} ítem{items.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                    </div>

                    {/* Items */}
                    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 max-h-[40vh]">
                        {items.map((item) => (
                            <div key={item.id} className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-750">
                                <div className="flex-1 min-w-0">
                                    <span className="text-[11px] font-mono font-extrabold text-teal-700 dark:text-teal-300">{item.sku}</span>
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{item.name}</p>
                                    {editingPriceId === item.id ? (
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            autoFocus
                                            defaultValue={item.unitPrice}
                                            onBlur={(e) => {
                                                updateUnitPrice(item.id, parseFloat(e.target.value) || 0);
                                                setEditingPriceId(null);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    updateUnitPrice(item.id, parseFloat((e.target as HTMLInputElement).value) || 0);
                                                    setEditingPriceId(null);
                                                }
                                                if (e.key === 'Escape') setEditingPriceId(null);
                                            }}
                                            className="mt-1 w-20 px-1.5 py-0.5 text-xs font-bold border-2 border-teal-400 rounded outline-none bg-teal-50 dark:bg-teal-900/30 dark:text-white"
                                        />
                                    ) : (
                                        <button
                                            onClick={() => setEditingPriceId(item.id)}
                                            className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400"
                                            title="Click para editar precio"
                                        >
                                            ${item.unitPrice.toFixed(2)} c/u
                                            <span className="material-symbols-outlined text-[12px] opacity-60">edit</span>
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold hover:bg-slate-300">−</button>
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                                        className="w-10 h-6 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-800 dark:text-white p-0 focus:ring-0"
                                    />
                                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold hover:bg-slate-300">+</button>
                                </div>
                                <button onClick={() => removeItem(item.id)} className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors" title="Eliminar">
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Shipping */}
                    <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={shippingEnabled}
                                onChange={(e) => setShippingEnabled(e.target.checked)}
                                className="w-3.5 h-3.5 text-teal-600 rounded border-slate-300"
                            />
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Incluir costo de envío</span>
                        </label>
                        {shippingEnabled && (
                            <div className="relative mt-2">
                                <span className="absolute left-2 top-1.5 text-slate-400 text-xs">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={shippingCost}
                                    onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className="w-full pl-5 pr-2 py-1 text-xs border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded outline-none focus:border-teal-500"
                                />
                            </div>
                        )}
                    </div>

                    {/* Panel Footer */}
                    <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Total</span>
                            <span className="text-lg font-black text-teal-600 dark:text-teal-400">${getTotal().toFixed(2)}</span>
                        </div>
                        <div className="flex gap-2">
                            {!showClearConfirm ? (
                                <button
                                    onClick={() => setShowClearConfirm(true)}
                                    className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors flex items-center gap-1"
                                >
                                    <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                                    Vaciar
                                </button>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-rose-500 font-bold">¿Seguro?</span>
                                    <button onClick={() => { clear(); setShowClearConfirm(false); setIsOpen(false); }} className="text-[11px] font-bold text-white bg-rose-500 px-2 py-1 rounded">Sí</button>
                                    <button onClick={() => setShowClearConfirm(false)} className="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">No</button>
                                </div>
                            )}
                            <button
                                onClick={() => setIsPreviewOpen(true)}
                                className="flex-1 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl font-bold text-sm shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">image</span>
                                Generar Imagen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ProformaPreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} />
        </>
    );
};
