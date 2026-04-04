import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BrandSelect } from './BrandSelect';
import { WarehouseSelect } from './WarehouseSelect';

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    productToEdit?: {
        id: number;
        sku: string;
        name: string;
        category: string;
        brand_id: number | null;
        min_stock_threshold: number;
        profit_margin: number;
        cost_without_vat: number;
        vat_percentage: number;
        price: number;
        image_url?: string | null;
    } | null;
}

// ─── Helper: round to 4 decimals to avoid floating-point noise ───
const r = (n: number) => Math.round(n * 10000) / 10000;

// ─── Derived cost WITH VAT ───
const costWithVat = (costWithoutVat: number, vatPercentage: number) =>
    r(costWithoutVat * (1 + vatPercentage / 100));

// ─── PVP from cost + margin ───
const calcPrice = (costWithoutVat: number, vatPercentage: number, profitMargin: number) =>
    r(costWithVat(costWithoutVat, vatPercentage) * (1 + profitMargin));

// ─── Margin from PVP + cost ───
const calcMargin = (costWithoutVat: number, vatPercentage: number, price: number) => {
    const c = costWithVat(costWithoutVat, vatPercentage);
    return c > 0 ? r(price / c - 1) : 0;
};

export const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, onSuccess, productToEdit }) => {
    const [loading, setLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [entryByPrice, setEntryByPrice] = useState(false);
    const [formData, setFormData] = useState({
        sku: '',
        name: '',
        category: '',
        brandId: null as number | null,
        minStock: 10,
        profitMargin: 0.65,
        costWithoutVat: 0,
        vatPercentage: 15.0,
        price: 0,
        imageUrl: ''
    });

    // Stock Adjustment State
    const [stockAdjustment, setStockAdjustment] = useState({
        warehouse_id: null as number | null,
        quantity: '',
        isPurchase: false,
        account_id: null as number | null,
        isMerma: false,
        merma_account_id: null as number | null
    });
    const [accounts, setAccounts] = useState<any[]>([]);
    const [currentStock, setCurrentStock] = useState<number | null>(null);

    useEffect(() => {
        const fetchStock = async () => {
            if (stockAdjustment.warehouse_id) {
                if (productToEdit?.id) {
                    const { data } = await supabase
                        .from('inventory_levels')
                        .select('current_stock')
                        .eq('warehouse_id', stockAdjustment.warehouse_id)
                        .eq('product_id', productToEdit.id)
                        .single();
                    if (data) {
                        setCurrentStock(data.current_stock);
                        setStockAdjustment(prev => ({ ...prev, quantity: prev.quantity === '' ? data.current_stock.toString() : prev.quantity }));
                    } else {
                        setCurrentStock(0);
                        setStockAdjustment(prev => ({ ...prev, quantity: prev.quantity === '' ? '0' : prev.quantity }));
                    }
                } else {
                    setCurrentStock(0);
                    setStockAdjustment(prev => ({ ...prev, quantity: prev.quantity === '' ? '0' : prev.quantity }));
                }
            } else {
                setCurrentStock(null);
            }
        };
        fetchStock();
    }, [stockAdjustment.warehouse_id, productToEdit?.id]);

    useEffect(() => {
        if (isOpen) {
            fetchAccounts();
            if (productToEdit) {
                const cwv = productToEdit.cost_without_vat || 0;
                const vat = productToEdit.vat_percentage || 15.0;
                const margin = productToEdit.profit_margin || 0.65;
                // Derive PVP from cost data if stored price is 0 or missing
                const storedPrice = productToEdit.price || 0;
                const derivedPrice = storedPrice > 0 ? storedPrice : calcPrice(cwv, vat, margin);

                setFormData({
                    sku: productToEdit.sku || '',
                    name: productToEdit.name || '',
                    category: productToEdit.category || '',
                    brandId: productToEdit.brand_id,
                    minStock: productToEdit.min_stock_threshold || 10,
                    profitMargin: Math.round(margin * 100) / 100,
                    costWithoutVat: cwv,
                    vatPercentage: vat,
                    price: Math.round(derivedPrice * 100) / 100,
                    imageUrl: productToEdit.image_url || ''
                });
            } else {
                setFormData({
                    sku: '',
                    name: '',
                    category: '',
                    brandId: null,
                    minStock: 10,
                    profitMargin: 0.65,
                    costWithoutVat: 0,
                    vatPercentage: 15.0,
                    price: 0,
                    imageUrl: ''
                });
            }
            // Reset stock adjustment
            setStockAdjustment({ warehouse_id: null, quantity: '', isPurchase: false, account_id: null, isMerma: false, merma_account_id: null });
        }
    }, [isOpen, productToEdit]);

    const fetchAccounts = async () => {
        try {
            const { data } = await supabase.from('accounts').select('*').order('name');
            if (data) setAccounts(data);
        } catch (error) {
            console.error('Error fetching accounts', error);
        }
    };

    // ─── Change handlers that keep everything in sync ───

    const handleCostChange = (newCost: number) => {
        if (entryByPrice) {
            // Cost changed while in Price Mode? Probably want to update Price
            const price = calcPrice(newCost, formData.vatPercentage, formData.profitMargin);
            setFormData(prev => ({ ...prev, costWithoutVat: newCost, price: Math.round(price * 100) / 100 }));
        } else {
            const price = calcPrice(newCost, formData.vatPercentage, formData.profitMargin);
            setFormData(prev => ({ ...prev, costWithoutVat: newCost, price: Math.round(price * 100) / 100 }));
        }
    };

    const handleVatChange = (newVat: number) => {
        if (entryByPrice) {
            // Price is fixed, update Cost
            const costWithVatValue = formData.price / (1 + formData.profitMargin);
            const costWithoutVatValue = costWithVatValue / (1 + (newVat / 100));
            setFormData(prev => ({ ...prev, vatPercentage: newVat, costWithoutVat: r(costWithoutVatValue) }));
        } else {
            const price = calcPrice(formData.costWithoutVat, newVat, formData.profitMargin);
            setFormData(prev => ({ ...prev, vatPercentage: newVat, price: Math.round(price * 100) / 100 }));
        }
    };

    const handleMarginChange = (newMargin: number) => {
        if (entryByPrice) {
            // Price is fixed, update Cost
            const costWithVatValue = formData.price / (1 + newMargin);
            const costWithoutVatValue = costWithVatValue / (1 + (formData.vatPercentage / 100));
            setFormData(prev => ({ ...prev, profitMargin: newMargin, costWithoutVat: r(costWithoutVatValue) }));
        } else {
            const price = calcPrice(formData.costWithoutVat, formData.vatPercentage, newMargin);
            setFormData(prev => ({ ...prev, profitMargin: newMargin, price: Math.round(price * 100) / 100 }));
        }
    };

    const handlePriceChange = (newPrice: number) => {
        if (entryByPrice) {
            // Margin is fixed, update Cost
            const costWithVatValue = newPrice / (1 + formData.profitMargin);
            const costWithoutVatValue = costWithVatValue / (1 + (formData.vatPercentage / 100));
            setFormData(prev => ({ ...prev, price: newPrice, costWithoutVat: r(costWithoutVatValue) }));
        } else {
            // Cost is fixed, update Margin
            const margin = calcMargin(formData.costWithoutVat, formData.vatPercentage, newPrice);
            setFormData(prev => ({ ...prev, price: newPrice, profitMargin: Math.round(margin * 100) / 100 }));
        }
    };

    // ─── Computed display values ───
    const costoConIva = costWithVat(formData.costWithoutVat, formData.vatPercentage);
    const gananciaAbsoluta = r(formData.price - costoConIva);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        
        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `products/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product_images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('product_images')
                .getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, imageUrl: data.publicUrl }));
        } catch (error: any) {
            console.error('Error uploading image:', error);
            alert('Error al subir imagen: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveImage = () => {
        setFormData(prev => ({ ...prev, imageUrl: '' }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.brandId) {
            alert('Por favor seleccione una marca.');
            return;
        }

        setLoading(true);

        try {
            // Compute implied image URL based on SKU if not manually uploaded
            const defaultImageUrl = supabase.storage
                .from('product_images')
                .getPublicUrl('products/' + formData.sku + '_cut.webp').data.publicUrl;

            const payload = {
                sku: formData.sku,
                name: formData.name,
                category: formData.category,
                brand_id: formData.brandId,
                min_stock_threshold: formData.minStock,
                profit_margin: formData.profitMargin,
                cost_without_vat: formData.costWithoutVat,
                vat_percentage: formData.vatPercentage,
                price: formData.price,
                image_url: formData.imageUrl || defaultImageUrl
            };

            let productId = productToEdit?.id;

            if (productToEdit && productToEdit.id) {
                // Update existing
                const { error: updateError } = await supabase
                    .from('products')
                    .update(payload)
                    .eq('id', productToEdit.id);
                if (updateError) throw updateError;
            } else {
                // Insert new
                const { data: newProd, error: insertError } = await supabase
                    .from('products')
                    .insert([payload])
                    .select('id')
                    .single();
                if (insertError) throw insertError;
                productId = newProd.id;
            }

            // Handle Stock Adjustment
            const submittedQtyStr = stockAdjustment.quantity.toString().trim();
            const submittedQty = parseInt(submittedQtyStr);
            const isQtyValid = submittedQtyStr !== '' && !isNaN(submittedQty);

            if (isQtyValid && !stockAdjustment.warehouse_id) {
                throw new Error('Debe marcar obligatoriamente el Almacén/Sucursal si va a editar la cantidad de stock.');
            }

            const originalQty = currentStock !== null ? currentStock : 0;
            const qtyChange = isQtyValid ? submittedQty - originalQty : 0;

            if (qtyChange !== 0 && stockAdjustment.warehouse_id && productId) {
                if (qtyChange > 0 && stockAdjustment.isPurchase && !stockAdjustment.account_id) {
                    throw new Error('Debe seleccionar una cuenta de pago para registrar la compra.');
                }
                if (qtyChange < 0 && stockAdjustment.isMerma && !stockAdjustment.merma_account_id) {
                    throw new Error('Debe seleccionar una cuenta de gasto/pérdida para registrar la merma.');
                }

                const unit_cost_with_vat = costWithVat(formData.costWithoutVat, formData.vatPercentage);
                const { data: stockData, error: stockError } = await supabase.rpc('process_quick_stock_adjustment', {
                    p_warehouse_id: stockAdjustment.warehouse_id,
                    p_payment_account_id: (qtyChange > 0 && stockAdjustment.isPurchase) ? stockAdjustment.account_id : null,
                    p_merma_account_id: (qtyChange < 0 && stockAdjustment.isMerma) ? stockAdjustment.merma_account_id : null,
                    p_products: [{
                        product_id: productId,
                        quantity_change: qtyChange,
                        unit_cost_with_vat: unit_cost_with_vat
                    }]
                });

                if (stockError) throw stockError;
                if (!stockData.success) {
                    throw new Error('Error en ajuste de stock: ' + stockData.message);
                }
            }

            onSuccess();
            onClose();

        } catch (error: any) {
            console.error('Error saving product:', error);
            alert('Error al guardar producto: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const inputClass = "w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm";
    const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700 my-8">
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                            <span className="material-symbols-outlined text-[24px]">inventory_2</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            {productToEdit ? 'Editar Producto' : 'Nuevo Producto'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
                    {/* ═══ Image Upload ═══ */}
                    <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative group">
                        {formData.imageUrl ? (
                            <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                                <img src={formData.imageUrl} alt="Product" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={handleRemoveImage}
                                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500 backdrop-blur-sm"
                                >
                                    <span className="material-symbols-outlined text-[16px] leading-none">close</span>
                                </button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center w-full h-full min-h-[128px] cursor-pointer">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    {isUploading ? (
                                        <span className="material-symbols-outlined text-[32px] text-primary animate-spin">progress_activity</span>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-[32px] text-slate-400 mb-2 group-hover:text-primary transition-colors">add_photo_alternate</span>
                                            <p className="mb-1 text-sm text-slate-600 dark:text-slate-400 font-medium">Click para subir foto central</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500">JPG, PNG o WEBP</p>
                                        </>
                                    )}
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                            </label>
                        )}
                    </div>

                    {/* ═══ Core Fields ═══ */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-1 md:col-span-2">
                            <label className={labelClass}>Nombre del Producto *</label>
                            <input required type="text" className={inputClass}
                                value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>

                        <div>
                            <label className={labelClass}>SKU *</label>
                            <input required type="text" className={`${inputClass} font-mono uppercase`}
                                value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })} />
                        </div>

                        <div>
                            <label className={labelClass}>Categoría</label>
                            <input type="text" className={inputClass}
                                value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <BrandSelect value={formData.brandId} onChange={(val) => setFormData({ ...formData, brandId: val })} required={true} />
                        </div>

                        <div>
                            <label className={labelClass}>Stock Mínimo</label>
                            <input type="number" min="0" className={inputClass}
                                value={formData.minStock} onChange={e => setFormData({ ...formData, minStock: parseInt(e.target.value) || 0 })} />
                        </div>
                    </div>

                    {/* ═══ Financial Section — auto-linked ═══ */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-[18px]">payments</span>
                            Precios y Costos
                            <span className="text-xs font-normal normal-case text-slate-400 ml-1">— los campos se auto-calculan</span>
                            <div className="ml-auto flex items-center gap-2">
                                <span className={`text-[10px] font-bold uppercase tracking-tight ${!entryByPrice ? 'text-primary' : 'text-slate-400'}`}>Por Costo</span>
                                <label className="flex items-center cursor-pointer relative group">
                                    <input type="checkbox" className="sr-only peer"
                                        checked={entryByPrice}
                                        onChange={(e) => setEntryByPrice(e.target.checked)}
                                    />
                                    <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                                <span className={`text-[10px] font-bold uppercase tracking-tight ${entryByPrice ? 'text-primary' : 'text-slate-400'}`}>Por Precio</span>
                            </div>
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Costo sin IVA ($)</label>
                                <input type="number" step="0.0001" min="0" className={`${inputClass} ${entryByPrice ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50' : ''}`}
                                    value={formData.costWithoutVat}
                                    onChange={e => handleCostChange(parseFloat(e.target.value) || 0)}
                                    readOnly={entryByPrice}
                                />
                                {entryByPrice && <p className="text-[10px] text-amber-600 mt-1 italic">Calculado desde el PVP</p>}
                            </div>

                            <div>
                                <label className={labelClass}>IVA (%)</label>
                                <input type="number" step="0.1" min="0" className={inputClass}
                                    value={formData.vatPercentage}
                                    onChange={e => handleVatChange(parseFloat(e.target.value) || 0)} />
                            </div>

                            <div>
                                <label className={labelClass}>Margen de Ganancia (decimal)</label>
                                <input type="number" step="0.01" className={inputClass}
                                    value={formData.profitMargin}
                                    onChange={e => handleMarginChange(parseFloat(e.target.value) || 0)} />
                                <p className="text-xs text-slate-400 mt-1">
                                    Ej: 0.65 = 65%. {entryByPrice ? 'Actualiza el costo automáticamente.' : 'Actualiza el PVP automáticamente.'}
                                </p>
                            </div>

                            <div>
                                <label className={labelClass}>PVP — Precio de Venta ($)</label>
                                <input type="number" step="0.01" min="0" className={`${inputClass} font-semibold ${!entryByPrice ? 'bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-200/50' : 'ring-2 ring-primary border-primary'}`}
                                    value={formData.price}
                                    onChange={e => handlePriceChange(parseFloat(e.target.value) || 0)} />
                                <p className="text-xs text-slate-400 mt-1">
                                    {entryByPrice ? 'Ingresa el precio final; el costo se ajustará.' : 'Al cambiar, el margen se recalcula automáticamente.'}
                                </p>
                            </div>
                        </div>

                        {/* Live summary card */}
                        {formData.costWithoutVat > 0 && (
                            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg grid grid-cols-3 gap-4 text-center text-sm">
                                <div>
                                    <div className="text-slate-400 text-xs mb-0.5">Costo c/ IVA</div>
                                    <div className="font-bold text-slate-700 dark:text-slate-200">${costoConIva.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-slate-400 text-xs mb-0.5">Margen</div>
                                    <div className={`font-bold ${formData.profitMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {(formData.profitMargin * 100).toFixed(1)}%
                                    </div>
                                </div>
                                <div>
                                    <div className="text-slate-400 text-xs mb-0.5">Ganancia</div>
                                    <div className={`font-bold ${gananciaAbsoluta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        ${gananciaAbsoluta.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══ AJUSTE DE STOCK RÁPIDO ═══ */}
                        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-[18px]">inventory</span>
                                Ajuste de Stock Rápido
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <WarehouseSelect
                                        value={stockAdjustment.warehouse_id}
                                        onChange={(val) => setStockAdjustment(prev => ({ ...prev, warehouse_id: val }))}
                                        label="Almacén:"
                                        required={stockAdjustment.quantity.toString().trim() !== ''}
                                    />
                                    <div className="mt-2 text-xs text-slate-500">
                                        Selecciona un almacén para modificar el stock de este producto al guardar.
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className={labelClass}>
                                            Nuevo Stock Total:
                                        </label>
                                        <input
                                            type="number"
                                            className={inputClass}
                                            value={stockAdjustment.quantity}
                                            onChange={e => setStockAdjustment(prev => ({ ...prev, quantity: e.target.value }))}
                                            placeholder="Ej: 50"
                                        />
                                    </div>
                                    {/* Delta indicator and conditional toggles */}
                                    {stockAdjustment.warehouse_id && (() => {
                                        const qt = parseInt(stockAdjustment.quantity);
                                        if (isNaN(qt) || currentStock === null) return null;
                                        const diff = qt - currentStock;
                                        if (diff === 0) return <div className="mt-2 text-xs text-slate-500">El stock no cambiará.</div>;
                                        if (diff > 0) {
                                            return (
                                                <div className="mt-3 space-y-3">
                                                    <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                                        <span className="material-symbols-outlined text-[16px]">add_circle</span>
                                                        Se añadirán <strong>{diff}</strong> unidades al inventario.
                                                    </div>
                                                    <label className="flex items-center cursor-pointer relative group">
                                                        <input type="checkbox" className="sr-only peer"
                                                            checked={stockAdjustment.isPurchase}
                                                            onChange={(e) => setStockAdjustment(prev => ({ ...prev, isPurchase: e.target.checked }))}
                                                        />
                                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                                                        <span className="ml-2 text-sm text-slate-600 font-medium group-hover:text-slate-900 transition-colors">Registrar como compra financiera</span>
                                                    </label>
                                                    {stockAdjustment.isPurchase && (
                                                        <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                                                            <label className={labelClass}>Cuenta de Pago:</label>
                                                            <select className={inputClass}
                                                                value={stockAdjustment.account_id || ''}
                                                                onChange={(e) => setStockAdjustment(prev => ({ ...prev, account_id: parseInt(e.target.value) }))}
                                                            >
                                                                <option value="">Seleccionar Cuenta...</option>
                                                                {accounts.map(acc => (
                                                                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name} ({acc.currency})</option>
                                                                ))}
                                                            </select>
                                                            {stockAdjustment.account_id && (
                                                                <div className="mt-2 text-xs font-semibold text-orange-700 flex items-center gap-1">
                                                                    <span className="material-symbols-outlined text-[14px]">info</span>
                                                                    Se debitarán ${(costoConIva * diff).toFixed(2)} de esta cuenta.
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        } else {
                                            // diff < 0 — stock reduction
                                            return (
                                                <div className="mt-3 space-y-3">
                                                    <div className="flex items-center gap-2 p-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-400">
                                                        <span className="material-symbols-outlined text-[16px]">remove_circle</span>
                                                        Se restarán <strong>{Math.abs(diff)}</strong> unidades del inventario.
                                                    </div>
                                                    <label className="flex items-center cursor-pointer relative group">
                                                        <input type="checkbox" className="sr-only peer"
                                                            checked={stockAdjustment.isMerma}
                                                            onChange={(e) => setStockAdjustment(prev => ({ ...prev, isMerma: e.target.checked }))}
                                                        />
                                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                                                        <span className="ml-2 text-sm text-slate-600 font-medium group-hover:text-slate-900 transition-colors">Registrar como merma (pérdida contable)</span>
                                                    </label>
                                                    {stockAdjustment.isMerma && (
                                                        <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-lg p-3">
                                                            <label className={labelClass}>Cuenta de Gasto / Pérdida:</label>
                                                            <select className={inputClass}
                                                                value={stockAdjustment.merma_account_id || ''}
                                                                onChange={(e) => setStockAdjustment(prev => ({ ...prev, merma_account_id: parseInt(e.target.value) }))}
                                                            >
                                                                <option value="">Seleccionar Cuenta...</option>
                                                                {accounts.map(acc => (
                                                                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name} ({acc.currency})</option>
                                                                ))}
                                                            </select>
                                                            {stockAdjustment.merma_account_id && (
                                                                <div className="mt-2 text-xs font-semibold text-rose-700 flex items-center gap-1">
                                                                    <span className="material-symbols-outlined text-[14px]">info</span>
                                                                    Se registrará una pérdida de ${(costoConIva * Math.abs(diff)).toFixed(2)} en contabilidad.
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ═══ Actions ═══ */}
                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <button type="button" onClick={onClose}
                            className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors font-medium">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading}
                            className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg shadow-sm shadow-primary/30 transition-all font-medium flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                            {loading && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                            {loading ? 'Guardando...' : 'Guardar Producto'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
