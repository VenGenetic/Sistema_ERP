import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { getThumbnailUrl } from '../utils/image';

interface ProductGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: string | null;
    initialProduct: any;
    onEditProduct: (product: any) => void;
    onSuccess: () => void;
}

export const ProductGroupModal: React.FC<ProductGroupModalProps> = ({
    isOpen,
    onClose,
    groupId,
    initialProduct,
    onEditProduct,
    onSuccess
}) => {
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [editStates, setEditStates] = useState<{ [id: number]: { sku: string; name: string; cost: number; price: number } }>({});
    const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);

    // Search states
    const [searchQuery, setSearchQuery] = useState('');
    const [searchProducts, setSearchProducts] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    
    // Confirm link modal states
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [productToLink, setProductToLink] = useState<any>(null);
    const [productsToMerge, setProductsToMerge] = useState<any[]>([]);

    // Pending unlinks state
    const [pendingUnlinks, setPendingUnlinks] = useState<Set<number>>(new Set());

    useEffect(() => {
        setCurrentGroupId(groupId);
    }, [groupId]);

    useEffect(() => {
        if (isOpen) {
            fetchGroupProducts();
            setSearchQuery('');
            setSearchProducts([]);
            setPendingUnlinks(new Set());
        }
    }, [isOpen, currentGroupId]);

    const fetchGroupProducts = async () => {
        setLoading(true);
        try {
            if (!currentGroupId) {
                // If there is no group_id, just load the initialProduct in the group list
                setProducts([initialProduct]);
                setEditStates({
                    [initialProduct.id]: {
                        sku: initialProduct.sku || '',
                        name: initialProduct.name || '',
                        cost: initialProduct.cost_without_vat || 0,
                        price: initialProduct.price || 0
                    }
                });
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('products')
                .select('id, sku, name, image_url, group_id, cost_without_vat, price, local_stock, importer_stock')
                .eq('group_id', currentGroupId)
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

    // Fetch Products for the search table (filter on type)
    useEffect(() => {
        if (!isOpen) return;

        const fetchProducts = async () => {
            setIsSearching(true);
            try {
                // Exclude all currently listed products
                const excludedIds = products.map(p => p.id);
                let query = supabase
                    .from('products')
                    .select('id, sku, name, image_url, group_id, local_stock, importer_stock')
                    .eq('is_active', true)
                    .limit(10);
                
                if (excludedIds.length > 0) {
                    query = query.not('id', 'in', `(${excludedIds.join(',')})`);
                }
                
                if (searchQuery.trim() !== '') {
                    query = query.or(`sku.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`);
                }
                
                const { data } = await query;
                if (data) {
                    setSearchProducts(data);
                }
            } catch (error) {
                console.error('Error fetching search products:', error);
            } finally {
                setIsSearching(false);
            }
        };

        const timer = setTimeout(fetchProducts, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, products, isOpen]);

    const initiateLink = async (prod: any) => {
        setLoading(true);
        try {
            if (prod.group_id) {
                // Fetch all products in the target group
                const { data } = await supabase
                    .from('products')
                    .select('id, sku, name, image_url, group_id, local_stock, importer_stock')
                    .eq('group_id', prod.group_id);
                
                if (data && data.length > 0) {
                    setProductsToMerge(data);
                } else {
                    setProductsToMerge([prod]);
                }
            } else {
                setProductsToMerge([prod]);
            }
            setProductToLink(prod);
            setShowConfirmModal(true);
        } catch (error) {
            console.error('Error fetching group members:', error);
        } finally {
            setLoading(false);
        }
    };

    const confirmLink = () => {
        if (!productToLink) return;
        
        // Add all products to merge to linkedProducts locally
        setProducts(prev => {
            const next = [...prev];
            productsToMerge.forEach(pm => {
                if (!next.some(p => p.id === pm.id)) {
                    next.push(pm);
                }
            });
            return next;
        });

        // Initialize edit states for the newly linked products
        setEditStates(prev => {
            const next = { ...prev };
            productsToMerge.forEach(pm => {
                if (!next[pm.id]) {
                    next[pm.id] = {
                        sku: pm.sku || '',
                        name: pm.name || '',
                        cost: pm.cost_without_vat || 0,
                        price: pm.price || 0
                    };
                }
            });
            return next;
        });

        // Remove from pending unlinks if they were there
        setPendingUnlinks(prev => {
            const next = new Set(prev);
            productsToMerge.forEach(pm => next.delete(pm.id));
            return next;
        });

        setShowConfirmModal(false);
        setProductToLink(null);
        setProductsToMerge([]);
        setSearchQuery('');
    };

    const handleUnlink = (prodId: number) => {
        if (prodId === initialProduct?.id) {
            alert('No puedes desenlazar el producto actual desde su propio visor de grupo.');
            return;
        }
        if (!window.confirm('¿Estás seguro que deseas desenlazar este repuesto específico?')) return;
        
        setProducts(prev => prev.filter(p => p.id !== prodId));
        setPendingUnlinks(prev => {
            const next = new Set(prev);
            next.add(prodId);
            return next;
        });
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
            let targetGroupId = currentGroupId;

            // If we have linked products, but no group_id yet, generate/find one
            if (products.length > 1 && !targetGroupId) {
                const firstWithGroupId = products.find(p => p.group_id);
                targetGroupId = firstWithGroupId ? firstWithGroupId.group_id : crypto.randomUUID();
                setCurrentGroupId(targetGroupId);
            } else if (products.length <= 1 && targetGroupId) {
                // If only 1 product remains or none, clear group_id on all
                targetGroupId = null;
                setCurrentGroupId(null);
            }

            // 1. Update group_id for all current products in the table
            if (targetGroupId) {
                const productIds = products.map(p => p.id);
                const { error: groupError } = await supabase
                    .from('products')
                    .update({ group_id: targetGroupId })
                    .in('id', productIds);
                if (groupError) throw groupError;
            } else {
                // Clear group_id for remaining product
                const productIds = products.map(p => p.id);
                if (productIds.length > 0) {
                    const { error: clearGroupError } = await supabase
                        .from('products')
                        .update({ group_id: null })
                        .in('id', productIds);
                    if (clearGroupError) throw clearGroupError;
                }
            }

            // 2. Process unlinks: set group_id to null
            if (pendingUnlinks.size > 0) {
                const unlinkIds = Array.from(pendingUnlinks);
                const { error: unlinkError } = await supabase
                    .from('products')
                    .update({ group_id: null })
                    .in('id', unlinkIds);
                if (unlinkError) throw unlinkError;
            }

            // 3. Update product details (SKU, Name, Cost, PVP)
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

            alert('Cambios y relaciones guardados exitosamente.');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error saving quick changes:', error);
            alert('Error al guardar cambios: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const inputClass = "w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-primary focus:border-primary outline-none text-xs";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
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
                                {currentGroupId ? (
                                    <>Grupo: <span className="font-mono">{currentGroupId.split('-')[0]}</span> — Mostrando {products.length} productos relacionados.</>
                                ) : (
                                    <>Este repuesto no tiene equivalentes asignados actualmente.</>
                                )}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Search section */}
                <div className="px-6 pt-4 flex flex-col gap-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Buscar y enlazar repuestos equivalentes a este grupo
                    </label>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                        <input 
                            type="text" 
                            className="w-full pl-10 pr-4 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-primary focus:border-primary outline-none text-xs" 
                            placeholder="Buscar por SKU o Nombre..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {isSearching && <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin text-[16px]">progress_activity</span>}
                    </div>

                    {searchQuery.trim() !== '' && (
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-sm max-h-48 overflow-y-auto">
                            <table className="w-full text-left border-collapse text-[11px]">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase sticky top-0 z-10">
                                    <tr>
                                        <th className="px-3 py-2 w-10">Foto</th>
                                        <th className="px-3 py-2 w-28">SKU</th>
                                        <th className="px-3 py-2">Nombre</th>
                                        <th className="px-3 py-2 text-center w-20">Stock</th>
                                        <th className="px-3 py-2 text-right w-20">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                                    {searchProducts.map(prod => {
                                        const isLinked = products.some(p => p.id === prod.id);
                                        const totalStock = (prod.local_stock || 0) + (prod.importer_stock || 0);
                                        return (
                                            <tr key={prod.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-3 py-1.5">
                                                    <div className="w-7 h-7 rounded border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 bg-slate-100 flex items-center justify-center">
                                                        {prod.image_url ? (
                                                            <img src={prod.image_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="material-symbols-outlined text-slate-400 text-sm">image</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5 font-mono font-bold">{prod.sku}</td>
                                                <td className="px-3 py-1.5 truncate max-w-[200px]" title={prod.name}>{prod.name}</td>
                                                <td className="px-3 py-1.5 text-center font-semibold">{totalStock} u.</td>
                                                <td className="px-3 py-1.5 text-right">
                                                    {isLinked ? (
                                                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-955/30 px-2 py-0.5 rounded-full border border-emerald-200/30">
                                                            Enlazado
                                                        </span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => initiateLink(prod)}
                                                            className="px-2 py-1 bg-primary hover:bg-primary/95 text-white text-[10px] font-semibold rounded shadow-sm transition-colors inline-flex items-center gap-0.5"
                                                        >
                                                            <span className="material-symbols-outlined text-[11px]">link</span>
                                                            Enlazar
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {searchProducts.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="text-center py-4 text-slate-400">
                                                No se encontraron repuestos.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Table content */}
                <div className="p-6 overflow-x-auto max-h-[45vh] overflow-y-auto">
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">list</span>
                        Repuestos en este grupo ({products.length})
                    </h4>
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
                                const isCurrent = prod.id === initialProduct?.id;
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
                                            <div className="flex items-center justify-end gap-1">
                                                {products.length > 1 && prod.id !== initialProduct?.id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUnlink(prod.id)}
                                                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors inline-flex"
                                                        title="Desenlazar del Grupo"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">link_off</span>
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => onEditProduct(prod)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors inline-flex"
                                                    title="Editar Detalle Completo"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                                </button>
                                            </div>
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

            {/* Confirmation link modal */}
            {showConfirmModal && productToLink && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 bg-blue-50/50 dark:bg-blue-900/10">
                            <span className="material-symbols-outlined text-blue-500 text-[20px]">info</span>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Confirmar Enlace</h3>
                        </div>
                        <div className="p-5">
                            <p className="text-slate-700 dark:text-slate-300 mb-3 text-xs font-semibold">
                                ¿Estás seguro que quieres enlazar estos productos?
                            </p>
                            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-lg text-[11px] mb-4">
                                <strong>Nota importante:</strong> Esto hará que todos estos productos (y todos los que ya estén vinculados a ellos) se enlacen de forma bidireccional formando un único grupo.
                            </div>
                            
                            <div className="max-h-40 overflow-y-auto space-y-2 mb-5 pr-1">
                                {productsToMerge.map(pm => {
                                    const totalStock = (pm.local_stock || 0) + (pm.importer_stock || 0);
                                    return (
                                        <div key={pm.id} className="flex items-center gap-2.5 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs">
                                            <div className="w-8 h-8 rounded border border-slate-200 bg-white overflow-hidden shrink-0">
                                                {pm.image_url ? (
                                                    <img src={pm.image_url} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-slate-400 text-sm">image</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                                    {pm.sku}
                                                    <span className="text-[10px] text-slate-500 font-normal">(Stock: {totalStock} u.)</span>
                                                </div>
                                                <div className="text-[9px] text-slate-500 truncate max-w-[220px]">{pm.name}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            
                            <div className="flex justify-end gap-2.5">
                                <button type="button" onClick={() => { setShowConfirmModal(false); setProductToLink(null); setProductsToMerge([]); }} className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors">
                                    Cancelar
                                </button>
                                <button type="button" onClick={confirmLink} className="px-4 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow transition-colors flex items-center gap-1.5">
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
