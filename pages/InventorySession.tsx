import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Save, Trash2, AlertTriangle, CheckCircle, Search, Minus, Plus } from 'lucide-react';

interface GroupItem {
    id: string;
    product_id: number;
    counted_stock: number;
    is_manually_added: boolean;
    last_updated?: number; // local timestamp for sorting
    product: {
        sku: string;
        name: string;
        inventory_levels: { current_stock: number; warehouse_id: number }[];
    };
}

export const InventorySession: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [group, setGroup] = useState<any>(null);
    const [items, setItems] = useState<GroupItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanSku, setScanSku] = useState('');
    const scanInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<'faltantes' | 'sobrantes' | 'cuadrados'>('faltantes');
    
    // Add product state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        fetchSessionData();
    }, [id]);

    const fetchSessionData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Group
            const { data: groupData, error: groupError } = await supabase
                .from('inventory_groups')
                .select('*')
                .eq('id', id)
                .single();
            if (groupError) throw groupError;

            // Rule of 24 hours
            const lastCounted = new Date(groupData.last_counted_at).getTime();
            const now = new Date().getTime();
            if (now - lastCounted > 24 * 60 * 60 * 1000) {
                alert("Han pasado más de 24 horas desde el último conteo. Se recomienda resetear el grupo para asegurar que la comparativa con el stock teórico sea válida.");
            }

            setGroup(groupData);

            // 2. Fetch Items with fresh inventory levels
            const { data: itemsData, error: itemsError } = await supabase
                .from('inventory_group_items')
                .select(`
                    id, 
                    product_id, 
                    counted_stock, 
                    is_manually_added,
                    product:products (
                        sku, 
                        name,
                        inventory_levels (current_stock, warehouse_id)
                    )
                `)
                .eq('group_id', id);

            if (itemsError) throw itemsError;
            const mappedItems = (itemsData || []).map((i: any) => ({
                ...i,
                last_updated: 0
            }));
            setItems(mappedItems as unknown as GroupItem[] || []);
        } catch (error: any) {
            console.error('Error fetching session:', error);
            alert('Error al cargar la sesión: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Fix focus loss for scanners
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            const activeTag = document.activeElement?.tagName.toLowerCase();
            // Allow native typing in other inputs
            if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
                return;
            }
            // Ignore shortcuts
            if (e.ctrlKey || e.metaKey || e.altKey) {
                return;
            }
            // If they type a character or hit Enter, focus the scanner
            if (e.key.length === 1 || e.key === 'Enter') {
                scanInputRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    // Calculate theoretical stock
    const getTheoreticalStock = (product: any, warehouseId: number) => {
        if (!product?.inventory_levels) return 0;
        // If warehouse_id is set in group, filter by it, else sum all (assuming single global for now if not set)
        const levels = warehouseId ? product.inventory_levels.filter((l: any) => l.warehouse_id === warehouseId) : product.inventory_levels;
        return levels.reduce((sum: number, l: any) => sum + (l.current_stock || 0), 0);
    };

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        const skuToFind = scanSku.trim();
        if (!skuToFind) return;
        setScanSku('');

        // 1. Check local state to see if it's already there (case-insensitive)
        const existingItem = items.find(i => i.product.sku.toLowerCase() === skuToFind.toLowerCase());

        if (existingItem) {
            // Functional state update to avoid closure staleness (Race condition fix)
            setItems(prev => prev.map(i => i.id === existingItem.id ? { ...i, counted_stock: i.counted_stock + 1, last_updated: Date.now() } : i));
            
            // Increment natively in the database via RPC (fire and forget)
            supabase.rpc('increment_inventory_group_item', {
                p_group_id: id,
                p_product_id: existingItem.product_id,
                p_amount: 1
            }).then();
        } else {
            // Not in group, check if exists in DB
            try {
                const { data: prodData, error: prodError } = await supabase
                    .from('products')
                    .select('id, sku, name, inventory_levels(current_stock, warehouse_id)')
                    .ilike('sku', skuToFind)
                    .single();
                
                if (prodError || !prodData) {
                    alert(`El SKU "${skuToFind}" no existe en el sistema. No se puede agregar.`);
                    return;
                }

                // Add to DB using the RPC which inserts securely (handles ON CONFLICT)
                await supabase.rpc('increment_inventory_group_item', {
                    p_group_id: id,
                    p_product_id: prodData.id,
                    p_amount: 1
                });
                
                // Fetch the new/updated item back
                const { data: newItem, error: fetchError } = await supabase
                    .from('inventory_group_items')
                    .select(`
                        id, 
                        product_id, 
                        counted_stock, 
                        is_manually_added,
                        product:products (
                            sku, 
                            name,
                            inventory_levels (current_stock, warehouse_id)
                        )
                    `)
                    .eq('group_id', id)
                    .eq('product_id', prodData.id)
                    .single();
                
                if (fetchError) throw fetchError;
                
                setItems(prev => {
                    // Double check if another scan inserted it locally while we were awaiting
                    if (prev.some(i => i.product_id === prodData.id)) {
                        return prev.map(i => i.product_id === prodData.id ? { ...i, counted_stock: newItem.counted_stock, last_updated: Date.now() } : i);
                    }
                    return [...prev, { ...newItem, last_updated: Date.now() } as unknown as GroupItem];
                });

            } catch (err) {
                console.error(err);
                alert('Error al buscar el producto.');
            }
        }
        
        // Force focus back
        if (scanInputRef.current) {
            scanInputRef.current.focus();
        }
    };

    const updateItemCount = async (itemId: string, productId: number, amountChange: number) => {
        if (amountChange === 0) return;
        
        // Functional state update
        setItems(prev => {
            const item = prev.find(i => i.id === itemId);
            if (!item) return prev;
            const newCount = Math.max(0, item.counted_stock + amountChange);
            return prev.map(i => i.id === itemId ? { ...i, counted_stock: newCount, last_updated: Date.now() } : i);
        });
        
        // Let DB handle atomic increment
        await supabase.rpc('increment_inventory_group_item', {
            p_group_id: id,
            p_product_id: productId,
            p_amount: amountChange
        });
    };

    const handleRemoveItem = async (itemId: string) => {
        if(!window.confirm("¿Quitar producto del grupo?")) return;
        setItems(prev => prev.filter(i => i.id !== itemId));
        await supabase.from('inventory_group_items').delete().eq('id', itemId);
    };

    const handleSearchAdd = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, sku, name')
                .ilike('name', `%${searchQuery}%`)
                .limit(10);
            if (error) throw error;
            setSearchResults(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddProductFromSearch = async (product: any) => {
        if (items.some(i => i.product_id === product.id)) {
            alert('El producto ya está en el grupo.');
            return;
        }

        try {
            const { data: prodData } = await supabase
                .from('products')
                .select('id, sku, name, inventory_levels(current_stock, warehouse_id)')
                .eq('id', product.id)
                .single();

            const { data: newItem, error: insertError } = await supabase
                .from('inventory_group_items')
                .insert({
                    group_id: id,
                    product_id: product.id,
                    counted_stock: 0,
                    is_manually_added: true
                })
                .select(`
                    id, product_id, counted_stock, is_manually_added,
                    product:products (sku, name, inventory_levels (current_stock, warehouse_id))
                `)
                .single();
                
            if (insertError) throw insertError;
            setItems(prev => [...prev, { ...newItem, last_updated: Date.now() } as unknown as GroupItem]);
            setSearchResults([]);
            setSearchQuery('');
        } catch (error) {
            console.error(error);
        }
    };

    const handleFinalize = async () => {
        if(!window.confirm("¿Finalizar conteo y ajustar el inventario en el sistema? Esto aplicará los cambios al stock real.")) return;
        
        try {
            setLoading(true);
            const { data: userData } = await supabase.auth.getUser();
            const userId = userData.user?.id;

            // Iterate items and adjust
            for (const item of items) {
                const theoretical = getTheoreticalStock(item.product, group.warehouse_id);
                const diff = item.counted_stock - theoretical;
                
                if (diff !== 0) {
                    // Update inventory_levels
                    // Fetch existing level
                    const { data: levelData } = await supabase
                        .from('inventory_levels')
                        .select('id, current_stock')
                        .eq('product_id', item.product_id)
                        // Note: If warehouse_id is null on group, we assume a default warehouse, but for now we take the first or null.
                        // In a real scenario, warehouse_id should be required on the group.
                        .limit(1)
                        .single();
                    
                    if (levelData) {
                        await supabase
                            .from('inventory_levels')
                            .update({ 
                                current_stock: item.counted_stock,
                                last_updated: new Date().toISOString()
                            })
                            .eq('id', levelData.id);
                    } else {
                        // Create level if didn't exist
                        const defaultWarehouseId = group.warehouse_id || 1; // Fallback
                        await supabase
                            .from('inventory_levels')
                            .insert({
                                product_id: item.product_id,
                                warehouse_id: defaultWarehouseId,
                                current_stock: item.counted_stock
                            });
                    }

                    // Insert log
                    await supabase
                        .from('inventory_logs')
                        .insert({
                            product_id: item.product_id,
                            warehouse_id: group.warehouse_id || 1,
                            quantity_change: diff,
                            reason: `Ajuste Modo Inventario - Grupo: ${group.name}`,
                            user_id: userId,
                            reference_type: 'inventory_mode',
                            reference_id: id
                        });
                }
            }

            // Reset counted stock in group
            await supabase.from('inventory_group_items').update({ counted_stock: 0 }).eq('group_id', id);
            await supabase.from('inventory_groups').update({ last_counted_at: new Date().toISOString() }).eq('id', id);
            
            alert('Inventario actualizado correctamente. Los conteos del grupo han sido encerados.');
            fetchSessionData();

        } catch (error: any) {
            console.error('Error finalizando:', error);
            alert('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Derived state for tabs
    const processedItems = useMemo(() => {
        return items.map(item => {
            const theoretical = getTheoreticalStock(item.product, group?.warehouse_id);
            return {
                ...item,
                theoretical,
                diff: item.counted_stock - theoretical
            };
        }).sort((a, b) => (b.last_updated || 0) - (a.last_updated || 0));
    }, [items, group]);

    const faltantes = processedItems.filter(i => i.diff < 0);
    const sobrantes = processedItems.filter(i => i.diff > 0);
    const cuadrados = processedItems.filter(i => i.diff === 0);

    const activeList = activeTab === 'faltantes' ? faltantes : activeTab === 'sobrantes' ? sobrantes : cuadrados;

    if (loading && !group) return <div className="p-12 text-center text-slate-500">Cargando sesión...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto flex flex-col h-[calc(100vh-6rem)]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/inventory-mode')} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-600 dark:text-slate-300">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{group?.name}</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Total ítems: {items.length}</p>
                    </div>
                </div>
                <button
                    onClick={handleFinalize}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-emerald-500/25"
                >
                    <Save className="w-5 h-5" />
                    Finalizar y Aplicar
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
                <form onSubmit={handleScan} className="flex gap-4 mb-6">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Escanear Código de Barras (SKU)</label>
                        <input
                            ref={scanInputRef}
                            type="text"
                            value={scanSku}
                            onChange={e => setScanSku(e.target.value)}
                            placeholder="Escanea aquí..."
                            autoFocus
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/20 outline-none transition-all dark:text-white font-mono text-lg"
                        />
                    </div>
                    <button type="submit" className="self-end px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors">
                        Escanear
                    </button>
                </form>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">Añadir producto manualmente al grupo:</h3>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearchAdd()}
                            placeholder="Buscar por nombre..."
                            className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary outline-none dark:text-white"
                        />
                        <button onClick={handleSearchAdd} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                            <Search className="w-5 h-5" />
                        </button>
                    </div>
                    {searchResults.length > 0 && (
                        <div className="mt-2 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-40 overflow-y-auto">
                            {searchResults.map(res => (
                                <div key={res.id} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <div>
                                        <div className="font-medium text-sm dark:text-slate-200">{res.name}</div>
                                        <div className="text-xs text-slate-500 font-mono">{res.sku}</div>
                                    </div>
                                    <button onClick={() => handleAddProductFromSearch(res)} className="p-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-colors">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* TABS */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6">
                <button
                    onClick={() => setActiveTab('faltantes')}
                    className={`flex items-center gap-2 pb-4 px-6 font-medium text-sm transition-colors relative ${activeTab === 'faltantes' ? 'text-rose-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    <AlertTriangle className="w-4 h-4" />
                    Faltantes ({faltantes.length})
                    {activeTab === 'faltantes' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-rose-500 rounded-t-full"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('sobrantes')}
                    className={`flex items-center gap-2 pb-4 px-6 font-medium text-sm transition-colors relative ${activeTab === 'sobrantes' ? 'text-amber-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    <Plus className="w-4 h-4" />
                    Sobrantes ({sobrantes.length})
                    {activeTab === 'sobrantes' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500 rounded-t-full"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('cuadrados')}
                    className={`flex items-center gap-2 pb-4 px-6 font-medium text-sm transition-colors relative ${activeTab === 'cuadrados' ? 'text-emerald-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    <CheckCircle className="w-4 h-4" />
                    Cuadrados ({cuadrados.length})
                    {activeTab === 'cuadrados' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-t-full"></div>}
                </button>
            </div>

            <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/90 backdrop-blur z-10">
                            <tr className="text-slate-500 dark:text-slate-400 text-sm tracking-wider">
                                <th className="px-6 py-4 font-medium uppercase">Producto</th>
                                <th className="px-6 py-4 font-medium uppercase text-center">Teórico</th>
                                <th className="px-6 py-4 font-medium uppercase text-center">Contado</th>
                                <th className="px-6 py-4 font-medium uppercase text-center">Diferencia</th>
                                <th className="px-6 py-4 font-medium uppercase text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {activeList.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-800 dark:text-slate-200">{item.product.name}</div>
                                        <div className="text-xs text-slate-500 font-mono mt-1">{item.product.sku}</div>
                                        {item.is_manually_added && (
                                            <span className="inline-block mt-1 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                AÑADIDO MANUALMENTE
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center font-medium text-slate-600 dark:text-slate-400">
                                        {item.theoretical}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-3">
                                            <button 
                                                onClick={() => updateItemCount(item.id, item.product_id, item.counted_stock > 0 ? -1 : 0)}
                                                className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors text-slate-600 dark:text-slate-300"
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>
                                            <span className="font-bold text-lg w-8 text-center text-slate-800 dark:text-slate-200">
                                                {item.counted_stock}
                                            </span>
                                            <button 
                                                onClick={() => updateItemCount(item.id, item.product_id, 1)}
                                                className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors text-slate-600 dark:text-slate-300"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center font-bold">
                                        <span className={item.diff < 0 ? 'text-rose-500' : item.diff > 0 ? 'text-amber-500' : 'text-emerald-500'}>
                                            {item.diff > 0 ? '+' : ''}{item.diff}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleRemoveItem(item.id)}
                                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors inline-flex"
                                            title="Quitar del grupo"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {activeList.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                        No hay productos en esta sección.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
