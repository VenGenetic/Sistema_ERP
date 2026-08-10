import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { reprintOrderReceipt } from '../utils/thermalReceipt';

// Ecuador is UTC-5
const TZ_OFFSET = '-05:00';

interface OrderItem {
    id: number;
    quantity: number;
    unit_price: number;
    unit_cost: number;
    product_id: number;
    products: { id: number; sku: string; name: string } | null;
}

interface Order {
    id: number;
    created_at: string;
    total_amount: number;
    shipping_cost: number;
    status: string;
    warehouse_id: number;
    closer_id: string;
    status_updated_by?: string;
    status_updated_at?: string;
    customers: { id: number; name: string } | null;
    order_items: OrderItem[];
}

interface DailySummary {
    date: string;
    revenue: number;
    cost: number;
    profit: number;
    orderCount: number;
    orders: Order[];
}

interface EditCartItem {
    product_id: number;
    sku: string;
    name: string;
    quantity: number;
    unit_price: number;
    unit_cost: number;
    warehouse_id: number;
    warehouse_name: string;
    current_stock: number;
}

/** Convert a UTC ISO string to local Ecuador date (YYYY-MM-DD) */
const toLocalDate = (utcString: string): string => {
    const d = new Date(utcString);
    // Shift to UTC-5
    const localMs = d.getTime() - 5 * 60 * 60 * 1000;
    const local = new Date(localMs);
    return local.toISOString().split('T')[0];
};

const todayLocal = (): string => {
    const now = new Date();
    const localMs = now.getTime() - 5 * 60 * 60 * 1000;
    return new Date(localMs).toISOString().split('T')[0];
};

const nDaysAgoLocal = (n: number): string => {
    const now = new Date();
    const localMs = now.getTime() - 5 * 60 * 60 * 1000;
    const d = new Date(localMs);
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
};

const DailyRegistry: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedDate, setExpandedDate] = useState<string | null>(null);
    const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
    const [editingDate, setEditingDate] = useState<string>('');
    const [justUpdatedId, setJustUpdatedId] = useState<number | null>(null);
    const [expandedOrderIds, setExpandedOrderIds] = useState<number[]>([]);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Active status filter tab
    const [activeTab, setActiveTab] = useState<'Entregado' | 'Cancelado'>('Entregado');

    // Date range filters
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
        start: nDaysAgoLocal(7),
        end: todayLocal(),
    });

    // Profile names map
    const [profilesMap, setProfilesMap] = useState<Map<string, string>>(new Map());
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Audit logs for expanded orders
    const [orderHistory, setOrderHistory] = useState<Record<number, any[]>>({});

    // Order items editing state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
    const [editCartItems, setEditCartItems] = useState<EditCartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearchingProducts, setIsSearchingProducts] = useState(false);
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // Fetch user and profile maps
    const fetchProfilesAndSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            setCurrentUser(session.user);
        }

        const { data: profiles } = await supabase.from('profiles').select('id, full_name');
        if (profiles) {
            const map = new Map<string, string>();
            profiles.forEach(p => map.set(p.id, p.full_name));
            setProfilesMap(map);
        }
    };

    // Fetch audit history for specific order
    const fetchOrderHistory = async (orderId: number) => {
        const { data, error } = await supabase
            .from('system_events')
            .select('*')
            .in('event_type', ['order_edit', 'order_cancel'])
            .eq('payload->>order_id', orderId.toString())
            .order('created_at', { ascending: false });

        if (!error && data) {
            setOrderHistory(prev => ({ ...prev, [orderId]: data }));
        }
    };

    // ─── Fetch data ─────────────────────────────────────────────────
    const fetchDailyData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const startUTC = `${dateRange.start}T00:00:00${TZ_OFFSET}`;
            const endUTC   = `${dateRange.end}T23:59:59${TZ_OFFSET}`;

            // Fetch both completed and cancelled orders
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id,
                    created_at,
                    total_amount,
                    shipping_cost,
                    status,
                    warehouse_id,
                    closer_id,
                    status_updated_by,
                    status_updated_at,
                    customers(id, name),
                    order_items(
                        id,
                        quantity, 
                        unit_price, 
                        unit_cost,
                        product_id,
                        products(id, sku, name)
                    )
                `)
                .in('status', ['Entregado', 'Cancelado'])
                .gte('created_at', startUTC)
                .lte('created_at', endUTC)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders((data as unknown as Order[]) || []);
        } catch (err: any) {
            console.error('Error fetching daily registry:', err);
            setError(err?.message || 'Error al cargar los datos. Revisa la consola.');
        } finally {
            setLoading(false);
        }
    }, [dateRange]);

    useEffect(() => {
        fetchProfilesAndSession();
    }, []);

    // ─── Re-fetch when date range changes ────────────────────────────────
    useEffect(() => {
        fetchDailyData();
    }, [dateRange, fetchDailyData]);

    // ─── Real-time: auto-refresh ───────────────────────
    useEffect(() => {
        const channel = supabase
            .channel('daily-registry-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                () => {
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    debounceRef.current = setTimeout(() => {
                        fetchDailyData();
                    }, 800);
                }
            )
            .subscribe();

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            supabase.removeChannel(channel);
        };
    }, [fetchDailyData]);

    // Grouping filtered orders into summaries
    const dailySummaries: DailySummary[] = useMemo(() => {
        const summaryMap: Record<string, DailySummary> = {};

        const filteredOrders = orders.filter(o => o.status === activeTab);

        filteredOrders.forEach(order => {
            const dateKey = toLocalDate(order.created_at);

            if (!summaryMap[dateKey]) {
                summaryMap[dateKey] = {
                    date: dateKey,
                    revenue: 0,
                    cost: 0,
                    profit: 0,
                    orderCount: 0,
                    orders: [],
                };
            }

            const r = summaryMap[dateKey];
            const revenue = Number(order.total_amount || 0);

            let orderCost = 0;
            order.order_items?.forEach(item => {
                orderCost += Number(item.unit_cost || 0) * Number(item.quantity || 0);
            });

            r.revenue    += revenue;
            r.cost       += orderCost;
            r.profit     += revenue - orderCost;
            r.orderCount += 1;
            r.orders.push(order);
        });

        return Object.values(summaryMap).sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
    }, [orders, activeTab]);

    const totalKPIs = useMemo(() => {
        return dailySummaries.reduce(
            (acc, curr) => {
                acc.revenue += curr.revenue;
                acc.cost    += curr.cost;
                acc.profit  += curr.profit;
                acc.orders  += curr.orderCount;
                return acc;
            },
            { revenue: 0, cost: 0, profit: 0, orders: 0 }
        );
    }, [dailySummaries]);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    const setQuickRange = (days: number) => {
        setDateRange({
            start: days === 0 ? todayLocal() : nDaysAgoLocal(days),
            end: todayLocal(),
        });
    };

    const activeBtn = (days: number): boolean => {
        const expectedStart = days === 0 ? todayLocal() : nDaysAgoLocal(days);
        return dateRange.start === expectedStart && dateRange.end === todayLocal();
    };

    const handleUpdateOrderDate = async (orderId: number) => {
        if (!editingDate) return;
        setLoading(true);

        const newTimestamp = `${editingDate}T17:00:00.000Z`;
        
        try {
            const { data: res, error: rpcError } = await supabase.rpc('update_order_date', {
                p_order_id: orderId,
                p_new_date: newTimestamp
            });

            if (rpcError) {
                alert(`Error al actualizar la fecha: ${rpcError.message}`);
                setLoading(false);
                return;
            }

            if (res && res.success === false) {
                alert(`Error: ${res.message}`);
                setLoading(false);
                return;
            }

            setOrders(prev => prev.map(o => 
                o.id === orderId ? { ...o, created_at: newTimestamp } : o
            ));

            setEditingOrderId(null);
            setEditingDate('');
            setJustUpdatedId(orderId);
            setTimeout(() => setJustUpdatedId(null), 3000);
            
            await new Promise(resolve => setTimeout(resolve, 800));
            await fetchDailyData();
        } catch (err: any) {
            alert(`Error inesperado: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const toggleOrderExpansion = (orderId: number) => {
        const isCurrentlyExpanded = expandedOrderIds.includes(orderId);
        if (!isCurrentlyExpanded) {
            fetchOrderHistory(orderId);
        }
        setExpandedOrderIds(prev =>
            prev.includes(orderId)
                ? prev.filter(id => id !== orderId)
                : [...prev, orderId]
        );
    };

    // ─── Sale Cancellation (Dar de Baja) ───────────────────
    const handleCancelOrder = async (order: Order) => {
        const isConfirmed = window.confirm(
            `¿Está seguro de que desea DAR DE BAJA (cancelar) la venta #${order.id} por un total de ${formatCurrency(order.total_amount)}?\n\nEsta acción:\n- Reintegrará todos los productos al inventario.\n- Creará un asiento compensatorio inverso contable para anular el dinero.\n- Registrará inmutablemente que usted la dio de baja.\n\nEsta operación no se puede deshacer.`
        );

        if (!isConfirmed) return;

        setLoading(true);
        try {
            const { data, error: rpcError } = await supabase.rpc('cancel_completed_sale', {
                p_order_id: order.id,
                p_user_id: currentUser?.id
            });

            if (rpcError) throw rpcError;

            if (data && data.success) {
                alert('¡Venta dada de baja con éxito! El inventario ha sido reabastecido y el flujo contable revertido.');
                fetchDailyData();
            } else {
                alert(`Error: ${data?.message || 'Error desconocido'}`);
            }
        } catch (err: any) {
            console.error('Error cancelling order:', err);
            alert(`Error al dar de baja la venta: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // ─── Search products in edit modal ───────────────────
    const handleProductSearch = async (val: string) => {
        setSearchQuery(val);
        if (!val.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearchingProducts(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select(`
                    id, sku, name, price, cost_without_vat, vat_percentage, is_discontinued, discontinued_until,
                    inventory_levels (
                        current_stock,
                        warehouse_id,
                        warehouses (name)
                    )
                `)
                .or(`sku.ilike.%${val}%,name.ilike.%${val}%`)
                .limit(10);

            if (error) throw error;

            setSearchResults(data || []);
        } catch (e) {
            console.error('Error searching products:', e);
        } finally {
            setIsSearchingProducts(false);
        }
    };

    // Add item from search to edit cart
    const addProductToEditCart = (prod: any, warehouseId: number, whName: string, stock: number) => {
        const cost = prod.cost_without_vat || 0;
        const vat = prod.vat_percentage || 0;
        const finalCost = cost * (1 + vat / 100);

        setEditCartItems(prev => {
            const exists = prev.find(item => item.product_id === prod.id);
            if (exists) {
                // If it already exists, just make sure we don't exceed stock limit
                const allowedQty = stock + (orderToEdit?.order_items.find(oi => oi.product_id === prod.id)?.quantity || 0);
                if (exists.quantity + 1 > allowedQty && warehouseId !== 0) {
                    alert(`No puedes agregar más unidades. El stock máximo disponible es ${allowedQty}.`);
                    return prev;
                }
                return prev.map(item =>
                    item.product_id === prod.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }

            return [...prev, {
                product_id: prod.id,
                sku: prod.sku,
                name: prod.name,
                quantity: 1,
                unit_price: prod.price,
                unit_cost: finalCost,
                warehouse_id: warehouseId,
                warehouse_name: whName,
                current_stock: stock
            }];
        });
        setSearchQuery('');
        setSearchResults([]);
    };

    // Update cart item quantity
    const updateEditCartQty = (productId: number, newQty: number) => {
        if (newQty < 1) return;

        const cartItem = editCartItems.find(item => item.product_id === productId);
        if (!cartItem) return;

        // original quantity in order (if it was there)
        const originalQty = orderToEdit?.order_items.find(oi => oi.product_id === productId)?.quantity || 0;
        const maxStock = cartItem.current_stock + originalQty;

        if (newQty > maxStock && cartItem.warehouse_id !== 0) {
            alert(`Stock insuficiente. El máximo disponible (incluyendo la venta original) es ${maxStock}.`);
            return;
        }

        setEditCartItems(prev => prev.map(item =>
            item.product_id === productId ? { ...item, quantity: newQty } : item
        ));
    };

    // Open edit modal for order
    const openEditOrderModal = async (order: Order) => {
        setOrderToEdit(order);
        setLoading(true);

        try {
            // Load current stock levels for each item in the order's warehouse
            const itemsWithStock = await Promise.all(order.order_items.map(async (item) => {
                const whId = order.warehouse_id || 0;
                let stock = 999;
                let whName = 'Manual';

                if (whId !== 0) {
                    const { data } = await supabase
                        .from('inventory_levels')
                        .select(`
                            current_stock,
                            warehouses (name)
                        `)
                        .eq('product_id', item.product_id)
                        .eq('warehouse_id', whId)
                        .maybeSingle();
                    
                    if (data) {
                        stock = Number(data.current_stock || 0);
                        whName = Array.isArray(data.warehouses) 
                            ? (data.warehouses as any)[0]?.name 
                            : (data.warehouses as any)?.name || 'Desconocido';
                    }
                }

                return {
                    product_id: item.product_id,
                    sku: item.products?.sku || 'N/A',
                    name: item.products?.name || 'Desconocido',
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    unit_cost: item.unit_cost,
                    warehouse_id: whId,
                    warehouse_name: whName,
                    current_stock: stock
                };
            }));

            setEditCartItems(itemsWithStock);
            setIsEditModalOpen(true);
        } catch (e: any) {
            alert('Error al abrir editor: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    // Save modifications to completed sale
    const handleSaveOrderEdits = async () => {
        if (!orderToEdit || editCartItems.length === 0) return;

        setIsSavingEdit(true);
        try {
            // Map items to database type: pos_item_input
            const mappedItems = editCartItems.map(item => ({
                product_id: item.product_id,
                warehouse_id: item.warehouse_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                unit_cost: item.unit_cost
            }));

            const { data, error: rpcError } = await supabase.rpc('modify_completed_sale', {
                p_order_id: orderToEdit.id,
                p_items: mappedItems,
                p_user_id: currentUser?.id
            });

            if (rpcError) throw rpcError;

            if (data && data.success) {
                alert(`¡Venta #${orderToEdit.id} modificada con éxito!\n- Diferencia de efectivo: ${formatCurrency(data.difference)}\n- Ajuste de comisión: ${formatCurrency(data.commission_adjustment)}`);
                setIsEditModalOpen(false);
                setOrderToEdit(null);
                setEditCartItems([]);
                fetchDailyData();
            } else {
                alert(`Error: ${data?.message || 'Error desconocido'}`);
            }
        } catch (e: any) {
            console.error('Error modifying order:', e);
            alert(`Error guardando cambios: ${e.message}`);
        } finally {
            setIsSavingEdit(false);
        }
    };

    // Calculate edit cart total
    const editCartTotal = useMemo(() => {
        const itemsSum = editCartItems.reduce((acc, curr) => acc + (curr.quantity * curr.unit_price), 0);
        return itemsSum + (orderToEdit?.shipping_cost || 0);
    }, [editCartItems, orderToEdit]);

    return (
        <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Cierre y Registro Diario
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Ingresos y control diario de ventas (hora Ecuador). Modifica o anula transacciones de forma segura.
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                        {([['Hoy', 0], ['7 Días', 7], ['Mes', 30]] as [string, number][]).map(([label, days]) => (
                            <button
                                key={label}
                                onClick={() => setQuickRange(days)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                    activeBtn(days)
                                        ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 bg-white dark:bg-[#161b22] px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            className="bg-transparent text-sm outline-none text-slate-700 dark:text-slate-300 font-medium"
                        />
                        <span className="text-slate-400">→</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            className="bg-transparent text-sm outline-none text-slate-700 dark:text-slate-300 font-medium"
                        />
                    </div>
                    <button
                        onClick={fetchDailyData}
                        disabled={loading}
                        title="Actualizar"
                        className="p-2 rounded-lg bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-[#1c2128] transition-colors disabled:opacity-50"
                    >
                        <span className={`material-symbols-outlined text-slate-500 text-[20px] ${loading ? 'animate-spin' : ''}`}>
                            refresh
                        </span>
                    </button>
                </div>
            </div>

            {/* Tab Selector */}
            <div className="flex border-b border-slate-200 dark:border-slate-800">
                <button
                    onClick={() => {
                        setActiveTab('Entregado');
                        setExpandedDate(null);
                    }}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === 'Entregado'
                            ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    Ventas Entregadas (Activas)
                </button>
                <button
                    onClick={() => {
                        setActiveTab('Cancelado');
                        setExpandedDate(null);
                    }}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === 'Cancelado'
                            ? 'border-rose-500 text-rose-500 dark:border-rose-400 dark:text-rose-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    <span className="material-symbols-outlined text-[18px]">cancel</span>
                    Dadas de Baja (Canceladas)
                </button>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="flex items-center gap-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-3">
                    <span className="material-symbols-outlined text-rose-500 text-[20px]">error</span>
                    <p className="text-sm text-rose-700 dark:text-rose-400 font-medium">{error}</p>
                </div>
            )}

            {/* KPI Cards (Contextual dynamically changed based on the active tab) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {activeTab === 'Entregado' ? 'Ingreso Total' : 'Total Revertido'}
                        </span>
                        <span className={`material-symbols-outlined ${activeTab === 'Entregado' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {activeTab === 'Entregado' ? 'point_of_sale' : 'money_off'}
                        </span>
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-bold text-slate-900 dark:text-white font-mono">
                            {loading ? <span className="animate-pulse text-slate-400">···</span> : formatCurrency(totalKPIs.revenue)}
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {activeTab === 'Entregado' ? 'Costo (COGS)' : 'Costo Reingresado'}
                        </span>
                        <span className="material-symbols-outlined text-amber-500">inventory_2</span>
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-bold text-slate-900 dark:text-white font-mono">
                            {loading ? <span className="animate-pulse text-slate-400">···</span> : formatCurrency(totalKPIs.cost)}
                        </div>
                    </div>
                </div>

                <div className={`${activeTab === 'Entregado' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/30' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-900/30'} p-5 rounded-xl border flex flex-col justify-between shadow-sm`}>
                    <div className="flex justify-between items-start">
                        <span className={`text-xs font-bold uppercase tracking-wider ${activeTab === 'Entregado' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {activeTab === 'Entregado' ? 'Ganancia Bruta' : 'Pérdida de Margen'}
                        </span>
                        <span className={`material-symbols-outlined ${activeTab === 'Entregado' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {activeTab === 'Entregado' ? 'trending_up' : 'trending_down'}
                        </span>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                        <div className={`text-3xl font-bold font-mono ${activeTab === 'Entregado' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                            {loading ? <span className="animate-pulse text-slate-400">···</span> : formatCurrency(totalKPIs.profit)}
                        </div>
                        {!loading && totalKPIs.revenue > 0 && activeTab === 'Entregado' && (
                            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-500 mb-1">
                                {((totalKPIs.profit / totalKPIs.revenue) * 100).toFixed(1)}% Mgn
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {activeTab === 'Entregado' ? 'Ventas Completadas' : 'Ventas Canceladas'}
                        </span>
                        <span className="material-symbols-outlined text-blue-500">receipt_long</span>
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-bold text-slate-900 dark:text-white font-mono">
                            {loading ? <span className="animate-pulse text-slate-400">···</span> : totalKPIs.orders}
                        </div>
                    </div>
                </div>
            </div>

            {/* Daily Registry Table */}
            <div className="bg-white dark:bg-[#161b22] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex-1">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white">
                        Desglose por Día ({activeTab === 'Entregado' ? 'Ventas Activas' : 'Ventas de Baja'})
                    </h3>
                    {loading && (
                        <span className="text-xs text-primary font-medium animate-pulse flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                            Cargando...
                        </span>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-[#0d1117] border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-10"></th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Órdenes</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Monto</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Costo</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                                    {activeTab === 'Entregado' ? 'Ganancia' : 'Pérdida'}
                                </th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Margen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {!loading && dailySummaries.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <span className="material-symbols-outlined text-4xl text-slate-300">calendar_month</span>
                                            <p className="font-medium">
                                                No hay registros {activeTab === 'Entregado' ? 'entregados' : 'cancelados'} en este período.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {loading && dailySummaries.length === 0 && (
                                [...Array(4)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4"><div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                                        <td className="px-6 py-4 text-right"><div className="h-4 w-8 bg-slate-200 dark:bg-slate-700 rounded ml-auto"></div></td>
                                        <td className="px-6 py-4 text-right"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded ml-auto"></div></td>
                                        <td className="px-6 py-4 text-right"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded ml-auto"></div></td>
                                        <td className="px-6 py-4 text-right"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded ml-auto"></div></td>
                                        <td className="px-6 py-4 text-right"><div className="h-4 w-14 bg-slate-200 dark:bg-slate-700 rounded ml-auto"></div></td>
                                    </tr>
                                ))
                            )}

                            {dailySummaries.map((day) => {
                                const margin = day.revenue > 0
                                    ? ((day.profit / day.revenue) * 100).toFixed(1)
                                    : '0';
                                const isExpanded = expandedDate === day.date;

                                return (
                                    <React.Fragment key={day.date}>
                                        <tr
                                            className={`hover:bg-slate-50 dark:hover:bg-[#1c2128] transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                                            onClick={() => setExpandedDate(isExpanded ? null : day.date)}
                                        >
                                            <td className="px-6 py-4 text-center">
                                                <span className={`material-symbols-outlined text-slate-400 transition-transform duration-200 text-[18px] ${isExpanded ? 'rotate-90 text-primary' : ''}`}>
                                                    chevron_right
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">
                                                {new Date(day.date + 'T12:00:00').toLocaleDateString('es-EC', {
                                                    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                                                })}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 font-mono text-right">
                                                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{day.orderCount}</span>
                                            </td>
                                            <td className={`px-6 py-4 text-sm font-bold text-right font-mono ${activeTab === 'Entregado' ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                {formatCurrency(day.revenue)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 text-right font-mono">
                                                {formatCurrency(day.cost)}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white text-right font-mono">
                                                {formatCurrency(day.profit)}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-right">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                    activeTab === 'Cancelado'
                                                        ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                        : Number(margin) < 20
                                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                                        : Number(margin) < 40
                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                }`}>
                                                    {margin}%
                                                </span>
                                            </td>
                                        </tr>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <tr className="bg-slate-50/50 dark:bg-[#0d1117] border-b-2 border-slate-200 dark:border-slate-800">
                                                <td colSpan={7} className="p-0">
                                                    <div className={`px-8 py-4 border-l-4 ${activeTab === 'Entregado' ? 'border-primary' : 'border-rose-500'}`}>
                                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                                                            Detalle de Órdenes ({day.orders.length})
                                                        </h4>
                                                        <div className="grid gap-2">
                                                            {day.orders.map(order => {
                                                                const orderCost = order.order_items?.reduce(
                                                                    (s, i) => s + Number(i.unit_cost || 0) * Number(i.quantity || 0), 0
                                                                ) ?? 0;
                                                                const orderProfit = Number(order.total_amount || 0) - orderCost;
                                                                const isOrderExpanded = expandedOrderIds.includes(order.id);

                                                                return (
                                                                    <div 
                                                                        key={order.id}
                                                                        onClick={() => toggleOrderExpansion(order.id)}
                                                                        className="flex flex-col gap-3 p-3 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm cursor-pointer hover:border-primary/50 transition-all group/card"
                                                                    >
                                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                                                                            <div className="flex items-center gap-4">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className={`material-symbols-outlined text-slate-400 text-sm transition-transform duration-200 ${isOrderExpanded ? 'rotate-180' : ''}`}>
                                                                                        expand_more
                                                                                    </span>
                                                                                    <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold font-mono text-xs px-2 py-1 rounded">
                                                                                        #{order.id}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                                                                                        {order.customers?.name || 'Mostrador / POS'}
                                                                                        {justUpdatedId === order.id && (
                                                                                            <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded animate-bounce">
                                                                                                ✓ ¡Actualizado!
                                                                                            </span>
                                                                                        )}
                                                                                    </span>

                                                                                    {/* Date details and inline edit */}
                                                                                    {editingOrderId === order.id ? (
                                                                                        <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                                                                                            <input
                                                                                                type="date"
                                                                                                value={editingDate}
                                                                                                max={todayLocal()}
                                                                                                disabled={loading}
                                                                                                onChange={(e) => setEditingDate(e.target.value)}
                                                                                                className="text-xs border border-primary rounded px-1.5 py-0.5 outline-none bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-mono disabled:opacity-50"
                                                                                                autoFocus
                                                                                            />
                                                                                            <button
                                                                                                onClick={() => handleUpdateOrderDate(order.id)}
                                                                                                disabled={loading}
                                                                                                className="text-[10px] min-w-[60px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded hover:bg-emerald-600 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
                                                                                            >
                                                                                                {loading ? '...' : 'Guardar'}
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => { setEditingOrderId(null); setEditingDate(''); }}
                                                                                                disabled={loading}
                                                                                                className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded hover:bg-slate-300 transition-colors disabled:opacity-50"
                                                                                            >
                                                                                                ✕
                                                                                            </button>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="flex flex-col gap-0.5">
                                                                                            <button
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    if (activeTab === 'Cancelado') return;
                                                                                                    setEditingOrderId(order.id);
                                                                                                    setEditingDate(toLocalDate(order.created_at));
                                                                                                }}
                                                                                                disabled={activeTab === 'Cancelado'}
                                                                                                className={`text-xs text-slate-500 flex items-center gap-1 mt-0.5 transition-colors group/edit ${activeTab === 'Entregado' ? 'hover:text-primary' : ''}`}
                                                                                                title={activeTab === 'Entregado' ? "Cambiar fecha del registro" : ""}
                                                                                            >
                                                                                                <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                                                                                                {toLocalDate(order.created_at)} · {new Date(order.created_at).toLocaleTimeString('es-EC', {
                                                                                                    hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil'
                                                                                                })}
                                                                                                {activeTab === 'Entregado' && (
                                                                                                    <span className="material-symbols-outlined text-[11px] opacity-0 group-hover/edit:opacity-60">edit</span>
                                                                                                )}
                                                                                            </button>

                                                                                            {/* Cancelled by info display */}
                                                                                            {activeTab === 'Cancelado' && order.status_updated_by && (
                                                                                                <span className="text-xs text-rose-500 font-bold flex items-center gap-1 mt-1">
                                                                                                    <span className="material-symbols-outlined text-[13px]">person_cancel</span>
                                                                                                    Dada de baja por: {profilesMap.get(order.status_updated_by) || 'Desconocido'} 
                                                                                                    {order.status_updated_at && ` el ${toLocalDate(order.status_updated_at)}`}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                            <div className="mt-2 sm:mt-0 flex items-center gap-4 text-right">
                                                                                <div>
                                                                                    <div className="text-xs text-slate-400 uppercase font-bold">
                                                                                        {activeTab === 'Entregado' ? 'Ganancia' : 'Pérdida'}
                                                                                    </div>
                                                                                    <div className={`text-sm font-bold font-mono ${orderProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                                                                        {formatCurrency(orderProfit)}
                                                                                    </div>
                                                                                </div>
                                                                                <div>
                                                                                    <div className="text-xs text-slate-400 uppercase font-bold">Total</div>
                                                                                    <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                                                                                        {formatCurrency(Number(order.total_amount))}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Detailed item list collapse */}
                                                                        {isOrderExpanded && (
                                                                            <div 
                                                                                className="bg-slate-50 dark:bg-slate-900/40 rounded-md p-3 border border-slate-100 dark:border-slate-800/50 animate-in fade-in slide-in-from-top-1 duration-200 flex flex-col gap-4"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                                <table className="w-full text-left">
                                                                                    <thead>
                                                                                        <tr className="text-[10px] uppercase tracking-tighter text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                                                                                            <th className="pb-1">Cant.</th>
                                                                                            <th className="pb-1">Repuesto / Descripción</th>
                                                                                            <th className="pb-1 text-right">Unit.</th>
                                                                                            <th className="pb-1 text-right">Subtotal</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                                                        {order.order_items?.map((item, idx) => {
                                                                                            const subtotal = Number(item.unit_price) * Number(item.quantity);
                                                                                            return (
                                                                                                <tr key={idx} className="text-[11px] text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                                                                                                    <td className="py-1.5 font-mono font-bold">{item.quantity}</td>
                                                                                                    <td className="py-1.5 pr-4 truncate max-w-[200px] md:max-w-none">
                                                                                                        {item.products?.name || 'Producto desconocido'}
                                                                                                    </td>
                                                                                                    <td className="py-1.5 text-right font-mono">{formatCurrency(Number(item.unit_price))}</td>
                                                                                                    <td className="py-1.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                                                                        {formatCurrency(subtotal)}
                                                                                                    </td>
                                                                                                </tr>
                                                                                            );
                                                                                        })}
                                                                                        {Number(order.shipping_cost) > 0 && (
                                                                                            <tr className="text-[11px] text-slate-500 italic">
                                                                                                <td className="py-1.5">1</td>
                                                                                                <td className="py-1.5">Cargo por Envío</td>
                                                                                                <td className="py-1.5 text-right font-mono">{formatCurrency(Number(order.shipping_cost))}</td>
                                                                                                <td className="py-1.5 text-right font-mono">{formatCurrency(Number(order.shipping_cost))}</td>
                                                                                            </tr>
                                                                                        )}
                                                                                    </tbody>
                                                                                </table>

                                                                                {/* Audit Trail list under order items */}
                                                                                {orderHistory[order.id] && orderHistory[order.id].length > 0 && (
                                                                                    <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                                                                                        <h5 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5 flex items-center gap-1">
                                                                                            <span className="material-symbols-outlined text-[12px]">history</span>
                                                                                            Historial de Auditoría
                                                                                        </h5>
                                                                                        <div className="space-y-1 max-h-[100px] overflow-y-auto">
                                                                                            {orderHistory[order.id].map((event, evIdx) => {
                                                                                                const payload = event.payload || {};
                                                                                                const actionName = event.event_type === 'order_edit' ? 'Modificación' : 'Baja (Cancelado)';
                                                                                                const editorName = payload.user_email || profilesMap.get(payload.edited_by || payload.cancelled_by) || 'Desconocido';
                                                                                                const dateStr = new Date(event.created_at).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' });

                                                                                                return (
                                                                                                    <div key={evIdx} className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#0d1117] rounded p-1.5 border border-slate-200 dark:border-slate-800/80">
                                                                                                        <span className="font-bold text-slate-700 dark:text-slate-300">{actionName}</span> por <span className="font-semibold">{editorName}</span> el {dateStr}
                                                                                                        {event.event_type === 'order_edit' && (
                                                                                                            <div className="mt-0.5 font-mono text-[9px] text-blue-600 dark:text-blue-400">
                                                                                                                Monto: {formatCurrency(payload.old_total)} → {formatCurrency(payload.new_total)} (Dif: {formatCurrency(payload.difference)})
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                );
                                                                                            })}
                                                                                        </div>
                                                                                    </div>
                                                                                )}

                                                                                {/* Action Buttons for active Delivered orders */}
                                                                                {activeTab === 'Entregado' && (
                                                                                    <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                                                                                        <button
                                                                                            onClick={() => openEditOrderModal(order)}
                                                                                            className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                                                                        >
                                                                                            <span className="material-symbols-outlined text-[13px]">edit_note</span>
                                                                                            Editar Venta
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={async () => {
                                                                                                try {
                                                                                                    await reprintOrderReceipt(order.id);
                                                                                                    alert(`Recibo de la orden #${order.id} enviado a la impresora (2 copias).`);
                                                                                                } catch (err: any) {
                                                                                                    alert(`Error reimprimiendo recibo: ${err?.message || err}`);
                                                                                                }
                                                                                            }}
                                                                                            className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                                                                                        >
                                                                                            <span className="material-symbols-outlined text-[13px]">print</span>
                                                                                            Reimprimir Recibo
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => handleCancelOrder(order)}
                                                                                            className="flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-3 py-1.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors ml-auto"
                                                                                        >
                                                                                            <span className="material-symbols-outlined text-[13px]">person_cancel</span>
                                                                                            Dar de Baja (Cancelar)
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Edición de Venta Entregada */}
            {isEditModalOpen && orderToEdit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-4xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-500">edit_note</span>
                                    Modificar Venta #{orderToEdit.id}
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Modifica de forma segura la cantidad, precios o productos de esta venta.
                                </p>
                            </div>
                            <button 
                                onClick={() => {
                                    setIsEditModalOpen(false);
                                    setOrderToEdit(null);
                                    setEditCartItems([]);
                                }}
                                className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Search and Cart layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 py-4 overflow-y-auto flex-1">
                            {/* Left: Product search & Add */}
                            <div className="lg:col-span-2 flex flex-col gap-3 min-h-0">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Agregar Repuestos
                                </label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">search</span>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => handleProductSearch(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-300 dark:border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        placeholder="Buscar por SKU o Nombre..."
                                    />
                                </div>

                                {/* Search Results */}
                                <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg p-2 space-y-1 bg-slate-50/50 dark:bg-[#0d1117]/30 min-h-[150px]">
                                    {isSearchingProducts ? (
                                        <div className="text-center text-xs text-slate-400 py-8 animate-pulse">Buscando productos...</div>
                                    ) : searchResults.length === 0 ? (
                                        <div className="text-center text-xs text-slate-400 py-8">
                                            {searchQuery ? 'No se encontraron repuestos.' : 'Escribe arriba para buscar repuestos.'}
                                        </div>
                                    ) : (
                                        searchResults.map((prod) => {
                                            const whId = orderToEdit.warehouse_id || 0;
                                            const stockLevel = prod.inventory_levels?.find((il: any) => il.warehouse_id === whId);
                                            const currentStock = stockLevel?.current_stock || 0;
                                            const hasStock = whId === 0 || currentStock > 0;
                                            const whName = stockLevel?.warehouses?.name || 'Manual';

                                            return (
                                                <button
                                                    key={prod.id}
                                                    onClick={() => addProductToEditCart(prod, whId, whName, currentStock)}
                                                    disabled={!hasStock}
                                                    className="w-full flex justify-between items-center p-2 text-left bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded hover:border-blue-500/50 transition-colors disabled:opacity-40"
                                                >
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px] sm:max-w-none">{prod.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono">{prod.sku}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">{formatCurrency(prod.price)}</div>
                                                        <div className={`text-[9px] font-bold uppercase ${hasStock ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                            {whId === 0 ? 'Manual' : `Stock: ${currentStock}`}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Right: Items currently in the cart to modify */}
                            <div className="lg:col-span-3 flex flex-col min-h-0 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-[#161b22]">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                    Detalle del Ajuste de Venta
                                </label>
                                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                                    {editCartItems.map((item) => {
                                        const subtotal = item.quantity * item.unit_price;
                                        return (
                                            <div key={item.product_id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-slate-800/80 rounded-lg">
                                                <div className="flex-1 pr-4">
                                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{item.name}</div>
                                                    <div className="text-[9px] text-slate-400 font-mono">{item.sku} · {item.warehouse_name}</div>
                                                </div>

                                                {/* Price input */}
                                                <div className="w-20 mr-4">
                                                    <input 
                                                        type="number"
                                                        step="0.01"
                                                        value={item.unit_price}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            setEditCartItems(prev => prev.map(c =>
                                                                c.product_id === item.product_id ? { ...c, unit_price: val } : c
                                                            ));
                                                        }}
                                                        className="w-full text-xs font-mono border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 rounded text-right"
                                                    />
                                                </div>

                                                {/* Quantity adjuster */}
                                                <div className="flex items-center gap-1 mr-4">
                                                    <button
                                                        onClick={() => updateEditCartQty(item.product_id, item.quantity - 1)}
                                                        className="p-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">remove</span>
                                                    </button>
                                                    <span className="font-mono text-xs font-bold w-6 text-center">{item.quantity}</span>
                                                    <button
                                                        onClick={() => updateEditCartQty(item.product_id, item.quantity + 1)}
                                                        className="p-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">add</span>
                                                    </button>
                                                </div>

                                                <div className="text-right min-w-[70px] mr-4 font-mono text-xs font-bold">
                                                    {formatCurrency(subtotal)}
                                                </div>

                                                {/* Delete button */}
                                                <button
                                                    onClick={() => setEditCartItems(prev => prev.filter(c => c.product_id !== item.product_id))}
                                                    className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Totals Summary */}
                                <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                                    {orderToEdit.shipping_cost > 0 && (
                                        <div className="flex justify-between">
                                            <span>Cargo Envío:</span>
                                            <span className="font-mono font-semibold">{formatCurrency(orderToEdit.shipping_cost)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span>Total Anterior:</span>
                                        <span className="font-mono font-semibold">{formatCurrency(orderToEdit.total_amount)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-800 dark:text-slate-200 font-bold text-sm">
                                        <span>Total Ajustado:</span>
                                        <span className="font-mono text-blue-600 dark:text-blue-400">{formatCurrency(editCartTotal)}</span>
                                    </div>

                                    {/* Delta difference */}
                                    <div className="flex justify-between border-t border-dashed border-slate-200 dark:border-slate-800 pt-1.5 font-bold">
                                        <span>Diferencia (Caja):</span>
                                        <span className={`font-mono text-sm ${editCartTotal - orderToEdit.total_amount >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                            {editCartTotal - orderToEdit.total_amount >= 0 ? '+' : ''}{formatCurrency(editCartTotal - orderToEdit.total_amount)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer buttons */}
                        <div className="flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-4">
                            <button
                                onClick={() => {
                                    setIsEditModalOpen(false);
                                    setOrderToEdit(null);
                                    setEditCartItems([]);
                                }}
                                disabled={isSavingEdit}
                                className="px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveOrderEdits}
                                disabled={editCartItems.length === 0 || isSavingEdit}
                                className="px-5 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 disabled:bg-blue-400 disabled:cursor-not-allowed"
                            >
                                {isSavingEdit ? (
                                    <>
                                        <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[14px]">save</span>
                                        Guardar Ajustes
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyRegistry;
