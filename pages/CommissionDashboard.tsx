import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { DollarSign, TrendingUp, Users, Calendar } from 'lucide-react';

interface CommissionData {
    closer_id: string;
    closer_name: string;
    total_sales: number;
    total_gp: number;
    earned_commission: number;
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

                // Fetch raw orders and order items to calculate GP
                // In a production app, this should be an RPC or a View

                // We only count orders that are verified/completed
                const validStatuses = ['completed', 'processing_fulfillment', 'shipped', 'ready_for_pickup'];

                let query = supabase
                    .from('orders')
                    .select(`
                        id,
                        total_amount,
                        closer_id,
                        status,
                        profiles!orders_closer_id_fkey ( full_name ),
                        order_items (
                            quantity,
                            unit_price,
                            unit_cost
                        )
                    `)
                    .in('status', validStatuses)
                    .not('closer_id', 'is', null);

                if (!userIsAdmin) {
                    query = query.eq('closer_id', session.user.id);
                }

                const { data: orders, error } = await query;

                if (error) throw error;

                // Aggregate by closer
                const aggregated: Record<string, CommissionData> = {};

                orders?.forEach((order: any) => {
                    const cid = order.closer_id;
                    if (!aggregated[cid]) {
                        aggregated[cid] = {
                            closer_id: cid,
                            closer_name: order.profiles?.full_name || 'Vendedor Desconocido',
                            total_sales: 0,
                            total_gp: 0,
                            earned_commission: 0
                        };
                    }

                    aggregated[cid].total_sales += order.total_amount;

                    // Calculate GP from items
                    let orderGp = 0;
                    order.order_items?.forEach((item: any) => {
                        const gp = (item.unit_price - item.unit_cost) * item.quantity;
                        orderGp += gp;
                    });

                    aggregated[cid].total_gp += orderGp;
                    aggregated[cid].earned_commission += (orderGp * 0.10); // 10% of GP
                });

                setCommissions(Object.values(aggregated).sort((a, b) => b.earned_commission - a.earned_commission));
            } catch (err) {
                console.error("Error fetching commissions", err);
            } finally {
                setLoading(false);
            }
        };

        fetchCommissions();
    }, []);

    const totalCompanyGp = commissions.reduce((sum, c) => sum + c.total_gp, 0);
    const totalCompanyCommissions = commissions.reduce((sum, c) => sum + c.earned_commission, 0);

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 dark:bg-[#0d1117] min-h-[calc(100vh-64px)]">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <TrendingUp className="text-blue-500" />
                        Comisiones
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Calculado al 10% sobre la Utilidad Bruta (GP)</p>
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-500 bg-white dark:bg-[#161b22] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                    <Calendar size={16} />
                    <span>Mes Actual</span>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white dark:bg-[#161b22] p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-slate-500 font-medium text-sm">Utilidad Bruta Total (Compañía)</h3>
                                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg">
                                        <TrendingUp size={20} />
                                    </div>
                                </div>
                                <div className="text-3xl font-black text-slate-900 dark:text-white">
                                    ${totalCompanyGp.toFixed(2)}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-[#161b22] p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-slate-500 font-medium text-sm">Comisiones a Pagar (10%)</h3>
                                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg">
                                        <DollarSign size={20} />
                                    </div>
                                </div>
                                <div className="text-3xl font-black text-slate-900 dark:text-white">
                                    ${totalCompanyCommissions.toFixed(2)}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-[#161b22] p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-slate-500 font-medium text-sm">Closers Activos</h3>
                                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-lg">
                                        <Users size={20} />
                                    </div>
                                </div>
                                <div className="text-3xl font-black text-slate-900 dark:text-white">
                                    {commissions.length}
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
                                        <th className="p-4 font-bold text-right">Ventas Totales</th>
                                        <th className="p-4 font-bold text-right">Utilidad Bruta (GP)</th>
                                        <th className="p-4 font-bold text-right text-blue-600 dark:text-blue-400">Comisión (10%)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                    {commissions.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-slate-500">
                                                No hay ventas verificadas registradas en este periodo.
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
                                                <td className="p-4 text-right font-medium text-slate-600 dark:text-slate-300">
                                                    ${c.total_sales.toFixed(2)}
                                                </td>
                                                <td className="p-4 text-right font-medium text-slate-600 dark:text-slate-300">
                                                    ${c.total_gp.toFixed(2)}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className="font-bold text-lg text-slate-900 dark:text-white">
                                                        ${c.earned_commission.toFixed(2)}
                                                    </span>
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
