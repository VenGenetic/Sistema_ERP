import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
interface ActivityItem {
    type: string;
    id: string;
    time: string;
    user: string;
    detail: string;
    status: string;
    amount?: string;
    timestamp: number;
}

const Dashboard: React.FC = () => {
    const { session } = useAuth();
    const currentUserId = session?.user?.id;
    const navigate = useNavigate();

    // Dynamic State
    const [todaySales, setTodaySales] = useState<number>(0);
    const [myTodaySales, setMyTodaySales] = useState<number>(0);
    const [lowStockCount, setLowStockCount] = useState<number>(0);
    const [inventoryHealth, setInventoryHealth] = useState<number>(100);
    const [netLiquidity, setNetLiquidity] = useState<number>(0);
    const [capitalCost, setCapitalCost] = useState<number>(0);
    const [topLostDemand, setTopLostDemand] = useState<{ term: string, count: number }[]>([]);
    const [activityStream, setActivityStream] = useState<ActivityItem[]>([]);
    const [counts, setCounts] = useState({ warehouses: 0, accounts: 0, users: 0, products: 0, items: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [justRefreshed, setJustRefreshed] = useState(false);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const [buildTime] = useState<string>(() => {
        // Tiempo aproximado del build actual (cuando se cargó la página)
        return new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' });
    });

    // Product Entries Tracker State
    type EntriesPeriod = '1M' | '3M' | '6M' | '1Y' | 'custom';
    const [entriesPeriod, setEntriesPeriod] = useState<EntriesPeriod>('1M');
    const [entriesCount, setEntriesCount] = useState<number>(0);
    const [entriesLoading, setEntriesLoading] = useState(false);
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    // Till Management State
    const [selectedTillDate, setSelectedTillDate] = useState(new Date(new Date().getTime() - 5 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [selectedTill, setSelectedTill] = useState<any>(null);
    const [isClosingTill, setIsClosingTill] = useState(false);
    const [tillFinalActualCash, setTillFinalActualCash] = useState<number | ''>('');
    const [tillNotes, setTillNotes] = useState('');
    
    // Edit Till State
    const [isEditingTill, setIsEditingTill] = useState(false);
    const [editTillData, setEditTillData] = useState<any>({});

    const fetchTillData = useCallback(async (dateStr: string) => {
        const { data, error } = await supabase
            .from('daily_tills')
            .select('*')
            .eq('date', dateStr)
            .maybeSingle();
            
        if (!error) {
            setSelectedTill(data);
        }
    }, []);

    useEffect(() => {
        fetchTillData(selectedTillDate);
    }, [selectedTillDate, fetchTillData]);

    // ─── Product entries by period ────────────────────────────────────────────
    const fetchEntriesByPeriod = useCallback(async (period: EntriesPeriod, from?: string, to?: string) => {
        setEntriesLoading(true);
        try {
            const now = new Date();
            let startDate: string;
            let endDate: string = now.toISOString();

            if (period === 'custom' && from) {
                startDate = new Date(from).toISOString();
                endDate = to ? new Date(to + 'T23:59:59').toISOString() : endDate;
            } else {
                const d = new Date();
                switch (period) {
                    case '1M': d.setMonth(d.getMonth() - 1); break;
                    case '3M': d.setMonth(d.getMonth() - 3); break;
                    case '6M': d.setMonth(d.getMonth() - 6); break;
                    case '1Y': d.setFullYear(d.getFullYear() - 1); break;
                }
                startDate = d.toISOString();
            }

            const { count, error } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            if (!error) setEntriesCount(count || 0);
        } catch (e) {
            console.error('Error fetching product entries:', e);
        } finally {
            setEntriesLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEntriesByPeriod(entriesPeriod, customFrom, customTo);
    }, [entriesPeriod, customFrom, customTo, fetchEntriesByPeriod]);

    const handleCloseTill = async () => {
        if (!selectedTill || typeof tillFinalActualCash !== 'number') return;
        
        // Final Expected Cash should ideally be calculated from Initial Cash + Sales (cash only). 
        // For now, we rely on total sales or the user's manual input if they just count the till.
        const expectedCash = Number(selectedTill.initial_cash) + myTodaySales; // simplified for now

        const { error } = await supabase
            .from('daily_tills')
            .update({
                status: 'closed',
                final_expected_cash: expectedCash,
                final_actual_cash: tillFinalActualCash,
                notes: tillNotes
            })
            .eq('id', selectedTill.id);

        if (error) {
            alert('Error cerrando caja: ' + error.message);
        } else {
            alert('Caja cerrada con éxito.');
            setIsClosingTill(false);
            fetchTillData(selectedTillDate);
        }
    };

    const handleSaveEditTill = async () => {
        if (!selectedTill) return;
        const { error } = await supabase
            .from('daily_tills')
            .update({
                status: editTillData.status,
                initial_cash: editTillData.initial_cash,
                final_expected_cash: editTillData.final_expected_cash,
                final_actual_cash: editTillData.final_actual_cash,
                notes: editTillData.notes
            })
            .eq('id', selectedTill.id);

        if (error) {
            alert('Error editando caja: ' + error.message);
        } else {
            alert('Caja actualizada con éxito.');
            setIsEditingTill(false);
            fetchTillData(selectedTillDate);
        }
    };

    // ─── Core data fetch (memoised so Realtime can call it) ───────────────────
    const fetchDashboardData = useCallback(async () => {
        try {
            // 1. Aggregated KPIs via RPC
            if (currentUserId) {
                const { data: stats, error: rpcError } = await supabase.rpc('get_dashboard_stats', {
                    p_user_id: currentUserId
                });

                if (!rpcError && stats) {
                    setTodaySales(Number(stats.todaySales) || 0);
                    setMyTodaySales(Number(stats.myTodaySales) || 0);
                    setLowStockCount(stats.lowStockCount || 0);

                    const total = stats.totalSkus || 0;
                    const low   = stats.lowStockCount || 0;
                    setInventoryHealth(total > 0 ? ((total - low) / total) * 100 : 100);

                    setNetLiquidity(Number(stats.netLiquidity) || 0);
                    setCapitalCost(Number(stats.capitalCost) || 0);
                    setTopLostDemand(stats.topLostDemand || []);
                }
            }

            // 2. Activity Stream
            const activities: ActivityItem[] = [];

            const { data: recentOrders } = await supabase
                .from('orders')
                .select('id, created_at, total_amount, status, customers(name)')
                .order('created_at', { ascending: false })
                .limit(5);

            if (recentOrders) {
                recentOrders.forEach(o => {
                    const date = new Date(o.created_at);
                    activities.push({
                        type: 'PEDIDO',
                        id: `ORD-${o.id}`,
                        time: date.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' }),
                        user: (o.customers as any)?.name || 'Consumidor Final',
                        detail: `Pedido ${o.status}`,
                        status: o.status === 'Entregado' ? 'Completado' : 'Pendiente',
                        amount: `$${Number(o.total_amount).toFixed(2)}`,
                        timestamp: date.getTime()
                    });
                });
            }

            const { data: recentLogs } = await supabase
                .from('inventory_logs')
                .select('id, created_at, quantity_change, reason, type:transaction_type, products:product_id(sku), users:user_id(email)')
                .order('created_at', { ascending: false })
                .limit(5);

            if (recentLogs) {
                recentLogs.forEach(l => {
                    const date = new Date(l.created_at);
                    activities.push({
                        type: 'STOCK',
                        id: `LOG-${l.id}`,
                        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        user: (l.users as any)?.email || 'Sistema',
                        detail: `${Number(l.quantity_change) > 0 ? 'Entrada' : 'Salida'} de ${Math.abs(Number(l.quantity_change))}u SKU: ${(l.products as any)?.sku || 'N/A'}${l.reason ? ` - ${l.reason}` : ''}`,
                        status: 'Completado',
                        timestamp: date.getTime()
                    });
                });
            }

            const { data: recentTxes } = await supabase
                .from('transactions')
                .select('id, created_at, description, transaction_entries(amount, is_debit, account_id)')
                .order('created_at', { ascending: false })
                .limit(5);

            if (recentTxes) {
                recentTxes.forEach(tx => {
                    const date = new Date(tx.created_at);
                    const firstEntry = tx.transaction_entries?.length > 0 ? tx.transaction_entries[0] : null;
                    activities.push({
                        type: 'FINANZAS',
                        id: `TX-${tx.id}`,
                        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        user: 'Sistema Contable',
                        detail: tx.description || 'Transacción Financiera',
                        status: 'Registrado',
                        amount: firstEntry ? `$${Number(firstEntry.amount).toFixed(2)}` : '',
                        timestamp: date.getTime()
                    });
                });
            }

            activities.sort((a, b) => b.timestamp - a.timestamp);
            setActivityStream(activities.slice(0, 6));
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [currentUserId]);

    const fetchStaticCounts = useCallback(async () => {
        try {
            const [
                { count: wCount },
                { count: aCount },
                { count: uCount },
                { count: pCount },
                { data: invData }
            ] = await Promise.all([
                supabase.from('warehouses').select('*', { count: 'exact', head: true }),
                supabase.from('accounts').select('*', { count: 'exact', head: true }),
                supabase.from('profiles').select('*', { count: 'exact', head: true }),
                supabase.from('products').select('*', { count: 'exact', head: true }),
                supabase.from('inventory_levels').select('current_stock')
            ]);

            const totalItems = invData?.reduce((acc, curr) => acc + (Number(curr.current_stock) || 0), 0) || 0;

            setCounts({
                warehouses: wCount || 0,
                accounts:   aCount || 0,
                users:      uCount || 0,
                products:   pCount || 0,
                items:      totalItems
            });
        } catch (error) {
            console.error('Error fetching static counts:', error);
        }
    }, []);

    // ─── Initial load ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (currentUserId) {
            fetchDashboardData();
            fetchStaticCounts();
        }
    }, [currentUserId, fetchDashboardData, fetchStaticCounts]);

    // ─── Real-time subscription — auto-refresh on any order change ────────────
    useEffect(() => {
        if (!currentUserId) return;

        const channel = supabase
            .channel('dashboard-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                () => {
                    // Debounce: wait 800ms then fetch once, even if multiple rows arrive
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    debounceRef.current = setTimeout(() => {
                        fetchDashboardData();
                        setJustRefreshed(true);
                        setTimeout(() => setJustRefreshed(false), 3000);
                    }, 800);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'inventory_levels' },
                () => {
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    debounceRef.current = setTimeout(() => {
                        fetchDashboardData();
                        setJustRefreshed(true);
                        setTimeout(() => setJustRefreshed(false), 3000);
                    }, 800);
                }
            )
            .subscribe();

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            supabase.removeChannel(channel);
        };
    }, [currentUserId, fetchDashboardData]);

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen">
            {/* Header / HUD */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Centro de Comando</h1>
                    <p className="text-slate-500 text-sm font-mono mt-1 flex items-center gap-2">
                        <span className="text-emerald-500 animate-pulse">● En Vivo</span>
                        <span>| Monitoreando {counts.warehouses} Bodegas, {counts.accounts} Cuentas, {counts.users} Socios</span>
                        {justRefreshed && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 animate-pulse">
                                <span className="material-symbols-outlined text-[12px]">sync</span>
                                Actualizado
                            </span>
                        )}
                    </p>
                </div>

            </div>

            {/* High Density Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
                {/* Finance Metric */}
                <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] flex flex-col justify-between h-32 hover:border-slate-400 dark:hover:border-slate-600 transition-colors group cursor-pointer shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Liquidez Neta</span>
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-white transition-colors">account_balance</span>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                            {isLoading ? '...' : `$${netLiquidity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </div>
                        <div className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">trending_up</span>
                            Actualizado en tiempo real
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
                        <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                            {isLoading ? '...' : `${inventoryHealth.toFixed(1)}%`}
                        </div>
                        <div className={`text-xs mt-1 flex items-center gap-1 ${inventoryHealth < 90 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {inventoryHealth < 90 ? (
                                <>
                                    <span className="material-symbols-outlined text-[14px]">warning</span>
                                    {lowStockCount} SKUs bajo umbral
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                    Niveles Óptimos
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Total Productos / Items Metric */}
                <div className="p-5 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-900/10 flex flex-col justify-between h-32 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors group cursor-pointer shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Inventario Físico</span>
                        <span className="material-symbols-outlined text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">category</span>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                            {isLoading ? '...' : `${counts.items} Items`}
                        </div>
                        <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">view_in_ar</span>
                            En {counts.products} Productos
                        </div>
                    </div>
                </div>

                {/* Ventas Hoy Totales Metric */}
                <div className="p-5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-900/10 flex flex-col justify-between h-32 hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors group cursor-pointer shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Ventas Globales (Hoy)</span>
                        <span className="material-symbols-outlined text-emerald-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">point_of_sale</span>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                            {isLoading ? '...' : `$${todaySales.toFixed(2)}`}
                        </div>
                        <div className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            Todas las ventas
                        </div>
                    </div>
                </div>

                {/* Capital del Inventario Metric */}
                <div className="p-5 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/30 dark:bg-purple-900/10 flex flex-col justify-between h-32 hover:border-purple-400 dark:hover:border-purple-600 transition-colors group cursor-pointer shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-purple-600 dark:text-purple-400 uppercase tracking-wider">Capital de Inventario</span>
                        <span className="material-symbols-outlined text-purple-400 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">monetization_on</span>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                            {isLoading ? '...' : `$${capitalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </div>
                        <div className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">sync</span>
                            Actualizado al segundo
                        </div>
                    </div>
                </div>



                {/* Mis Ventas Hoy Metric */}
                <div className="p-5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-900/10 flex flex-col justify-between h-32 hover:border-blue-400 dark:hover:border-blue-600 transition-colors group cursor-pointer shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-blue-600 dark:text-blue-400 uppercase tracking-wider">Mis Ventas Hoy</span>
                        <span className="material-symbols-outlined text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">payments</span>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                            {isLoading ? '...' : `$${myTodaySales.toFixed(2)}`}
                        </div>
                        <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">account_circle</span>
                            Dinero generado en mi turno
                        </div>
                    </div>
                </div>
            </div>

            {/* Till Management Widget */}
            <div className="mb-8 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-amber-500 text-3xl">point_of_sale</span>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-wider">Control de Caja y Cuadre</h2>
                            <p className="text-sm text-slate-500">Seleccione una fecha para revisar el estado de la caja de ese día.</p>
                        </div>
                    </div>
                    <div>
                        <input
                            type="date"
                            value={selectedTillDate}
                            onChange={(e) => setSelectedTillDate(e.target.value)}
                            className="w-48 border-2 border-amber-400 bg-amber-50 dark:bg-amber-900/10 text-amber-900 dark:text-amber-500 rounded-lg p-2 font-bold outline-none"
                        />
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-[#0d1117] p-5 rounded-lg border border-slate-200 dark:border-slate-800">
                    {selectedTill ? (
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <span className="block text-xs font-semibold text-slate-500 uppercase">Estado</span>
                                    <span className={`font-bold mt-1 inline-block px-2 py-0.5 rounded ${selectedTill.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                                        {selectedTill.status === 'open' ? 'ABIERTA' : 'CERRADA'}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs font-semibold text-slate-500 uppercase">Fondo Inicial</span>
                                    <span className="font-bold text-slate-900 dark:text-white">${Number(selectedTill.initial_cash).toFixed(2)}</span>
                                </div>
                                {selectedTill.status === 'closed' && (
                                    <>
                                        <div>
                                            <span className="block text-xs font-semibold text-slate-500 uppercase">Efectivo Cuadrado</span>
                                            <span className="font-bold text-slate-900 dark:text-white">${Number(selectedTill.final_actual_cash).toFixed(2)}</span>
                                        </div>
                                        <div>
                                            <span className="block text-xs font-semibold text-slate-500 uppercase">Faltante/Sobrante</span>
                                            <span className={`font-bold ${Number(selectedTill.final_actual_cash) - Number(selectedTill.final_expected_cash) < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                ${(Number(selectedTill.final_actual_cash) - Number(selectedTill.final_expected_cash)).toFixed(2)}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {selectedTill.status === 'open' ? (
                                    <button 
                                        onClick={() => setIsClosingTill(true)}
                                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded shadow transition-colors"
                                    >
                                        Cerrar Caja
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => {
                                            setEditTillData({ ...selectedTill });
                                            setIsEditingTill(true);
                                        }}
                                        className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold px-4 py-2 rounded transition-colors"
                                    >
                                        Modificar Cuadre Anterior
                                    </button>
                                )}
                                <button onClick={() => navigate('/orders')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded shadow transition-colors flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[18px]">view_kanban</span> Pedidos
                                </button>
                                <button onClick={() => navigate('/pos')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded shadow transition-colors flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[18px]">point_of_sale</span> POS
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-4 text-slate-500">
                            No hay caja registrada para el día {selectedTillDate}. Debes abrirla en el POS.
                            <div className="mt-4 flex justify-center gap-3">
                                <button onClick={() => navigate('/orders')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded shadow transition-colors flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[18px]">view_kanban</span> Ver Pedidos
                                </button>
                                <button onClick={() => navigate('/pos')} className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded shadow transition-colors inline-flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[18px]">point_of_sale</span> Abrir Caja en POS
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Operational Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">



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
                                        <span className="text-[10px] text-slate-500 font-mono">Cargado a las {buildTime}</span>
                                    </div>
                                </div>
                                <span className="text-xs text-slate-500">Listo</span>
                            </div>
                        </div>
                    </div>

                    {/* Product Entries Tracker Widget */}
                    <div className="bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-900/50 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4 text-teal-700 dark:text-teal-500">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined">local_shipping</span>
                                <span className="text-sm font-bold uppercase tracking-wide">Productos Ingresados</span>
                            </div>
                        </div>

                        {/* Period Buttons */}
                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {(['1M', '3M', '6M', '1Y'] as EntriesPeriod[]).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setEntriesPeriod(p)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                        entriesPeriod === p
                                            ? 'bg-teal-600 text-white shadow-sm'
                                            : 'bg-white dark:bg-[#161b22] text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800 hover:border-teal-400'
                                    }`}
                                >
                                    {p === '1M' ? '1 Mes' : p === '3M' ? '3 Meses' : p === '6M' ? '6 Meses' : '1 Año'}
                                </button>
                            ))}
                            <button
                                onClick={() => setEntriesPeriod('custom')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                    entriesPeriod === 'custom'
                                        ? 'bg-teal-600 text-white shadow-sm'
                                        : 'bg-white dark:bg-[#161b22] text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800 hover:border-teal-400'
                                }`}
                            >
                                Personalizado
                            </button>
                        </div>

                        {/* Custom Date Range */}
                        {entriesPeriod === 'custom' && (
                            <div className="flex gap-2 mb-4">
                                <input
                                    type="date"
                                    value={customFrom}
                                    onChange={(e) => setCustomFrom(e.target.value)}
                                    className="flex-1 border border-teal-300 dark:border-teal-700 bg-white dark:bg-[#161b22] text-teal-800 dark:text-teal-300 rounded-md p-1.5 text-xs font-mono outline-none focus:ring-2 focus:ring-teal-500"
                                />
                                <span className="text-teal-500 self-center text-xs">→</span>
                                <input
                                    type="date"
                                    value={customTo}
                                    onChange={(e) => setCustomTo(e.target.value)}
                                    className="flex-1 border border-teal-300 dark:border-teal-700 bg-white dark:bg-[#161b22] text-teal-800 dark:text-teal-300 rounded-md p-1.5 text-xs font-mono outline-none focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                        )}

                        {/* Result */}
                        <div className="bg-white dark:bg-[#161b22] border border-teal-100 dark:border-teal-900/30 rounded-lg p-4 text-center">
                            <div className="text-3xl font-black text-teal-700 dark:text-teal-400 font-mono">
                                {entriesLoading ? '...' : entriesCount.toLocaleString()}
                            </div>
                            <div className="text-xs text-teal-600 dark:text-teal-500 mt-1 font-medium">
                                productos creados en {entriesPeriod === '1M' ? 'el último mes' : entriesPeriod === '3M' ? 'los últimos 3 meses' : entriesPeriod === '6M' ? 'los últimos 6 meses' : entriesPeriod === '1Y' ? 'el último año' : 'el rango seleccionado'}
                            </div>
                        </div>
                    </div>


                </div>
            </div>
            
            {/* Close Till Modal */}
            {isClosingTill && selectedTill && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">Cerrar Caja: {selectedTillDate}</h2>
                        
                        <div className="space-y-4">
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm">
                                <div className="flex justify-between mb-1">
                                    <span className="text-slate-500">Efectivo Inicial:</span>
                                    <span className="font-bold">${Number(selectedTill.initial_cash).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Total Ventas (Ref):</span>
                                    <span className="font-bold text-blue-600">${myTodaySales.toFixed(2)}</span>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Efectivo Físico Contado ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={tillFinalActualCash}
                                    onChange={(e) => setTillFinalActualCash(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                    className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-amber-500 font-mono text-lg"
                                    placeholder="0.00"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Notas u Observaciones (Opcional)</label>
                                <textarea
                                    value={tillNotes}
                                    onChange={(e) => setTillNotes(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm resize-none"
                                    rows={3}
                                />
                            </div>
                            
                            <div className="pt-4 flex gap-3">
                                <button 
                                    onClick={() => setIsClosingTill(false)}
                                    className="flex-1 py-3 px-4 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCloseTill}
                                    className="flex-1 py-3 px-4 bg-amber-600 hover:bg-amber-700 rounded-xl font-bold text-white shadow-md transition-colors"
                                >
                                    Confirmar Cierre
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Till Modal */}
            {isEditingTill && selectedTill && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-md animate-in fade-in zoom-in duration-200 my-8">
                        <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2 text-rose-600">Modo Administrador: Editar Caja</h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Estado</label>
                                <select 
                                    value={editTillData.status || 'closed'}
                                    onChange={(e) => setEditTillData({...editTillData, status: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none"
                                >
                                    <option value="open">ABIERTA</option>
                                    <option value="closed">CERRADA</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Fondo Inicial</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={editTillData.initial_cash || 0}
                                    onChange={(e) => setEditTillData({...editTillData, initial_cash: parseFloat(e.target.value) || 0})}
                                    className="w-full border border-slate-300 rounded-lg p-2 font-mono text-sm outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Efectivo Esperado (Sistema)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={editTillData.final_expected_cash || 0}
                                    onChange={(e) => setEditTillData({...editTillData, final_expected_cash: parseFloat(e.target.value) || 0})}
                                    className="w-full border border-slate-300 rounded-lg p-2 font-mono text-sm outline-none bg-rose-50"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Efectivo Físico Cuadrado</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={editTillData.final_actual_cash || 0}
                                    onChange={(e) => setEditTillData({...editTillData, final_actual_cash: parseFloat(e.target.value) || 0})}
                                    className="w-full border border-slate-300 rounded-lg p-2 font-mono text-sm outline-none bg-rose-50"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Notas Administrativas</label>
                                <textarea
                                    value={editTillData.notes || ''}
                                    onChange={(e) => setEditTillData({...editTillData, notes: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none resize-none"
                                    rows={2}
                                />
                            </div>
                            
                            <div className="pt-4 flex gap-3">
                                <button 
                                    onClick={() => setIsEditingTill(false)}
                                    className="flex-1 py-2 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveEditTill}
                                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg font-bold text-white shadow-md transition-colors"
                                >
                                    Forzar Guardado
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;