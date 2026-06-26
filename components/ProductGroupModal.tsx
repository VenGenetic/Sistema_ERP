import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { getThumbnailUrl } from '../utils/image';

interface ProductGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: string;
    currentProduct: any;
    onEditProduct: (product: any) => void;
    onSuccess: () => void;
}

export const ProductGroupModal: React.FC<ProductGroupModalProps> = ({
    isOpen,
    onClose,
    groupId,
    currentProduct,
    onEditProduct,
    onSuccess
}) => {
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [editStates, setEditStates] = useState<{ [id: number]: { sku: string; name: string; cost: number; price: number } }>({});

    useEffect(() => {
        if (isOpen && groupId) {
            fetchGroupProducts();
        }
    }, [isOpen, groupId]);

    const fetchGroupProducts = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, sku, name, image_url, group_id, cost_without_vat, price, local_stock, importer_stock')
                .eq('group_id', groupId)
                .order('sku');
            
            if (error) throw error;
            if (data) {
                setProducts(data);
                const initialEdits: any = {};
                data.forEach(p => {
                    initialEdits[p.id] = {
                        sku: p.sku || '',
                        name: p.name || '',
                        cost: p.cost_without_vat || 0,
                        price: p.price || 0
                    };
                });
                setEditStates(initialEdits);
            }
        } catch (error: any) {
            console.error('Error fetching group products:', error);
            alert('Error al cargar repuestos del grupo: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (id: number, field: string, value: any) => {
        setEditStates(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                [field]: value
            }
        }));
    };

    const handleSaveQuickChanges = async () => {
        setLoading(true);
        try {
            for (const prod of products) {
                const edits = editStates[prod.id];
                if (!edits) continue;

                const hasChanges = edits.sku !== (prod.sku || '') ||
                                   edits.name !== (prod.name || '') ||
                                   edits.cost !== (prod.cost_without_vat || 0) ||
                                   edits.price !== (prod.price || 0);

                if (hasChanges) {
                    const { error } = await supabase
                        .from('products')
                        .update({
                            sku: edits.sku.toUpperCase(),
                            name: edits.name,
                            cost_without_vat: edits.cost,
                            price: edits.price,
                            last_edited_at: new Date().toISOString()
                        })
                        .eq('id', prod.id);

                    if (error) throw error;
                }
            }
            alert('Cambios rápidos guardados exitosamente.');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error saving quick changes:', error);
            alert('Error al guardar cambios rápidos: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const inputClass = "w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-primary focus:border-primary outline-none text-xs";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-700 my-8">
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                            <span className="material-symbols-outlined text-[24px]">link</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                Grupo de Repuestos Equivalentes
                            </h2>
                            <p className="text-xs text-slate-500">
                                Grupo: <span className="font-mono">{groupId.split('-')[0]}</span> — Mostrando {products.length} productos relacionados.
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Table content */}
                <div className="p-6 overflow-x-auto max-h-[60vh] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-3 w-12">Foto</th>
                                <th className="px-3 py-3 w-32">SKU</th>
                                <th className="px-3 py-3">Nombre</th>
                                <th className="px-3 py-3 w-28">Costo ($)</th>
                                <th className="px-3 py-3 w-28">PVP ($)</th>
                                <th className="px-3 py-3 w-24 text-center">Stock Total</th>
                                <th className="px-3 py-3 w-20 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                            {products.map(prod => {
                                const edits = editStates[prod.id] || { sku: '', name: '', cost: 0, price: 0 };
                                const isCurrent = prod.id === currentProduct?.id;
                                return (
                                    <tr key={prod.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${isCurrent ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                                        <td className="px-3 py-2">
                                            <div className="w-9 h-9 rounded border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 bg-slate-100 flex items-center justify-center shadow-sm">
                                                {prod.image_url ? (
                                                    <img src={getThumbnailUrl(prod.image_url, 40, 40)} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="material-symbols-outlined text-slate-400 text-base">image</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                type="text"
                                                className={`${inputClass} font-mono uppercase font-bold`}
                                                value={edits.sku}
                                                onChange={e => handleInputChange(prod.id, 'sku', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                type="text"
                                                className={inputClass}
                                                value={edits.name}
                                                onChange={e => handleInputChange(prod.id, 'name', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                className={inputClass}
                                                value={edits.cost}
                                                onChange={e => handleInputChange(prod.id, 'cost', parseFloat(e.target.value) || 0)}
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                className={`${inputClass} font-bold text-emerald-600 dark:text-emerald-400`}
                                                value={edits.price}
                                                onChange={e => handleInputChange(prod.id, 'price', parseFloat(e.target.value) || 0)}
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-center font-bold">
                                            {(prod.local_stock || 0) + (prod.importer_stock || 0)} u.
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <button
                                                type="button"
                                                onClick={() => onEditProduct(prod)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors inline-flex"
                                                title="Editar Detalle Completo"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer Actions */}
                <div className="p-5 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/30">
                    <div className="text-xs text-slate-500">
                        * Puedes modificar los datos directamente en la tabla y presionar <strong>Guardar Cambios Rápidos</strong>.
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose}
                            className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors font-medium text-xs">
                            Cerrar
                        </button>
                        <button type="button" onClick={handleSaveQuickChanges} disabled={loading}
                            className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg shadow-sm shadow-primary/30 transition-all font-medium text-xs flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                            {loading && <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>}
                            Guardar Cambios Rápidos
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
