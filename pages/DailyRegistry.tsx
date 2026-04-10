import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';

// Ecuador is UTC-5
const TZ_OFFSET = '-05:00';

interface OrderItem {
    quantity: number;
    unit_price: number;
    unit_cost: number;
    products: { name: string } | null;
}

interface Order {
    id: number;
    created_at: string;
    total_amount: number;
    shipping_cost: number;
    status: string;
    customers: { name: string } | null;
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

    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
        start: nDaysAgoLocal(7),
        end: todayLocal(),
    });

    useEffect(() => {
        fetchDailyData();
    }, [dateRange]);

    const fetchDailyData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Use timezone-aware timestamps so the filter respects Ecuador time (UTC-5)
            const startUTC = `${dateRange.start}T00:00:00${TZ_OFFSET}`;
            const endUTC   = `${dateRange.end}T23:59:59${TZ_OFFSET}`;

            // Only fetch COMPLETED sales (status = 'Entregado')
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id,
                    created_at,
                    total_amount,
                    shipping_cost,
                    status,
                    customers(name),
                    order_items(
                        quantity, 
                        unit_price, 
                        unit_cost,
                        products(name)
                    )
                `)
                .eq('status', 'Entregado')
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

    const dailySummaries: DailySummary[] = useMemo(() => {
        const summaryMap: Record<string, DailySummary> = {};

        orders.forEach(order => {
            // Group by LOCAL date (UTC-5), not UTC date
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
    }, [orders]);

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
        // Guardar como mediodía Ecuador (17:00 UTC) para evitar drift de zona horaria
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

            // Actualización INMEDIATA del estado local para que el usuario vea el cambio
            setOrders(prev => prev.map(o => 
                o.id === orderId ? { ...o, created_at: newTimestamp } : o
            ));

            setEditingOrderId(null);
            setEditingDate('');
            setJustUpdatedId(orderId);
            setTimeout(() => setJustUpdatedId(null), 3000); // Quitar mensaje de éxito tras 3s
            
            // Pequeña espera para que Supabase actualice sus índices antes de re-consultar
            await new Promise(resolve => setTimeout(resolve, 800));
            await fetchDailyData();
        } catch (err: any) {
            alert(`Error inesperado: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Cierre y Registro Diario
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Ingresos y ganancias de ventas completadas, agrupadas por día (hora Ecuador).
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

            {/* Error Banner */}
            {error && (
                <div className="flex items-center gap-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-3">
                    <span className="material-symbols-outlined text-rose-500 text-[20px]">error</span>
                    <p className="text-sm text-rose-700 dark:text-rose-400 font-medium">{error}</p>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ingreso Total</span>
                        <span className="material-symbols-outlined text-emerald-500">point_of_sale</span>
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-bold text-slate-900 dark:text-white font-mono">
                            {loading ? <span className="animate-pulse text-slate-400">···</span> : formatCurrency(totalKPIs.revenue)}
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Costo (COGS)</span>
                        <span className="material-symbols-outlined text-rose-500">inventory_2</span>
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-bold text-slate-900 dark:text-white font-mono">
                            {loading ? <span className="animate-pulse text-slate-400">···</span> : formatCurrency(totalKPIs.cost)}
                        </div>
                    </div>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-5 rounded-xl border border-emerald-200 dark:border-emerald-900/30 flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Ganancia Bruta</span>
                        <span className="material-symbols-outlined text-emerald-500">trending_up</span>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                        <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                            {loading ? <span className="animate-pulse text-emerald-300">···</span> : formatCurrency(totalKPIs.profit)}
                        </div>
                        {!loading && totalKPIs.revenue > 0 && (
                            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-500 mb-1">
                                {((totalKPIs.profit / totalKPIs.revenue) * 100).toFixed(1)}% Mgn
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ventas Completadas</span>
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
                    <h3 className="font-bold text-slate-900 dark:text-white">Desglose por Día</h3>
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
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ingreso</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Costo</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ganancia</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Margen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {!loading && dailySummaries.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <span className="material-symbols-outlined text-4xl text-slate-300">calendar_month</span>
                                            <p className="font-medium">No hay ventas completadas en este período.</p>
                                            <p className="text-xs text-slate-400">Solo se muestran órdenes con estado "Entregado".</p>
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
                                            <td className="px-6 py-4 text-sm font-bold text-emerald-600 dark:text-emerald-400 text-right font-mono">
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
                                                    Number(margin) < 20
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
                                                    <div className="px-8 py-4 border-l-4 border-primary">
                                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                                                            Detalle de Órdenes ({day.orders.length})
                                                        </h4>
                                                        <div className="grid gap-2">
                                                            {day.orders.map(order => {
                                                                const orderCost = order.order_items?.reduce(
                                                                    (s, i) => s + Number(i.unit_cost || 0) * Number(i.quantity || 0), 0
                                                                ) ?? 0;
                                                                const orderProfit = Number(order.total_amount || 0) - orderCost;

                                                                return (
                                                                        <div className="flex flex-col gap-3">
                                                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                                                                                <div className="flex items-center gap-4">
                                                                                    <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold font-mono text-xs px-2 py-1 rounded">
                                                                                        #{order.id}
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

                                                                                        {/* Fecha editable inline */}
                                                                                        {editingOrderId === order.id ? (
                                                                                            <div className="flex items-center gap-1 mt-1">
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
                                                                                            <button
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    setEditingOrderId(order.id);
                                                                                                    setEditingDate(toLocalDate(order.created_at));
                                                                                                }}
                                                                                                className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 hover:text-primary transition-colors group"
                                                                                                title="Cambiar fecha del registro"
                                                                                            >
                                                                                                <span className="material-symbols-outlined text-[12px] group-hover:text-primary">calendar_today</span>
                                                                                                {toLocalDate(order.created_at)} · {new Date(order.created_at).toLocaleTimeString('es-EC', {
                                                                                                    hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil'
                                                                                                })}
                                                                                                <span className="material-symbols-outlined text-[11px] opacity-0 group-hover:opacity-60">edit</span>
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="mt-2 sm:mt-0 flex items-center gap-4 text-right">
                                                                                    <div>
                                                                                        <div className="text-xs text-slate-400 uppercase font-bold">Ganancia</div>
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

                                                                            {/* Desglose de Repuestos */}
                                                                            <div className="bg-slate-50 dark:bg-slate-900/40 rounded-md p-2 border border-slate-100 dark:border-slate-800/50">
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
                                                                            </div>
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
        </div>
    );
};

export default DailyRegistry;
