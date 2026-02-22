import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BrandSelect } from './BrandSelect';
import { WarehouseSelect } from './WarehouseSelect';

// ─── Editable fields config ───
const BULK_FIELDS = [
    { key: 'category', label: 'Categoría', type: 'text', icon: 'category' },
    { key: 'brand_id', label: 'Marca', type: 'brand', icon: 'sell' },
    { key: 'min_stock_threshold', label: 'Stock Mínimo', type: 'number', icon: 'inventory' },
    { key: 'cost_without_vat', label: 'Costo sin IVA ($)', type: 'currency', icon: 'payments' },
    { key: 'vat_percentage', label: 'IVA (%)', type: 'percent', icon: 'percent' },
    { key: 'profit_margin', label: 'Margen de Ganancia', type: 'margin', icon: 'trending_up' },
    { key: 'add_stock', label: 'Añadir Stock', type: 'stock', icon: 'add_box' }
] as const;

type BulkFieldKey = typeof BULK_FIELDS[number]['key'];

interface BulkEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    selectedProducts: any[]; // Full product objects from Products.tsx
}

// ─── Helpers ───
const r = (n: number) => Math.round(n * 10000) / 10000;
const costWithVat = (c: number, v: number) => r(c * (1 + v / 100));
const calcPrice = (c: number, v: number, m: number) => r(costWithVat(c, v) * (1 + m));

export const BulkEditModal: React.FC<BulkEditModalProps> = ({ isOpen, onClose, onSuccess, selectedProducts }) => {
    const [selectedField, setSelectedField] = useState<BulkFieldKey | ''>('');
    const [value, setValue] = useState<any>('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

    // Stock specific state
    const [stockAdjustment, setStockAdjustment] = useState({
        warehouse_id: null as number | null,
        isPurchase: false,
        account_id: null as number | null
    });
    const [accounts, setAccounts] = useState<any[]>([]);
    // New toggle to apply changes to all products
    const [applyToAll, setApplyToAll] = useState(false);


    // Reset state when opened
    useEffect(() => {
        if (isOpen) {
            setSelectedField('');
            setValue('');
            setResult(null);
            setStockAdjustment({ warehouse_id: null, isPurchase: false, account_id: null });
            fetchAccounts();
        }
    }, [isOpen]);

    const fetchAccounts = async () => {
        try {
            const { data } = await supabase.from('accounts').select('*').order('name');
            if (data) setAccounts(data);
        } catch (error) {
            console.error('Error fetching accounts', error);
        }
    };
    // Helper to fetch all products when applying to whole system
    const fetchAllProductsChunked = async () => {
        let allProducts: any[] = [];
        let from = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('products')
                .select('id, cost_without_vat, vat_percentage, profit_margin')
                .range(from, from + limit - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                allProducts = [...allProducts, ...data];
                from += limit;
                if (data.length < limit) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }
        return allProducts;
    };

    const fieldConfig = BULK_FIELDS.find(f => f.key === selectedField);
    const isFinancialField = ['cost_without_vat', 'vat_percentage', 'profit_margin'].includes(selectedField);

    const handleApply = async () => {
        if (!selectedField) return;
        setLoading(true);
        setResult(null);
        // Determine target products based on toggle
        let targetProducts: any[] = [];
        if (applyToAll) {
            try {
                targetProducts = await fetchAllProductsChunked();
            } catch (e) {
                console.error('Failed to fetch all products', e);
                setLoading(false);
                return;
            }
        } else {
            targetProducts = selectedProducts;
        }

        let success = 0;
        let failed = 0;

        try {
            if (isFinancialField) {
                // Financial fields: update per-product to recalculate PVP
                // chunk updates to avoid blocking UI for too long, but run concurrently
                const CHUNK_SIZE = 50;
                for (let i = 0; i < targetProducts.length; i += CHUNK_SIZE) {
                    const chunk = targetProducts.slice(i, i + CHUNK_SIZE);
                    await Promise.all(chunk.map(async (prod) => {
                        const cost = selectedField === 'cost_without_vat' ? Number(value) : (prod.cost_without_vat || 0);
                        const vat = selectedField === 'vat_percentage' ? Number(value) : (prod.vat_percentage || 12);
                        const margin = selectedField === 'profit_margin' ? Number(value) : (prod.profit_margin || 0.30);
                        const newPrice = calcPrice(cost, vat, margin);

                        const payload: any = {
                            [selectedField]: Number(value),
                            price: newPrice
                        };

                        const { error } = await supabase
                            .from('products')
                            .update(payload)
                            .eq('id', prod.id);

                        if (error) {
                            console.error(`Failed to update product ${prod.id}:`, error);
                            failed++;
                        } else {
                            success++;
                        }
                    }));
                }
            } else if (selectedField === 'add_stock') {
                if (!stockAdjustment.warehouse_id) throw new Error('Debe seleccionar un almacén destino.');
                if (stockAdjustment.isPurchase && !stockAdjustment.account_id) throw new Error('Seleccione cuenta de pago.');
                const qty = Number(value);
                if (!qty) throw new Error('Ingrese una cantidad válida.');

                const productsMap = targetProducts.map(prod => ({
                    product_id: prod.id,
                    quantity_change: qty,
                    unit_cost_with_vat: costWithVat(prod.cost_without_vat || 0, prod.vat_percentage || 12)
                }));

                const { data, error } = await supabase.rpc('process_quick_stock_adjustment', {
                    p_warehouse_id: stockAdjustment.warehouse_id,
                    p_payment_account_id: stockAdjustment.isPurchase ? stockAdjustment.account_id : null,
                    p_products: productsMap
                });

                if (error) {
                    console.error('Add stock error:', error);
                    failed = selectedProducts.length;
                } else if (!data.success) {
                    failed = selectedProducts.length;
                    alert(data.message);
                } else {
                    success = selectedProducts.length;
                }
            } else {
                // Non-financial: batch update with a single value
                const ids = targetProducts.map(p => p.id);
                const payload: any = {};

                if (selectedField === 'brand_id') {
                    payload.brand_id = value;
                } else if (selectedField === 'min_stock_threshold') {
                    payload.min_stock_threshold = Number(value);
                } else {
                    payload[selectedField] = value;
                }

                // Chunk the generic update to avoid URL length limits with .in()
                const CHUNK_SIZE = 500;
                for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
                    const chunk = ids.slice(i, i + CHUNK_SIZE);
                    const { error } = await supabase
                        .from('products')
                        .update(payload)
                        .in('id', chunk);

                    if (error) {
                        console.error('Bulk update error:', error);
                        failed += chunk.length;
                    } else {
                        success += chunk.length;
                    }
                }
            }

            setResult({ success, failed });

            if (failed === 0) {
                // Auto-close after short delay on full success
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 800);
            }
        } catch (err: any) {
            console.error('Unexpected bulk edit error:', err);
            alert('Error inesperado: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const inputClass = "w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm";
    // UI toggle for applying to whole system
    const applyAllToggle = (
        <div className="flex items-center gap-2 mt-2">
            <label className="flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={applyToAll}
                    onChange={e => setApplyToAll(e.target.checked)}
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500" />
                <span className="ml-2 text-sm text-slate-600 font-medium">Aplicar a todo el sistema (¡Cuidado!)</span>
            </label>
        </div>
    );

    // Preview: what will the PVP become for each product?
    const getPreviewRows = () => {
        if (!isFinancialField || !value) return [];
        return selectedProducts.slice(0, 5).map(prod => {
            const cost = selectedField === 'cost_without_vat' ? Number(value) : (prod.cost_without_vat || 0);
            const vat = selectedField === 'vat_percentage' ? Number(value) : (prod.vat_percentage || 12);
            const margin = selectedField === 'profit_margin' ? Number(value) : (prod.profit_margin || 0.30);
            const newPvp = calcPrice(cost, vat, margin);
            const oldPvp = prod.price || 0;
            return { name: prod.name, sku: prod.sku, oldPvp, newPvp };
        });
    };

    const getStockPreviewTotal = () => {
        if (selectedField !== 'add_stock' || !value) return 0;
        const qty = Number(value);
        if (!qty) return 0;
        let total = 0;
        for (const p of selectedProducts) {
            total += costWithVat(p.cost_without_vat || 0, p.vat_percentage || 12) * qty;
        }
        return total;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-slate-700 my-8">
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                            <span className="material-symbols-outlined text-[24px]">edit_note</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edición Rápida</h2>
                            <p className="text-xs text-slate-500">{selectedProducts.length} producto{selectedProducts.length !== 1 ? 's' : ''} seleccionado{selectedProducts.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-5 flex flex-col gap-5">
                    {/* Apply to all toggle, shown above the field inputs */}
                    {applyAllToggle}

                    {/* Step 1: Pick the field */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            1. ¿Qué propiedad deseas cambiar?
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {BULK_FIELDS.map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => { setSelectedField(f.key); setValue(''); }}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all border ${selectedField === f.key
                                        ? 'bg-primary/10 border-primary text-primary ring-2 ring-primary/20'
                                        : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-[18px]">{f.icon}</span>
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Step 2: Enter the new value */}
                    {selectedField && (
                        <div className="animate-in fade-in">
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                2. Nuevo valor para "{fieldConfig?.label}"
                            </label>

                            {fieldConfig?.type === 'text' && (
                                <input type="text" className={inputClass} placeholder="Ej: Frenos"
                                    value={value} onChange={e => setValue(e.target.value)} autoFocus />
                            )}

                            {fieldConfig?.type === 'number' && (
                                <input type="number" min="0" className={inputClass} placeholder="Ej: 10"
                                    value={value} onChange={e => setValue(e.target.value)} autoFocus />
                            )}

                            {fieldConfig?.type === 'currency' && (
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                                    <input type="number" step="0.01" min="0" className={`${inputClass} pl-7`} placeholder="0.00"
                                        value={value} onChange={e => setValue(e.target.value)} autoFocus />
                                </div>
                            )}

                            {fieldConfig?.type === 'percent' && (
                                <div className="relative">
                                    <input type="number" step="0.1" min="0" className={inputClass} placeholder="Ej: 12"
                                        value={value} onChange={e => setValue(e.target.value)} autoFocus />
                                    <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
                                </div>
                            )}

                            {fieldConfig?.type === 'margin' && (
                                <>
                                    <input type="number" step="0.01" className={inputClass} placeholder="Ej: 0.30"
                                        value={value} onChange={e => setValue(e.target.value)} autoFocus />
                                    <p className="text-xs text-slate-400 mt-1">Ej: 0.30 = 30% de margen sobre costo con IVA</p>
                                </>
                            )}

                            {fieldConfig?.type === 'brand' && (
                                <BrandSelect value={value || null} onChange={(val) => setValue(val)} />
                            )}

                            {fieldConfig?.type === 'stock' && (
                                <div className="space-y-4">
                                    <input type="number" className={inputClass} placeholder="Cantidad a sumar (Ej: 10 o -5)"
                                        value={value} onChange={e => setValue(e.target.value)} autoFocus />

                                    <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4">
                                        <WarehouseSelect
                                            value={stockAdjustment.warehouse_id}
                                            onChange={(val) => setStockAdjustment(prev => ({ ...prev, warehouse_id: val }))}
                                            label="Almacén de destino:"
                                        />

                                        <div className="flex items-center gap-3 pt-2">
                                            <label className="flex items-center cursor-pointer relative group">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={stockAdjustment.isPurchase}
                                                    onChange={(e) => setStockAdjustment(prev => ({ ...prev, isPurchase: e.target.checked }))}
                                                />
                                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                                                <span className="ml-2 text-sm text-slate-600 font-medium group-hover:text-slate-900 transition-colors">Es una compra financiera</span>
                                            </label>
                                        </div>

                                        {stockAdjustment.isPurchase && (
                                            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-3 animate-in fade-in slide-in-from-top-2">
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                    Cuenta de Pago (De donde sale el dinero):
                                                </label>
                                                <select
                                                    className={inputClass}
                                                    value={stockAdjustment.account_id || ''}
                                                    onChange={(e) => setStockAdjustment(prev => ({ ...prev, account_id: parseInt(e.target.value) }))}
                                                >
                                                    <option value="">Seleccionar Cuenta...</option>
                                                    {accounts.map(acc => (
                                                        <option key={acc.id} value={acc.id}>
                                                            {acc.code} - {acc.name} ({acc.currency})
                                                        </option>
                                                    ))}
                                                </select>

                                                {stockAdjustment.account_id && Number(value) > 0 && (
                                                    <div className="mt-2 text-xs font-semibold text-orange-700 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px]">info</span>
                                                        Se debitarán aprox. ${getStockPreviewTotal().toFixed(2)} de esta cuenta.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Financial field preview */}
                    {isFinancialField && value && (
                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">info</span>
                                PVP se recalculará automáticamente:
                            </p>
                            <div className="space-y-1.5">
                                {getPreviewRows().map((row, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <span className="text-slate-600 dark:text-slate-400 truncate max-w-[200px]" title={row.name}>
                                            <span className="font-mono text-slate-400 mr-1">{row.sku}</span>
                                            {row.name}
                                        </span>
                                        <span className="flex items-center gap-1 shrink-0">
                                            <span className="text-slate-400">${row.oldPvp.toFixed(2)}</span>
                                            <span className="material-symbols-outlined text-[14px] text-amber-500">arrow_forward</span>
                                            <span className="font-bold text-amber-700 dark:text-amber-300">${row.newPvp.toFixed(2)}</span>
                                        </span>
                                    </div>
                                ))}
                                {selectedProducts.length > 5 && (
                                    <p className="text-xs text-slate-400 text-center">...y {selectedProducts.length - 5} más</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Result message */}
                    {result && (
                        <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${result.failed === 0
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'
                            }`}>
                            <span className="material-symbols-outlined text-[18px]">
                                {result.failed === 0 ? 'check_circle' : 'warning'}
                            </span>
                            {result.success} actualizado{result.success !== 1 ? 's' : ''}
                            {result.failed > 0 && `, ${result.failed} fallido${result.failed !== 1 ? 's' : ''}`}
                        </div>
                    )}

                    {/* Selected products summary */}
                    <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-3">
                        <p className="text-xs font-semibold text-slate-500 mb-1.5">Productos seleccionados:</p>
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                            {selectedProducts.map(p => (
                                <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md text-xs text-slate-600 dark:text-slate-300">
                                    <span className="font-mono text-slate-400">{p.sku}</span>
                                    {p.name?.length > 25 ? p.name.substring(0, 25) + '…' : p.name}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                    <button type="button" onClick={onClose}
                        className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors font-medium text-sm">
                        Cancelar
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={loading || !selectedField || (!value && value !== 0)}
                        className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-sm shadow-amber-500/30 transition-all font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                        {loading && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
                        {loading ? 'Aplicando...' : `Aplicar a ${selectedProducts.length} producto${selectedProducts.length !== 1 ? 's' : ''}`}
                    </button>
                </div>
            </div>
        </div>
    );
};
