import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Save, Trash2, AlertTriangle, CheckCircle, Search, Minus, Plus, Loader2, X, Package, ShieldCheck, AlertCircle, Clock, Calendar, Check, SaveAll, Info } from 'lucide-react';

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
    const [deletedIds, setDeletedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingWithoutApply, setSavingWithoutApply] = useState(false);
    const [scanSku, setScanSku] = useState('');
    const scanInputRef = useRef<HTMLInputElement>(null);
    const [lastInteractedId, setLastInteractedId] = useState<string | null>(null);
    
    // Unsaved changes tracking & UI feedbacks
    const [isDirty, setIsDirty] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);
    const [savedToast, setSavedToast] = useState(false);
    const [sessionExpiredWarning, setSessionExpiredWarning] = useState(false);

    // Add product state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        fetchSessionData();
    }, [id]);

    const fetchSessionData = async () => {
        setLoading(true);
        setIsDirty(false);
        setDeletedIds([]);
        try {
            // 1. Fetch Group with interval and session timestamps
            const { data: groupData, error: groupError } = await supabase
                .from('inventory_groups')
                .select('*')
                .eq('id', id)
                .single();
            if (groupError) throw groupError;

            // Rule of 24 hours (check from session_started_at, fallback to last_counted_at)
            const refTime = groupData.session_started_at ? new Date(groupData.session_started_at).getTime() : new Date(groupData.last_counted_at).getTime();
            const now = new Date().getTime();
            const isExpired = (now - refTime) > (24 * 60 * 60 * 1000);
            if (isExpired) {
                setSessionExpiredWarning(true);
            } else {
                setSessionExpiredWarning(false);
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

    // Prevent accidental unload if dirty
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    // Calculate theoretical stock
    const getTheoreticalStock = (product: any, warehouseId: number) => {
        if (!product?.inventory_levels) return 0;
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
            setItems(prev => prev.map(i => i.id === existingItem.id ? { ...i, counted_stock: i.counted_stock + 1, last_updated: Date.now() } : i));
            setIsDirty(true);
        } else {
            // Not in group state yet, check if exists in DB products table
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

                const tempId = `temp-${Date.now()}-${Math.random()}`;
                const newItem: GroupItem = {
                    id: tempId,
                    product_id: prodData.id,
                    counted_stock: 1,
                    is_manually_added: true,
                    last_updated: Date.now(),
                    product: prodData
                };
                
                setLastInteractedId(tempId);
                setItems(prev => {
                    if (prev.some(i => i.product_id === prodData.id)) {
                        return prev.map(i => i.product_id === prodData.id ? { ...i, counted_stock: i.counted_stock + 1, last_updated: Date.now() } : i);
                    }
                    return [...prev, newItem];
                });
                setIsDirty(true);
            } catch (err) {
                console.error(err);
                alert('Error al buscar el producto.');
            }
        }
        
        if (scanInputRef.current) {
            scanInputRef.current.focus();
        }
    };

    const updateItemCount = (itemId: string, amountChange: number) => {
        if (amountChange === 0) return;
        
        setLastInteractedId(itemId);
        setItems(prev => {
            const item = prev.find(i => i.id === itemId);
            if (!item) return prev;
            const newCount = Math.max(0, item.counted_stock + amountChange);
            return prev.map(i => i.id === itemId ? { ...i, counted_stock: newCount, last_updated: Date.now() } : i);
        });
        setIsDirty(true);
    };

    const handleRemoveItem = (itemId: string) => {
        if(!window.confirm("¿Quitar producto de la sesión actual de conteo?")) return;
        if (lastInteractedId === itemId) setLastInteractedId(null);
        if (!itemId.startsWith('temp-')) {
            setDeletedIds(prev => [...prev, itemId]);
        }
        setItems(prev => prev.filter(i => i.id !== itemId));
        setIsDirty(true);
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
                        .select('id, sku, name, inventory_levels(current_stock, warehouse_id)')
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
                .select('id, sku, name, inventory_levels(current_stock, warehouse_id)')
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

    const handleAddProductFromSearch = (product: any) => {
        if (items.some(i => String(i.product_id) === String(product.id) || i.product?.sku?.trim().toLowerCase() === product.sku?.trim().toLowerCase())) {
            alert('El repuesto ya está en este grupo de inventario.');
            return;
        }

        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const newItem: GroupItem = {
            id: tempId,
            product_id: product.id,
            counted_stock: 0,
            is_manually_added: true,
            last_updated: Date.now(),
            product: product
        };

        setLastInteractedId(tempId);
        setItems(prev => [...prev, newItem]);
        setIsDirty(true);
    };

    // BOTÓN 1: GUARDAR SIN APLICAR (Almacena progreso sin alterar stock real ni last_counted_at)
    const handleSaveWithoutApplying = async (shouldNavigateBack = false) => {
        try {
            setSavingWithoutApply(true);

            // 1. Process deletions
            if (deletedIds.length > 0) {
                const validDbIds = deletedIds.filter(dId => !dId.startsWith('temp-'));
                if (validDbIds.length > 0) {
                    const { error: delErr } = await supabase
                        .from('inventory_group_items')
                        .delete()
                        .in('id', validDbIds);
                    if (delErr) throw delErr;
                }
            }

            // 2. Process upserts of active items
            if (items.length > 0) {
                const upsertRows = items.map(i => {
                    const row: any = {
                        group_id: id,
                        product_id: i.product_id,
                        counted_stock: i.counted_stock,
                        is_manually_added: i.is_manually_added
                    };
                    if (!i.id.startsWith('temp-')) {
                        row.id = i.id;
                    }
                    return row;
                });

                const { error: upsertErr } = await supabase
                    .from('inventory_group_items')
                    .upsert(upsertRows, { onConflict: 'group_id,product_id' });
                if (upsertErr) throw upsertErr;
            }

            // 3. Ensure session_started_at is initialized if it was null, WITHOUT touching last_counted_at
            if (!group?.session_started_at) {
                const nowIso = new Date().toISOString();
                await supabase
                    .from('inventory_groups')
                    .update({ session_started_at: nowIso })
                    .eq('id', id);
                setGroup((prev: any) => ({ ...prev, session_started_at: nowIso }));
            }

            setIsDirty(false);
            setDeletedIds([]);

            if (shouldNavigateBack) {
                navigate('/inventory-mode');
            } else {
                // Trigger visual Toast notification & re-fetch to get official IDs
                await fetchSessionData();
                setSavedToast(true);
                setTimeout(() => setSavedToast(false), 4500);
            }
        } catch (err: any) {
            console.error('Error al guardar sin aplicar:', err);
            alert('Error al guardar los cambios: ' + err.message);
        } finally {
            setSavingWithoutApply(false);
        }
    };

    // BOTÓN 2: FINALIZAR Y APLICAR (Ajusta stock real en sistema y renueva estado)
    const handleFinalizeAndApply = async () => {
        if (!window.confirm("¿Finalizar conteo y aplicar el ajuste de inventario al sistema? Esto actualizará el stock real en almacenes.")) return;

        try {
            setLoading(true);
            const { data: userData } = await supabase.auth.getUser();
            const userId = userData.user?.id;

            // 1. Process deletions first
            if (deletedIds.length > 0) {
                const validDbIds = deletedIds.filter(dId => !dId.startsWith('temp-'));
                if (validDbIds.length > 0) {
                    await supabase.from('inventory_group_items').delete().in('id', validDbIds);
                }
            }

            // 2. Iterate items and adjust actual inventory
            for (const item of items) {
                const theoretical = getTheoreticalStock(item.product, group?.warehouse_id);
                const diff = item.counted_stock - theoretical;

                if (diff !== 0) {
                    const { data: levelData } = await supabase
                        .from('inventory_levels')
                        .select('id, current_stock')
                        .eq('product_id', item.product_id)
                        .limit(1)
                        .maybeSingle();

                    if (levelData) {
                        await supabase
                            .from('inventory_levels')
                            .update({
                                current_stock: item.counted_stock,
                                last_updated: new Date().toISOString()
                            })
                            .eq('id', levelData.id);
                    } else {
                        const defaultWarehouseId = group?.warehouse_id || 1;
                        await supabase
                            .from('inventory_levels')
                            .insert({
                                product_id: item.product_id,
                                warehouse_id: defaultWarehouseId,
                                current_stock: item.counted_stock
                            });
                    }

                    await supabase
                        .from('inventory_logs')
                        .insert({
                            product_id: item.product_id,
                            warehouse_id: group?.warehouse_id || 1,
                            quantity_change: diff,
                            reason: `Ajuste Modo Inventario - Grupo: ${group?.name}`,
                            user_id: userId,
                            reference_type: 'inventory_mode',
                            reference_id: id
                        });
                }
            }

            // 3. Ensure items exist in group and reset counted_stock to 0
            const resetRows = items.map(i => ({
                group_id: id,
                product_id: i.product_id,
                counted_stock: 0,
                is_manually_added: i.is_manually_added,
                ...(i.id.startsWith('temp-') ? {} : { id: i.id })
            }));
            if (resetRows.length > 0) {
                await supabase.from('inventory_group_items').upsert(resetRows, { onConflict: 'group_id,product_id' });
            }

            // 4. Update group last_counted_at and clear session_started_at
            const nowIso = new Date().toISOString();
            await supabase
                .from('inventory_groups')
                .update({
                    last_counted_at: nowIso,
                    session_started_at: null // Resets 24-hour clock for next session
                })
                .eq('id', id);

            setIsDirty(false);
            alert('Inventario actualizado y aplicado correctamente. Los conteos en sesión del grupo han sido encerados y el estado renovado.');
            navigate('/inventory-mode');
        } catch (error: any) {
            console.error('Error finalizando:', error);
            alert('Error al finalizar y aplicar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBackNavigation = () => {
        if (isDirty) {
            setShowExitModal(true);
        } else {
            navigate('/inventory-mode');
        }
    };

    // Calculate Status Badge based on interval and last_counted_at
    const statusInfo = useMemo(() => {
        if (!group) return { status: 'Por inventariar' as const, nextDateStr: 'Pendiente' };
        const val = group.interval_value || 0;
        const unit = group.interval_unit || 'days';
        
        if (!group.last_counted_at || val <= 0) {
            return { status: 'Por inventariar' as const, nextDateStr: 'Sin intervalo programado' };
        }

        const nextDate = new Date(group.last_counted_at);
        if (unit === 'months') {
            nextDate.setMonth(nextDate.getMonth() + val);
        } else if (unit === 'weeks') {
            nextDate.setDate(nextDate.getDate() + (val * 7));
        } else {
            nextDate.setDate(nextDate.getDate() + val);
        }

        const isUpToDate = nextDate.getTime() > new Date().getTime();
        return {
            status: (isUpToDate ? 'Al día' : 'Por inventariar') as ('Al día' | 'Por inventariar'),
            nextDateStr: nextDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        };
    }, [group]);

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
                <div className={`flex items-center justify-between px-4 py-3.5 border-b border-t-4 ${themeConfig.border} ${themeConfig.headerBg} shrink-0`}>
                    <div className="flex items-center gap-2.5 font-extrabold text-sm md:text-base">
                        {themeConfig.icon}
                        <span>{title}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${themeConfig.badge}`}>
                        {list.length}
                    </span>
                </div>

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
                                                        onClick={() => updateItemCount(item.id, item.counted_stock > 0 ? -1 : 0)}
                                                        className="w-6 h-6 flex items-center justify-center hover:bg-white dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 transition-all font-bold active:scale-95"
                                                        title="Disminuir conteo"
                                                    >
                                                        <Minus className="w-3 h-3" />
                                                    </button>
                                                    <span className="font-black text-sm w-7 text-center text-slate-900 dark:text-white font-mono">
                                                        {item.counted_stock}
                                                    </span>
                                                    <button
                                                        onClick={() => updateItemCount(item.id, 1)}
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

    if (loading && !group) return <div className="p-12 text-center text-slate-500 font-medium">Cargando datos de sesión...</div>;

    return (
        <div className="p-4 md:p-6 w-full max-w-[1700px] mx-auto flex flex-col min-h-[calc(100vh-6rem)] relative">
            {/* TOAST DE GUARDADO SIN APLICAR */}
            {savedToast && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-5 duration-300 border border-emerald-400/30">
                    <CheckCircle className="w-6 h-6 shrink-0 animate-bounce" />
                    <div>
                        <h4 className="font-extrabold text-sm">¡Cambios guardados sin aplicar!</h4>
                        <p className="text-xs text-emerald-100 mt-0.5">El conteo activo se salvaguardó en el sistema sin alterar el stock real.</p>
                    </div>
                    <button onClick={() => setSavedToast(false)} className="p-1 hover:bg-white/20 rounded-lg ml-2">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* MODAL DE CONFIRMACIÓN DE SALIDA SEGURA */}
            {showExitModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200 text-center">
                        <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                            Tienes cambios sin guardar
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                            Has realizado modificaciones en el conteo actual que no se han guardado aún. Si sales sin guardar, se volverá a la <strong>última versión guardada</strong> en la base de datos (preservando el reloj de las 24 horas).
                        </p>
                        <div className="flex flex-col gap-2.5">
                            <button
                                onClick={() => {
                                    setShowExitModal(false);
                                    handleSaveWithoutApplying(true);
                                }}
                                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl text-sm shadow-lg shadow-blue-600/20 transition-colors flex items-center justify-center gap-2"
                            >
                                <SaveAll className="w-4 h-4" />
                                Guardar cambios y salir
                            </button>
                            <button
                                onClick={() => {
                                    setShowExitModal(false);
                                    navigate('/inventory-mode');
                                }}
                                className="w-full py-3 px-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 font-extrabold rounded-xl text-sm transition-colors border border-rose-200 dark:border-rose-800"
                            >
                                Salir sin guardar (Descartar)
                            </button>
                            <button
                                onClick={() => setShowExitModal(false)}
                                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition-colors mt-1"
                            >
                                Cancelar y quedarme en la sesión
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADVERTENCIA 24 HORAS EXPIRADA */}
            {sessionExpiredWarning && (
                <div className="mb-4 p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 animate-pulse" />
                        <div className="text-sm">
                            <strong className="font-bold block">¡Advertencia de Sesión Prolongada (Más de 24 Horas)!</strong>
                            <span>Han transcurrido más de 24 horas desde que se inició este conteo. Te recomendamos encerar o finalizar la sesión para evitar disparidades con el stock teórico actual de almacén.</span>
                        </div>
                    </div>
                    <button onClick={() => setSessionExpiredWarning(false)} className="text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/50 p-1.5 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* HEADER & CONTROLES TÉCNICOS */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-6 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={handleBackNavigation} 
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-700 dark:text-slate-200 shadow-2xs"
                        title="Volver al listado"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-black text-slate-900 dark:text-white">{group?.name}</h1>
                            {/* BADGE DE ESTADO */}
                            {statusInfo.status === 'Al día' ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 rounded-full text-xs font-black border border-emerald-300 dark:border-emerald-800">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Al día
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 rounded-full text-xs font-black border border-amber-300 dark:border-amber-800">
                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Por inventariar
                                </span>
                            )}
                            {isDirty && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold border border-blue-200 dark:border-blue-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                                    Cambios pendientes
                                </span>
                            )}
                        </div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-4 flex-wrap">
                            <span>Total repuestos: <strong className="text-slate-800 dark:text-slate-200">{items.length}</strong></span>
                            <span>•</span>
                            <span>Próximo conteo límite: <strong className="text-slate-800 dark:text-slate-200">{statusInfo.nextDateStr}</strong></span>
                            <span>•</span>
                            <span>Sesión iniciada: <strong className="text-slate-800 dark:text-slate-200">{group?.session_started_at ? new Date(group.session_started_at).toLocaleString() : group?.last_counted_at ? new Date(group.last_counted_at).toLocaleString() : 'Recién iniciada'}</strong></span>
                        </p>
                    </div>
                </div>

                {/* BOTONES DE GUARDADO Y FINALIZADO SEPARADOS */}
                <div className="flex items-center gap-3 w-full xl:w-auto justify-end flex-wrap sm:flex-nowrap">
                    <button
                        onClick={() => handleSaveWithoutApplying(false)}
                        disabled={savingWithoutApply || !isDirty}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md ${
                            isDirty 
                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25 active:scale-95 cursor-pointer' 
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-600 shadow-none'
                        }`}
                        title="Guardar el conteo en progreso sin alterar el stock real de almacenes"
                    >
                        {savingWithoutApply ? <Loader2 className="w-4 h-4 animate-spin" /> : <SaveAll className="w-4 h-4" />}
                        <span>Guardar sin Aplicar</span>
                    </button>
                    
                    <button
                        onClick={handleFinalizeAndApply}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-black text-sm transition-all shadow-lg shadow-emerald-600/30 active:scale-95"
                        title="Aplicar conteos al stock real del inventario, renovar fecha y encerar sesión"
                    >
                        <Save className="w-4 h-4" />
                        <span>Finalizar y Aplicar</span>
                    </button>
                </div>
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
                    <button type="submit" className="self-end px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 active:scale-95">
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
                            <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        ) : null}
                    </div>

                    {searchResults.length > 0 && (
                        <div className="mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 z-10 relative">
                            {searchResults.map(prod => (
                                <div key={prod.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between transition-colors">
                                    <div>
                                        <div className="font-bold text-sm text-slate-800 dark:text-slate-200">{prod.name}</div>
                                        <div className="text-xs font-mono text-slate-500">{prod.sku} • Teórico actual: {getTheoreticalStock(prod, group?.warehouse_id)}</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleAddProductFromSearch(prod);
                                            setSearchResults([]);
                                            setSearchQuery('');
                                        }}
                                        className="px-3 py-1 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg text-xs font-bold transition-colors"
                                    >
                                        + Añadir a sesión
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {renderColumn("Faltantes", faltantes, 'faltantes')}
                {renderColumn("Sobrantes", sobrantes, 'sobrantes')}
                {renderColumn("Cuadran Expresos", cuadrados, 'cuadrados')}
            </div>
        </div>
    );
};
