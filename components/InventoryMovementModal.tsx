import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Database } from '../types/supabase';

type Product = Database['public']['Tables']['products']['Row'];
type Warehouse = Database['public']['Tables']['warehouses']['Row'];

interface InventoryMovementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const InventoryMovementModal: React.FC<InventoryMovementModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        productId: '',
        warehouseId: '',
        type: 'IN', // 'IN' or 'OUT'
        quantity: '',
        reason: '',
        reference: '' // Optional reference
    });

    useEffect(() => {
        if (isOpen) {
            fetchOptions();
        }
    }, [isOpen]);

    const fetchOptions = async () => {
        setLoading(true);
        try {
            const { data: productsData, error: productsError } = await supabase.from('products').select('*');
            if (productsError) throw productsError;
            setProducts(productsData || []);

            const { data: warehousesData, error: warehousesError } = await supabase.from('warehouses').select('*');
            if (warehousesError) throw warehousesError;
            setWarehouses(warehousesData || []);
        } catch (err: any) {
            console.error('Error fetching options:', err);
            setError('Error loading products or warehouses');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        const qty = parseFloat(formData.quantity);
        if (isNaN(qty) || qty <= 0) {
            setError('Quantity must be a positive number');
            setSubmitting(false);
            return;
        }

        const finalQty = formData.type === 'OUT' ? -qty : qty;

        try {
            // Call the ACID RPC
            const { data, error: rpcError } = await supabase.rpc('process_inventory_movement', {
                p_product_id: parseInt(formData.productId),
                p_warehouse_id: parseInt(formData.warehouseId),
                p_quantity_change: finalQty,
                p_reason: formData.reason,
                p_reference_type: 'manual_adjustment',
                p_reference_id: formData.reference || null
            });

            if (rpcError) throw rpcError;

            onSuccess();
            onClose();
            // Reset form
            setFormData({
                productId: '',
                warehouseId: '',
                type: 'IN',
                quantity: '',
                reason: '',
                reference: ''
            });

        } catch (err: any) {
            console.error('Transaction failed:', err);
            setError(err.message || 'Transaction failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Registrar Movimiento</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">error</span>
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo</label>
                            <select
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            >
                                <option value="IN">Entrada (+)</option>
                                <option value="OUT">Salida (-)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cantidad</label>
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                required
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Producto</label>
                        <select
                            required
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            value={formData.productId}
                            onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                        >
                            <option value="">Seleccionar Producto...</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Almacén</label>
                        <select
                            required
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            value={formData.warehouseId}
                            onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                        >
                            <option value="">Seleccionar Almacén...</option>
                            {warehouses.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Motivo</label>
                        <input
                            type="text"
                            required
                            placeholder="Ej. Compra, Venta, Ajuste..."
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Referencia (Opcional)</label>
                        <input
                            type="text"
                            placeholder="ID Orden, Factura..."
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            value={formData.reference}
                            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg shadow-sm shadow-primary/30 transition-all font-medium flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {submitting && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                            {submitting ? 'Procesando...' : 'Confirmar Movimiento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InventoryMovementModal;
