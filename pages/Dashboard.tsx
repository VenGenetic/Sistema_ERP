import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const Dashboard: React.FC = () => {
    // Phase 5: Dynamic State
    const [todaySales, setTodaySales] = useState<number>(0);
    const [lowStockCount, setLowStockCount] = useState<number>(0);
    const [topLostDemand, setTopLostDemand] = useState<{ term: string, count: number }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // 1. Today's Sales
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);

                const { data: orders } = await supabase
                    .from('orders')
                    .select('total_amount')
                    .gte('created_at', startOfDay.toISOString());

                const sales = orders?.reduce((acc, order) => acc + Number(order.total_amount), 0) || 0;
                setTodaySales(sales);

                // 2. Low Stock Alerts
                const { data: inventory } = await supabase
                    .from('inventory_levels')
                    .select('current_stock, products(id, min_stock_threshold)');

                if (inventory) {
                    const stockByProduct: Record<string, { total: number, min: number }> = {};
                    inventory.forEach((il: any) => {
                        const pid = il.products?.id;
                        if (!pid) return;
                        if (!stockByProduct[pid]) {
                            stockByProduct[pid] = { total: 0, min: Math.max(il.products.min_stock_threshold || 10, 1) };
                        }
                        stockByProduct[pid].total += il.current_stock;
                    });

                    let lowStock = 0;
                    for (const pid in stockByProduct) {
                        if (stockByProduct[pid].total <= stockByProduct[pid].min) lowStock++;
                    }
                    setLowStockCount(lowStock);
                }

                // 3. Lost Demand Rank
                const { data: lostDemand } = await supabase
                    .from('lost_demand')
                    .select('*');

                if (lostDemand) {
                    const counts: Record<string, number> = {};
                    lostDemand.forEach(row => {
                        if (row.search_term) {
                            const term = String(row.search_term).toUpperCase();
                            counts[term] = (counts[term] || 0) + 1;
                        }
                    });

                    const top5 = Object.entries(counts)
                        .map(([term, count]) => ({ term, count: count as number }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 5);

                    setTopLostDemand(top5);
                }
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    // Activity Stream consolidado basado en INVENTORY_LOGS, TRANSACTIONS y ORDERS
    const activityStream = [
        { type: 'PEDIDO', id: 'ORD-9942', time: '10:42 AM', user: 'Sistema (Auto)', detail: 'Nuevo Pedido Dropship vía TrendyShop UK', status: 'Pendiente', amount: '$124.00' },
        { type: 'STOCK', id: 'LOG-4421', time: '10:38 AM', user: 'Juan Pérez', detail: 'Movidas 50u SKU-991 Bodega Central -> Oeste', status: 'Completado', meta: 'Bodega' },
        { type: 'FINANZAS', id: 'TX-1102', time: '10:15 AM', user: 'Stripe API', detail: 'Pago recibido en Cuenta Stripe Web', status: 'Liquidado', amount: '+$2,450.00' },
        { type: 'ALERTA', id: 'SYS-001', time: '09:55 AM', user: 'Bot Inventario', detail: 'Alerta Stock Bajo: Audífonos (5 restantes)', status: 'Advertencia', meta: 'SKU-882' },
        { type: 'PEDIDO', id: 'ORD-9941', time: '09:30 AM', user: 'Sara M.', detail: 'Pedido completado manualmente', status: 'Completado', amount: '$45.00' },
    ];

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen">
            {/* Header / HUD */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Centro de Comando</h1>
                    <p className="text-slate-500 text-sm font-mono mt-1">
                        <span className="text-emerald-500 animate-pulse">● En Vivo</span> | Monitoreando 3 Bodegas, 5 Cuentas, 142 Socios
                    </p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-[#161b22] border border-slate-700 hover:border-slate-500 rounded text-slate-300 text-sm font-medium transition-all">
                        <span className="material-symbols-outlined text-[18px]">terminal</span>
                        Ejecutar Script
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded text-sm font-bold shadow-lg shadow-primary/20 transition-all">
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Crear Pedido
                    </button>
                </div>
            </div>

            {/* High Density Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                {/* Finance Metric */}
                <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] flex flex-col justify-between h-32 hover:border-slate-400 dark:hover:border-slate-600 transition-colors group cursor-pointer shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Liquidez Neta</span>
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-white transition-colors">account_balance</span>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">$71,680.50</div>
                        <div className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">trending_up</span>
                            +12.5% esta semana
                        </div>
                    </div>
                </div>

                {/* Alertas de Stock Metric */}
                <div className="p-5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-900/10 flex flex-col justify-between h-32 hover:border-rose-400 dark:hover:border-rose-600 transition-colors group cursor-pointer shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-rose-600 dark:text-rose-400 uppercase tracking-wider">Alertas de Stock</span>
                        <span className="material-symbols-outlined text-rose-400 group-hover:text-rose-600 dark:group-hover:text-rose-300 transition-colors">warning</span>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{isLoading ? '...' : lowStockCount} SKUs</div>
                        <div className="text-xs text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">trending_down</span>
                            Bajo el mínimo
                        </div>
                    </div>
                </div>

                {/* Inventory Metric */}
                <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] flex flex-col justify-between h-32 hover:border-slate-400 dark:hover:border-slate-600 transition-colors group cursor-pointer shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Salud del Inventario</span>
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-white transition-colors">inventory_2</span>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">98.2%</div>
                        <div className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">warning</span>
                            3 SKUs bajo umbral
                        </div>
                    </div>
                </div>

                {/* Ventas Hoy Metric */}
                <div className="p-5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-900/10 flex flex-col justify-between h-32 hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors group cursor-pointer shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Ventas de Hoy</span>
                        <span className="material-symbols-outlined text-emerald-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">point_of_sale</span>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                            {isLoading ? '...' : `$${todaySales.toFixed(2)}`}
                        </div>
                        <div className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            Corte de Caja local
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Operational Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Col: Live Operations Feed */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Flujo de Operaciones Unificado</h3>
                        <div className="flex gap-2">
                            <span className="px-2 py-1 rounded bg-slate-200 dark:bg-[#161b22] text-[10px] font-mono text-slate-500 border border-slate-300 dark:border-slate-800">TIEMPO REAL</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-[#0d1117] border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Hora</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Tipo</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Detalles</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Usuario/Actor</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono text-right">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {activityStream.map((item, idx) => (
                                    <tr key={idx} className="group hover:bg-slate-50 dark:hover:bg-[#1c2128] transition-colors cursor-pointer">
                                        <td className="px-6 py-4 text-xs font-mono text-slate-500">{item.time}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold border
                                                ${item.type === 'PEDIDO' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : ''}
                                                ${item.type === 'STOCK' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' : ''}
                                                ${item.type === 'FINANZAS' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : ''}
                                                ${item.type === 'ALERTA' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : ''}
                                            `}>
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm text-slate-900 dark:text-slate-200 font-medium">{item.detail}</span>
                                                <span className="text-xs text-slate-400 font-mono mt-0.5">{item.id} {item.amount && `• ${item.amount}`}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-500">{item.user}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`text-xs font-medium 
                                                ${item.status === 'Advertencia' ? 'text-rose-500' : 'text-slate-900 dark:text-white'}
                                            `}>{item.status}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d1117] text-center">
                            <button className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">Ver registro de auditoría completo</button>
                        </div>
                    </div>
                </div>

                {/* Right Col: Technical Status */}
                <div className="flex flex-col gap-6">
                    {/* Deployment Status */}
                    <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Infraestructura</h3>
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-800">
                                        <span className="material-symbols-outlined text-[18px]">dns</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-slate-900 dark:text-white">Supabase DB</span>
                                        <span className="text-[10px] text-slate-500 font-mono">us-east-1 • 24ms</span>
                                    </div>
                                </div>
                                <span className="text-xs text-emerald-500 font-medium">Saludable</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-800">
                                        <span className="material-symbols-outlined text-[18px]">javascript</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-slate-900 dark:text-white">Node.js Workers</span>
                                        <span className="text-[10px] text-slate-500 font-mono">v18.x • 99.9% Uptime</span>
                                    </div>
                                </div>
                                <span className="text-xs text-emerald-500 font-medium">Activo</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-800">
                                        <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-slate-900 dark:text-white">Vercel Edge</span>
                                        <span className="text-[10px] text-slate-500 font-mono">Última build: 4m atrás</span>
                                    </div>
                                </div>
                                <span className="text-xs text-slate-500">Listo</span>
                            </div>
                        </div>
                    </div>

                    {/* Lost Demand Widget */}
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4 text-amber-700 dark:text-amber-500">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined">radar</span>
                                <span className="text-sm font-bold uppercase tracking-wide">Demanda Perdida</span>
                            </div>
                            <span className="text-[10px] font-mono bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded">TOP 5</span>
                        </div>
                        <div className="space-y-3">
                            {isLoading ? (
                                <div className="text-center text-xs text-amber-600 py-4">Cargando radar...</div>
                            ) : topLostDemand.length === 0 ? (
                                <div className="text-center text-xs text-amber-600 py-4">No hay demanda registrada.</div>
                            ) : (
                                topLostDemand.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white dark:bg-[#161b22] px-3 py-2 border border-amber-100 dark:border-amber-900/30 rounded">
                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.term}</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-sm font-black text-amber-600">{item.count}</span>
                                            <span className="text-[10px] text-amber-500 uppercase">req</span>
                                        </div>
                                    </div>
                                ))
                            )}
                            <button className="w-full bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold py-2 rounded shadow-sm mt-2 transition-colors">
                                Revisar en Compras
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;