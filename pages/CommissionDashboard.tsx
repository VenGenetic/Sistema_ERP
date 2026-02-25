import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { DollarSign, TrendingUp, Users, Calendar, Tag, Hash, ShoppingBag, Award, Lock, Unlock, Calculator } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface PointLedgerSummary {
    milestone: string;
    status: 'frozen' | 'released' | 'clawback';
    total_points: number;
}

interface GlobalPool {
    id: string;
    month_year: string;
    total_pool_amount: number;
}

const CommissionDashboard: React.FC = () => {
    const { session, isAdmin } = useAuth();
    const [loading, setLoading] = useState(true);
    const [points, setPoints] = useState<PointLedgerSummary[]>([]);
    const [globalPool, setGlobalPool] = useState<GlobalPool | null>(null);
    const [totalCompanyReleasedPoints, setTotalCompanyReleasedPoints] = useState(0);

    // Derived States
    const frozenPoints = points.filter(p => p.status === 'frozen').reduce((sum, p) => sum + p.total_points, 0);
    const releasedPoints = points.filter(p => p.status === 'released').reduce((sum, p) => sum + p.total_points, 0);
    const clawbackPoints = points.filter(p => p.status === 'clawback').reduce((sum, p) => sum + p.total_points, 0);
    const netReleased = releasedPoints - clawbackPoints;

    useEffect(() => {
        fetchGamificationData();
    }, [session]);

    const fetchGamificationData = async () => {
        if (!session) return;
        setLoading(true);
        try {
            // 1. Fetch user's point ledger summary
            const { data: userPointsData, error: userPointsError } = await supabase
                .from('point_ledger')
                .select('milestone, status, points')
                .eq('user_id', session.user.id);

            if (userPointsError) throw userPointsError;

            // Group user points by milestone and status
            const summaryMap: Record<string, PointLedgerSummary> = {};
            (userPointsData || []).forEach(row => {
                const key = `${row.milestone}_${row.status}`;
                if (!summaryMap[key]) summaryMap[key] = { milestone: row.milestone, status: row.status as any, total_points: 0 };
                summaryMap[key].total_points += Number(row.points);
            });
            setPoints(Object.values(summaryMap));

            // 2. Fetch Global Pool for current month
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            const dateStr = startOfMonth.toISOString().split('T')[0];

            const { data: poolData, error: poolError } = await supabase
                .from('global_pool')
                .select('*')
                .eq('month_year', dateStr)
                .maybeSingle();

            if (poolError) throw poolError;
            setGlobalPool(poolData);

            // 3. To calculate Payroll, we need Total Company Released Points for the current period
            // (For simplicity in this phase, we just sum all released points across all users. 
            // In a real app, this would be filtered by date range).
            const { data: allReleasedData, error: allReleasedError } = await supabase
                .from('point_ledger')
                .select('points')
                .eq('status', 'released');

            if (allReleasedError) throw allReleasedError;

            const totalReleased = (allReleasedData || []).reduce((sum, row) => sum + Number(row.points), 0);
            setTotalCompanyReleasedPoints(totalReleased);

        } catch (error) {
            console.error("Error fetching gamification data:", error);
        } finally {
            setLoading(false);
        }
    };

    const runPayrollSimulator = () => {
        // Simple simulator: user's share * global pool
        if (!globalPool || totalCompanyReleasedPoints === 0 || netReleased === 0) return 0;
        const share = netReleased / totalCompanyReleasedPoints;
        return (share * globalPool.total_pool_amount).toFixed(2);
    };

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 dark:bg-[#0d1117] min-h-[calc(100vh-64px)] overflow-hidden">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <Award className="text-amber-500" />
                        Finanzas & Gamificación
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Mi Billetera de Puntos, Global Pool y Calculadora de Nómina.</p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* My Points Wallet */}
                    <div className="md:col-span-2 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-6">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                            <TrendingUp size={20} className="text-blue-500" />
                            Mi Billetera de Puntos
                        </h2>

                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#0c1117] border border-slate-100 dark:border-slate-800/50">
                                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1"><Lock size={14} /> Congelados (Frozen)</div>
                                <div className="text-3xl font-black text-slate-400 dark:text-slate-500">{frozenPoints.toFixed(1)}</div>
                                <div className="text-xs text-slate-400 mt-1">Esperando Pago del Cliente</div>
                            </div>
                            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/20 shadow-inner">
                                <div className="text-emerald-700 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1"><Unlock size={14} /> Liberados (Net)</div>
                                <div className="text-3xl font-black text-emerald-600 dark:text-emerald-500">{netReleased.toFixed(1)}</div>
                                <div className="text-xs text-emerald-600/70 mt-1">Cobro Exitoso</div>
                            </div>
                            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/20">
                                <div className="text-red-700 dark:text-red-400 text-xs font-semibold uppercase tracking-wider mb-2">Clawbacks</div>
                                <div className="text-3xl font-black text-red-600 dark:text-red-500">{clawbackPoints.toFixed(1)}</div>
                                <div className="text-xs text-red-600/70 mt-1">Devoluciones / Rebotes</div>
                            </div>
                        </div>

                        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 border-b border-slate-100 dark:border-slate-800 pb-2">Desglose por Hito (Milestone)</h3>
                        {points.length > 0 ? (
                            <div className="space-y-3 mt-4">
                                {points.reduce((acc: any[], curr) => {
                                    // group by milestone for rendering
                                    const existing = acc.find(a => a.milestone === curr.milestone);
                                    if (existing) existing[curr.status] = curr.total_points;
                                    else acc.push({ milestone: curr.milestone, frozen: curr.status === 'frozen' ? curr.total_points : 0, released: curr.status === 'released' ? curr.total_points : 0 });
                                    return acc;
                                }, []).map((m: any, idx) => (
                                    <div key={idx} className="flex justify-between border-b border-slate-50 dark:border-slate-800/50 pb-2 text-sm">
                                        <span className="font-medium text-slate-700 dark:text-slate-300">{m.milestone}</span>
                                        <div className="flex gap-4 font-mono">
                                            <span className="text-slate-400" title="Frozen">{m.frozen > 0 ? m.frozen.toFixed(1) + ' ❄️' : '-'}</span>
                                            <span className="text-emerald-600 font-bold" title="Released">{m.released > 0 ? m.released.toFixed(1) + ' 🔓' : '-'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 italic py-4">Aún no has generado puntos.</p>
                        )}
                    </div>

                    {/* Global Pool & Payroll */}
                    <div className="space-y-6">
                        {/* Global Pool */}
                        <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-xl shadow-lg p-6 text-white border border-indigo-700/50 relative overflow-hidden">
                            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-5 rounded-full blur-xl"></div>
                            <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-indigo-500 opacity-20 rounded-full blur-2xl"></div>

                            <h2 className="text-indigo-200 font-medium text-sm tracking-wider uppercase mb-1 relative z-10 flex justify-between">
                                <span>Global Pool</span>
                                <span>{new Date().toLocaleString('es-ES', { month: 'short', year: 'numeric' }).toUpperCase()}</span>
                            </h2>
                            <div className="text-4xl font-black mb-2 relative z-10 tracking-tight">
                                ${globalPool?.total_pool_amount ? parseFloat(globalPool.total_pool_amount as unknown as string).toFixed(2) : '0.00'}
                            </div>
                            <p className="text-indigo-200 text-xs relative z-10">10% de la Utilidad Bruta de órdenes cobradas.</p>
                        </div>

                        {/* Payroll Calculator */}
                        <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-6 relative">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                                <Calculator size={20} className="text-amber-500" />
                                Estimador de Nómina
                            </h2>

                            <div className="space-y-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Mis Puntos Liberados:</span>
                                    <span className="font-mono font-bold dark:text-slate-200">{netReleased.toFixed(1)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Puntos Liberados Cía:</span>
                                    <span className="font-mono font-bold dark:text-slate-200">{totalCompanyReleasedPoints.toFixed(1)}</span>
                                </div>
                                <div className="flex justify-between text-sm border-b border-slate-100 dark:border-slate-800 pb-4">
                                    <span className="text-slate-500">Participación (%):</span>
                                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                        {totalCompanyReleasedPoints > 0 ? ((netReleased / totalCompanyReleasedPoints) * 100).toFixed(2) : '0.00'}%
                                    </span>
                                </div>

                                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-4 rounded-lg flex flex-col items-center justify-center">
                                    <div className="text-xs font-bold text-amber-700 dark:text-amber-500 uppercase tracking-widest mb-1">Bono Proyectado</div>
                                    <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
                                        ${runPayrollSimulator()}
                                    </div>
                                </div>
                                <p className="text-[10px] text-center text-slate-400 leading-tight">Valor estricto de simulación. Se actualiza cada vez que una orden es marcada como cobrada.</p>
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export default CommissionDashboard;
