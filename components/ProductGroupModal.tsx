import React, { useState, useEffect } from 'react';
import { useBackDismiss } from '../hooks/useBackDismiss';
import { supabase } from '../supabaseClient';
import { getThumbnailUrl } from '../utils/image';
import {
  Image as ImageIcon,
  Info,
  Link as LinkIcon,
  Link2Off,
  List,
  Loader2,
  Pencil,
  Search,
  X,
} from 'lucide-react';

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

    // El «atrás» del teléfono cierra este modal en vez de dejar la pantalla.
    useBackDismiss(isOpen, onClose);

    if (!isOpen) return null;

    const inputClass = "w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-primary focus:border-primary outline-none text-xs";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-surface rounded-xl shadow-lg w-full max-w-4xl overflow-hidden border border-subtle my-8">
                {/* Header */}
                <div className="p-5 border-b border-subtle flex justify-between items-center bg-surface-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-soft text-primary-soft-fg rounded-lg">
                            <LinkIcon size={24} aria-hidden="true" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-fg">
                                Grupo de Repuestos Equivalentes
                            </h2>
                            <p className="text-xs text-fg-muted">
                                {currentGroupId ? (
                                    <>Grupo: <span className="font-mono">{currentGroupId.split('-')[0]}</span> — Mostrando {products.length} productos relacionados.</>
                                ) : (
                                    <>Este repuesto no tiene equivalentes asignados actualmente.</>
                                )}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-fg-subtle hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                {/* Search section */}
                <div className="px-6 pt-4 flex flex-col gap-2">
                    <label className="block text-xs font-semibold text-fg">
                        Buscar y enlazar repuestos equivalentes a este grupo
                    </label>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
                        <input 
                            type="text" 
                            className="w-full pl-10 pr-4 py-1.5 bg-surface-2 border border-strong rounded focus:ring-1 focus:ring-primary focus:border-primary outline-none text-xs" 
                            placeholder="Buscar por SKU o Nombre..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {isSearching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle animate-spin" aria-hidden="true" />}
                    </div>

                    {searchQuery.trim() !== '' && (
                        <div className="border border-subtle rounded-lg overflow-hidden bg-surface shadow-sm max-h-48 overflow-y-auto">
                            <table className="w-full text-left border-collapse text-[11px]">
                                <thead className="bg-surface-2 text-fg-muted font-semibold uppercase sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-2.5 w-10">Foto</th>
                                        <th className="px-4 py-2.5 w-28">SKU</th>
                                        <th className="px-4 py-2.5">Nombre</th>
                                        <th className="px-4 py-2.5 text-center w-20">Stock</th>
                                        <th className="px-4 py-2.5 text-right w-20">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-fg">
                                    {searchProducts.map(prod => {
                                        const isLinked = products.some(p => p.id === prod.id);
                                        const totalStock = (prod.local_stock || 0) + (prod.importer_stock || 0);
                                        return (
                                            <tr key={prod.id} className="hover:bg-surface-hover transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="w-7 h-7 rounded border border-subtle overflow-hidden shrink-0 bg-slate-100 flex items-center justify-center">
                                                        {prod.image_url ? (
                                                            <img src={prod.image_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <ImageIcon size={14} className="text-fg-subtle" aria-hidden="true" />
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 font-mono font-bold">{prod.sku}</td>
                                                <td className="px-4 py-3 truncate max-w-[200px]" title={prod.name}>{prod.name}</td>
                                                <td className="px-4 py-3 text-center font-semibold">{totalStock} u.</td>
                                                <td className="px-4 py-3 text-right">
                                                    {isLinked ? (
                                                        <span className="text-2xs font-semibold text-success-soft-fg bg-success-soft px-2 py-0.5 rounded-full border border-success/20">
                                                            Enlazado
                                                        </span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => initiateLink(prod)}
                                                            className="px-2 py-1 bg-primary hover:bg-primary/95 text-white text-2xs font-semibold rounded shadow-sm transition-colors inline-flex items-center gap-0.5"
                                                        >
                                                            <LinkIcon size={11} aria-hidden="true" />
                                                            Enlazar
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {searchProducts.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="text-center py-4 text-fg-subtle">
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
                    <h4 className="text-xs font-semibold text-fg mb-2 flex items-center gap-1.5">
                        <List size={16} aria-hidden="true" />
                        Repuestos en este grupo ({products.length})
                    </h4>
                    <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-surface-2 text-fg-muted font-semibold uppercase sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-2.5 w-12">Foto</th>
                                <th className="px-4 py-2.5 w-32">SKU</th>
                                <th className="px-4 py-2.5">Nombre</th>
                                <th className="px-4 py-2.5 w-28">Costo ($)</th>
                                <th className="px-4 py-2.5 w-28">PVP ($)</th>
                                <th className="px-4 py-2.5 w-24 text-center">Stock Total</th>
                                <th className="px-4 py-2.5 w-20 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-fg">
                            {products.map(prod => {
                                const edits = editStates[prod.id] || { sku: '', name: '', cost: 0, price: 0 };
                                const isCurrent = prod.id === initialProduct?.id;
                                return (
                                    <tr key={prod.id} className={`hover:bg-surface-hover transition-colors ${isCurrent ? 'bg-primary-soft/30 dark:bg-primary/10' : ''}`}>
                                        <td className="px-4 py-3">
                                            <div className="w-9 h-9 rounded border border-subtle overflow-hidden shrink-0 bg-slate-100 flex items-center justify-center shadow-sm">
                                                {prod.image_url ? (
                                                    <img src={getThumbnailUrl(prod.image_url, 40, 40)} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <ImageIcon size={16} className="text-fg-subtle" aria-hidden="true" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                className={`${inputClass} font-mono uppercase font-bold`}
                                                value={edits.sku}
                                                onChange={e => handleInputChange(prod.id, 'sku', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                className={inputClass}
                                                value={edits.name}
                                                onChange={e => handleInputChange(prod.id, 'name', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="number"
                                                step="0.01"
                                                className={inputClass}
                                                value={edits.cost}
                                                onChange={e => handleInputChange(prod.id, 'cost', parseFloat(e.target.value) || 0)}
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="number"
                                                step="0.01"
                                                className={`${inputClass} font-bold text-success`}
                                                value={edits.price}
                                                onChange={e => handleInputChange(prod.id, 'price', parseFloat(e.target.value) || 0)}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold">
                                            {(prod.local_stock || 0) + (prod.importer_stock || 0)} u.
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {products.length > 1 && prod.id !== initialProduct?.id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUnlink(prod.id)}
                                                        className="p-1.5 text-fg-subtle hover:text-danger hover:bg-danger-soft rounded-lg transition-colors inline-flex"
                                                        title="Desenlazar del Grupo"
                                                    >
                                                        <Link2Off size={16} aria-hidden="true" />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => onEditProduct(prod)}
                                                    className="p-1.5 text-fg-subtle hover:text-primary hover:bg-primary-soft rounded-lg transition-colors inline-flex"
                                                    title="Editar Detalle Completo"
                                                >
                                                    <Pencil size={16} aria-hidden="true" />
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
                <div className="p-5 border-t border-subtle flex justify-between items-center bg-surface-2">
                    <div className="text-xs text-fg-muted">
                        * Puedes modificar los datos directamente en la tabla y presionar <strong>Guardar Cambios Rápidos</strong>.
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose}
                            className="px-4 py-2 text-fg hover:bg-surface-hover rounded-lg transition-colors font-medium text-xs">
                            Cerrar
                        </button>
                        <button type="button" onClick={handleSaveQuickChanges} disabled={loading}
                            className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg shadow-sm shadow-primary/30 transition-all font-medium text-xs flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                            {loading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                            Guardar Cambios Rápidos
                        </button>
                    </div>
                </div>
            </div>

            {/* Confirmation link modal */}
            {showConfirmModal && productToLink && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-surface rounded-xl shadow-lg w-full max-w-md overflow-hidden border border-subtle animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-subtle flex items-center gap-3 bg-primary-soft/50">
                            <Info size={20} className="text-primary" aria-hidden="true" />
                            <h3 className="text-base font-bold text-fg">Confirmar Enlace</h3>
                        </div>
                        <div className="p-5">
                            <p className="text-fg mb-3 text-xs font-semibold">
                                ¿Estás seguro que quieres enlazar estos productos?
                            </p>
                            <div className="bg-warning-soft border border-warning/20 text-warning-soft-fg p-2.5 rounded-lg text-[11px] mb-4">
                                <strong>Nota importante:</strong> Esto hará que todos estos productos (y todos los que ya estén vinculados a ellos) se enlacen de forma bidireccional formando un único grupo.
                            </div>
                            
                            <div className="max-h-40 overflow-y-auto space-y-2 mb-5 pr-1">
                                {productsToMerge.map(pm => {
                                    const totalStock = (pm.local_stock || 0) + (pm.importer_stock || 0);
                                    return (
                                        <div key={pm.id} className="flex items-center gap-2.5 p-2 bg-surface-2 border border-subtle rounded-lg shadow-xs">
                                            <div className="w-8 h-8 rounded border border-subtle bg-white overflow-hidden shrink-0">
                                                {pm.image_url ? (
                                                    <img src={pm.image_url} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                                                        <ImageIcon size={14} className="text-fg-subtle" aria-hidden="true" />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-bold text-fg flex items-center gap-1.5">
                                                    {pm.sku}
                                                    <span className="text-2xs text-fg-muted font-normal">(Stock: {totalStock} u.)</span>
                                                </div>
                                                <div className="text-[12px] text-fg-muted truncate max-w-[220px]">{pm.name}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            
                            <div className="flex justify-end gap-2.5">
                                <button type="button" onClick={() => { setShowConfirmModal(false); setProductToLink(null); setProductsToMerge([]); }} className="px-3.5 py-1.5 text-xs font-semibold text-fg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors">
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
