import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Database } from '../types/supabase';
import {
  CircleAlert,
  Loader2,
  X,
} from 'lucide-react';

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
        destinationWarehouseId: '',
        type: 'IN', // 'IN', 'OUT', or 'TRANSFER'
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

        if (formData.type === 'TRANSFER' && formData.warehouseId === formData.destinationWarehouseId) {
            setError('El almacén origen y destino no pueden ser el mismo');
            setSubmitting(false);
            return;
        }

        try {
            if (formData.type === 'TRANSFER') {
                const { error: rpcError } = await supabase.rpc('process_inventory_transfer', {
                    p_product_id: parseInt(formData.productId),
                    p_source_warehouse: parseInt(formData.warehouseId),
                    p_destination_warehouse: parseInt(formData.destinationWarehouseId),
                    p_quantity: qty,
                    p_reason: formData.reason
                });
                if (rpcError) throw rpcError;
            } else {
                const finalQty = formData.type === 'OUT' ? -qty : qty;
                const { error: rpcError } = await supabase.rpc('process_inventory_movement', {
                    p_product_id: parseInt(formData.productId),
                    p_warehouse_id: parseInt(formData.warehouseId),
                    p_quantity_change: finalQty,
                    p_reason: formData.reason,
                    p_reference_type: 'manual_adjustment',
                    p_reference_id: formData.reference || null
                });
                if (rpcError) throw rpcError;
            }

            onSuccess();
            onClose();
            // Reset form
            setFormData({
                productId: '',
                warehouseId: '',
                destinationWarehouseId: '',
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-surface rounded-xl shadow-lg w-full max-w-md overflow-hidden border border-subtle">
                <div className="p-6 border-b border-subtle flex justify-between items-center">
                    <h2 className="text-xl font-bold text-fg">Registrar Movimiento</h2>
                    <button onClick={onClose} className="text-fg-subtle hover:text-slate-600 dark:hover:text-slate-200">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
                    {error && (
                        <div className="p-3 bg-danger-soft text-danger-soft-fg text-sm rounded-lg flex items-center gap-2">
                            <CircleAlert size={18} aria-hidden="true" />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-fg mb-1">Tipo</label>
                            <select
                                className="w-full px-3 py-2 bg-surface-2 border border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            >
                                <option value="IN">Entrada (+)</option>
                                <option value="OUT">Salida (-)</option>
                                <option value="TRANSFER">Traslado (Entre almacenes)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-fg mb-1">Cantidad</label>
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                required
                                className="w-full px-3 py-2 bg-surface-2 border border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-fg mb-1">Producto</label>
                        <select
                            required
                            className="w-full px-3 py-2 bg-surface-2 border border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            value={formData.productId}
                            onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                        >
                            <option value="">Seleccionar Producto...</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                            ))}
                        </select>
                    </div>

                    <div className={formData.type === 'TRANSFER' ? 'grid grid-cols-2 gap-4' : ''}>
                        <div>
                            <label className="block text-sm font-medium text-fg mb-1">
                                {formData.type === 'TRANSFER' ? 'Almacén Origen' : 'Almacén'}
                            </label>
                            <select
                                required
                                className="w-full px-3 py-2 bg-surface-2 border border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                value={formData.warehouseId}
                                onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                            >
                                <option value="">Seleccionar Almacén...</option>
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                        {formData.type === 'TRANSFER' && (
                            <div>
                                <label className="block text-sm font-medium text-fg mb-1">
                                    Almacén Destino
                                </label>
                                <select
                                    required
                                    className="w-full px-3 py-2 bg-surface-2 border border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                    value={formData.destinationWarehouseId}
                                    onChange={(e) => setFormData({ ...formData, destinationWarehouseId: e.target.value })}
                                >
                                    <option value="">Seleccionar Almacén...</option>
                                    {warehouses.map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-fg mb-1">Motivo</label>
                        <input
                            type="text"
                            required
                            placeholder="Ej. Compra, Venta, Ajuste..."
                            className="w-full px-3 py-2 bg-surface-2 border border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-fg mb-1">Referencia (Opcional)</label>
                        <input
                            type="text"
                            placeholder="ID Orden, Factura..."
                            className="w-full px-3 py-2 bg-surface-2 border border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            value={formData.reference}
                            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-fg hover:bg-surface-hover rounded-lg transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || (formData.type === 'TRANSFER' && formData.warehouseId !== '' && formData.warehouseId === formData.destinationWarehouseId)}
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg shadow-sm shadow-primary/30 transition-all font-medium flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {submitting && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
                            {submitting ? 'Procesando...' : 'Confirmar Movimiento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InventoryMovementModal;
