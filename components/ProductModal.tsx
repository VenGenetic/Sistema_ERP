import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BrandSelect } from './BrandSelect'; // Assuming in same folder

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
    } | null;
}

export const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, onSuccess, productToEdit }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        sku: '',
        name: '',
        category: '',
        brandId: null as number | null,
        minStock: 10,
        profitMargin: 0.30,
        costWithoutVat: 0,
        vatPercentage: 12.0,
        price: 0
    });

    useEffect(() => {
        if (isOpen) {
            if (productToEdit) {
                setFormData({
                    sku: productToEdit.sku || '',
                    name: productToEdit.name || '',
                    category: productToEdit.category || '',
                    brandId: productToEdit.brand_id,
                    minStock: productToEdit.min_stock_threshold || 10,
                    profitMargin: productToEdit.profit_margin || 0.30,
                    costWithoutVat: productToEdit.cost_without_vat || 0,
                    vatPercentage: productToEdit.vat_percentage || 12.0,
                    price: productToEdit.price || 0
                });
            } else {
                // Reset for new product
                setFormData({
                    sku: '',
                    name: '',
                    category: '',
                    brandId: null,
                    minStock: 10,
                    profitMargin: 0.30,
                    costWithoutVat: 0,
                    vatPercentage: 12.0,
                    price: 0
                });
            }
        }
    }, [isOpen, productToEdit]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.brandId) {
            alert('Por favor seleccione una marca.');
            return;
        }

        setLoading(true);

        try {
            // Match the payload keys exactly to your public.products table schema
            const payload = {
                sku: formData.sku,
                name: formData.name,
                category: formData.category,
                brand_id: formData.brandId,
                min_stock_threshold: formData.minStock,
                profit_margin: formData.profitMargin,
                cost_without_vat: formData.costWithoutVat,
                vat_percentage: formData.vatPercentage,
                price: formData.price
            };

            let error;
            if (productToEdit && productToEdit.id) {
                // Update
                const { error: updateError } = await supabase
                    .from('products')
                    .update(payload)
                    .eq('id', productToEdit.id);
                error = updateError;
            } else {
                // Insert
                const { error: insertError } = await supabase
                    .from('products')
                    .insert([payload]);
                error = insertError;
            }

            if (error) throw error;

            onSuccess(); // This triggers fetchData() in Inventory.tsx to refresh the UI
            onClose();

        } catch (error: any) {
            console.error('Error saving product:', error);
            alert('Error al guardar producto: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700 my-8">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
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

                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Core Fields */}
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del Producto *</label>
                            <input
                                required
                                type="text"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SKU *</label>
                            <input
                                required
                                type="text"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none font-mono uppercase"
                                value={formData.sku}
                                onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoría</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <BrandSelect
                                value={formData.brandId}
                                onChange={(val) => setFormData({ ...formData, brandId: val })}
                                required={true}
                            />
                        </div>

                        {/* Divider for Financial Section */}
                        <div className="col-span-1 md:col-span-2 border-t border-slate-200 dark:border-slate-700 pt-4 mt-1">
                            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">payments</span>
                                Inventario y Finanzas
                            </h3>
                        </div>

                        {/* Inventory & Financial Fields */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stock Mínimo</label>
                            <input
                                type="number"
                                min="0"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                value={formData.minStock}
                                onChange={e => setFormData({ ...formData, minStock: parseInt(e.target.value) || 0 })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Margen de Ganancia (Ej: 0.30 = 30%)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                value={formData.profitMargin}
                                onChange={e => setFormData({ ...formData, profitMargin: parseFloat(e.target.value) || 0 })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Costo sin IVA ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                value={formData.costWithoutVat}
                                onChange={e => setFormData({ ...formData, costWithoutVat: parseFloat(e.target.value) || 0 })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">IVA (%)</label>
                            <input
                                type="number"
                                step="0.1"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                value={formData.vatPercentage}
                                onChange={e => setFormData({ ...formData, vatPercentage: parseFloat(e.target.value) || 0 })}
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Precio de Venta al Público (PVP) ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                value={formData.price}
                                onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg shadow-sm shadow-primary/30 transition-all font-medium flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                            {loading ? 'Guardando...' : 'Guardar Producto'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
