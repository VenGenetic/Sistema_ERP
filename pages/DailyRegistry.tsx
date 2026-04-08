import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

interface OrderItem {
    quantity: number;
    unit_price: number;
    unit_cost: number;
}

interface Order {
    id: number;
    created_at: string;
    total_amount: number;
    shipping_cost: number;
    status: string;
    profiles: { full_name: string } | null;
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

const DailyRegistry: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [expandedDate, setExpandedDate] = useState<string | null>(null);

    // Filter states
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
        start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchDailyData();
    }, [dateRange]);

    const fetchDailyData = async () => {
        setLoading(true);
        try {
            // Only fetching completed or shipped orders to represent actual realized income
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id,
                    created_at,
                    total_amount,
                    shipping_cost,
                    status,
                    profiles:customer_id(full_name),
                    order_items(quantity, unit_price, unit_cost)
                `)
                .in('status', ['completed', 'shipped'])
                .gte('created_at', `${dateRange.start}T00:00:00`)
                .lte('created_at', `${dateRange.end}T23:59:59`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data as unknown as Order[] || []);
        } catch (error) {
            console.error('Error fetching daily registry:', error);
        } finally {
            setLoading(false);
        }
    };

    const dailySummaries: DailySummary[] = useMemo(() => {
        const summaryMap: Record<string, DailySummary> = {};

        orders.forEach(order => {
            // Extract local date string YYYY-MM-DD
            const dateStr = new Date(order.created_at).toLocaleDateString('es-EC', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).split('/').reverse().join('-'); // format normalization

            // Or use an easier date string without timezone issues conceptually for UI grouping
            const displayDate = new Date(order.created_at).toISOString().split('T')[0];

            if (!summaryMap[displayDate]) {
                summaryMap[displayDate] = {
                    date: displayDate,
                    revenue: 0,
                    cost: 0,
                    profit: 0,
                    orderCount: 0,
                    orders: []
                };
            }

            const r = summaryMap[displayDate];
            r.revenue += Number(order.total_amount || 0);

            let orderCost = 0;
            order.order_items?.forEach(item => {
                orderCost += Number(item.unit_cost || 0) * Number(item.quantity || 0);
            });

            r.cost += orderCost;
            r.profit += (Number(order.total_amount || 0) - orderCost);
            r.orderCount += 1;
            r.orders.push(order);
        });

        // Convert map to array and sort descending
        return Object.values(summaryMap).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [orders]);

    const totalKPIs = useMemo(() => {
        return dailySummaries.reduce((acc, curr) => {
            acc.revenue += curr.revenue;
            acc.cost += curr.cost;
            acc.profit += curr.profit;
            acc.orders += curr.orderCount;
            return acc;
        }, { revenue: 0, cost: 0, profit: 0, orders: 0 });
    }, [dailySummaries]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    };

    const setQuickRange = (days: number) => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);
        setDateRange({
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        });
    };

    return (
        <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Cierre y Registro Diario</h1>
                    <p className="text-sm text-slate-500 mt-1">Análisis de ingresos, costos y ganancias agrupados por día de operación.</p>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                        <button onClick={() => setQuickRange(0)} className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors">Hoy</button>
                        <button onClick={() => setQuickRange(7)} className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors">7 Días</button>
                        <button onClick={() => setQuickRange(30)} className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors">Mes</button>
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
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ingreso Total</span>
                        <span className="material-symbols-outlined text-emerald-500">point_of_sale</span>
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-bold text-slate-900 dark:text-white font-mono">{loading ? '...' : formatCurrency(totalKPIs.revenue)}</div>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Costo (COGS)</span>
                        <span className="material-symbols-outlined text-rose-500">inventory_2</span>
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-bold text-slate-900 dark:text-white font-mono">{loading ? '...' : formatCurrency(totalKPIs.cost)}</div>
                    </div>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-5 rounded-xl border border-emerald-200 dark:border-emerald-900/30 flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Ganancia Bruta</span>
                        <span className="material-symbols-outlined text-emerald-500">trending_up</span>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                        <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">{loading ? '...' : formatCurrency(totalKPIs.profit)}</div>
                        <div className="text-sm font-bold text-emerald-600 dark:text-emerald-500 mb-1">
                            {totalKPIs.revenue > 0 ? ((totalKPIs.profit / totalKPIs.revenue) * 100).toFixed(1) : 0}% Mgn
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Volumen Órdenes</span>
                        <span className="material-symbols-outlined text-blue-500">receipt_long</span>
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-bold text-slate-900 dark:text-white font-mono">{loading ? '...' : totalKPIs.orders}</div>
                    </div>
                </div>
            </div>

            {/* Daily Registry Table */}
            <div className="bg-white dark:bg-[#161b22] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex-1">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white">Desglose por Día</h3>
                    {loading && <span className="text-xs text-primary font-medium animate-pulse">Sincronizando...</span>}
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-[#0d1117] border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-16"></th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Órdenes</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ingreso</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Costo</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ganancia</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Margen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {dailySummaries.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <span className="material-symbols-outlined text-4xl text-slate-300">calendar_month</span>
                                            <p>No hay registros de ventas para el periodo seleccionado.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            
                            {dailySummaries.map((day) => {
                                const margin = day.revenue > 0 ? ((day.profit / day.revenue) * 100).toFixed(1) : '0';
                                const isExpanded = expandedDate === day.date;
                                
                                return (
                                    <React.Fragment key={day.date}>
                                        <tr 
                                            className={`hover:bg-slate-50 dark:hover:bg-[#1c2128] transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                                            onClick={() => setExpandedDate(isExpanded ? null : day.date)}
                                        >
                                            <td className="px-6 py-4 text-center">
                                                <span className={`material-symbols-outlined text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-primary' : ''}`}>
                                                    chevron_right
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">
                                                {new Date(day.date + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
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
                                                <span className={`px-2 py-1 rounded text-xs ${Number(margin) < 30 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                                                    {margin}%
                                                </span>
                                            </td>
                                        </tr>
                                        
                                        {/* Expanded Details Row */}
                                        {isExpanded && (
                                            <tr className="bg-slate-50/50 dark:bg-[#0d1117] border-b-2 border-slate-200 dark:border-slate-800">
                                                <td colSpan={7} className="p-0">
                                                    <div className="px-8 py-4 border-l-4 border-primary">
                                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Detalle de Órdenes ({day.orders.length})</h4>
                                                        <div className="grid gap-2">
                                                            {day.orders.map(order => (
                                                                <div key={order.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold font-mono text-xs px-2 py-1 rounded">
                                                                            #{order.id}
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                                                                                {order.profiles?.full_name || 'Cliente Mostrador (POS)'}
                                                                            </span>
                                                                            <span className="text-xs text-slate-500 flex items-center gap-1">
                                                                                <span className="material-symbols-outlined text-[12px]">schedule</span>
                                                                                {new Date(order.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit'})}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="mt-2 sm:mt-0 text-right">
                                                                        <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                                                                            {formatCurrency(order.total_amount)}
                                                                        </div>
                                                                        <div className="text-[10px] uppercase text-emerald-500 font-bold">
                                                                            {order.status}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
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
