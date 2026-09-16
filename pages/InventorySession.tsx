import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Save, Trash2, AlertTriangle, CheckCircle, Search, Minus, Plus, Loader2, X, Package, ShieldCheck, AlertCircle, Clock, Calendar, Check, SaveAll, Info, TrendingUp, Gauge, Warehouse } from 'lucide-react';
import { RotationClass, ROTATION_CLASS_BOUNDS, midpointOfClass, clampToClass, getAccuracyTier, suggestNextInterval, AccuracyTier } from '../utils/rotationClass';
import { fetchInventoryWarehouses, InventoryWarehouse, INVENTORY_WAREHOUSE_NAME } from '../utils/inventoryWarehouse';

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

interface CountPreview {
    total: number;
    matched: number;
    faltantes: number;
    sobrantes: number;
    accuracyPct: number | null;
    tier: AccuracyTier | null;
    rotationClass: RotationClass;
    currentInterval: number;
    suggestedInterval: number | null;
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

    // "Finalizar y Aplicar" handshake: preview del conteo + decisión del
    // manager sobre el próximo intervalo antes de escribir stock real.
    const [showFinalizeModal, setShowFinalizeModal] = useState(false);
    const [finalizePreview, setFinalizePreview] = useState<CountPreview | null>(null);
    const [intervalChoice, setIntervalChoice] = useState<'suggested' | 'keep' | 'custom'>('suggested');
    const [customIntervalDays, setCustomIntervalDays] = useState('');
    const [applyingFinalize, setApplyingFinalize] = useState(false);

    // Bodega del grupo: apply_inventory_group la exige (aborta con "El grupo no
    // tiene una bodega asignada") y getTheoreticalStock la usa para filtrar los
    // inventory_levels, asi que se puede asignar desde aqui sin volver al listado.
    const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
    const [savingWarehouse, setSavingWarehouse] = useState(false);
    // Puerta de entrada al conteo: un grupo sin bodega no puede contarse (el
    // teorico saldria sumando todas las bodegas y el RPC abortaria al aplicar),
    // asi que se pide antes de dejar escanear nada.
    const [pendingWarehouseId, setPendingWarehouseId] = useState('');

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
    useEffect(() => {
        const loadWarehouses = async () => {
            try {
                const data = await fetchInventoryWarehouses();
                setWarehouses(data);
                // Hoy Guayaquil es la única opción: se deja preseleccionada para
                // que el operador solo confirme, sin abrir un desplegable de uno.
                if (data.length === 1) setPendingWarehouseId(String(data[0].id));
            } catch (error: any) {
                console.error('Error cargando bodegas:', error);
            }
        };
        loadWarehouses();
    }, []);

    const handleWarehouseChange = async (rawValue: string) => {
        const newWarehouseId = rawValue ? parseInt(rawValue, 10) : null;
        setSavingWarehouse(true);
        try {
            const { error } = await supabase
                .from('inventory_groups')
                .update({ warehouse_id: newWarehouseId })
                .eq('id', id);
            if (error) throw error;
            setGroup((prev: any) => ({ ...prev, warehouse_id: newWarehouseId }));
        } catch (error: any) {
            console.error('Error asignando la bodega:', error);
            alert('No se pudo asignar la bodega: ' + error.message);
        } finally {
            setSavingWarehouse(false);
        }
    };

    const getTheoreticalStock = (product: any, warehouseId: number) => {
        if (!product?.inventory_levels) return 0;
        const levels = warehouseId ? product.inventory_levels.filter((l: any) => l.warehouse_id === warehouseId) : product.inventory_levels;
        return levels.reduce((sum: number, l: any) => sum + (l.current_stock || 0), 0);
    };

    // Preview mostrado en el modal de "Finalizar y Aplicar" — usa los mismos
    // datos locales que ya alimentan las columnas Faltantes/Sobrantes/Cuadrados,
    // así que siempre coincide con lo que el operador acaba de ver en pantalla.
    // Es solo para la UX: el valor que realmente se guarda lo recalcula
    // apply_inventory_group con sus propios contadores del lado del servidor.
    const computeCountPreview = (): CountPreview => {
        const rotationClass: RotationClass = (group?.rotation_class as RotationClass) || 'medium';
        const currentInterval = group?.interval_days ?? midpointOfClass(rotationClass);

        let matched = 0, faltantes = 0, sobrantes = 0;
        items.forEach(item => {
            const theoretical = getTheoreticalStock(item.product, group?.warehouse_id);
            if (item.counted_stock === theoretical) matched += 1;
            else if (item.counted_stock < theoretical) faltantes += 1;
            else sobrantes += 1;
        });

        const total = items.length;
        const accuracyPct = total > 0 ? Math.round((matched / total) * 10000) / 100 : null;
        const tier = accuracyPct !== null ? getAccuracyTier(accuracyPct) : null;
        const suggestedInterval = accuracyPct !== null
            ? suggestNextInterval(currentInterval, accuracyPct, rotationClass)
            : null;

        return { total, matched, faltantes, sobrantes, accuracyPct, tier, rotationClass, currentInterval, suggestedInterval };
    };

    const openFinalizeModal = () => {
        if (!group?.warehouse_id) {
            alert('Este grupo no tiene una bodega asignada. Elige la bodega en la cabecera antes de aplicar el conteo: es la que decide sobre que stock se escribe.');
            return;
        }
        const preview = computeCountPreview();
        setFinalizePreview(preview);
        setIntervalChoice(preview.accuracyPct === null ? 'keep' : 'suggested');
        setCustomIntervalDays('');
        setShowFinalizeModal(true);
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

    // Shared by both buttons below: pushes deletions + current counted_stock
    // to inventory_group_items without touching real stock. Both
    // "Guardar sin Aplicar" and "Finalizar y Aplicar" need this — the latter
    // needs it so apply_inventory_group (which reads straight from the DB)
    // sees items added or adjusted locally during this session, including
    // ones that were never explicitly saved.
    const persistItemCounts = async () => {
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

        if (items.length > 0) {
            // Ojo: todas las filas del payload deben tener exactamente las mismas
            // claves. Si a las ya guardadas les añadimos `id` y a las nuevas
            // (temp-*) no, PostgREST manda un INSERT con la unión de columnas y
            // rellena el `id` que falta con NULL en vez de con su DEFAULT
            // gen_random_uuid() -> "null value in column id ... not-null".
            // El upsert resuelve por (group_id, product_id), que es UNIQUE, así
            // que no hace falta mandar el id: las filas existentes conservan el suyo.
            const upsertRows = items.map(i => ({
                group_id: id,
                product_id: i.product_id,
                counted_stock: i.counted_stock,
                is_manually_added: i.is_manually_added
            }));

            const { error: upsertErr } = await supabase
                .from('inventory_group_items')
                .upsert(upsertRows, { onConflict: 'group_id,product_id' });
            if (upsertErr) throw upsertErr;
        }

        setDeletedIds([]);
    };

    // BOTÓN 1: GUARDAR SIN APLICAR (Almacena progreso sin alterar stock real ni last_counted_at)
    const handleSaveWithoutApplying = async (shouldNavigateBack = false) => {
        try {
            setSavingWithoutApply(true);

            await persistItemCounts();

            // Ensure session_started_at is initialized if it was null, WITHOUT touching last_counted_at
            if (!group?.session_started_at) {
                const nowIso = new Date().toISOString();
                await supabase
                    .from('inventory_groups')
                    .update({ session_started_at: nowIso })
                    .eq('id', id);
                setGroup((prev: any) => ({ ...prev, session_started_at: nowIso }));
            }

            setIsDirty(false);

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

    // BOTÓN 2 (confirmado desde el modal de auditoría): Ajusta stock real y
    // renueva el intervalo del grupo con la decisión que aprobó el manager.
    const handleFinalizeAndApply = async () => {
        if (!finalizePreview) return;

        let nextIntervalDays: number | null;
        if (intervalChoice === 'keep') {
            nextIntervalDays = finalizePreview.currentInterval;
        } else if (intervalChoice === 'custom') {
            const parsed = parseInt(customIntervalDays, 10);
            nextIntervalDays = Number.isFinite(parsed)
                ? clampToClass(parsed, finalizePreview.rotationClass)
                : null; // sin número válido, deja que el RPC conserve el intervalo actual
        } else {
            nextIntervalDays = finalizePreview.suggestedInterval; // 'suggested'
        }

        try {
            setApplyingFinalize(true);

            // 1. Push local counts (deletions + counted_stock) to inventory_group_items
            //    so the RPC below — which reads straight from the DB — sees the latest
            //    state, including items added or adjusted during this session.
            await persistItemCounts();

            // 2. Apply the whole group atomically in the database: locks the group and
            //    each item's row at group.warehouse_id specifically (fixing the missing
            //    warehouse filter), writes inventory_levels + inventory_logs together,
            //    recalculates the real accuracy score server-side, and resets the group
            //    for its next cycle — all in one transaction.
            const { error: applyError } = await supabase.rpc('apply_inventory_group', {
                p_group_id: id,
                p_next_interval_days: nextIntervalDays
            });
            if (applyError) throw applyError;

            setIsDirty(false);
            setShowFinalizeModal(false);
            alert('Inventario actualizado y aplicado correctamente. Los conteos en sesión del grupo han sido encerados y el estado renovado.');
            navigate('/inventory-mode');
        } catch (error: any) {
            console.error('Error finalizando:', error);
            alert('Error al finalizar y aplicar: ' + error.message);
        } finally {
            setApplyingFinalize(false);
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
        const intervalDays = group.interval_days || 0;

        if (!group.last_counted_at || intervalDays <= 0) {
            return { status: 'Por inventariar' as const, nextDateStr: 'Sin intervalo programado' };
        }

        const nextDate = new Date(group.last_counted_at);
        nextDate.setDate(nextDate.getDate() + intervalDays);

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
                border: 'border-danger',
                headerBg: 'bg-danger-soft/80 dark:bg-danger/40 text-danger dark:text-white border-danger/20 dark:border-danger/80',
                icon: <AlertTriangle className="w-5 h-5 text-danger shrink-0" />,
                badge: 'bg-danger-soft dark:bg-danger text-danger dark:text-white'
            },
            sobrantes: {
                border: 'border-warning',
                headerBg: 'bg-warning-soft/80 dark:bg-warning/40 text-warning dark:text-white border-warning/20 dark:border-warning/80',
                icon: <Plus className="w-5 h-5 text-warning shrink-0" />,
                badge: 'bg-warning-soft dark:bg-warning text-warning dark:text-white'
            },
            cuadrados: {
                border: 'border-success',
                headerBg: 'bg-success-soft/80 dark:bg-success/40 text-success dark:text-white border-success/20 dark:border-success/80',
                icon: <CheckCircle className="w-5 h-5 text-success shrink-0" />,
                badge: 'bg-success-soft dark:bg-success text-success dark:text-white'
            }
        }[type];

        return (
            <div className="flex flex-col h-[740px] bg-slate-100/70 dark:bg-slate-900/50 rounded-2xl border border-subtle shadow-sm overflow-hidden">
                <div className={`flex items-center justify-between px-4 py-3.5 border-b border-t-4 ${themeConfig.border} ${themeConfig.headerBg} shrink-0`}>
                    <div className="flex items-center gap-2.5 font-bold text-sm md:text-base">
                        {themeConfig.icon}
                        <span>{title}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${themeConfig.badge}`}>
                        {list.length}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {list.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-fg-subtle text-sm p-6 text-center italic">
                            No hay repuestos en esta categoría.
                        </div>
                    ) : (
                        list.map(item => {
                            const isLastInteracted = item.id === lastInteractedId;
                            return (
                                <div
                                    key={item.id}
                                    className={`rounded-xl transition-all duration-300 ${ isLastInteracted ? 'bg-primary-soft/90 border-2 border-primary shadow-[0_0_25px_rgba(6,182,212,0.4)] ring-2 ring-primary/80' : 'bg-white dark:bg-slate-800 border border-subtle hover:border-slate-300 dark:hover:border-slate-600 shadow-xs' } overflow-hidden`}
                                >
                                    {isLastInteracted && (
                                        <div className="bg-primary text-white px-3 py-1 text-[11px] font-bold tracking-wider uppercase flex items-center justify-between shadow-sm">
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-white dark:bg-surface shadow-sm" />
                                                ⭐ ÚLTIMO ESCANEADO / AÑADIDO
                                            </span>
                                            <span className="text-2xs font-semibold bg-black/20 px-2 py-0.5 rounded">Activo</span>
                                        </div>
                                    )}
                                    <div className="p-3.5">
                                        <div className="flex items-start justify-between gap-2 mb-2.5">
                                            <div className="min-w-0 flex-1">
                                                <div className="font-bold text-fg text-xs md:text-sm whitespace-normal break-words leading-tight">
                                                    {item.product.name}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                    <span className="text-fg-muted font-mono font-bold text-xs bg-surface-3 px-2 py-0.5 rounded border border-subtle">
                                                        {item.product.sku}
                                                    </span>
                                                    {item.is_manually_added && (
                                                        <span className="bg-warning-soft text-warning-soft-fg text-[12px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                            Manual
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveItem(item.id)}
                                                className="p-1.5 text-fg-subtle hover:text-danger hover:bg-danger-soft rounded-lg transition-colors shrink-0"
                                                title="Quitar del grupo"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-700/60 grid grid-cols-3 gap-2 items-center text-center">
                                            <div className="flex flex-col items-center justify-center bg-surface-2 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                                <span className="text-2xs font-bold text-fg-subtle uppercase tracking-wider mb-0.5">Teórico</span>
                                                <span className="font-bold text-sm text-fg font-mono">
                                                    {item.theoretical}
                                                </span>
                                            </div>

                                            <div className="flex flex-col items-center">
                                                <span className="text-2xs font-bold text-primary uppercase tracking-wider mb-0.5">Contado</span>
                                                <div className="flex items-center bg-surface-3 rounded-lg p-0.5 border border-subtle shadow-2xs">
                                                    <button
                                                        onClick={() => updateItemCount(item.id, item.counted_stock > 0 ? -1 : 0)}
                                                        className="w-6 h-6 flex items-center justify-center hover:bg-white dark:hover:bg-slate-800 rounded text-fg-muted transition-all font-bold active:scale-95"
                                                        title="Disminuir conteo"
                                                    >
                                                        <Minus className="w-3 h-3" />
                                                    </button>
                                                    <span className="font-bold text-sm w-7 text-center text-fg font-mono">
                                                        {item.counted_stock}
                                                    </span>
                                                    <button
                                                        onClick={() => updateItemCount(item.id, 1)}
                                                        className="w-6 h-6 flex items-center justify-center hover:bg-white dark:hover:bg-slate-800 rounded text-fg-muted transition-all font-bold active:scale-95"
                                                        title="Aumentar conteo"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-center justify-center bg-surface-2 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                                <span className="text-2xs font-bold text-fg-subtle uppercase tracking-wider mb-0.5">Diferencia</span>
                                                <span className={`font-bold text-sm font-mono ${item.diff < 0 ? 'text-danger' : item.diff > 0 ? 'text-warning' : 'text-success'}`}>
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

    if (loading && !group) return <div className="p-12 text-center text-fg-muted font-medium">Cargando datos de sesión...</div>;

    return (
        <div className="p-4 md:p-6 w-full max-w-[1700px] mx-auto flex flex-col min-h-[calc(100vh-6rem)] relative">
            {/* TOAST DE GUARDADO SIN APLICAR */}
            {savedToast && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-success text-white px-5 py-3.5 rounded-2xl shadow-xl animate-in slide-in-from-bottom-5 duration-300 border border-success/30">
                    <CheckCircle className="w-6 h-6 shrink-0 animate-bounce" />
                    <div>
                        <h4 className="font-bold text-sm">¡Cambios guardados sin aplicar!</h4>
                        <p className="text-xs text-white mt-0.5">El conteo activo se salvaguardó en el sistema sin alterar el stock real.</p>
                    </div>
                    <button onClick={() => setSavedToast(false)} className="p-1 hover:bg-white/20 rounded-lg ml-2">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* MODAL DE CONFIRMACIÓN DE SALIDA SEGURA */}
            {showExitModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-surface rounded-2xl shadow-xl max-w-md w-full p-6 border border-subtle animate-in zoom-in-95 duration-200 text-center">
                        <div className="w-14 h-14 bg-warning-soft text-warning-soft-fg rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-fg mb-2">
                            Tienes cambios sin guardar
                        </h3>
                        <p className="text-sm text-fg-muted mb-6 leading-relaxed">
                            Has realizado modificaciones en el conteo actual que no se han guardado aún. Si sales sin guardar, se volverá a la <strong>última versión guardada</strong> en la base de datos (preservando el reloj de las 24 horas).
                        </p>
                        <div className="flex flex-col gap-2.5">
                            <button
                                onClick={() => {
                                    setShowExitModal(false);
                                    handleSaveWithoutApplying(true);
                                }}
                                className="w-full py-3 px-4 bg-primary hover:bg-primary text-white font-bold rounded-xl text-sm shadow-lg shadow-primary/20 transition-colors flex items-center justify-center gap-2"
                            >
                                <SaveAll className="w-4 h-4" />
                                Guardar cambios y salir
                            </button>
                            <button
                                onClick={() => {
                                    setShowExitModal(false);
                                    navigate('/inventory-mode');
                                }}
                                className="w-full py-3 px-4 bg-danger-soft hover:bg-danger-soft text-danger-soft-fg font-bold rounded-xl text-sm transition-colors border border-danger/20"
                            >
                                Salir sin guardar (Descartar)
                            </button>
                            <button
                                onClick={() => setShowExitModal(false)}
                                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-fg font-bold rounded-xl text-sm transition-colors mt-1"
                            >
                                Cancelar y quedarme en la sesión
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: ELEGIR BODEGA ANTES DE EMPEZAR EL CONTEO */}
            {!loading && group && !group.warehouse_id && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-surface rounded-2xl shadow-xl max-w-md w-full p-6 border border-subtle animate-in zoom-in-95 duration-200">
                        <div className="w-14 h-14 bg-primary-soft text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                            <Warehouse className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-fg mb-2 text-center">
                            ¿Qué bodega vas a contar?
                        </h3>
                        <p className="text-sm text-fg-muted mb-5 leading-relaxed text-center">
                            El grupo <strong className="text-fg">{group.name}</strong> todavía no tiene bodega. Es la que decide qué stock teórico se compara y sobre cuál se escribe el ajuste al finalizar.
                        </p>
                        {warehouses.length === 0 ? (
                            <div className="flex items-start gap-2.5 px-4 py-3 bg-warning-soft text-warning-soft-fg rounded-xl border border-warning/20 text-sm font-medium mb-4">
                                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                <span>No hay ninguna bodega activa llamada <strong>{INVENTORY_WAREHOUSE_NAME}</strong>. Créala en Bodegas (o revisa que esté activa) para poder contar.</span>
                            </div>
                        ) : (
                            <select
                                value={pendingWarehouseId}
                                onChange={(e) => setPendingWarehouseId(e.target.value)}
                                autoFocus
                                className="w-full px-4 py-3 bg-surface-2 border-2 border-subtle rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/20 outline-none transition-all text-fg font-bold text-sm mb-4"
                            >
                                <option value="">Selecciona una bodega...</option>
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id} className="bg-surface text-fg">{w.name}</option>
                                ))}
                            </select>
                        )}
                        <div className="flex flex-col gap-2.5">
                            <button
                                onClick={() => handleWarehouseChange(pendingWarehouseId)}
                                disabled={!pendingWarehouseId || savingWarehouse}
                                className="w-full py-3 px-4 bg-primary hover:bg-primary text-white font-bold rounded-xl text-sm shadow-lg shadow-primary/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {savingWarehouse ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Empezar el conteo
                            </button>
                            <button
                                onClick={() => navigate('/inventory-mode')}
                                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-fg font-bold rounded-xl text-sm transition-colors"
                            >
                                Volver al listado
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: RESUMEN DE AUDITORÍA ANTES DE FINALIZAR Y APLICAR */}
            {showFinalizeModal && finalizePreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-surface rounded-2xl shadow-xl max-w-lg w-full p-6 border border-subtle animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-11 h-11 bg-primary-soft text-primary rounded-full flex items-center justify-center shrink-0">
                                <Gauge className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-fg leading-tight">Resumen de Auditoría</h3>
                                <p className="text-xs text-fg-muted">{group?.name}</p>
                            </div>
                        </div>

                        {finalizePreview.total === 0 ? (
                            <p className="text-sm text-fg-muted mt-4 mb-2">
                                Este grupo no tiene ítems contados. Aplicar no modificará stock; el intervalo de conteo se mantiene igual.
                            </p>
                        ) : (
                            <>
                                <div className="mt-4 mb-3 p-3.5 bg-surface-2 rounded-xl border border-subtle">
                                    <p className="text-sm font-bold text-fg">
                                        Precisión del conteo: {finalizePreview.accuracyPct}%
                                    </p>
                                    <p className="text-xs text-fg-muted mt-0.5">
                                        {finalizePreview.matched} cuadrados, {finalizePreview.sobrantes} sobrantes, {finalizePreview.faltantes} faltantes
                                    </p>
                                    {finalizePreview.tier && (
                                        <p className="text-xs text-fg mt-2 leading-relaxed">
                                            <strong>{finalizePreview.tier.headline}</strong> Este grupo es de Rotación {ROTATION_CLASS_BOUNDS[finalizePreview.rotationClass].label}. {finalizePreview.tier.detail}
                                        </p>
                                    )}
                                </div>

                                <div className="mb-4 flex items-center justify-center gap-3 text-sm py-2">
                                    <span className="text-fg-muted">Actual: <strong className="text-fg font-mono">{finalizePreview.currentInterval}d</strong></span>
                                    <TrendingUp className="w-4 h-4 text-fg-subtle" />
                                    <span className="text-fg-muted">Sugerido: <strong className="text-primary font-mono">{finalizePreview.suggestedInterval}d</strong></span>
                                </div>

                                <div className="space-y-2 mb-5">
                                    <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-subtle hover:bg-surface-2 cursor-pointer text-sm">
                                        <input type="radio" name="intervalChoice" checked={intervalChoice === 'suggested'} onChange={() => setIntervalChoice('suggested')} className="accent-primary" />
                                        Aceptar sugerencia del sistema ({finalizePreview.suggestedInterval} días)
                                    </label>
                                    <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-subtle hover:bg-surface-2 cursor-pointer text-sm">
                                        <input type="radio" name="intervalChoice" checked={intervalChoice === 'keep'} onChange={() => setIntervalChoice('keep')} className="accent-primary" />
                                        Mantener en {finalizePreview.currentInterval} días
                                    </label>
                                    <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-subtle hover:bg-surface-2 cursor-pointer text-sm">
                                        <input type="radio" name="intervalChoice" checked={intervalChoice === 'custom'} onChange={() => setIntervalChoice('custom')} className="accent-primary" />
                                        Forzar otro intervalo:
                                        <input
                                            type="number"
                                            value={customIntervalDays}
                                            onChange={(e) => { setCustomIntervalDays(e.target.value); setIntervalChoice('custom'); }}
                                            placeholder={`${ROTATION_CLASS_BOUNDS[finalizePreview.rotationClass].min}-${ROTATION_CLASS_BOUNDS[finalizePreview.rotationClass].max}`}
                                            className="w-20 px-2 py-1 bg-surface border border-strong rounded-lg text-xs font-mono text-center outline-none focus:ring-2 focus:ring-primary"
                                        />
                                        días
                                    </label>
                                    <p className="text-[11px] text-fg-subtle pl-1">
                                        Cualquier opción se ajusta a los límites de Rotación {ROTATION_CLASS_BOUNDS[finalizePreview.rotationClass].label}: {ROTATION_CLASS_BOUNDS[finalizePreview.rotationClass].min}-{ROTATION_CLASS_BOUNDS[finalizePreview.rotationClass].max} días.
                                    </p>
                                </div>
                            </>
                        )}

                        <div className="flex gap-2.5">
                            <button
                                onClick={() => setShowFinalizeModal(false)}
                                disabled={applyingFinalize}
                                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-fg font-bold rounded-xl text-sm transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleFinalizeAndApply}
                                disabled={applyingFinalize}
                                className="flex-1 py-2.5 px-4 bg-success hover:bg-success text-white font-bold rounded-xl text-sm shadow-lg shadow-success/20 transition-colors flex items-center justify-center gap-2"
                            >
                                {applyingFinalize ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Confirmar y Aplicar Inventario
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADVERTENCIA 24 HORAS EXPIRADA */}
            {sessionExpiredWarning && (
                <div className="mb-4 p-4 bg-danger-soft border border-danger/20 text-danger-soft-fg rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-6 h-6 text-danger shrink-0 animate-pulse" />
                        <div className="text-sm">
                            <strong className="font-bold block">¡Advertencia de Sesión Prolongada (Más de 24 Horas)!</strong>
                            <span>Han transcurrido más de 24 horas desde que se inició este conteo. Te recomendamos encerar o finalizar la sesión para evitar disparidades con el stock teórico actual de almacén.</span>
                        </div>
                    </div>
                    <button onClick={() => setSessionExpiredWarning(false)} className="text-danger hover:bg-danger-soft p-1.5 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* HEADER & CONTROLES TÉCNICOS */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-6 bg-surface p-5 rounded-2xl border border-subtle shadow-sm">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={handleBackNavigation} 
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-700 rounded-xl transition-colors text-fg shadow-2xs"
                        title="Volver al listado"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-bold text-fg">{group?.name}</h1>
                            {/* BADGE DE ESTADO */}
                            {statusInfo.status === 'Al día' ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-success-soft text-success-soft-fg rounded-full text-xs font-bold border border-success/20">
                                    <span className="w-2 h-2 rounded-full bg-success" />
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Al día
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-warning-soft text-warning-soft-fg rounded-full text-xs font-bold border border-warning/20">
                                    <span className="w-2 h-2 rounded-full bg-warning" />
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Por inventariar
                                </span>
                            )}
                            {isDirty && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-primary-soft text-primary-soft-fg rounded-full text-xs font-bold border border-primary/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                                    Cambios pendientes
                                </span>
                            )}
                        </div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <label className="text-xs font-bold text-fg-muted uppercase tracking-wider flex items-center gap-1.5">
                                <Warehouse className="w-3.5 h-3.5 text-fg-subtle" />
                                Bodega
                            </label>
                            <select
                                value={group?.warehouse_id ?? ''}
                                onChange={(e) => handleWarehouseChange(e.target.value)}
                                disabled={savingWarehouse}
                                className={`px-2.5 py-1.5 bg-surface border rounded-lg text-xs font-bold text-fg outline-none focus:ring-2 focus:ring-primary cursor-pointer shadow-2xs disabled:opacity-60 ${group?.warehouse_id ? 'border-strong' : 'border-warning'}`}
                                title="Bodega sobre la que se aplicara el conteo"
                            >
                                <option value="">Sin asignar</option>
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id} className="bg-surface text-fg">{w.name}</option>
                                ))}
                            </select>
                            {!group?.warehouse_id && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-warning-soft text-warning-soft-fg rounded-full text-xs font-bold border border-warning/20">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    Asigna una bodega para poder aplicar
                                </span>
                            )}
                            {savingWarehouse && <Loader2 className="w-4 h-4 animate-spin text-fg-subtle" />}
                        </div>
                        <p className="text-xs font-medium text-fg-muted mt-1 flex items-center gap-4 flex-wrap">
                            <span>Total repuestos: <strong className="text-fg">{items.length}</strong></span>
                            <span>•</span>
                            <span>Próximo conteo límite: <strong className="text-fg">{statusInfo.nextDateStr}</strong></span>
                            <span>•</span>
                            <span>Sesión iniciada: <strong className="text-fg">{group?.session_started_at ? new Date(group.session_started_at).toLocaleString() : group?.last_counted_at ? new Date(group.last_counted_at).toLocaleString() : 'Recién iniciada'}</strong></span>
                        </p>
                    </div>
                </div>

                {/* BOTONES DE GUARDADO Y FINALIZADO SEPARADOS */}
                <div className="flex items-center gap-3 w-full xl:w-auto justify-end flex-wrap sm:flex-nowrap">
                    <button
                        onClick={() => handleSaveWithoutApplying(false)}
                        disabled={savingWithoutApply || !isDirty}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md ${ isDirty ? 'bg-primary hover:bg-primary text-white shadow-primary/25 active:scale-95 cursor-pointer' : 'bg-slate-100 dark:bg-slate-700 text-fg-subtle cursor-not-allowed border border-subtle shadow-none' }`}
                        title="Guardar el conteo en progreso sin alterar el stock real de almacenes"
                    >
                        {savingWithoutApply ? <Loader2 className="w-4 h-4 animate-spin" /> : <SaveAll className="w-4 h-4" />}
                        <span>Guardar sin Aplicar</span>
                    </button>
                    
                    <button
                        onClick={openFinalizeModal}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-success hover:bg-success text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-success/30 active:scale-95"
                        title="Revisar el resumen de auditoría y aplicar el conteo al stock real"
                    >
                        <Save className="w-4 h-4" />
                        <span>Finalizar y Aplicar</span>
                    </button>
                </div>
            </div>

            <div className="bg-surface rounded-2xl shadow-sm border border-subtle p-6 mb-6">
                <form onSubmit={handleScan} className="flex gap-4 mb-6">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-fg mb-1">Escanear Código de Barras (SKU)</label>
                        <input
                            ref={scanInputRef}
                            type="text"
                            value={scanSku}
                            onChange={e => setScanSku(e.target.value)}
                            placeholder="Escanea aquí..."
                            autoFocus
                            className="w-full px-4 py-3 bg-surface-2 border-2 border-subtle rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/20 outline-none transition-all dark:text-white font-mono text-lg"
                        />
                    </div>
                    <button type="submit" className="self-end px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 active:scale-95">
                        Escanear
                    </button>
                </form>

                <div className="border-t border-subtle pt-6">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                            <Package className="w-4 h-4 text-primary" />
                            Añadir repuestos del catálogo al grupo
                        </h3>
                        <span className="text-xs text-fg-muted">Búsqueda en tiempo real por Código o Nombre</span>
                    </div>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearchAdd()}
                            placeholder="Escribe el código (SKU) o nombre de repuesto..."
                            className="w-full pl-10 pr-10 py-2.5 bg-surface-2 border border-subtle rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none dark:text-white text-sm transition-all placeholder:text-slate-400"
                        />
                        {isSearching ? (
                            <Loader2 className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-fg-subtle animate-spin" />
                        ) : searchQuery ? (
                            <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-slate-600 dark:hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        ) : null}
                    </div>

                    {searchResults.length > 0 && (
                        <div className="mt-2 bg-surface border border-subtle rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 z-10 relative">
                            {searchResults.map(prod => (
                                <div key={prod.id} className="p-3 hover:bg-surface-hover flex items-center justify-between transition-colors">
                                    <div>
                                        <div className="font-bold text-sm text-fg">{prod.name}</div>
                                        <div className="text-xs font-mono text-fg-muted">{prod.sku} • Teórico actual: {getTheoreticalStock(prod, group?.warehouse_id)}</div>
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
