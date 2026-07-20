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

    // Product Entries Tracker State — Flexible Duration System
    type DurationUnit = 'days' | 'months' | 'years';
    type AnchorSide = 'end' | 'start';
    const [durationAmount, setDurationAmount] = useState<number>(1);
    const [durationUnit, setDurationUnit] = useState<DurationUnit>('months');
    const [anchorSide, setAnchorSide] = useState<AnchorSide>('end');
    const [anchorDate, setAnchorDate] = useState<string>(() => new Date(new Date().getTime() - 5 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [entriesLoading, setEntriesLoading] = useState(false);
    // Dual-series chart data: countIn = Ingresados (new SKUs), countOut = Salidos (inventory_logs negative)
    const [entriesChartData, setEntriesChartData] = useState<{date: string; countIn: number; countOut: number}[]>([]);
    // Ingresados metrics
    const [inCount, setInCount] = useState(0);
    const [inAvgDaily, setInAvgDaily] = useState(0);
    const [inPeakDay, setInPeakDay] = useState<{date: string; count: number}>({date: '', count: 0});
    const [inPrevCount, setInPrevCount] = useState(0);
    // Salidos metrics
    const [outCount, setOutCount] = useState(0);
    const [outAvgDaily, setOutAvgDaily] = useState(0);
    const [outPeakDay, setOutPeakDay] = useState<{date: string; count: number}>({date: '', count: 0});
    const [outPrevCount, setOutPrevCount] = useState(0);
    // Visibility toggles
    const [showIngresados, setShowIngresados] = useState(true);
    const [showSalidos, setShowSalidos] = useState(true);
    const [chartHover, setChartHover] = useState<{x: number; date: string; countIn: number; countOut: number} | null>(null);

    // ─── Financial Chart State ───
    const [financeLoading, setFinanceLoading] = useState(false);
    const [financeChartData, setFinanceChartData] = useState<{date: string; incomeReal: number; expenseReal: number; ghostIn: number; ghostOut: number}[]>([]);
    // Visibility toggles for financial chart
    const [showIncomeReal, setShowIncomeReal] = useState(true);
    const [showExpenseReal, setShowExpenseReal] = useState(true);
    const [showGhostIn, setShowGhostIn] = useState(true);
    const [showGhostOut, setShowGhostOut] = useState(true);
    const [financeChartHover, setFinanceChartHover] = useState<{x: number; date: string; incomeReal: number; expenseReal: number; ghostIn: number; ghostOut: number} | null>(null);
    // Totals for metrics row
    const [totalIncomeReal, setTotalIncomeReal] = useState(0);
    const [totalExpenseReal, setTotalExpenseReal] = useState(0);
    const [totalGhostIn, setTotalGhostIn] = useState(0);
    const [totalGhostOut, setTotalGhostOut] = useState(0);
    const [prevTotalIncomeReal, setPrevTotalIncomeReal] = useState(0);
    const [prevTotalExpenseReal, setPrevTotalExpenseReal] = useState(0);
    const [prevTotalGhostIn, setPrevTotalGhostIn] = useState(0);
    const [prevTotalGhostOut, setPrevTotalGhostOut] = useState(0);


    // Compute the resolved date range from duration + anchor
    const resolvedRange = React.useMemo(() => {
        const anchor = new Date(anchorDate + 'T12:00:00');
        if (isNaN(anchor.getTime())) return null;
        const offset = new Date(anchor);
        switch (durationUnit) {
            case 'days': offset.setDate(offset.getDate() + (anchorSide === 'start' ? durationAmount : -durationAmount)); break;
            case 'months': offset.setMonth(offset.getMonth() + (anchorSide === 'start' ? durationAmount : -durationAmount)); break;
            case 'years': offset.setFullYear(offset.getFullYear() + (anchorSide === 'start' ? durationAmount : -durationAmount)); break;
        }
        const startD = anchorSide === 'start' ? anchor : offset;
        const endD = anchorSide === 'start' ? offset : anchor;
        if (startD > endD) return null;
        return {
            start: startD.toISOString().split('T')[0],
            end: endD.toISOString().split('T')[0],
            startISO: startD.toISOString(),
            endISO: new Date(endD.getFullYear(), endD.getMonth(), endD.getDate(), 23, 59, 59).toISOString(),
        };
    }, [anchorDate, durationAmount, durationUnit, anchorSide]);

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

    // ─── Dual-series fetch: Ingresados (new SKUs) + Salidos (inventory_logs) ──
    const fetchEntriesData = useCallback(async (startDate: string, endDate: string) => {
        setEntriesLoading(true);
        try {
            const periodMs = new Date(endDate).getTime() - new Date(startDate).getTime();
            const prevStartISO = new Date(new Date(startDate).getTime() - periodMs).toISOString();

            // ── Fetch in parallel ──
            const [
                { data: inData },
                { data: outData },
                { count: inPrev },
                { count: outPrev },
            ] = await Promise.all([
                // Ingresados: new products created in catalog
                supabase.from('products').select('created_at')
                    .gte('created_at', startDate).lte('created_at', endDate)
                    .order('created_at', { ascending: true }),
                // Salidos: inventory_logs entries with quantity_change < 0 (dispatched/sold)
                supabase.from('inventory_logs').select('created_at, quantity_change')
                    .gte('created_at', startDate).lte('created_at', endDate)
                    .lt('quantity_change', 0)
                    .order('created_at', { ascending: true }),
                // Previous period: Ingresados
                supabase.from('products').select('*', { count: 'exact', head: true })
                    .gte('created_at', prevStartISO).lt('created_at', startDate),
                // Previous period: Salidos
                supabase.from('inventory_logs').select('*', { count: 'exact', head: true })
                    .gte('created_at', prevStartISO).lt('created_at', startDate)
                    .lt('quantity_change', 0),
            ]);

            // ── Group both by day ──
            const groupedIn: Record<string, number> = {};
            (inData || []).forEach((p: any) => {
                const day = p.created_at?.split('T')[0];
                if (day) groupedIn[day] = (groupedIn[day] || 0) + 1;
            });
            const groupedOut: Record<string, number> = {};
            (outData || []).forEach((l: any) => {
                const day = l.created_at?.split('T')[0];
                if (day) groupedOut[day] = (groupedOut[day] || 0) + Math.abs(Number(l.quantity_change));
            });

            // ── Fill all days (cap at 730) ──
            const filled: {date: string; countIn: number; countOut: number}[] = [];
            const cursor = new Date(startDate);
            const end = new Date(endDate);
            let safety = 0;
            while (cursor <= end && safety < 730) {
                const key = cursor.toISOString().split('T')[0];
                filled.push({ date: key, countIn: groupedIn[key] || 0, countOut: groupedOut[key] || 0 });
                cursor.setDate(cursor.getDate() + 1);
                safety++;
            }
            setEntriesChartData(filled);

            // ── Metrics: Ingresados ──
            const totalIn = (inData || []).length;
            const totalOut = (outData || []).reduce((s: number, l: any) => s + Math.abs(Number(l.quantity_change)), 0);
            const totalDays = Math.max(filled.length, 1);
            setInCount(totalIn);
            setInAvgDaily(Math.round((totalIn / totalDays) * 10) / 10);
            const peakIn = filled.reduce((max, d) => d.countIn > max.count ? {date: d.date, count: d.countIn} : max, {date: '', count: 0});
            setInPeakDay(peakIn);
            setInPrevCount(inPrev || 0);

            // ── Metrics: Salidos ──
            setOutCount(totalOut);
            setOutAvgDaily(Math.round((totalOut / totalDays) * 10) / 10);
            const peakOut = filled.reduce((max, d) => d.countOut > max.count ? {date: d.date, count: d.countOut} : max, {date: '', count: 0});
            setOutPeakDay(peakOut);
            setOutPrevCount(outPrev || 0);

        } catch (e) {
            console.error('Error fetching dual entries data:', e);
        } finally {
            setEntriesLoading(false);
        }
    }, []);

    // ─── Financial Flow Fetch: 4 Series (Real Sales, Real Purchases, Ghost In, Ghost Out) ──
    const fetchFinancialFlowData = useCallback(async (startDate: string, endDate: string) => {
        setFinanceLoading(true);
        try {
            const periodMs = new Date(endDate).getTime() - new Date(startDate).getTime();
            const prevStartISO = new Date(new Date(startDate).getTime() - periodMs).toISOString();

            // Fetch current period data
            const [
                { data: ordersData },
                { data: logsData }
            ] = await Promise.all([
                // 1. Sales (Income Real)
                supabase.from('orders').select('created_at, final_total')
                    .gte('created_at', startDate).lte('created_at', endDate)
                    .neq('status', 'Anulado')
                    .order('created_at', { ascending: true }),
                // 2, 3, 4. Inventory logs for purchases and ghosts
                supabase.from('inventory_logs').select(`
                    created_at,
                    quantity_change,
                    reason,
                    products ( cost_without_vat )
                `)
                    .gte('created_at', startDate).lte('created_at', endDate)
                    .order('created_at', { ascending: true })
            ]);

            // Fetch previous period data for comparisons
            const [
                { data: prevOrdersData },
                { data: prevLogsData }
            ] = await Promise.all([
                supabase.from('orders').select('final_total')
                    .gte('created_at', prevStartISO).lt('created_at', startDate)
                    .neq('status', 'Anulado'),
                supabase.from('inventory_logs').select(`quantity_change, reason, products ( cost_without_vat )`)
                    .gte('created_at', prevStartISO).lt('created_at', startDate)
            ]);

            // Grouping logic for Current Period
            const groupedInc: Record<string, number> = {}; // Income Real
            const groupedExp: Record<string, number> = {}; // Expense Real (Purchases)
            const groupedGIn: Record<string, number> = {}; // Ghost In
            const groupedGOut: Record<string, number> = {}; // Ghost Out

            (ordersData || []).forEach((o: any) => {
                const day = o.created_at?.split('T')[0];
                if (day) groupedInc[day] = (groupedInc[day] || 0) + Number(o.final_total || 0);
            });

            (logsData || []).forEach((l: any) => {
                const day = l.created_at?.split('T')[0];
                if (!day) return;
                const cost = Number(l.products?.cost_without_vat || 0);
                const qty = Number(l.quantity_change);
                const reason = (l.reason || '').toLowerCase();
                const value = Math.abs(qty) * cost;

                if (qty > 0) {
                    if (reason.includes('compra') || reason.includes('purchase')) {
                        groupedExp[day] = (groupedExp[day] || 0) + value; // Blue
                    } else {
                        groupedGIn[day] = (groupedGIn[day] || 0) + value; // Yellow
                    }
                } else if (qty < 0) {
                    // Exclude POS sales because they are tracked in Income Real
                    if (!reason.includes('venta') && !reason.includes('sale') && !reason.includes('pedido') && !reason.includes('order')) {
                        groupedGOut[day] = (groupedGOut[day] || 0) + value; // Pink
                    }
                }
            });

            // Calculate totals for previous period
            let pInc = 0, pExp = 0, pGIn = 0, pGOut = 0;
            (prevOrdersData || []).forEach((o: any) => pInc += Number(o.final_total || 0));
            (prevLogsData || []).forEach((l: any) => {
                const cost = Number(l.products?.cost_without_vat || 0);
                const qty = Number(l.quantity_change);
                const reason = (l.reason || '').toLowerCase();
                const value = Math.abs(qty) * cost;

                if (qty > 0) {
                    if (reason.includes('compra') || reason.includes('purchase')) pExp += value;
                    else pGIn += value;
                } else if (qty < 0) {
                    if (!reason.includes('venta') && !reason.includes('sale') && !reason.includes('pedido') && !reason.includes('order')) pGOut += value;
                }
            });

            // Fill days array
            const filled: {date: string; incomeReal: number; expenseReal: number; ghostIn: number; ghostOut: number}[] = [];
            const cursor = new Date(startDate);
            const end = new Date(endDate);
            let safety = 0;
            let tInc = 0, tExp = 0, tGIn = 0, tGOut = 0;

            while (cursor <= end && safety < 730) {
                const key = cursor.toISOString().split('T')[0];
                const iR = groupedInc[key] || 0;
                const eR = groupedExp[key] || 0;
                const gI = groupedGIn[key] || 0;
                const gO = groupedGOut[key] || 0;

                tInc += iR;
                tExp += eR;
                tGIn += gI;
                tGOut += gO;

                filled.push({ date: key, incomeReal: iR, expenseReal: eR, ghostIn: gI, ghostOut: gO });
                cursor.setDate(cursor.getDate() + 1);
                safety++;
            }

            setFinanceChartData(filled);
            setTotalIncomeReal(tInc);
            setTotalExpenseReal(tExp);
            setTotalGhostIn(tGIn);
            setTotalGhostOut(tGOut);
            
            setPrevTotalIncomeReal(pInc);
            setPrevTotalExpenseReal(pExp);
            setPrevTotalGhostIn(pGIn);
            setPrevTotalGhostOut(pGOut);

        } catch (e) {
            console.error('Error fetching financial flow data:', e);
        } finally {
            setFinanceLoading(false);
        }
    }, []);

    useEffect(() => {
        if (resolvedRange) {
            fetchEntriesData(resolvedRange.startISO, resolvedRange.endISO);
            fetchFinancialFlowData(resolvedRange.startISO, resolvedRange.endISO);
        }
    }, [resolvedRange, fetchEntriesData, fetchFinancialFlowData]);

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

                {/* Compact Infrastructure Status */}
                <div className="flex items-center gap-3 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Infra</span>
                    <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">Supabase</span>
                    </div>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">Node.js</span>
                    </div>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">Edge</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono ml-1">{buildTime}</span>
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

            {/* ═══════════════════════════════════════════════════════════════════
                 PRODUCTOS INGRESADOS — Full Width Interactive Chart Widget
               ═══════════════════════════════════════════════════════════════════ */}
            <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg overflow-hidden">
                {/* Widget Header */}
                <div className="flex flex-col gap-4 px-6 pt-6 pb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/20">
                                <span className="material-symbols-outlined text-[22px]">inventory_2</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Productos Ingresados</h3>
                                <p className="text-xs text-slate-500 font-mono mt-0.5">
                                    {resolvedRange ? `${resolvedRange.start}  →  ${resolvedRange.end}` : 'Configurar rango'}
                                </p>
                            </div>
                        </div>

                        {/* Quick Presets */}
                        <div className="flex bg-slate-100 dark:bg-[#0d1117] rounded-lg p-1 gap-0.5">
                            {[
                                {label: '7D', amt: 7, unit: 'days' as DurationUnit},
                                {label: '1M', amt: 1, unit: 'months' as DurationUnit},
                                {label: '3M', amt: 3, unit: 'months' as DurationUnit},
                                {label: '6M', amt: 6, unit: 'months' as DurationUnit},
                                {label: '1A', amt: 1, unit: 'years' as DurationUnit},
                            ].map((preset) => {
                                const isActive = durationAmount === preset.amt && durationUnit === preset.unit && anchorSide === 'end'
                                    && anchorDate === new Date(new Date().getTime() - 5 * 60 * 60 * 1000).toISOString().split('T')[0];
                                return (
                                    <button
                                        key={preset.label}
                                        onClick={() => {
                                            setDurationAmount(preset.amt);
                                            setDurationUnit(preset.unit);
                                            setAnchorSide('end');
                                            setAnchorDate(new Date(new Date().getTime() - 5 * 60 * 60 * 1000).toISOString().split('T')[0]);
                                        }}
                                        className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all duration-200 ${
                                            isActive
                                                ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Flexible Duration Builder ── */}
                    <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-[#0d1117] rounded-xl p-3 border border-slate-200 dark:border-slate-800">
                        {/* Duration Amount + Unit */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Duración:</span>
                            <input
                                type="number"
                                min={1}
                                max={999}
                                value={durationAmount}
                                onChange={(e) => setDurationAmount(Math.max(1, Math.min(999, parseInt(e.target.value) || 1)))}
                                className="w-16 border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161b22] text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-mono text-center outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                            <div className="flex bg-white dark:bg-[#161b22] border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden">
                                {([{key: 'days', label: 'Días'}, {key: 'months', label: 'Meses'}, {key: 'years', label: 'Años'}] as {key: DurationUnit, label: string}[]).map((u) => (
                                    <button
                                        key={u.key}
                                        onClick={() => setDurationUnit(u.key)}
                                        className={`px-3 py-1.5 text-xs font-bold transition-all duration-150 ${
                                            durationUnit === u.key
                                                ? 'bg-teal-600 text-white'
                                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        {u.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Separator */}
                        <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block"></div>

                        {/* Anchor Toggle + Date */}
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setAnchorSide(anchorSide === 'end' ? 'start' : 'end')}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161b22] text-slate-600 dark:text-slate-400 hover:border-teal-400 transition-all"
                                title={anchorSide === 'end' ? 'La fecha seleccionada es el FINAL del rango' : 'La fecha seleccionada es el INICIO del rango'}
                            >
                                <span className="material-symbols-outlined text-[16px] text-teal-500">
                                    {anchorSide === 'end' ? 'last_page' : 'first_page'}
                                </span>
                                {anchorSide === 'end' ? 'Hasta' : 'Desde'}
                            </button>
                            <input
                                type="date"
                                value={anchorDate}
                                onChange={(e) => setAnchorDate(e.target.value)}
                                className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161b22] text-slate-800 dark:text-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                        </div>

                        {/* Resolved Range Display */}
                        {resolvedRange && (
                            <div className="flex items-center gap-2 ml-auto">
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                    {resolvedRange.start}
                                </span>
                                <span className="text-teal-500 text-sm">→</span>
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                    {resolvedRange.end}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── Series Toggle Buttons ─── */}
                <div className="flex items-center gap-3 px-6 pb-2">
                    <button
                        onClick={() => setShowIngresados(v => !v)}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold border-2 transition-all duration-200 ${
                            showIngresados
                                ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-400 text-teal-700 dark:text-teal-300 shadow-sm'
                                : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 line-through'
                        }`}
                    >
                        <span className="inline-block w-3 h-3 rounded-full bg-teal-500 shadow-sm shadow-teal-500/50"></span>
                        Ingresados
                    </button>
                    <button
                        onClick={() => setShowSalidos(v => !v)}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold border-2 transition-all duration-200 ${
                            showSalidos
                                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 text-blue-700 dark:text-blue-300 shadow-sm'
                                : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 line-through'
                        }`}
                    >
                        <span className="inline-block w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50"></span>
                        Salidos
                    </button>
                    {(!showIngresados || !showSalidos) && (
                        <button
                            onClick={() => { setShowIngresados(true); setShowSalidos(true); }}
                            className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline transition-colors"
                        >
                            Mostrar ambos
                        </button>
                    )}
                </div>

                {/* ─── Metrics Row (dual: Ingresados + Salidos) ─── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 pb-5">
                    {/* ── Ingresados metrics ── */}
                    <div className={`rounded-xl p-4 border-2 transition-all duration-300 ${
                        showIngresados
                            ? 'bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 border-teal-300 dark:border-teal-800'
                            : 'bg-slate-50 dark:bg-[#0d1117] border-slate-200 dark:border-slate-800 opacity-40'
                    }`}>
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="w-2 h-2 rounded-full bg-teal-500 inline-block"></span>
                            <div className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Total Ingresados</div>
                        </div>
                        <div className="text-3xl font-black text-teal-700 dark:text-teal-300 font-mono">
                            {entriesLoading ? <span className="animate-pulse">—</span> : inCount.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-teal-500 mt-1">nuevos SKUs en catálogo</div>
                    </div>
                    <div className={`rounded-xl p-4 border-2 transition-all duration-300 ${
                        showIngresados
                            ? 'bg-slate-50 dark:bg-[#0d1117] border-teal-200 dark:border-teal-900/50'
                            : 'bg-slate-50 dark:bg-[#0d1117] border-slate-200 dark:border-slate-800 opacity-40'
                    }`}>
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="w-2 h-2 rounded-full bg-teal-400 inline-block"></span>
                            <div className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Pico / Tendencia</div>
                        </div>
                        <div className="text-2xl font-black text-slate-800 dark:text-white font-mono">
                            {entriesLoading ? <span className="animate-pulse">—</span> : inPeakDay.count}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{inPeakDay.date || '—'}</div>
                        {(() => {
                            const pct = inPrevCount > 0 ? Math.round(((inCount - inPrevCount) / inPrevCount) * 100) : inCount > 0 ? 100 : 0;
                            const isUp = pct >= 0;
                            return <div className={`text-xs font-bold mt-1 ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>{isUp ? '▲' : '▼'} {isUp ? '+' : ''}{pct}% vs anterior</div>;
                        })()}
                    </div>

                    {/* ── Salidos metrics ── */}
                    <div className={`rounded-xl p-4 border-2 transition-all duration-300 ${
                        showSalidos
                            ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-300 dark:border-blue-800'
                            : 'bg-slate-50 dark:bg-[#0d1117] border-slate-200 dark:border-slate-800 opacity-40'
                    }`}>
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                            <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total Salidos</div>
                        </div>
                        <div className="text-3xl font-black text-blue-700 dark:text-blue-300 font-mono">
                            {entriesLoading ? <span className="animate-pulse">—</span> : outCount.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-blue-500 mt-1">unidades despachadas</div>
                    </div>
                    <div className={`rounded-xl p-4 border-2 transition-all duration-300 ${
                        showSalidos
                            ? 'bg-slate-50 dark:bg-[#0d1117] border-blue-200 dark:border-blue-900/50'
                            : 'bg-slate-50 dark:bg-[#0d1117] border-slate-200 dark:border-slate-800 opacity-40'
                    }`}>
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>
                            <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Pico / Tendencia</div>
                        </div>
                        <div className="text-2xl font-black text-slate-800 dark:text-white font-mono">
                            {entriesLoading ? <span className="animate-pulse">—</span> : outPeakDay.count}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{outPeakDay.date || '—'}</div>
                        {(() => {
                            const pct = outPrevCount > 0 ? Math.round(((outCount - outPrevCount) / outPrevCount) * 100) : outCount > 0 ? 100 : 0;
                            const isUp = pct >= 0;
                            return <div className={`text-xs font-bold mt-1 ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>{isUp ? '▲' : '▼'} {isUp ? '+' : ''}{pct}% vs anterior</div>;
                        })()}
                    </div>
                </div>

                {/* ─── SVG Dual-Series Area Chart ─── */}
                <div className="px-6 pb-6">
                    <div className="bg-slate-50 dark:bg-[#0d1117] rounded-xl border border-slate-200 dark:border-slate-800 p-4 relative" onMouseLeave={() => setChartHover(null)}>
                        {entriesLoading ? (
                            <div className="flex items-center justify-center h-[300px]">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-xs text-slate-400 font-mono">Cargando datos...</span>
                                </div>
                            </div>
                        ) : entriesChartData.length === 0 ? (
                            <div className="flex items-center justify-center h-[300px] text-slate-400">
                                <div className="text-center">
                                    <span className="material-symbols-outlined text-4xl mb-2 block">bar_chart_off</span>
                                    <p className="text-sm">No hay datos para este período</p>
                                </div>
                            </div>
                        ) : (() => {
                            const W = 900;
                            const H = 280;
                            const PAD_TOP = 20;
                            const PAD_BOTTOM = 35;
                            const PAD_LEFT = 48;
                            const PAD_RIGHT = 12;
                            const chartW = W - PAD_LEFT - PAD_RIGHT;
                            const chartH = H - PAD_TOP - PAD_BOTTOM;
                            const data = entriesChartData;
                            const gap = chartW / Math.max(data.length, 1);
                            const baseline = PAD_TOP + chartH;

                            // Dynamic max based on which series are visible
                            const maxVal = Math.max(
                                showIngresados ? Math.max(...data.map(d => d.countIn)) : 0,
                                showSalidos    ? Math.max(...data.map(d => d.countOut)) : 0,
                                1
                            );

                            // Y axis grid
                            const yTicks = 5;
                            const yLines = Array.from({length: yTicks + 1}, (_, i) => {
                                const val = Math.round((maxVal / yTicks) * i);
                                const y = PAD_TOP + chartH - (chartH * (val / maxVal));
                                return {val, y};
                            });

                            // Build SVG path helpers
                            const toPath = (getter: (d: {date:string;countIn:number;countOut:number}) => number) => {
                                const pts = data.map((d, i) => {
                                    const x = PAD_LEFT + (i * gap) + gap / 2;
                                    const y = PAD_TOP + chartH - (chartH * (getter(d) / maxVal));
                                    return `${x},${y}`;
                                });
                                const fx = PAD_LEFT + gap / 2;
                                const lx = PAD_LEFT + ((data.length - 1) * gap) + gap / 2;
                                return {
                                    area: `M${fx},${baseline} L${pts.join(' L')} L${lx},${baseline} Z`,
                                    line: `M${pts.join(' L')}`,
                                    pts,
                                };
                            };

                            const inPaths  = toPath(d => d.countIn);
                            const outPaths = toPath(d => d.countOut);
                            const labelStep = Math.max(1, Math.floor(data.length / 8));

                            return (
                                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[300px]" preserveAspectRatio="xMidYMid meet">
                                    <defs>
                                        <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.40" />
                                            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.03" />
                                        </linearGradient>
                                        <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.03" />
                                        </linearGradient>
                                    </defs>

                                    {/* Y grid lines */}
                                    {yLines.map((tick, i) => (
                                        <g key={i}>
                                            <line x1={PAD_LEFT} y1={tick.y} x2={W - PAD_RIGHT} y2={tick.y}
                                                stroke="currentColor" className="text-slate-200 dark:text-slate-800"
                                                strokeWidth="1" strokeDasharray={i === 0 ? '0' : '4 4'} />
                                            <text x={PAD_LEFT - 6} y={tick.y + 4} textAnchor="end"
                                                className="fill-slate-400" style={{fontSize: 10, fontFamily: 'monospace'}}>{tick.val}</text>
                                        </g>
                                    ))}

                                    {/* ── Ingresados (Teal) ── */}
                                    {showIngresados && (
                                        <>
                                            <path d={inPaths.area} fill="url(#gradIn)" />
                                            <path d={inPaths.line} fill="none" stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                            {data.map((d, i) => {
                                                const x = PAD_LEFT + (i * gap) + gap / 2;
                                                const y = PAD_TOP + chartH - (chartH * (d.countIn / maxVal));
                                                const isHov = chartHover?.date === d.date;
                                                return (
                                                    <circle key={`in-${i}`} cx={x} cy={y}
                                                        r={data.length > 90 ? 0 : data.length > 45 ? 2 : 3.5}
                                                        fill="#14b8a6" stroke="white" strokeWidth="1.5"
                                                        style={{opacity: isHov ? 1 : (d.countIn > 0 ? 0.75 : 0.15), transition: 'opacity 0.1s'}} />
                                                );
                                            })}
                                        </>
                                    )}

                                    {/* ── Salidos (Blue) ── */}
                                    {showSalidos && (
                                        <>
                                            <path d={outPaths.area} fill="url(#gradOut)" />
                                            <path d={outPaths.line} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                            {data.map((d, i) => {
                                                const x = PAD_LEFT + (i * gap) + gap / 2;
                                                const y = PAD_TOP + chartH - (chartH * (d.countOut / maxVal));
                                                const isHov = chartHover?.date === d.date;
                                                return (
                                                    <circle key={`out-${i}`} cx={x} cy={y}
                                                        r={data.length > 90 ? 0 : data.length > 45 ? 2 : 3.5}
                                                        fill="#3b82f6" stroke="white" strokeWidth="1.5"
                                                        style={{opacity: isHov ? 1 : (d.countOut > 0 ? 0.75 : 0.15), transition: 'opacity 0.1s'}} />
                                                );
                                            })}
                                        </>
                                    )}

                                    {/* Invisible hover strips */}
                                    {data.map((d, i) => {
                                        const x = PAD_LEFT + (i * gap) + gap / 2;
                                        return (
                                            <rect key={`hover-${i}`}
                                                x={x - gap / 2} y={PAD_TOP} width={gap} height={chartH}
                                                fill="transparent" className="cursor-pointer"
                                                onMouseEnter={() => setChartHover({x, date: d.date, countIn: d.countIn, countOut: d.countOut})}
                                            />
                                        );
                                    })}

                                    {/* Hover crosshair */}
                                    {chartHover && (
                                        <line x1={chartHover.x} y1={PAD_TOP} x2={chartHover.x} y2={baseline}
                                            stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
                                    )}

                                    {/* X axis labels */}
                                    {data.map((d, i) => {
                                        if (i % labelStep !== 0 && i !== data.length - 1) return null;
                                        const x = PAD_LEFT + (i * gap) + gap / 2;
                                        const parts = d.date.split('-');
                                        return (
                                            <text key={i} x={x} y={H - 8} textAnchor="middle"
                                                className="fill-slate-400" style={{fontSize: 9, fontFamily: 'monospace'}}>
                                                {`${parts[2]}/${parts[1]}`}
                                            </text>
                                        );
                                    })}
                                </svg>
                            );
                        })()}

                        {/* ── Floating Dual Tooltip ── */}
                        {chartHover && (
                            <div
                                className="absolute pointer-events-none bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-sm text-white text-xs font-bold px-3 py-2.5 rounded-xl shadow-2xl border border-slate-700 transition-all duration-75"
                                style={{
                                    left: `clamp(2%, ${(chartHover.x / 900) * 100}%, 88%)`,
                                    top: '12px',
                                    transform: 'translateX(-50%)',
                                    minWidth: '130px',
                                }}
                            >
                                <div className="text-slate-400 font-mono text-[10px] mb-1.5 pb-1.5 border-b border-slate-700">{chartHover.date}</div>
                                {showIngresados && (
                                    <div className="flex items-center justify-between gap-4 mb-1">
                                        <span className="flex items-center gap-1.5 text-teal-400">
                                            <span className="w-2 h-2 rounded-full bg-teal-500 inline-block"></span> Ingresados
                                        </span>
                                        <span className="font-black text-sm text-white">{chartHover.countIn}</span>
                                    </div>
                                )}
                                {showSalidos && (
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="flex items-center gap-1.5 text-blue-400">
                                            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> Salidos
                                        </span>
                                        <span className="font-black text-sm text-white">{chartHover.countOut}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── NEW: Financial Chart (Real vs Ghost) ─── */}
                <div className="flex items-center gap-2 px-6 pb-4 pt-4 mt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                    <h2 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Flujo Financiero (Real vs Fantasma)</h2>
                </div>

                {/* Financial Series Toggle Buttons */}
                <div className="flex flex-wrap items-center gap-3 px-6 pb-2">
                    <button
                        onClick={() => setShowIncomeReal(v => !v)}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold border-2 transition-all duration-200 ${
                            showIncomeReal
                                ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 text-emerald-700 dark:text-emerald-300 shadow-sm'
                                : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 line-through'
                        }`}
                    >
                        <span className="inline-block w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
                        Ventas Reales
                    </button>
                    <button
                        onClick={() => setShowExpenseReal(v => !v)}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold border-2 transition-all duration-200 ${
                            showExpenseReal
                                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 text-blue-700 dark:text-blue-300 shadow-sm'
                                : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 line-through'
                        }`}
                    >
                        <span className="inline-block w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50"></span>
                        Compras Reales
                    </button>
                    <button
                        onClick={() => setShowGhostIn(v => !v)}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold border-2 transition-all duration-200 ${
                            showGhostIn
                                ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-400 text-amber-700 dark:text-amber-300 shadow-sm'
                                : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 line-through'
                        }`}
                    >
                        <span className="inline-block w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50"></span>
                        Valor Fantasma IN
                    </button>
                    <button
                        onClick={() => setShowGhostOut(v => !v)}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold border-2 transition-all duration-200 ${
                            showGhostOut
                                ? 'bg-pink-50 dark:bg-pink-900/30 border-pink-400 text-pink-700 dark:text-pink-300 shadow-sm'
                                : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 line-through'
                        }`}
                    >
                        <span className="inline-block w-3 h-3 rounded-full bg-pink-500 shadow-sm shadow-pink-500/50"></span>
                        Valor Fantasma OUT
                    </button>
                    {(!showIncomeReal || !showExpenseReal || !showGhostIn || !showGhostOut) && (
                        <button
                            onClick={() => { setShowIncomeReal(true); setShowExpenseReal(true); setShowGhostIn(true); setShowGhostOut(true); }}
                            className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline transition-colors"
                        >
                            Mostrar todo
                        </button>
                    )}
                </div>

                {/* Financial Metrics Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 pb-5">
                    {/* Income Real */}
                    <div className={`rounded-xl p-4 border-2 transition-all duration-300 ${
                        showIncomeReal
                            ? 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-300 dark:border-emerald-800'
                            : 'bg-slate-50 dark:bg-[#0d1117] border-slate-200 dark:border-slate-800 opacity-40'
                    }`}>
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                            <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Ventas (Ingreso)</div>
                        </div>
                        <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">
                            {financeLoading ? <span className="animate-pulse">—</span> : `$${totalIncomeReal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                        </div>
                        {(() => {
                            const pct = prevTotalIncomeReal > 0 ? Math.round(((totalIncomeReal - prevTotalIncomeReal) / prevTotalIncomeReal) * 100) : totalIncomeReal > 0 ? 100 : 0;
                            const isUp = pct >= 0;
                            return <div className={`text-[10px] font-bold mt-1.5 ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>{isUp ? '▲' : '▼'} {isUp ? '+' : ''}{pct}% vs ant.</div>;
                        })()}
                    </div>

                    {/* Expense Real */}
                    <div className={`rounded-xl p-4 border-2 transition-all duration-300 ${
                        showExpenseReal
                            ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-300 dark:border-blue-800'
                            : 'bg-slate-50 dark:bg-[#0d1117] border-slate-200 dark:border-slate-800 opacity-40'
                    }`}>
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                            <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Compras (Gasto)</div>
                        </div>
                        <div className="text-2xl font-black text-blue-700 dark:text-blue-300 font-mono">
                            {financeLoading ? <span className="animate-pulse">—</span> : `$${totalExpenseReal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                        </div>
                        {(() => {
                            const pct = prevTotalExpenseReal > 0 ? Math.round(((totalExpenseReal - prevTotalExpenseReal) / prevTotalExpenseReal) * 100) : totalExpenseReal > 0 ? 100 : 0;
                            const isUp = pct >= 0;
                            // For expenses, going down is usually "good" in retail, but we just show the raw trend
                            return <div className={`text-[10px] font-bold mt-1.5 ${isUp ? 'text-blue-500' : 'text-emerald-500'}`}>{isUp ? '▲' : '▼'} {isUp ? '+' : ''}{pct}% vs ant.</div>;
                        })()}
                    </div>

                    {/* Ghost In */}
                    <div className={`rounded-xl p-4 border-2 transition-all duration-300 ${
                        showGhostIn
                            ? 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-300 dark:border-amber-800'
                            : 'bg-slate-50 dark:bg-[#0d1117] border-slate-200 dark:border-slate-800 opacity-40'
                    }`}>
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                            <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Ghost IN (Capital)</div>
                        </div>
                        <div className="text-2xl font-black text-amber-700 dark:text-amber-300 font-mono">
                            {financeLoading ? <span className="animate-pulse">—</span> : `$${totalGhostIn.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                        </div>
                        <div className="text-[10px] text-amber-500 mt-1.5">Capital añadido sin registro</div>
                    </div>

                    {/* Ghost Out */}
                    <div className={`rounded-xl p-4 border-2 transition-all duration-300 ${
                        showGhostOut
                            ? 'bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border-pink-300 dark:border-pink-800'
                            : 'bg-slate-50 dark:bg-[#0d1117] border-slate-200 dark:border-slate-800 opacity-40'
                    }`}>
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="w-2 h-2 rounded-full bg-pink-500 inline-block"></span>
                            <div className="text-[10px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider">Ghost OUT (Mermas)</div>
                        </div>
                        <div className="text-2xl font-black text-pink-700 dark:text-pink-300 font-mono">
                            {financeLoading ? <span className="animate-pulse">—</span> : `$${totalGhostOut.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                        </div>
                        <div className="text-[10px] text-pink-500 mt-1.5">Pérdidas de inventario</div>
                    </div>
                </div>

                {/* SVG 4-Series Financial Area Chart */}
                <div className="px-6 pb-6">
                    <div className="bg-slate-50 dark:bg-[#0d1117] rounded-xl border border-slate-200 dark:border-slate-800 p-4 relative" onMouseLeave={() => setFinanceChartHover(null)}>
                        {financeLoading ? (
                            <div className="flex items-center justify-center h-[300px]">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-xs text-slate-400 font-mono">Calculando flujos...</span>
                                </div>
                            </div>
                        ) : financeChartData.length === 0 ? (
                            <div className="flex items-center justify-center h-[300px] text-slate-400">
                                <div className="text-center">
                                    <span className="material-symbols-outlined text-4xl mb-2 block">account_balance_wallet</span>
                                    <p className="text-sm">No hay transacciones en este período</p>
                                </div>
                            </div>
                        ) : (() => {
                            const W = 900;
                            const H = 300;
                            const PAD_TOP = 20;
                            const PAD_BOTTOM = 35;
                            const PAD_LEFT = 60; // Wider for currency
                            const PAD_RIGHT = 12;
                            const chartW = W - PAD_LEFT - PAD_RIGHT;
                            const chartH = H - PAD_TOP - PAD_BOTTOM;
                            const data = financeChartData;
                            const gap = chartW / Math.max(data.length, 1);
                            const baseline = PAD_TOP + chartH;

                            // Dynamic max
                            const maxVal = Math.max(
                                showIncomeReal ? Math.max(...data.map(d => d.incomeReal)) : 0,
                                showExpenseReal ? Math.max(...data.map(d => d.expenseReal)) : 0,
                                showGhostIn ? Math.max(...data.map(d => d.ghostIn)) : 0,
                                showGhostOut ? Math.max(...data.map(d => d.ghostOut)) : 0,
                                1
                            );

                            // Y grid
                            const yTicks = 5;
                            const yLines = Array.from({length: yTicks + 1}, (_, i) => {
                                const val = (maxVal / yTicks) * i;
                                const y = PAD_TOP + chartH - (chartH * (val / maxVal));
                                return {val, y};
                            });

                            // Path generator
                            const toPath = (getter: (d: any) => number) => {
                                const pts = data.map((d, i) => {
                                    const x = PAD_LEFT + (i * gap) + gap / 2;
                                    const y = PAD_TOP + chartH - (chartH * (getter(d) / maxVal));
                                    return `${x},${y}`;
                                });
                                const fx = PAD_LEFT + gap / 2;
                                const lx = PAD_LEFT + ((data.length - 1) * gap) + gap / 2;
                                return {
                                    area: `M${fx},${baseline} L${pts.join(' L')} L${lx},${baseline} Z`,
                                    line: `M${pts.join(' L')}`,
                                    pts,
                                };
                            };

                            const pInc = toPath(d => d.incomeReal);
                            const pExp = toPath(d => d.expenseReal);
                            const pGIn = toPath(d => d.ghostIn);
                            const pGOut = toPath(d => d.ghostOut);
                            const labelStep = Math.max(1, Math.floor(data.length / 8));

                            return (
                                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[300px]" preserveAspectRatio="xMidYMid meet">
                                    <defs>
                                        <linearGradient id="gradInc" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.40" />
                                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.03" />
                                        </linearGradient>
                                        <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.40" />
                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.03" />
                                        </linearGradient>
                                        <linearGradient id="gradGIn" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.40" />
                                            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.03" />
                                        </linearGradient>
                                        <linearGradient id="gradGOut" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#ec4899" stopOpacity="0.40" />
                                            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.03" />
                                        </linearGradient>
                                    </defs>

                                    {/* Y Grid */}
                                    {yLines.map((tick, i) => (
                                        <g key={`y-${i}`}>
                                            <line x1={PAD_LEFT} y1={tick.y} x2={W - PAD_RIGHT} y2={tick.y}
                                                stroke="currentColor" className="text-slate-200 dark:text-slate-800"
                                                strokeWidth="1" strokeDasharray={i === 0 ? '0' : '4 4'} />
                                            <text x={PAD_LEFT - 6} y={tick.y + 3} textAnchor="end"
                                                className="fill-slate-400" style={{fontSize: 9, fontFamily: 'monospace'}}>
                                                ${tick.val >= 1000 ? (tick.val / 1000).toFixed(1) + 'k' : Math.round(tick.val)}
                                            </text>
                                        </g>
                                    ))}

                                    {/* Series: Expense (Blue) */}
                                    {showExpenseReal && (
                                        <>
                                            <path d={pExp.area} fill="url(#gradExp)" />
                                            <path d={pExp.line} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </>
                                    )}

                                    {/* Series: Ghost In (Yellow) */}
                                    {showGhostIn && (
                                        <>
                                            <path d={pGIn.area} fill="url(#gradGIn)" />
                                            <path d={pGIn.line} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </>
                                    )}

                                    {/* Series: Ghost Out (Pink) */}
                                    {showGhostOut && (
                                        <>
                                            <path d={pGOut.area} fill="url(#gradGOut)" />
                                            <path d={pGOut.line} fill="none" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </>
                                    )}

                                    {/* Series: Income (Green) - Drawn last to be on top */}
                                    {showIncomeReal && (
                                        <>
                                            <path d={pInc.area} fill="url(#gradInc)" />
                                            <path d={pInc.line} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </>
                                    )}

                                    {/* Dots rendering */}
                                    {data.map((d, i) => {
                                        const x = PAD_LEFT + (i * gap) + gap / 2;
                                        const isHov = financeChartHover?.date === d.date;
                                        const r = data.length > 90 ? 0 : data.length > 45 ? 2 : 3.5;
                                        return (
                                            <g key={`dots-${i}`}>
                                                {showExpenseReal && <circle cx={x} cy={PAD_TOP + chartH - (chartH * (d.expenseReal / maxVal))} r={r} fill="#3b82f6" stroke="white" strokeWidth="1.5" style={{opacity: isHov ? 1 : (d.expenseReal > 0 ? 0.75 : 0), transition: 'opacity 0.1s'}} />}
                                                {showGhostIn && <circle cx={x} cy={PAD_TOP + chartH - (chartH * (d.ghostIn / maxVal))} r={r} fill="#f59e0b" stroke="white" strokeWidth="1.5" style={{opacity: isHov ? 1 : (d.ghostIn > 0 ? 0.75 : 0), transition: 'opacity 0.1s'}} />}
                                                {showGhostOut && <circle cx={x} cy={PAD_TOP + chartH - (chartH * (d.ghostOut / maxVal))} r={r} fill="#ec4899" stroke="white" strokeWidth="1.5" style={{opacity: isHov ? 1 : (d.ghostOut > 0 ? 0.75 : 0), transition: 'opacity 0.1s'}} />}
                                                {showIncomeReal && <circle cx={x} cy={PAD_TOP + chartH - (chartH * (d.incomeReal / maxVal))} r={r} fill="#10b981" stroke="white" strokeWidth="1.5" style={{opacity: isHov ? 1 : (d.incomeReal > 0 ? 0.75 : 0), transition: 'opacity 0.1s'}} />}
                                            </g>
                                        );
                                    })}

                                    {/* Invisible hover strips */}
                                    {data.map((d, i) => {
                                        const x = PAD_LEFT + (i * gap) + gap / 2;
                                        return (
                                            <rect key={`fhover-${i}`}
                                                x={x - gap / 2} y={PAD_TOP} width={gap} height={chartH}
                                                fill="transparent" className="cursor-pointer"
                                                onMouseEnter={() => setFinanceChartHover({x, date: d.date, incomeReal: d.incomeReal, expenseReal: d.expenseReal, ghostIn: d.ghostIn, ghostOut: d.ghostOut})}
                                            />
                                        );
                                    })}

                                    {/* Hover crosshair */}
                                    {financeChartHover && (
                                        <line x1={financeChartHover.x} y1={PAD_TOP} x2={financeChartHover.x} y2={baseline}
                                            stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
                                    )}

                                    {/* X axis labels */}
                                    {data.map((d, i) => {
                                        if (i % labelStep !== 0 && i !== data.length - 1) return null;
                                        const x = PAD_LEFT + (i * gap) + gap / 2;
                                        const parts = d.date.split('-');
                                        return (
                                            <text key={i} x={x} y={H - 8} textAnchor="middle"
                                                className="fill-slate-400" style={{fontSize: 9, fontFamily: 'monospace'}}>
                                                {`${parts[2]}/${parts[1]}`}
                                            </text>
                                        );
                                    })}
                                </svg>
                            );
                        })()}

                        {/* ── Floating 4-Series Tooltip ── */}
                        {financeChartHover && (
                            <div
                                className="absolute pointer-events-none bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-sm text-white text-xs font-bold px-3 py-2.5 rounded-xl shadow-2xl border border-slate-700 transition-all duration-75"
                                style={{
                                    left: `clamp(2%, ${(financeChartHover.x / 900) * 100}%, 88%)`,
                                    top: '12px',
                                    transform: 'translateX(-50%)',
                                    minWidth: '160px',
                                }}
                            >
                                <div className="text-slate-400 font-mono text-[10px] mb-1.5 pb-1.5 border-b border-slate-700">{financeChartHover.date}</div>
                                {showIncomeReal && (
                                    <div className="flex items-center justify-between gap-4 mb-1">
                                        <span className="flex items-center gap-1.5 text-emerald-400">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Ventas Reales
                                        </span>
                                        <span className="font-black text-sm text-white">${financeChartHover.incomeReal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                    </div>
                                )}
                                {showExpenseReal && (
                                    <div className="flex items-center justify-between gap-4 mb-1">
                                        <span className="flex items-center gap-1.5 text-blue-400">
                                            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> Compras Reales
                                        </span>
                                        <span className="font-black text-sm text-white">${financeChartHover.expenseReal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                    </div>
                                )}
                                {showGhostIn && (
                                    <div className="flex items-center justify-between gap-4 mb-1">
                                        <span className="flex items-center gap-1.5 text-amber-400">
                                            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> Ghost IN
                                        </span>
                                        <span className="font-black text-sm text-white">${financeChartHover.ghostIn.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                    </div>
                                )}
                                {showGhostOut && (
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="flex items-center gap-1.5 text-pink-400">
                                            <span className="w-2 h-2 rounded-full bg-pink-500 inline-block"></span> Ghost OUT
                                        </span>
                                        <span className="font-black text-sm text-white">${financeChartHover.ghostOut.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                    </div>
                                )}
                            </div>
                        )}
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