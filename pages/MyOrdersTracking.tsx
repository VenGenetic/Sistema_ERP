import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Clock, CheckCircle2, AlertTriangle, Package, Truck, Search, ChevronDown, ChevronUp } from 'lucide-react';

interface OrderTracking {
    id: number;
    created_at: string;
    customer_name: string;
    status: string;
    total_amount: number;
    items: {
        id: string;
        product_name: string;
        quantity: number;
        status: string;
        rejection_reason?: string;
    }[];
}

const MyOrdersTracking: React.FC = () => {
    const [orders, setOrders] = useState<OrderTracking[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        fetchMyOrders();
    }, []);

    const fetchMyOrders = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
            .from('orders')
            .select(`
                id, created_at, status, total_amount,
                customer:customers (name),
                items:order_items (
                    id, quantity, status, rejection_reason,
                    product:products (name)
                )
            `)
            .eq('closer_id', session.user.id)
            .order('created_at', { ascending: false });

        if (!error && data) {
            const mapped: OrderTracking[] = data.map((o: any) => ({
                id: o.id,
                created_at: o.created_at,
                customer_name: o.customer?.name || 'Consumidor Final',
                status: o.status,
                total_amount: o.total_amount,
                items: o.items.map((i: any) => ({
                    id: i.id,
                    product_name: i.product?.name || 'Producto Desconocido',
                    quantity: i.quantity,
                    status: i.status,
                    rejection_reason: i.rejection_reason
                }))
            }));
            setOrders(mapped);
        }
        setLoading(false);
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'partially_fulfilled': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'processing': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getItemStatusIcon = (status: string) => {
        switch (status) {
            case 'shipped': return <CheckCircle2 size={16} className="text-emerald-500" />;
            case 'pending_sourcing': return <Clock size={16} className="text-amber-500" />;
            case 'sourced': return <Package size={16} className="text-blue-500" />;
            case 'rejected': return <AlertTriangle size={16} className="text-red-500" />;
            default: return <Package size={16} className="text-slate-400" />;
        }
    };

    const filteredOrders = orders.filter(o =>
        o.customer_name.toLowerCase().includes(filter.toLowerCase()) ||
        o.id.toString().includes(filter)
    );

    if (loading) return <div className="p-8 text-center text-slate-500 font-bold">Cargando mis ventas...</div>;

    return (
        <div className="p-6 bg-slate-50 h-full flex flex-col overflow-hidden">
            <header className="mb-6 flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Mis Ventas y Tracking</h1>
                    <p className="text-slate-500">Sigue el estado de cumplimiento de tus órdenes.</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por cliente o #..."
                        className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 w-64 shadow-sm"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
            </header>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {filteredOrders.length === 0 ? (
                    <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
                        <Package className="mx-auto text-slate-200 mb-4" size={48} />
                        <p className="text-slate-400 font-medium">No se encontraron ventas.</p>
                    </div>
                ) : (
                    filteredOrders.map(order => (
                        <div key={order.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-blue-300">
                            <div
                                className="p-4 flex items-center justify-between cursor-pointer"
                                onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center font-black text-slate-400 border border-slate-100">
                                        #{order.id}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800">{order.customer_name}</div>
                                        <div className="text-xs text-slate-400 font-medium flex items-center gap-2">
                                            <span>{new Date(order.created_at).toLocaleDateString()}</span>
                                            <span>•</span>
                                            <span className="font-bold text-slate-600">${order.total_amount.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${getStatusStyle(order.status)}`}>
                                        {order.status.replace('_', ' ')}
                                    </div>
                                    {expandedOrder === order.id ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
                                </div>
                            </div>

                            {expandedOrder === order.id && (
                                <div className="bg-slate-50/50 border-t border-slate-100 p-4 animate-in slide-in-from-top-2 duration-200">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Detalle de Fulfillment</h4>
                                    <div className="space-y-2">
                                        {order.items.map(item => (
                                            <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    {getItemStatusIcon(item.status)}
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-700">{item.product_name}</div>
                                                        <div className="text-[10px] text-slate-400">Cantidad: {item.quantity}</div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${getStatusStyle(item.status)}`}>
                                                        {item.status.replace('_', ' ')}
                                                    </span>
                                                    {item.status === 'rejected' && item.rejection_reason && (
                                                        <span className="text-[9px] text-red-500 italic mt-1 font-medium bg-red-50 px-1.5 rounded">{item.rejection_reason}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default MyOrdersTracking;
