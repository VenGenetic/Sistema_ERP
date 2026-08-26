import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { reprintOrderReceipt } from '../utils/thermalReceipt';
import {
    FREE_SALE_WAREHOUSE_ID,
    InventoryLevelRow,
    isFreeSaleProduct,
    readDefaultWarehouseId,
    resolveWarehouseForLine,
} from '../utils/warehouseResolution';
import {
  BadgeCheck,
  BanknoteX,
  Calendar,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleX,
  FilePen,
  History,
  Loader2,
  Minus,
  Package,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  Store,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserX,
  X,
} from 'lucide-react';

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
    // Bodegas activas, para resolver de cuál sale cada línea al editar una orden
    const [warehouseNames, setWarehouseNames] = useState<Map<number, string>>(new Map());

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

        const { data: warehouses } = await supabase
            .from('warehouses').select('id, name').eq('is_active', true);
        if (warehouses) {
            setWarehouseNames(new Map<number, string>(warehouses.map((w: any) => [w.id, w.name])));
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
            const defaultWarehouseId = readDefaultWarehouseId();

            // La bodega se resuelve por producto, no desde orders.warehouse_id:
            // esa columna nunca se llena, así que caía siempre en 0 ("Manual")
            // y los ajustes de una orden editada no tocaban el inventario.
            const itemsWithStock = await Promise.all(order.order_items.map(async (item) => {
                const { data: levels } = await supabase
                    .from('inventory_levels')
                    .select('current_stock, warehouse_id, warehouses (name)')
                    .eq('product_id', item.product_id);

                const rows = (levels || []) as InventoryLevelRow[];
                const resolved = isFreeSaleProduct(item.products?.sku, rows)
                    ? { warehouse_id: FREE_SALE_WAREHOUSE_ID, warehouse_name: 'Manual', current_stock: 999 }
                    : resolveWarehouseForLine(rows, item.quantity, warehouseNames, defaultWarehouseId);

                const whId = resolved?.warehouse_id ?? FREE_SALE_WAREHOUSE_ID;
                const whName = resolved?.warehouse_name ?? 'Manual';
                const stock = resolved ? resolved.current_stock : 999;

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
                    <h1 className="text-2xl font-bold text-fg tracking-tight">
                        Cierre y Registro Diario
                    </h1>
                    <p className="text-sm text-fg-muted mt-1">
                        Ingresos y control diario de ventas (hora Ecuador). Modifica o anula transacciones de forma segura.
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
                    <div className="flex bg-surface-3 p-1 rounded-lg">
                        {([['Hoy', 0], ['7 Días', 7], ['Mes', 30]] as [string, number][]).map(([label, days]) => (
                            <button
                                key={label}
                                onClick={() => setQuickRange(days)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${ activeBtn(days) ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-700 hover:bg-white dark:hover:bg-slate-700' }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 bg-surface px-3 py-1.5 border border-subtle rounded-lg shadow-sm">
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            className="bg-transparent text-sm outline-none text-fg font-medium"
                        />
                        <span className="text-fg-subtle">→</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            className="bg-transparent text-sm outline-none text-fg font-medium"
                        />
                    </div>
                    <button
                        onClick={fetchDailyData}
                        disabled={loading}
                        title="Actualizar"
                        className="p-2 rounded-lg bg-surface border border-subtle shadow-sm hover:bg-surface-hover transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={20} className={`text-fg-muted ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                    </button>
                </div>
            </div>

            {/* Tab Selector */}
            <div className="flex border-b border-subtle">
                <button
                    onClick={() => {
                        setActiveTab('Entregado');
                        setExpandedDate(null);
                    }}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors ${ activeTab === 'Entregado' ? 'border-primary text-primary dark:text-primary' : 'border-transparent text-fg-muted hover:text-slate-700 dark:hover:text-slate-300' }`}
                >
                    <BadgeCheck size={18} aria-hidden="true" />
                    Ventas Entregadas (Activas)
                </button>
                <button
                    onClick={() => {
                        setActiveTab('Cancelado');
                        setExpandedDate(null);
                    }}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors ${ activeTab === 'Cancelado' ? 'border-danger text-danger dark:text-danger' : 'border-transparent text-fg-muted hover:text-slate-700 dark:hover:text-slate-300' }`}
                >
                    <CircleX size={18} aria-hidden="true" />
                    Dadas de Baja (Canceladas)
                </button>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="flex items-center gap-3 bg-danger-soft border border-danger/20 rounded-xl px-4 py-3">
                    <CircleAlert size={20} className="text-danger" aria-hidden="true" />
                    <p className="text-sm text-danger font-medium">{error}</p>
                </div>
            )}

            {/* KPI Cards (Contextual dynamically changed based on the active tab) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface p-5 rounded-xl border border-subtle flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-fg-muted uppercase tracking-wider">
                            {activeTab === 'Entregado' ? 'Ingreso Total' : 'Total Revertido'}
                        </span>
                        {/* La rama ya determina el estado: el color va fijo en cada una. */}
                        {activeTab === 'Entregado'
                            ? <Store size={18} className="text-success" aria-hidden="true" />
                            : <BanknoteX size={18} className="text-danger" aria-hidden="true" />}
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-bold text-fg font-mono">
                            {loading ? <span className="animate-pulse text-fg-subtle">···</span> : formatCurrency(totalKPIs.revenue)}
                        </div>
                    </div>
                </div>

                <div className="bg-surface p-5 rounded-xl border border-subtle flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-fg-muted uppercase tracking-wider">
                            {activeTab === 'Entregado' ? 'Costo (COGS)' : 'Costo Reingresado'}
                        </span>
                        <Package size={18} className="text-warning" aria-hidden="true" />
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-bold text-fg font-mono">
                            {loading ? <span className="animate-pulse text-fg-subtle">···</span> : formatCurrency(totalKPIs.cost)}
                        </div>
                    </div>
                </div>

                <div className={`${activeTab === 'Entregado' ? 'bg-success-soft border-success/20 dark:border-success/30' : 'bg-danger-soft border-danger/20 dark:border-danger/30'} p-5 rounded-xl border flex flex-col justify-between shadow-sm`}>
                    <div className="flex justify-between items-start">
                        <span className={`text-xs font-bold uppercase tracking-wider ${activeTab === 'Entregado' ? 'text-success dark:text-success' : 'text-danger dark:text-danger'}`}>
                            {activeTab === 'Entregado' ? 'Ganancia Bruta' : 'Pérdida de Margen'}
                        </span>
                        {activeTab === 'Entregado'
                            ? <TrendingUp size={18} className="text-success" aria-hidden="true" />
                            : <TrendingDown size={18} className="text-danger" aria-hidden="true" />}
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                        <div className={`text-3xl font-bold font-mono ${activeTab === 'Entregado' ? 'text-success dark:text-success' : 'text-danger dark:text-danger'}`}>
                            {loading ? <span className="animate-pulse text-fg-subtle">···</span> : formatCurrency(totalKPIs.profit)}
                        </div>
                        {!loading && totalKPIs.revenue > 0 && activeTab === 'Entregado' && (
                            <div className="text-sm font-bold text-success mb-1">
                                {((totalKPIs.profit / totalKPIs.revenue) * 100).toFixed(1)}% Mgn
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-surface p-5 rounded-xl border border-subtle flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-fg-muted uppercase tracking-wider">
                            {activeTab === 'Entregado' ? 'Ventas Completadas' : 'Ventas Canceladas'}
                        </span>
                        <ReceiptText size={18} className="text-primary" aria-hidden="true" />
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-bold text-fg font-mono">
                            {loading ? <span className="animate-pulse text-fg-subtle">···</span> : totalKPIs.orders}
                        </div>
                    </div>
                </div>
            </div>

            {/* Daily Registry Table */}
            <div className="bg-surface rounded-xl border border-subtle shadow-sm overflow-hidden flex-1">
                <div className="px-6 py-4 border-b border-subtle flex items-center justify-between">
                    <h3 className="font-bold text-fg">
                        Desglose por Día ({activeTab === 'Entregado' ? 'Ventas Activas' : 'Ventas de Baja'})
                    </h3>
                    {loading && (
                        <span className="text-xs text-primary font-medium animate-pulse flex items-center gap-1">
                            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                            Cargando...
                        </span>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-surface-2 border-b border-subtle">
                            <tr>
                                <th className="px-4 py-2.5 text-xs font-bold text-fg-muted uppercase tracking-wider w-10"></th>
                                <th className="px-4 py-2.5 text-xs font-bold text-fg-muted uppercase tracking-wider">Fecha</th>
                                <th className="px-4 py-2.5 text-xs font-bold text-fg-muted uppercase tracking-wider text-right">Órdenes</th>
                                <th className="px-4 py-2.5 text-xs font-bold text-fg-muted uppercase tracking-wider text-right">Monto</th>
                                <th className="px-4 py-2.5 text-xs font-bold text-fg-muted uppercase tracking-wider text-right">Costo</th>
                                <th className="px-4 py-2.5 text-xs font-bold text-fg-muted uppercase tracking-wider text-right">
                                    {activeTab === 'Entregado' ? 'Ganancia' : 'Pérdida'}
                                </th>
                                <th className="px-4 py-2.5 text-xs font-bold text-fg-muted uppercase tracking-wider text-right">Margen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {!loading && dailySummaries.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center text-fg-muted">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Calendar size={32} className="text-fg-subtle" aria-hidden="true" />
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
                                        <td className="px-4 py-3"><div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                                        <td className="px-4 py-3"><div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                                        <td className="px-4 py-3 text-right"><div className="h-4 w-8 bg-slate-200 dark:bg-slate-700 rounded ml-auto"></div></td>
                                        <td className="px-4 py-3 text-right"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded ml-auto"></div></td>
                                        <td className="px-4 py-3 text-right"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded ml-auto"></div></td>
                                        <td className="px-4 py-3 text-right"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded ml-auto"></div></td>
                                        <td className="px-4 py-3 text-right"><div className="h-4 w-14 bg-slate-200 dark:bg-slate-700 rounded ml-auto"></div></td>
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
                                            className={`hover:bg-surface-hover transition-colors cursor-pointer ${isExpanded ? 'bg-primary-soft/30 dark:bg-primary/10' : ''}`}
                                            onClick={() => setExpandedDate(isExpanded ? null : day.date)}
                                        >
                                            <td className="px-4 py-3 text-center">
                                                <ChevronRight size={18} className={`text-fg-subtle transition-transform duration-200 ${isExpanded ? 'rotate-90 text-primary' : ''}`} aria-hidden="true" />
                                            </td>
                                            <td className="px-4 py-3 text-sm font-bold text-fg">
                                                {new Date(day.date + 'T12:00:00').toLocaleDateString('es-EC', {
                                                    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                                                })}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-fg font-mono text-right">
                                                <span className="bg-surface-3 px-2 py-1 rounded">{day.orderCount}</span>
                                            </td>
                                            <td className={`px-4 py-3 text-sm font-bold text-right font-mono ${activeTab === 'Entregado' ? 'text-success' : 'text-danger'}`}>
                                                {formatCurrency(day.revenue)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-fg-muted text-right font-mono">
                                                {formatCurrency(day.cost)}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-bold text-fg text-right font-mono">
                                                {formatCurrency(day.profit)}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium text-right">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${ activeTab === 'Cancelado' ? 'bg-slate-100 text-fg-muted dark:bg-slate-800 dark:text-slate-400' : Number(margin) < 20 ? 'bg-danger-soft text-danger dark:text-danger' : Number(margin) < 40 ? 'bg-warning-soft text-warning dark:text-warning' : 'bg-success-soft text-success dark:text-success' }`}>
                                                    {margin}%
                                                </span>
                                            </td>
                                        </tr>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <tr className="bg-slate-50/50 dark:bg-[#0d1117] border-b-2 border-subtle">
                                                <td colSpan={7} className="p-0">
                                                    <div className={`px-8 py-4 border-l-4 ${activeTab === 'Entregado' ? 'border-primary' : 'border-danger'}`}>
                                                        <h4 className="text-xs font-bold text-fg-muted uppercase tracking-widest mb-3">
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
                                                                        className="flex flex-col gap-3 p-3 bg-surface border border-subtle rounded-lg shadow-sm cursor-pointer hover:border-primary/50 transition-all group/card"
                                                                    >
                                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                                                                            <div className="flex items-center gap-4">
                                                                                <div className="flex items-center gap-2">
                                                                                    <ChevronDown size={14} className={`text-fg-subtle transition-transform duration-200 ${isOrderExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                                                                                    <div className="bg-primary-soft text-primary-soft-fg font-bold font-mono text-xs px-2 py-1 rounded">
                                                                                        #{order.id}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-sm font-bold text-fg">
                                                                                        {order.customers?.name || 'Mostrador / POS'}
                                                                                        {justUpdatedId === order.id && (
                                                                                            <span className="ml-2 text-2xs bg-success-soft text-success-soft-fg px-1.5 py-0.5 rounded animate-bounce">
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
                                                                                                className="text-xs border border-primary rounded px-1.5 py-0.5 outline-none bg-surface text-fg font-mono disabled:opacity-50"
                                                                                                autoFocus
                                                                                            />
                                                                                            <button
                                                                                                onClick={() => handleUpdateOrderDate(order.id)}
                                                                                                disabled={loading}
                                                                                                className="text-2xs min-w-[60px] font-bold bg-success text-white px-2 py-0.5 rounded hover:bg-success transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
                                                                                            >
                                                                                                {loading ? '...' : 'Guardar'}
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => { setEditingOrderId(null); setEditingDate(''); }}
                                                                                                disabled={loading}
                                                                                                className="text-2xs font-bold bg-slate-200 text-fg-muted px-2 py-0.5 rounded hover:bg-slate-300 transition-colors disabled:opacity-50"
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
                                                                                                className={`text-xs text-fg-muted flex items-center gap-1 mt-0.5 transition-colors group/edit ${activeTab === 'Entregado' ? 'hover:text-primary' : ''}`}
                                                                                                title={activeTab === 'Entregado' ? "Cambiar fecha del registro" : ""}
                                                                                            >
                                                                                                <Calendar size={12} aria-hidden="true" />
                                                                                                {toLocalDate(order.created_at)} · {new Date(order.created_at).toLocaleTimeString('es-EC', {
                                                                                                    hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil'
                                                                                                })}
                                                                                                {activeTab === 'Entregado' && (
                                                                                                    <Pencil size={11} className="opacity-0 group-hover/edit:opacity-60" aria-hidden="true" />
                                                                                                )}
                                                                                            </button>

                                                                                            {/* Cancelled by info display */}
                                                                                            {activeTab === 'Cancelado' && order.status_updated_by && (
                                                                                                <span className="text-xs text-danger font-bold flex items-center gap-1 mt-1">
                                                                                                    <UserX size={14} aria-hidden="true" />
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
                                                                                    <div className="text-xs text-fg-subtle uppercase font-bold">
                                                                                        {activeTab === 'Entregado' ? 'Ganancia' : 'Pérdida'}
                                                                                    </div>
                                                                                    <div className={`text-sm font-bold font-mono ${orderProfit >= 0 ? 'text-success dark:text-success' : 'text-danger'}`}>
                                                                                        {formatCurrency(orderProfit)}
                                                                                    </div>
                                                                                </div>
                                                                                <div>
                                                                                    <div className="text-xs text-fg-subtle uppercase font-bold">Total</div>
                                                                                    <div className="text-sm font-bold text-fg font-mono">
                                                                                        {formatCurrency(Number(order.total_amount))}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Detailed item list collapse */}
                                                                        {isOrderExpanded && (
                                                                            <div 
                                                                                className="bg-surface-2 rounded-lg p-3 border border-slate-100 dark:border-slate-800/50 animate-in fade-in slide-in-from-top-1 duration-200 flex flex-col gap-4"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                                <table className="w-full text-left">
                                                                                    <thead>
                                                                                        <tr className="text-2xs uppercase tracking-tighter text-fg-subtle font-bold border-b border-subtle">
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
                                                                                                <tr key={idx} className="text-[11px] text-fg-muted hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                                                                                                    <td className="py-1.5 font-mono font-bold">{item.quantity}</td>
                                                                                                    <td className="py-1.5 pr-4 truncate max-w-[200px] md:max-w-none">
                                                                                                        {item.products?.name || 'Producto desconocido'}
                                                                                                    </td>
                                                                                                    <td className="py-1.5 text-right font-mono">{formatCurrency(Number(item.unit_price))}</td>
                                                                                                    <td className="py-1.5 text-right font-mono font-bold text-fg">
                                                                                                        {formatCurrency(subtotal)}
                                                                                                    </td>
                                                                                                </tr>
                                                                                            );
                                                                                        })}
                                                                                        {Number(order.shipping_cost) > 0 && (
                                                                                            <tr className="text-[11px] text-fg-muted italic">
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
                                                                                    <div className="border-t border-subtle pt-3">
                                                                                        <h5 className="text-2xs uppercase font-bold text-fg-subtle tracking-wider mb-1.5 flex items-center gap-1">
                                                                                            <History size={12} aria-hidden="true" />
                                                                                            Historial de Auditoría
                                                                                        </h5>
                                                                                        <div className="space-y-1 max-h-[100px] overflow-y-auto">
                                                                                            {orderHistory[order.id].map((event, evIdx) => {
                                                                                                const payload = event.payload || {};
                                                                                                const actionName = event.event_type === 'order_edit' ? 'Modificación' : 'Baja (Cancelado)';
                                                                                                const editorName = payload.user_email || profilesMap.get(payload.edited_by || payload.cancelled_by) || 'Desconocido';
                                                                                                const dateStr = new Date(event.created_at).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' });

                                                                                                return (
                                                                                                    <div key={evIdx} className="text-2xs text-fg-muted bg-surface-3 rounded p-1.5 border border-subtle">
                                                                                                        <span className="font-bold text-fg">{actionName}</span> por <span className="font-semibold">{editorName}</span> el {dateStr}
                                                                                                        {event.event_type === 'order_edit' && (
                                                                                                            <div className="mt-0.5 font-mono text-[12px] text-primary">
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
                                                                                            className="flex items-center gap-1 text-[11px] font-bold text-primary-soft-fg bg-primary-soft px-3 py-1.5 rounded hover:bg-primary-soft transition-colors"
                                                                                        >
                                                                                            <FilePen size={14} aria-hidden="true" />
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
                                                                                            className="flex items-center gap-1 text-[11px] font-bold text-success-soft-fg bg-success-soft px-3 py-1.5 rounded hover:bg-success-soft transition-colors"
                                                                                        >
                                                                                            <Printer size={14} aria-hidden="true" />
                                                                                            Reimprimir Recibo
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => handleCancelOrder(order)}
                                                                                            className="flex items-center gap-1 text-[11px] font-bold text-danger-soft-fg bg-danger-soft px-3 py-1.5 rounded hover:bg-danger-soft transition-colors ml-auto"
                                                                                        >
                                                                                            <UserX size={14} aria-hidden="true" />
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
                    <div className="bg-surface border border-subtle rounded-2xl shadow-xl p-6 w-full max-w-4xl flex flex-col max-h-[85dvh] animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="flex justify-between items-center pb-4 border-b border-subtle">
                            <div>
                                <h2 className="text-lg font-bold text-fg flex items-center gap-2">
                                    <FilePen size={18} className="text-primary" aria-hidden="true" />
                                    Modificar Venta #{orderToEdit.id}
                                </h2>
                                <p className="text-xs text-fg-muted">
                                    Modifica de forma segura la cantidad, precios o productos de esta venta.
                                </p>
                            </div>
                            <button 
                                onClick={() => {
                                    setIsEditModalOpen(false);
                                    setOrderToEdit(null);
                                    setEditCartItems([]);
                                }}
                                className="p-1 rounded-full text-fg-subtle hover:bg-surface-hover hover:text-slate-600"
                            >
                                <X size={18} aria-hidden="true" />
                            </button>
                        </div>

                        {/* Search and Cart layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 py-4 overflow-y-auto flex-1">
                            {/* Left: Product search & Add */}
                            <div className="lg:col-span-2 flex flex-col gap-3 min-h-0">
                                <label className="block text-xs font-bold text-fg-muted uppercase tracking-wider">
                                    Agregar Repuestos
                                </label>
                                <div className="relative">
                                    <Search size={18} className="absolute left-3 top-2.5 text-fg-subtle" aria-hidden="true" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => handleProductSearch(e.target.value)}
                                        className="w-full bg-surface-2 border border-strong rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                        placeholder="Buscar por SKU o Nombre..."
                                    />
                                </div>

                                {/* Search Results */}
                                <div className="flex-1 overflow-y-auto border border-subtle rounded-lg p-2 space-y-1 bg-slate-50/50 dark:bg-[#0d1117]/30 min-h-[150px]">
                                    {isSearchingProducts ? (
                                        <div className="text-center text-xs text-fg-subtle py-8 animate-pulse">Buscando productos...</div>
                                    ) : searchResults.length === 0 ? (
                                        <div className="text-center text-xs text-fg-subtle py-8">
                                            {searchQuery ? 'No se encontraron repuestos.' : 'Escribe arriba para buscar repuestos.'}
                                        </div>
                                    ) : (
                                        searchResults.map((prod) => {
                                            // La bodega sale del propio producto. Con
                                            // orderToEdit.warehouse_id (siempre null) todo
                                            // caía en 0 y se agregaba como "Manual", sin
                                            // descontar nunca del inventario.
                                            const levels = (prod.inventory_levels || []) as InventoryLevelRow[];
                                            const resolved = isFreeSaleProduct(prod.sku, levels)
                                                ? { warehouse_id: FREE_SALE_WAREHOUSE_ID, warehouse_name: 'Manual', current_stock: 9999 }
                                                : resolveWarehouseForLine(levels, 1, warehouseNames, readDefaultWarehouseId());
                                            const whId = resolved?.warehouse_id ?? FREE_SALE_WAREHOUSE_ID;
                                            const currentStock = resolved?.current_stock ?? 0;
                                            const hasStock = whId === FREE_SALE_WAREHOUSE_ID || currentStock > 0;
                                            const whName = resolved?.warehouse_name || 'Manual';

                                            return (
                                                <button
                                                    key={prod.id}
                                                    onClick={() => addProductToEditCart(prod, whId, whName, currentStock)}
                                                    disabled={!hasStock}
                                                    className="w-full flex justify-between items-center p-2 text-left bg-surface border border-subtle rounded hover:border-primary/50 transition-colors disabled:opacity-40"
                                                >
                                                    <div>
                                                        <div className="text-xs font-bold text-fg truncate max-w-[150px] sm:max-w-none">{prod.name}</div>
                                                        <div className="text-2xs text-fg-subtle font-mono">{prod.sku}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs font-bold text-fg font-mono">{formatCurrency(prod.price)}</div>
                                                        <div className={`text-[12px] font-bold uppercase ${hasStock ? 'text-success' : 'text-danger'}`}>
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
                            <div className="lg:col-span-3 flex flex-col min-h-0 border border-subtle rounded-xl p-4 bg-surface">
                                <label className="block text-xs font-bold text-fg-muted uppercase tracking-wider mb-3">
                                    Detalle del Ajuste de Venta
                                </label>
                                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                                    {editCartItems.map((item) => {
                                        const subtotal = item.quantity * item.unit_price;
                                        return (
                                            <div key={item.product_id} className="flex justify-between items-center p-3 bg-surface-2 border border-subtle rounded-lg">
                                                <div className="flex-1 pr-4">
                                                    <div className="text-xs font-bold text-fg truncate max-w-[200px]">{item.name}</div>
                                                    <div className="text-[12px] text-fg-subtle font-mono">{item.sku} · {item.warehouse_name}</div>
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
                                                        className="w-full text-xs font-mono border border-strong bg-surface p-1 rounded text-right"
                                                    />
                                                </div>

                                                {/* Quantity adjuster */}
                                                <div className="flex items-center gap-1 mr-4">
                                                    <button
                                                        onClick={() => updateEditCartQty(item.product_id, item.quantity - 1)}
                                                        className="p-1 rounded bg-slate-200 dark:bg-slate-800 text-fg-muted hover:bg-slate-300"
                                                    >
                                                        <Minus size={14} aria-hidden="true" />
                                                    </button>
                                                    <span className="font-mono text-xs font-bold w-6 text-center">{item.quantity}</span>
                                                    <button
                                                        onClick={() => updateEditCartQty(item.product_id, item.quantity + 1)}
                                                        className="p-1 rounded bg-slate-200 dark:bg-slate-800 text-fg-muted hover:bg-slate-300"
                                                    >
                                                        <Plus size={14} aria-hidden="true" />
                                                    </button>
                                                </div>

                                                <div className="text-right min-w-[70px] mr-4 font-mono text-xs font-bold">
                                                    {formatCurrency(subtotal)}
                                                </div>

                                                {/* Delete button */}
                                                <button
                                                    onClick={() => setEditCartItems(prev => prev.filter(c => c.product_id !== item.product_id))}
                                                    className="p-1 text-danger hover:bg-danger-soft rounded"
                                                >
                                                    <Trash2 size={18} aria-hidden="true" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Totals Summary */}
                                <div className="border-t border-subtle pt-4 mt-3 space-y-1.5 text-xs text-fg-muted">
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
                                    <div className="flex justify-between text-fg font-bold text-sm">
                                        <span>Total Ajustado:</span>
                                        <span className="font-mono text-primary">{formatCurrency(editCartTotal)}</span>
                                    </div>

                                    {/* Delta difference */}
                                    <div className="flex justify-between border-t border-dashed border-subtle pt-1.5 font-bold">
                                        <span>Diferencia (Caja):</span>
                                        <span className={`font-mono text-sm ${editCartTotal - orderToEdit.total_amount >= 0 ? 'text-success' : 'text-danger'}`}>
                                            {editCartTotal - orderToEdit.total_amount >= 0 ? '+' : ''}{formatCurrency(editCartTotal - orderToEdit.total_amount)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer buttons */}
                        <div className="flex justify-end gap-2 border-t border-subtle pt-4">
                            <button
                                onClick={() => {
                                    setIsEditModalOpen(false);
                                    setOrderToEdit(null);
                                    setEditCartItems([]);
                                }}
                                disabled={isSavingEdit}
                                className="px-4 py-2 text-xs font-bold bg-slate-100 text-fg-muted rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveOrderEdits}
                                disabled={editCartItems.length === 0 || isSavingEdit}
                                className="px-5 py-2 text-xs font-bold bg-primary text-white rounded-lg hover:bg-primary transition-colors flex items-center gap-1.5 disabled:bg-primary disabled:cursor-not-allowed"
                            >
                                {isSavingEdit ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Save size={14} aria-hidden="true" />
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
