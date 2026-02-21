import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ShoppingCart, FileText, Settings, TrendingUp, Package, DollarSign } from 'lucide-react';

interface DailyStats {
    total_orders: number;
    total_items_sold: number;
    total_sales_revenue: number;
    total_commission: number;
}

const RepDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<DailyStats>({
        total_orders: 0,
        total_items_sold: 0,
        total_sales_revenue: 0,
        total_commission: 0
    });
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                // Get User Profile
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', session.user.id)
                    .single();

                if (profile) setUserName(profile.full_name || 'Vendedor');

                // Get Today's Stats from the View
                // Format YYYY-MM-DD for current local date
                const today = new Date().toISOString().split('T')[0];

                const { data: statsData, error } = await supabase
                    .from('v_daily_sales_stats')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .eq('sale_date', today)
                    .single();

                if (statsData) {
                    setStats({
                        total_orders: statsData.total_orders,
                        total_items_sold: statsData.total_items_sold,
                        total_sales_revenue: statsData.total_sales_revenue + (statsData.total_shipping_revenue || 0),
                        total_commission: statsData.total_commission
                    });
                }
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-[#0d1117] text-slate-900 dark:text-white pb-20">
            {/* Header */}
            <header className="px-6 py-5 flex justify-between items-center bg-white dark:bg-[#161b22] border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-10">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Hola, {userName}</h1>
                    <p className="text-sm text-slate-500">Panel de Ventas</p>
                </div>
                <button
                    onClick={handleLogout}
                    className="text-sm font-medium text-slate-500 hover:text-red-500 transition-colors"
                >
                    Salir
                </button>
            </header>

            <main className="flex-1 p-4 flex flex-col gap-6 max-w-md mx-auto w-full mt-4">

                {/* Hero Section: Tus Ganancias de Hoy */}
                <section className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2 text-blue-100">
                            <TrendingUp size={20} />
                            <h2 className="text-sm font-semibold uppercase tracking-wider">Tus Ganancias de Hoy</h2>
                        </div>
                        {loading ? (
                            <div className="h-12 w-32 bg-white/20 animate-pulse rounded-lg mt-2"></div>
                        ) : (
                            <div className="text-5xl font-extrabold tracking-tighter">
                                ${stats.total_commission.toFixed(2)}
                            </div>
                        )}
                        <p className="text-xs text-blue-200 mt-3 font-medium">Actualizado en tiempo real</p>
                    </div>
                </section>

                {/* Today's Stats Grid */}
                <section className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                        <div className="flex items-start justify-between mb-3">
                            <h3 className="text-xs font-bold text-slate-500 uppercase">Ventas (Total)</h3>
                            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-md">
                                <DollarSign size={16} />
                            </div>
                        </div>
                        {loading ? (
                            <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 animate-pulse rounded"></div>
                        ) : (
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                ${stats.total_sales_revenue.toFixed(2)}
                            </div>
                        )}
                    </div>

                    <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                        <div className="flex items-start justify-between mb-3">
                            <h3 className="text-xs font-bold text-slate-500 uppercase">Artículos</h3>
                            <div className="p-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-md">
                                <Package size={16} />
                            </div>
                        </div>
                        {loading ? (
                            <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 animate-pulse rounded"></div>
                        ) : (
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                {stats.total_items_sold}
                            </div>
                        )}
                    </div>
                </section>

                {/* Action Buttons */}
                <section className="mt-2 flex flex-col gap-3">
                    <button
                        onClick={() => navigate('/pos')}
                        className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-4 shadow-md transition-transform active:scale-95"
                    >
                        <ShoppingCart size={24} />
                        <span className="text-lg font-bold uppercase tracking-wide">Nueva Venta</span>
                    </button>

                    <button
                        onClick={() => navigate('/orders')}
                        className="w-full flex items-center justify-center gap-3 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#1c2128] text-slate-700 dark:text-slate-200 rounded-xl py-4 shadow-sm transition-transform active:scale-95"
                    >
                        <FileText size={22} className="text-slate-500" />
                        <span className="text-lg font-bold">Mi Historial</span>
                    </button>

                    <button
                        onClick={() => navigate('/settings')}
                        className="w-full flex items-center justify-center gap-3 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#1c2128] text-slate-700 dark:text-slate-200 rounded-xl py-4 shadow-sm transition-transform active:scale-95"
                    >
                        <Settings size={22} className="text-slate-500" />
                        <span className="text-lg font-bold">Mi Perfil</span>
                    </button>
                </section>

            </main>
        </div>
    );
};

export default RepDashboard;
