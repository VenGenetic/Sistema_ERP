import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { DollarSign, TrendingUp, Users, Calendar, Tag, Hash, ShoppingBag } from 'lucide-react';

interface CommissionData {
    closer_id: string;
    closer_name: string;
    referral_code: string;
    total_orders: number;
    total_sales: number;
    total_gross_profit: number;
    earned_commission: number;
    promo_attributed_orders: number;
    promo_attributed_sales: number;
}

const CommissionDashboard: React.FC = () => {
    const [commissions, setCommissions] = useState<CommissionData[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        const fetchCommissions = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                setCurrentUserId(session.user.id);

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role_id')
                    .eq('id', session.user.id)
                    .single();

                const userIsAdmin = profile?.role_id === 1;
                setIsAdmin(userIsAdmin);

                // Use the employee_earnings_summary view
                let query = supabase
                    .from('employee_earnings_summary')
                    .select('*')
                    .gt('total_orders', 0);

                if (!userIsAdmin) {
                    query = query.eq('closer_id', session.user.id);
                }

                const { data, error } = await query.order('earned_commission', { ascending: false });

                if (error) throw error;

                setCommissions((data || []) as CommissionData[]);
            } catch (err) {
                console.error("Error fetching commissions", err);
            } finally {
                setLoading(false);
            }
        };

        fetchCommissions();
    }, []);

    const totalCompanySales = commissions.reduce((sum, c) => sum + c.total_sales, 0);
    const totalCompanyGp = commissions.reduce((sum, c) => sum + c.total_gross_profit, 0);
    const totalCompanyCommissions = commissions.reduce((sum, c) => sum + c.earned_commission, 0);
    const totalOrders = commissions.reduce((sum, c) => sum + c.total_orders, 0);
    const totalPromoOrders = commissions.reduce((sum, c) => sum + c.promo_attributed_orders, 0);

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 dark:bg-[#0d1117] min-h-[calc(100vh-64px)]">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <TrendingUp className="text-blue-500" />
                        Comisiones y Atribución
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Calculado al 10% sobre la Utilidad Bruta (GP) • Atribución vía código promo</p>
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-500 bg-white dark:bg-[#161b22] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                    <Calendar size={16} />
                    <span>Histórico</span>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            ) : (
                <>
                    {/* Admin Summary Cards */}
                    {isAdmin && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                            <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-slate-500 font-medium text-xs uppercase tracking-wider">Ventas Totales</h3>
                                    <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg">
                                        <DollarSign size={16} />
                                    </div>
                                </div>
                                <div className="text-2xl font-black text-slate-900 dark:text-white">
                                    ${totalCompanySales.toFixed(2)}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-slate-500 font-medium text-xs uppercase tracking-wider">Utilidad Bruta</h3>
                                    <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg">
                                        <TrendingUp size={16} />
                                    </div>
                                </div>
                                <div className="text-2xl font-black text-slate-900 dark:text-white">
                                    ${totalCompanyGp.toFixed(2)}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-slate-500 font-medium text-xs uppercase tracking-wider">Comisiones (10%)</h3>
                                    <div className="p-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-lg">
                                        <DollarSign size={16} />
                                    </div>
                                </div>
                                <div className="text-2xl font-black text-slate-900 dark:text-white">
                                    ${totalCompanyCommissions.toFixed(2)}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-slate-500 font-medium text-xs uppercase tracking-wider">Órdenes</h3>
                                    <div className="p-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-lg">
                                        <ShoppingBag size={16} />
                                    </div>
                                </div>
                                <div className="text-2xl font-black text-slate-900 dark:text-white">
                                    {totalOrders}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-slate-500 font-medium text-xs uppercase tracking-wider">Vía Promo</h3>
                                    <div className="p-1.5 bg-teal-50 dark:bg-teal-900/20 text-teal-600 rounded-lg">
                                        <Tag size={16} />
                                    </div>
                                </div>
                                <div className="text-2xl font-black text-slate-900 dark:text-white">
                                    {totalPromoOrders}
                                    <span className="text-sm font-medium text-slate-400 ml-1">
                                        ({totalOrders > 0 ? ((totalPromoOrders / totalOrders) * 100).toFixed(0) : 0}%)
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Commissions Table */}
                    <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 dark:bg-[#0c1117] border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                                        <th className="p-4 font-bold">Vendedor / Closer</th>
                                        <th className="p-4 font-bold text-center">Código</th>
                                        <th className="p-4 font-bold text-right">Órdenes</th>
                                        <th className="p-4 font-bold text-right">Ventas</th>
                                        <th className="p-4 font-bold text-right">GP</th>
                                        <th className="p-4 font-bold text-right text-blue-600 dark:text-blue-400">Comisión (10%)</th>
                                        <th className="p-4 font-bold text-right">Vía Promo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                    {commissions.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-slate-500">
                                                No hay ventas verificadas registradas.
                                            </td>
                                        </tr>
                                    ) : (
                                        commissions.map((c) => (
                                            <tr key={c.closer_id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${c.closer_id === currentUserId ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-900 dark:text-white">{c.closer_name}</div>
                                                    {c.closer_id === currentUserId && (
                                                        <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded mt-1 inline-block">TÚ</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className="inline-flex items-center gap-1 font-mono text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded font-bold tracking-wider">
                                                        <Hash size={10} />
                                                        {c.referral_code || '—'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right font-medium text-slate-600 dark:text-slate-300">
                                                    {c.total_orders}
                                                </td>
                                                <td className="p-4 text-right font-medium text-slate-600 dark:text-slate-300">
                                                    ${c.total_sales.toFixed(2)}
                                                </td>
                                                <td className="p-4 text-right font-medium text-slate-600 dark:text-slate-300">
                                                    ${c.total_gross_profit.toFixed(2)}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className="font-bold text-lg text-slate-900 dark:text-white">
                                                        ${c.earned_commission.toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        <span className="font-bold text-slate-700 dark:text-slate-200">{c.promo_attributed_orders}</span>
                                                        {c.promo_attributed_sales > 0 && (
                                                            <span className="text-[10px] text-teal-600 font-medium">
                                                                ${c.promo_attributed_sales.toFixed(2)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default CommissionDashboard;
