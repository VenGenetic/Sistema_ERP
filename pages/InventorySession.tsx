import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Save, Trash2, AlertTriangle, CheckCircle, Search, Minus, Plus, Loader2, X, Package } from 'lucide-react';

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
    const [lastInteractedId, setLastInteractedId] = useState<string | null>(null);
    
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
            setLastInteractedId(existingItem.id);
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
                
                setLastInteractedId(newItem.id);
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
        
        setLastInteractedId(itemId);
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
        if (lastInteractedId === itemId) setLastInteractedId(null);
        setItems(prev => prev.filter(i => i.id !== itemId));
        await supabase.from('inventory_group_items').delete().eq('id', itemId);
    };

    useEffect(() => {
        const query = searchQuery.trim();
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        const timer = setTimeout(() => {
            const executeSearch = async () => {
                setIsSearching(true);
                try {
                    const { data, error } = await supabase
                        .from('products')
                        .select('id, sku, name')
                        .or(`sku.ilike.%${query}%,name.ilike.%${query}%`)
                        .limit(20);
                    if (error) throw error;
                    setSearchResults(data || []);
                } catch (err) {
                    console.error('Error in interactive search:', err);
                } finally {
                    setIsSearching(false);
                }
            };
            executeSearch();
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSearchAdd = async () => {
        const query = searchQuery.trim();
        if (!query) return;
        setIsSearching(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, sku, name')
                .or(`sku.ilike.%${query}%,name.ilike.%${query}%`)
                .limit(20);
            if (error) throw error;
            setSearchResults(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddProductFromSearch = async (product: any) => {
        if (items.some(i => String(i.product_id) === String(product.id) || i.product?.sku?.trim().toLowerCase() === product.sku?.trim().toLowerCase())) {
            alert('El repuesto ya está en este grupo de inventario.');
            return;
        }

        try {
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
            setLastInteractedId(newItem.id);
            setItems(prev => [...prev, { ...newItem, last_updated: Date.now() } as unknown as GroupItem]);
        } catch (error: any) {
            console.error('Error al añadir repuesto:', error);
            alert('No se pudo añadir el repuesto: ' + error.message);
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
            navigate('/inventory-mode');

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

    const renderColumn = (
        title: string, 
        list: typeof processedItems, 
        type: 'faltantes' | 'sobrantes' | 'cuadrados'
    ) => {
        const themeConfig = {
            faltantes: {
                border: 'border-rose-500',
                headerBg: 'bg-rose-50/80 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/80',
                icon: <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />,
                badge: 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300'
            },
            sobrantes: {
                border: 'border-amber-500',
                headerBg: 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/80',
                icon: <Plus className="w-5 h-5 text-amber-500 shrink-0" />,
                badge: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
            },
            cuadrados: {
                border: 'border-emerald-500',
                headerBg: 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80',
                icon: <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />,
                badge: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
            }
        }[type];

        return (
            <div className="flex flex-col h-[740px] bg-slate-100/70 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                {/* Column Header */}
                <div className={`flex items-center justify-between px-4 py-3.5 border-b border-t-4 ${themeConfig.border} ${themeConfig.headerBg} shrink-0`}>
                    <div className="flex items-center gap-2.5 font-extrabold text-sm md:text-base">
                        {themeConfig.icon}
                        <span>{title}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${themeConfig.badge}`}>
                        {list.length}
                    </span>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {list.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm p-6 text-center italic">
                            No hay repuestos en esta categoría.
                        </div>
                    ) : (
                        list.map(item => {
                            const isLastInteracted = item.id === lastInteractedId;
                            return (
                                <div
                                    key={item.id}
                                    className={`rounded-xl transition-all duration-300 ${
                                        isLastInteracted
                                            ? 'bg-cyan-50/90 dark:bg-cyan-950/60 border-2 border-cyan-500 dark:border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.4)] ring-2 ring-cyan-400/80'
                                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 shadow-xs'
                                    } overflow-hidden`}
                                >
                                    {isLastInteracted && (
                                        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-500 dark:to-blue-500 text-white px-3 py-1 text-[11px] font-black tracking-wider uppercase flex items-center justify-between shadow-sm">
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-white animate-pulse shadow-sm" />
                                                ⭐ ÚLTIMO ESCANEADO / AÑADIDO
                                            </span>
                                            <span className="text-[10px] font-semibold bg-black/20 px-2 py-0.5 rounded">Activo</span>
                                        </div>
                                    )}
                                    <div className="p-3.5">
                                        {/* Top: Description with wrap and Delete button */}
                                        <div className="flex items-start justify-between gap-2 mb-2.5">
                                            <div className="min-w-0 flex-1">
                                                <div className="font-extrabold text-slate-800 dark:text-slate-100 text-xs md:text-sm whitespace-normal break-words leading-tight">
                                                    {item.product.name}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                    <span className="text-slate-600 dark:text-slate-300 font-mono font-bold text-xs bg-slate-100 dark:bg-slate-700/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                                                        {item.product.sku}
                                                    </span>
                                                    {item.is_manually_added && (
                                                        <span className="bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                            Manual
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveItem(item.id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
                                                title="Quitar del grupo"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Bottom: Controls & Metrics */}
                                        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-700/60 grid grid-cols-3 gap-2 items-center text-center">
                                            <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Teórico</span>
                                                <span className="font-extrabold text-sm text-slate-700 dark:text-slate-300 font-mono">
                                                    {item.theoretical}
                                                </span>
                                            </div>

                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">Contado</span>
                                                <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700 shadow-2xs">
                                                    <button
                                                        onClick={() => updateItemCount(item.id, item.product_id, item.counted_stock > 0 ? -1 : 0)}
                                                        className="w-6 h-6 flex items-center justify-center hover:bg-white dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 transition-all font-bold active:scale-95"
                                                        title="Disminuir conteo"
                                                    >
                                                        <Minus className="w-3 h-3" />
                                                    </button>
                                                    <span className="font-black text-sm w-7 text-center text-slate-900 dark:text-white font-mono">
                                                        {item.counted_stock}
                                                    </span>
                                                    <button
                                                        onClick={() => updateItemCount(item.id, item.product_id, 1)}
                                                        className="w-6 h-6 flex items-center justify-center hover:bg-white dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 transition-all font-bold active:scale-95"
                                                        title="Aumentar conteo"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Diferencia</span>
                                                <span className={`font-black text-sm font-mono ${item.diff < 0 ? 'text-rose-500' : item.diff > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                    {item.diff > 0 ? '+' : ''}{item.diff}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    };

    if (loading && !group) return <div className="p-12 text-center text-slate-500">Cargando sesión...</div>;

    return (
        <div className="p-4 md:p-6 w-full max-w-[1700px] mx-auto flex flex-col min-h-[calc(100vh-6rem)]">
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
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Package className="w-4 h-4 text-primary" />
                            Añadir repuestos del catálogo al grupo
                        </h3>
                        <span className="text-xs text-slate-500">Búsqueda en tiempo real por Código o Nombre</span>
                    </div>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearchAdd()}
                            placeholder="Escribe el código (SKU) o nombre de repuesto..."
                            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none dark:text-white text-sm transition-all placeholder:text-slate-400"
                        />
                        {isSearching ? (
                            <Loader2 className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                        ) : searchQuery ? (
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    setSearchResults([]);
                                }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md transition-colors"
                                title="Limpiar búsqueda"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        ) : null}
                    </div>
                    {searchResults.length > 0 && (
                        <div className="mt-3 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto bg-white dark:bg-slate-900/90 shadow-sm">
                            {searchResults.map(res => {
                                const existingItem = items.find(i => String(i.product_id) === String(res.id) || i.product?.sku?.trim().toLowerCase() === res.sku?.trim().toLowerCase());
                                return (
                                    <div key={res.id} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-semibold px-2 py-0.5 rounded text-xs border border-slate-200 dark:border-slate-700 shrink-0">
                                                    {res.sku}
                                                </span>
                                                <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
                                                    {res.name}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="shrink-0">
                                            {existingItem ? (
                                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 font-medium text-xs">
                                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                    <span>Ya en grupo ({existingItem.counted_stock} contados)</span>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleAddProductFromSearch(res)}
                                                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    <span>Añadir al grupo</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
                        <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-xs text-slate-500 dark:text-slate-400">
                            No se encontraron repuestos con código o nombre "{searchQuery.trim()}" en el catálogo.
                        </div>
                    )}
                </div>
            </div>

            {/* 3-COLUMN GRID DISPLAY (FALTANTES, SOBRANTES, CUADRADOS) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {renderColumn('Faltantes', faltantes, 'faltantes')}
                {renderColumn('Sobrantes', sobrantes, 'sobrantes')}
                {renderColumn('Cuadrados', cuadrados, 'cuadrados')}
            </div>
        </div>
    );
};
