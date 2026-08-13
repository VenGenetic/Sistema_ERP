import React, { useState, useEffect } from 'react';
import { useBackDismiss } from '../hooks/useBackDismiss';
import { supabase } from '../supabaseClient';
import { BrandSelect } from './BrandSelect';
import { WarehouseSelect } from './WarehouseSelect';
import {
  ArrowRight,
  Banknote,
  Boxes,
  CircleCheck,
  FilePen,
  Info,
  LayoutGrid,
  Loader2,
  PackageX,
  Percent,
  SquarePlus,
  Tag,
  TicketX,
  TrendingUp,
  TriangleAlert,
  X,
} from 'lucide-react';

// ─── Editable fields config ───
// El icono es la referencia al componente, no una cadena.
const BULK_FIELDS = [
    { key: 'category', label: 'Categoría', type: 'text', icon: LayoutGrid },
    { key: 'brand_id', label: 'Marca', type: 'brand', icon: Tag },
    { key: 'add_tag', label: 'Añadir Etiqueta', type: 'tag', icon: Tag },
    { key: 'remove_tag', label: 'Quitar Etiqueta', type: 'tag', icon: TicketX },
    { key: 'min_stock_threshold', label: 'Stock Mínimo', type: 'number', icon: Boxes },
    { key: 'cost_without_vat', label: 'Costo sin IVA ($)', type: 'currency', icon: Banknote },
    { key: 'vat_percentage', label: 'IVA (%)', type: 'percent', icon: Percent },
    { key: 'profit_margin', label: 'Margen de Ganancia', type: 'margin', icon: TrendingUp },
    { key: 'add_stock', label: 'Añadir Stock', type: 'stock', icon: SquarePlus },
    { key: 'is_discontinued', label: 'Descontinuar Producto', type: 'discontinued', icon: TriangleAlert },
    { key: 'importer_unavailable_override', label: 'Agotado en Importadora', type: 'importer_unavailable', icon: PackageX }
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
    const [previewStock, setPreviewStock] = useState<Record<number, number>>({});
    // New toggle to apply changes to all products
    const [applyToAll, setApplyToAll] = useState(false);
    
    // Tags
    const [availableTags, setAvailableTags] = useState<any[]>([]);


    // Reset state when opened
    useEffect(() => {
        if (isOpen) {
            setSelectedField('');
            setValue('');
            setResult(null);
            setStockAdjustment({ warehouse_id: null, isPurchase: false, account_id: null });
            fetchAccounts();
            supabase.from('tags').select('*').order('order_index').then(({data}) => {
                if (data) setAvailableTags(data);
            });
        }
    }, [isOpen]);

    // Fetch stock for preview when configuring add_stock
    useEffect(() => {
        const fetchStockPreview = async () => {
            if (selectedField === 'add_stock' && stockAdjustment.warehouse_id && selectedProducts.length > 0) {
                const top5Ids = selectedProducts.slice(0, 5).map(p => p.id);
                const { data } = await supabase
                    .from('inventory_levels')
                    .select('product_id, current_stock')
                    .eq('warehouse_id', stockAdjustment.warehouse_id)
                    .in('product_id', top5Ids);

                const stockMap: Record<number, number> = {};
                if (data) {
                    data.forEach(d => {
                        stockMap[d.product_id] = d.current_stock;
                    });
                }
                setPreviewStock(stockMap);
            } else {
                setPreviewStock({});
            }
        };
        fetchStockPreview();
    }, [selectedField, stockAdjustment.warehouse_id, selectedProducts]);

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
            } else if (selectedField === 'add_tag' || selectedField === 'remove_tag') {
                if (!value) throw new Error('Debe seleccionar una etiqueta.');
                const ids = targetProducts.map(p => p.id);
                
                if (selectedField === 'add_tag') {
                    const tagInserts = ids.map(id => ({ product_id: id, tag_id: value }));
                    const CHUNK_SIZE = 500;
                    for (let i = 0; i < tagInserts.length; i += CHUNK_SIZE) {
                        const chunk = tagInserts.slice(i, i + CHUNK_SIZE);
                        const { error } = await supabase.from('product_tags').upsert(chunk, { onConflict: 'product_id,tag_id' });
                        if (error) { failed += chunk.length; console.error(error); }
                        else success += chunk.length;
                    }
                } else if (selectedField === 'remove_tag') {
                    const CHUNK_SIZE = 500;
                    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
                        const chunk = ids.slice(i, i + CHUNK_SIZE);
                        const { error } = await supabase.from('product_tags').delete().eq('tag_id', value).in('product_id', chunk);
                        if (error) { failed += chunk.length; console.error(error); }
                        else success += chunk.length;
                    }
                }
            } else {
                // Non-financial: batch update with a single value
                const ids = targetProducts.map(p => p.id);
                const payload: any = {};

                if (selectedField === 'brand_id') {
                    payload.brand_id = value;
                } else if (selectedField === 'min_stock_threshold') {
                    payload.min_stock_threshold = Number(value);
                } else if (selectedField === 'is_discontinued') {
                    payload.is_discontinued = value !== 'falso_activo';
                    if (value === 'falso_activo' || value === 'permanente') {
                        payload.discontinued_until = null;
                    } else {
                        const months = parseInt(value);
                        const d = new Date();
                        d.setMonth(d.getMonth() + months);
                        payload.discontinued_until = d.toISOString();
                    }
                } else if (selectedField === 'importer_unavailable_override') {
                    payload.importer_unavailable_override = value !== 'falso_activo';
                    if (value === 'falso_activo' || value === 'permanente') {
                        payload.importer_unavailable_until = null;
                    } else {
                        const months = parseInt(value);
                        const d = new Date();
                        d.setMonth(d.getMonth() + months);
                        payload.importer_unavailable_until = d.toISOString();
                    }
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
                        
                        if (selectedField === 'is_discontinued' && payload.is_discontinued) {
                            await supabase
                                .from('product_demands')
                                .update({ status: 'discontinued' })
                                .in('product_id', chunk)
                                .in('status', ['pending_stock', 'stock_available']);
                                
                            await supabase
                                .from('customer_requests')
                                .update({ status: 'discontinued' })
                                .in('product_id', chunk)
                                .eq('status', 'pending');
                        }
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

    // El «atrás» del teléfono cierra este modal en vez de dejar la pantalla.
    useBackDismiss(isOpen, onClose);

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
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-warning" />
                <span className="ml-2 text-sm text-fg-muted font-medium">Aplicar a todo el sistema (¡Cuidado!)</span>
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

    // Preview for stock adjustments
    const getStockPreviewRows = () => {
        if (selectedField !== 'add_stock' || !value || !stockAdjustment.warehouse_id) return [];
        const qty = Number(value) || 0;
        return selectedProducts.slice(0, 5).map(prod => {
            const currentStock = previewStock[prod.id] || 0;
            const newStock = currentStock + qty;
            return { name: prod.name, sku: prod.sku, oldStock: currentStock, newStock: newStock };
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-surface rounded-xl shadow-lg w-full max-w-xl overflow-hidden border border-subtle my-8">
                {/* Header */}
                <div className="p-5 border-b border-subtle flex justify-between items-center bg-warning-soft">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-warning-soft text-warning-soft-fg rounded-lg">
                            <FilePen size={24} aria-hidden="true" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-fg">Edición Rápida</h2>
                            <p className="text-xs text-fg-muted">{selectedProducts.length} producto{selectedProducts.length !== 1 ? 's' : ''} seleccionado{selectedProducts.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-fg-subtle hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                <div className="p-5 flex flex-col gap-5">
                    {/* Apply to all toggle, shown above the field inputs */}
                    {applyAllToggle}

                    {/* Step 1: Pick the field */}
                    <div>
                        <label className="block text-sm font-semibold text-fg mb-2">
                            1. ¿Qué propiedad deseas cambiar?
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {BULK_FIELDS.map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => { setSelectedField(f.key); setValue(''); }}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all border ${selectedField === f.key ? 'bg-primary/10 border-primary text-primary ring-2 ring-primary/20' : 'bg-slate-50 dark:bg-slate-700/50 border-subtle text-fg-muted hover:border-slate-400' }`}
                                >
                                    <f.icon size={18} aria-hidden="true" />
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Step 2: Enter the new value */}
                    {selectedField && (
                        <div className="animate-in fade-in">
                            <label className="block text-sm font-semibold text-fg mb-2">
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
                                    <span className="absolute left-3 top-2.5 text-fg-subtle text-sm">$</span>
                                    <input type="number" step="0.01" min="0" className={`${inputClass} pl-7`} placeholder="0.00"
                                        value={value} onChange={e => setValue(e.target.value)} autoFocus />
                                </div>
                            )}

                            {fieldConfig?.type === 'percent' && (
                                <div className="relative">
                                    <input type="number" step="0.1" min="0" className={inputClass} placeholder="Ej: 12"
                                        value={value} onChange={e => setValue(e.target.value)} autoFocus />
                                    <span className="absolute right-3 top-2.5 text-fg-subtle text-sm">%</span>
                                </div>
                            )}

                            {fieldConfig?.type === 'margin' && (
                                <>
                                    <input type="number" step="0.01" className={inputClass} placeholder="Ej: 0.30"
                                        value={value} onChange={e => setValue(e.target.value)} autoFocus />
                                    <p className="text-xs text-fg-subtle mt-1">Ej: 0.30 = 30% de margen sobre costo con IVA</p>
                                </>
                            )}

                            {fieldConfig?.type === 'brand' && (
                                <BrandSelect value={value || null} onChange={(val) => setValue(val)} />
                            )}

                            {fieldConfig?.type === 'tag' && (
                                <select 
                                    className={inputClass} 
                                    value={value || ''} 
                                    onChange={e => setValue(e.target.value)}
                                >
                                    <option value="">Seleccionar etiqueta...</option>
                                    {availableTags.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            )}

                            {fieldConfig?.type === 'stock' && (
                                <div className="space-y-4">
                                    <input type="number" className={inputClass} placeholder="Cantidad a sumar (Ej: 10 o -5)"
                                        value={value} onChange={e => setValue(e.target.value)} autoFocus />

                                    <div className="bg-surface-2 p-4 rounded-lg border border-subtle space-y-4">
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
                                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-warning"></div>
                                                <span className="ml-2 text-sm text-fg-muted font-medium group-hover:text-slate-900 transition-colors">Es una compra financiera</span>
                                            </label>
                                        </div>

                                        {stockAdjustment.isPurchase && (
                                            <div className="bg-warning-soft border border-warning/20 rounded-lg p-3 animate-in fade-in slide-in-from-top-2">
                                                <label className="block text-sm font-medium text-fg mb-1">
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
                                                    <div className="mt-2 text-xs font-semibold text-warning flex items-center gap-1">
                                                        <Info size={14} aria-hidden="true" />
                                                        Se debitarán aprox. ${getStockPreviewTotal().toFixed(2)} de esta cuenta.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {fieldConfig?.type === 'discontinued' && (
                                <div>
                                    <select 
                                        className={inputClass}
                                        value={value || ''}
                                        onChange={(e) => setValue(e.target.value)}
                                        autoFocus
                                    >
                                        <option value="" disabled>Seleccionar estado de continuidad...</option>
                                        <option value="falso_activo">🟢 Activo (Revertir Descontinuación)</option>
                                        <option value="permanente">🔴 Descontinuado Permanente</option>
                                        <option value="3">⏳ Descontinuado Temporal (3 meses)</option>
                                        <option value="6">⏳ Descontinuado Temporal (6 meses)</option>
                                        <option value="12">⏳ Descontinuado Temporal (1 Año)</option>
                                    </select>
                                    {value && value !== 'falso_activo' && (
                                        <p className="text-xs text-danger font-medium mt-2">⚠️ Al descontinuar, todas las listas de espera activas asociadas a estos productos pasarán a estado "Descontinuado" para ser notificadas.</p>
                                    )}
                                </div>
                            )}
                            {fieldConfig?.type === 'importer_unavailable' && (
                                <div>
                                    <select
                                        className={inputClass}
                                        value={value || ''}
                                        onChange={(e) => setValue(e.target.value)}
                                        autoFocus
                                    >
                                        <option value="" disabled>Seleccionar estado de disponibilidad...</option>
                                        <option value="falso_activo">🟢 Disponible (Confiar en el stock scrapeado)</option>
                                        <option value="permanente">🟠 Agotado en Importadora (hasta que lo desmarques)</option>
                                        <option value="3">⏳ Agotado en Importadora (3 meses)</option>
                                        <option value="6">⏳ Agotado en Importadora (6 meses)</option>
                                        <option value="12">⏳ Agotado en Importadora (1 Año)</option>
                                    </select>
                                    {value && value !== 'falso_activo' && (
                                        <p className="text-xs text-warning font-medium mt-2">⚠️ El stock de importadora se mostrará como 0 en todo el sistema (Sourcing, Reposición, Demandas) aunque la importadora reporte otra cosa. Las listas de espera marcadas como "Disponible" volverán a "Pendiente" automáticamente.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Financial field preview */}
                    {isFinancialField && value && (
                        <div className="bg-warning-soft border border-warning/20 rounded-lg p-3">
                            <p className="text-xs font-semibold text-warning mb-2 flex items-center gap-1">
                                <Info size={14} aria-hidden="true" />
                                PVP se recalculará automáticamente:
                            </p>
                            <div className="space-y-1.5">
                                {getPreviewRows().map((row, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <span className="text-fg-muted truncate max-w-[200px]" title={row.name}>
                                            <span className="font-mono text-fg-subtle mr-1">{row.sku}</span>
                                            {row.name}
                                        </span>
                                        <span className="flex items-center gap-1 shrink-0">
                                            <span className="text-fg-subtle">${row.oldPvp.toFixed(2)}</span>
                                            <ArrowRight size={14} className="text-warning" aria-hidden="true" />
                                            <span className="font-bold text-warning">${row.newPvp.toFixed(2)}</span>
                                        </span>
                                    </div>
                                ))}
                                {selectedProducts.length > 5 && (
                                    <p className="text-xs text-fg-subtle text-center">...y {selectedProducts.length - 5} más</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Result message */}
                    {result && (
                        <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${result.failed === 0 ? 'bg-success-soft text-success dark:text-success' : 'bg-danger-soft text-danger dark:text-danger' }`}>
                            {result.failed === 0 ? <CircleCheck size={18} aria-hidden="true" /> : <TriangleAlert size={18} aria-hidden="true" />}
                            {result.success} actualizado{result.success !== 1 ? 's' : ''}
                            {result.failed > 0 && `, ${result.failed} fallido${result.failed !== 1 ? 's' : ''}`}
                        </div>
                    )}

                    {/* Selected products summary */}
                    <div className="bg-surface-2 rounded-lg p-3">
                        <p className="text-xs font-semibold text-fg-muted mb-1.5">Productos seleccionados:</p>
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                            {selectedProducts.map(p => (
                                <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface border border-subtle rounded-lg text-xs text-fg-muted">
                                    <span className="font-mono text-fg-subtle">{p.sku}</span>
                                    {p.name?.length > 25 ? p.name.substring(0, 25) + '…' : p.name}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-5 border-t border-subtle bg-slate-50/50 dark:bg-slate-900/30">
                    <button type="button" onClick={onClose}
                        className="px-4 py-2 text-fg hover:bg-surface-hover rounded-lg transition-colors font-medium text-sm">
                        Cancelar
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={loading || !selectedField || (!value && value !== 0)}
                        className="px-6 py-2 bg-warning hover:bg-warning text-white rounded-lg shadow-sm shadow-warning/30 transition-all font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                        {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                        {loading ? 'Aplicando...' : `Aplicar a ${selectedProducts.length} producto${selectedProducts.length !== 1 ? 's' : ''}`}
                    </button>
                </div>
            </div>
        </div>
    );
};
