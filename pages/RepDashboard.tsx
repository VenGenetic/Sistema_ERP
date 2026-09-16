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
    /**
     * Por qué no alcanza con `stats` en cero.
     *
     * Este panel leía la consulta, y si no venían datos mostraba ceros. El
     * problema es que "hoy no vendiste nada" y "la consulta falló" se veían
     * EXACTAMENTE igual, y son cosas opuestas: una es información y la otra
     * es una avería que nadie reporta porque la pantalla parece funcionar.
     *
     * Hoy la consulta falla siempre: la vista `v_daily_sales_stats` no
     * existe en la base (comprobado el 14/09/2026). Y aunque existiera,
     * seguiría vacía, porque `orders.created_by` y `orders.closer_id` están
     * en NULL en las 320 órdenes: no hay nada que diga QUIÉN hizo cada
     * venta. Mientras eso no se registre en el punto de venta, este panel no
     * puede tener datos -- y tiene que decirlo en vez de fingir un cero.
     */
    const [error, setError] = useState<string | null>(null);

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
                /*
                    La fecha de ECUADOR, no la del navegador ni la UTC.

                    `toISOString()` devuelve UTC. Ecuador es UTC-5, así que a
                    partir de las 19:00 hora local el día ya cambió en UTC y el
                    panel se reiniciaba solo: las ventas de la última hora
                    aparecían como del día siguiente. El negocio cierra a las
                    18:00, o sea que el error caía justo en el cierre de caja.

                    Tampoco sirve la fecha local del dispositivo: un teléfono
                    con la zona horaria mal puesta mostraría otro día. Se fija
                    `America/Guayaquil`, que es la misma que usa la vista
                    `v_daily_sales_stats` para agrupar. Las dos tienen que
                    coincidir o el panel pediría un día que no existe.
                */
                const today = new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'America/Guayaquil',
                    year: 'numeric', month: '2-digit', day: '2-digit',
                }).format(new Date());

                const { data: statsData, error: errorStats } = await supabase
                    .from('v_daily_sales_stats')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .eq('sale_date', today)
                    .maybeSingle();

                /*
                    `maybeSingle` y no `single`: sin ventas hoy no hay fila, y
                    `single` convertía ese caso normal en un error, mezclándolo
                    con los errores de verdad.

                    42P01 / PGRST205 = la vista no existe. Es lo que pasa hoy.
                */
                if (errorStats) {
                    setError(
                        errorStats.code === '42P01' || errorStats.code === 'PGRST205'
                            ? 'El panel todavía no está disponible: falta registrar en cada venta quién la hizo. No es que no tengas ventas hoy.'
                            : 'No se pudieron leer tus ventas de hoy. Volvé a intentar en un momento.',
                    );
                } else if (statsData) {
                    setStats({
                        total_orders: statsData.total_orders,
                        total_items_sold: statsData.total_items_sold,
                        total_sales_revenue: statsData.total_sales_revenue + (statsData.total_shipping_revenue || 0),
                        total_commission: statsData.total_commission
                    });
                }
            } catch (err) {
                console.error('Error fetching dashboard data:', err);
                setError('No se pudieron leer tus ventas de hoy. Volvé a intentar en un momento.');
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
        <div className="flex flex-col min-h-screen bg-surface-2 text-fg pb-20">
            {/* Header */}
            <header className="px-6 py-5 flex justify-between items-center bg-surface border-b border-subtle shadow-sm sticky top-0 z-10">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Hola, {userName}</h1>
                    <p className="text-sm text-fg-muted">Panel de Ventas</p>
                </div>
                <button
                    onClick={handleLogout}
                    className="text-sm font-medium text-fg-muted hover:text-danger transition-colors"
                >
                    Salir
                </button>
            </header>

            <main className="flex-1 p-4 flex flex-col gap-6 max-w-md mx-auto w-full mt-4">

                {/* El aviso va ARRIBA de las cifras, no debajo: si queda abajo,
                    quien mira ve primero los ceros, saca su conclusión y no
                    baja. Con `role="alert"` lo anuncia también un lector de
                    pantalla, que es cuando más falta hace. */}
                {!loading && error && (
                    <div
                        role="alert"
                        className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-soft-fg"
                    >
                        <p className="font-semibold">Las cifras de abajo no son tus ventas</p>
                        <p className="mt-0.5 text-xs leading-relaxed">{error}</p>
                    </div>
                )}

                {/* Hero Section: Tus Ganancias de Hoy */}
                <section className="bg-primary rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2 text-white">
                            <TrendingUp size={20} />
                            <h2 className="text-sm font-semibold">Tus Ganancias de Hoy</h2>
                        </div>
                        {loading ? (
                            <div className="h-12 w-32 bg-white/20 animate-pulse rounded-lg mt-2"></div>
                        ) : (
                            <div className="text-5xl font-bold tracking-tighter">
                                ${stats.total_commission.toFixed(2)}
                            </div>
                        )}
                        <p className="text-xs text-white mt-3 font-medium">Actualizado en tiempo real</p>
                    </div>
                </section>

                {/* Today's Stats Grid */}
                <section className="grid grid-cols-2 gap-4">
                    <div className="bg-surface border border-subtle rounded-xl p-4 shadow-sm flex flex-col justify-between">
                        <div className="flex items-start justify-between mb-3">
                            <h3 className="text-xs font-bold text-fg-muted uppercase">Ventas (Total)</h3>
                            <div className="p-1.5 bg-success-soft text-success-soft-fg rounded-lg">
                                <DollarSign size={16} />
                            </div>
                        </div>
                        {loading ? (
                            <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 animate-pulse rounded"></div>
                        ) : (
                            <div className="text-2xl font-bold text-fg">
                                ${stats.total_sales_revenue.toFixed(2)}
                            </div>
                        )}
                    </div>

                    <div className="bg-surface border border-subtle rounded-xl p-4 shadow-sm flex flex-col justify-between">
                        <div className="flex items-start justify-between mb-3">
                            <h3 className="text-xs font-bold text-fg-muted uppercase">Artículos</h3>
                            <div className="p-1.5 bg-primary-soft text-primary rounded-lg">
                                <Package size={16} />
                            </div>
                        </div>
                        {loading ? (
                            <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 animate-pulse rounded"></div>
                        ) : (
                            <div className="text-2xl font-bold text-fg">
                                {stats.total_items_sold}
                            </div>
                        )}
                    </div>
                </section>

                {/* Action Buttons */}
                <section className="mt-2 flex flex-col gap-3">
                    <button
                        onClick={() => navigate('/pos')}
                        className="w-full flex items-center justify-center gap-3 bg-primary hover:bg-primary text-white rounded-xl py-4 shadow-md transition-transform active:scale-95"
                    >
                        <ShoppingCart size={24} />
                        <span className="text-lg font-bold tracking-wide">Nueva Venta</span>
                    </button>

                    <button
                        onClick={() => navigate('/orders')}
                        className="w-full flex items-center justify-center gap-3 bg-surface border border-subtle hover:bg-surface-hover text-fg rounded-xl py-4 shadow-sm transition-transform active:scale-95"
                    >
                        <FileText size={22} className="text-fg-muted" />
                        <span className="text-lg font-bold">Mi Historial</span>
                    </button>

                    <button
                        onClick={() => navigate('/settings')}
                        className="w-full flex items-center justify-center gap-3 bg-surface border border-subtle hover:bg-surface-hover text-fg rounded-xl py-4 shadow-sm transition-transform active:scale-95"
                    >
                        <Settings size={22} className="text-fg-muted" />
                        <span className="text-lg font-bold">Mi Perfil</span>
                    </button>
                </section>

            </main>
        </div>
    );
};

export default RepDashboard;
