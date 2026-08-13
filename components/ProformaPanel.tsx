import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useProformaStore } from '../store/useProformaStore';
import { useCartStore } from '../store/cartStore';
import { fetchProformaStockInfo, ProformaStockInfo, STOCK_STATUS_LABELS } from '../utils/proformaStock';
import { ProformaPreviewModal } from './ProformaPreviewModal';
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Store,
  Trash,
  X,
} from 'lucide-react';

const STOCK_BADGE_CLASSES: Record<string, string> = {
    in_stock: 'bg-success-soft text-success dark:bg-success/30 dark:text-success',
    backorder: 'bg-warning-soft text-warning dark:bg-warning/30 dark:text-warning',
    out_of_stock: 'bg-danger-soft text-danger dark:bg-danger/30 dark:text-danger',
};

export const ProformaPanel: React.FC = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [isConverting, setIsConverting] = useState(false);
    const [stockInfo, setStockInfo] = useState<Record<number, ProformaStockInfo>>({});

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

    const productIdsKey = items.map(i => i.productId).join(',');
    useEffect(() => {
        if (!productIdsKey) {
            setStockInfo({});
            return;
        }
        let cancelled = false;
        fetchProformaStockInfo(productIdsKey.split(',').map(Number)).then(info => {
            if (!cancelled) setStockInfo(info);
        });
        return () => { cancelled = true; };
    }, [productIdsKey]);

    // Converts the current proforma into a POS sale: resolves a real warehouse
    // per item (mirrors the products/inventory_levels join POS.tsx already uses),
    // loads them into the POS cart (a Zustand store, so it survives navigation),
    // then routes to /pos so the cashier finishes checkout there. No "Venta Libre"
    // fallback: every item gets a real warehouse_id so its stock is visible and
    // editable in the POS cart before the sale closes (see the "Editar" stock
    // button added to each POS cart row). If a product has never been stocked in
    // any warehouse, we fall back to the user's ProductModal-configured default
    // warehouse (localStorage 'erp_default_warehouse_id'); if that's not set
    // either, the item is skipped with a clear alert rather than guessing.
    const handleConvertToSale = async () => {
        if (items.length === 0 || isConverting) return;
        setIsConverting(true);
        try {
            const productIds = items.map(i => i.productId);
            const [{ data: products, error: prodError }, { data: warehouses, error: whError }] = await Promise.all([
                supabase
                    .from('products')
                    .select(`
                        id, sku, name, price, cost_without_vat, vat_percentage, is_discontinued, discontinued_until,
                        inventory_levels ( current_stock, warehouse_id, warehouses ( name ) )
                    `)
                    .in('id', productIds),
                supabase.from('warehouses').select('id, name').eq('is_active', true),
            ]);

            if (prodError) throw prodError;
            if (whError) throw whError;

            const warehouseNameById = new Map<number, string>((warehouses || []).map((w: any) => [w.id, w.name]));
            const defaultWarehouseIdRaw = localStorage.getItem('erp_default_warehouse_id');
            const defaultWarehouseId = defaultWarehouseIdRaw ? parseInt(defaultWarehouseIdRaw, 10) : null;

            const unresolved: string[] = [];
            const lowStock: string[] = [];
            const { clearCart, addToCart, updateQuantity, updateUnitPrice } = useCartStore.getState();
            clearCart();

            for (const item of items) {
                const prod = products?.find((p: any) => p.id === item.productId);
                if (!prod) {
                    unresolved.push(item.sku);
                    continue;
                }

                const levels: any[] = prod.inventory_levels || [];
                const chosen = levels.find(l => l.current_stock >= item.quantity) || levels.find(l => l.current_stock > 0) || levels[0];

                let warehouse_id: number;
                let warehouse_name: string;
                let current_stock: number;

                if (chosen) {
                    warehouse_id = chosen.warehouse_id;
                    warehouse_name = (Array.isArray(chosen.warehouses) ? chosen.warehouses[0]?.name : chosen.warehouses?.name)
                        || warehouseNameById.get(chosen.warehouse_id)
                        || 'Bodega';
                    current_stock = chosen.current_stock;
                } else if (defaultWarehouseId && warehouseNameById.has(defaultWarehouseId)) {
                    warehouse_id = defaultWarehouseId;
                    warehouse_name = warehouseNameById.get(defaultWarehouseId)!;
                    current_stock = 0;
                } else {
                    unresolved.push(item.sku);
                    continue;
                }

                if (current_stock < item.quantity) lowStock.push(item.sku);

                addToCart({
                    product: {
                        id: prod.id,
                        sku: prod.sku,
                        name: prod.name,
                        price: prod.price,
                        cost_without_vat: prod.cost_without_vat,
                        vat_percentage: prod.vat_percentage,
                        is_discontinued: prod.is_discontinued,
                        discontinued_until: prod.discontinued_until,
                    },
                    warehouse_id,
                    warehouse_name,
                    current_stock,
                });

                const cartNow = useCartStore.getState().cart;
                const newCartItem = cartNow[cartNow.length - 1];
                updateQuantity(newCartItem.id, item.quantity);
                updateUnitPrice(newCartItem.id, item.unitPrice);
            }

            if (unresolved.length > 0) {
                alert(`Estos productos nunca han sido registrados en ninguna bodega y no se pudieron agregar (configura una bodega por defecto en Editar Producto, o agrégalos manualmente en el POS): ${unresolved.join(', ')}`);
            }
            if (lowStock.length > 0) {
                alert(`Estos productos no tienen stock suficiente en la bodega asignada — corrige el stock desde el carrito del POS antes de cerrar la venta: ${lowStock.join(', ')}`);
            }

            setIsOpen(false);
            navigate('/pos');
        } catch (err) {
            console.error('Error convirtiendo proforma a venta:', err);
            alert('Error al convertir la proforma a venta POS. Intenta nuevamente.');
        } finally {
            setIsConverting(false);
        }
    };

    if (items.length === 0) return null;

    return (
        <>
            {/* Collapsed FAB */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed top-6 right-6 z-40 bg-success hover:bg-success text-white w-14 h-14 rounded-full shadow-xl shadow-success/40 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                    title="Ver proforma"
                >
                    <FileText size={24} aria-hidden="true" />
                    <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] flex items-center justify-center bg-white text-success text-[11px] font-bold rounded-full shadow-md border-2 border-success">
                        {items.length}
                    </span>
                </button>
            )}

            {/* Expanded Panel */}
            {isOpen && (
                <div className="fixed top-6 right-6 z-40 w-[380px] max-h-[70dvh] bg-surface rounded-2xl shadow-xl border border-subtle flex flex-col overflow-hidden animate-in slide-in-from-top-4">
                    {/* Panel Header */}
                    <div className="flex items-center justify-between p-4 border-b border-subtle bg-success-soft">
                        <div className="flex items-center gap-2">
                            <FileText size={18} className="text-success" aria-hidden="true" />
                            <h3 className="font-bold text-fg text-sm">Proforma</h3>
                            <span className="text-xs font-bold bg-success text-success px-2 py-0.5 rounded-full">
                                {items.length} ítem{items.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="p-1 text-fg-subtle hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-surface-hover">
                            <X size={18} aria-hidden="true" />
                        </button>
                    </div>

                    {/* Items */}
                    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 max-h-[40dvh]">
                        {items.map((item) => (
                            <div key={item.id} className="flex items-center gap-2.5 p-2.5 bg-surface-2 rounded-xl border border-slate-200/60 dark:border-subtle">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[11px] font-mono font-bold text-success">{item.sku}</span>
                                        {stockInfo[item.productId] && (
                                            <span className={`text-[12px] font-bold px-1.5 py-0.5 rounded-full ${STOCK_BADGE_CLASSES[stockInfo[item.productId].status]}`}>
                                                {stockInfo[item.productId].status === 'in_stock'
                                                    ? `Stock: ${stockInfo[item.productId].totalStock}`
                                                    : STOCK_STATUS_LABELS[stockInfo[item.productId].status]}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs font-semibold text-fg truncate">{item.name}</p>
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
                                            className="mt-1 w-20 px-1.5 py-0.5 text-xs font-bold border-2 border-success rounded outline-none bg-success-soft dark:text-white"
                                        />
                                    ) : (
                                        <button
                                            onClick={() => setEditingPriceId(item.id)}
                                            className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-fg-muted hover:text-success"
                                            title="Click para editar precio"
                                        >
                                            ${item.unitPrice.toFixed(2)} c/u
                                            <Pencil size={12} className="opacity-60" aria-hidden="true" />
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 text-fg-muted flex items-center justify-center text-xs font-bold hover:bg-slate-300">−</button>
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                                        className="w-10 h-6 text-center bg-surface border border-subtle rounded text-xs font-bold text-fg p-0 focus:ring-0"
                                    />
                                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 text-fg-muted flex items-center justify-center text-xs font-bold hover:bg-slate-300">+</button>
                                </div>
                                <button onClick={() => removeItem(item.id)} className="p-1 text-danger hover:text-danger hover:bg-danger-soft rounded-lg transition-colors" title="Eliminar">
                                    <X size={16} aria-hidden="true" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Shipping */}
                    <div className="px-3 py-2 border-t border-subtle">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={shippingEnabled}
                                onChange={(e) => setShippingEnabled(e.target.checked)}
                                className="w-3.5 h-3.5 text-success rounded border-strong"
                            />
                            <span className="text-xs font-bold text-fg-muted">Incluir costo de envío</span>
                        </label>
                        {shippingEnabled && (
                            <div className="relative mt-2">
                                <span className="absolute left-2 top-1.5 text-fg-subtle text-xs">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={shippingCost}
                                    onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className="w-full pl-5 pr-2 py-1 text-xs border border-strong dark:bg-slate-800 dark:text-white rounded outline-none focus:border-success"
                                />
                            </div>
                        )}
                    </div>

                    {/* Panel Footer */}
                    <div className="p-3 border-t border-subtle flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-fg-muted uppercase">Total</span>
                            <span className="text-lg font-bold text-success">${getTotal().toFixed(2)}</span>
                        </div>
                        <div className="flex gap-2">
                            {!showClearConfirm ? (
                                <button
                                    onClick={() => setShowClearConfirm(true)}
                                    className="px-3 py-2 text-xs font-semibold text-danger hover:bg-danger-soft rounded-lg transition-colors flex items-center gap-1"
                                >
                                    <Trash size={16} aria-hidden="true" />
                                    Vaciar
                                </button>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-danger font-bold">¿Seguro?</span>
                                    <button onClick={() => { clear(); setShowClearConfirm(false); setIsOpen(false); }} className="text-[11px] font-bold text-white bg-danger px-2 py-1 rounded">Sí</button>
                                    <button onClick={() => setShowClearConfirm(false)} className="text-[11px] font-bold text-fg-muted bg-surface-3 px-2 py-1 rounded">No</button>
                                </div>
                            )}
                            <button
                                onClick={() => setIsPreviewOpen(true)}
                                className="flex-1 py-2 bg-success hover:from-success hover:to-success text-white rounded-xl font-bold text-sm shadow-md shadow-success/20 transition-all flex items-center justify-center gap-2"
                            >
                                <ImageIcon size={18} aria-hidden="true" />
                                Generar Imagen
                            </button>
                        </div>
                        <button
                            onClick={handleConvertToSale}
                            disabled={isConverting}
                            className="w-full py-2 bg-primary hover:from-primary hover:to-primary text-white rounded-xl font-bold text-sm shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isConverting ? <Loader2 size={18} className={`text-lg ${isConverting ? 'animate-spin' : ''}`} aria-hidden="true" /> : <Store size={18} className={`text-lg ${isConverting ? 'animate-spin' : ''}`} aria-hidden="true" />}
                            {isConverting ? 'Convirtiendo...' : 'Convertir a Venta POS'}
                        </button>
                    </div>
                </div>
            )}

            <ProformaPreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} stockInfo={stockInfo} />
        </>
    );
};
