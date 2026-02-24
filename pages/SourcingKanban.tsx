import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Package, Truck, AlertCircle, CheckCircle, XCircle, DollarSign, Search } from 'lucide-react';

interface SourcingItem {
    id: string;
    order_id: number;
    product: {
        id: number;
        sku: string;
        name: string;
        price: number;
    };
    quantity: number;
    unit_price: number;
    unit_cost: number;
    status: string;
    created_at: string;
    customer_name: string;
}

const SourcingKanban: React.FC = () => {
    const [items, setItems] = useState<SourcingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        fetchPendingItems();
    }, []);

    const fetchPendingItems = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('order_items')
            .select(`
                *,
                product:products (id, sku, name, price),
                order:orders (customer:customers (name))
            `)
            .in('status', ['pending_sourcing', 'sourced', 'rejected'])
            .order('created_at', { ascending: false });

        if (!error && data) {
            const mapped: SourcingItem[] = data.map((item: any) => ({
                id: item.id,
                order_id: item.order_id,
                product: item.product,
                quantity: item.quantity,
                unit_price: item.unit_price,
                unit_cost: item.unit_cost,
                status: item.status,
                created_at: item.created_at,
                customer_name: item.order?.customer?.name || 'Cliente Desconocido'
            }));
            setItems(mapped);
        }
        setLoading(false);
    };

    const handleUpdateCost = async (itemId: string, productId: number, newCost: number) => {
        // 1. Update products table (master cost)
        const { error: pError } = await supabase
            .from('products')
            .update({ cost_without_vat: newCost })
            .eq('id', productId);

        if (pError) {
            alert("Error al actualizar costo maestro: " + pError.message);
            return;
        }

        // 2. Update order_items table (specific transaction cost)
        const { error: iError } = await supabase
            .from('order_items')
            .update({ unit_cost: newCost })
            .eq('id', itemId);

        if (iError) {
            alert("Error al actualizar costo del item: " + iError.message);
            return;
        }

        fetchPendingItems();
    };

    const handleUpdateStatus = async (itemId: string, newStatus: string, reason?: string) => {
        const payload: any = { status: newStatus };
        if (reason) payload.rejection_reason = reason;

        const { error } = await supabase
            .from('order_items')
            .update(payload)
            .eq('id', itemId);

        if (error) {
            alert("Error al actualizar estado: " + error.message);
            return;
        }

        fetchPendingItems();
    };

    const columns = [
        { id: 'pending_sourcing', title: 'Por Comprar', icon: <Package className="text-amber-500" />, color: 'bg-amber-50' },
        { id: 'sourced', title: 'Comprado / En Camino', icon: <Truck className="text-blue-500" />, color: 'bg-blue-50' },
        { id: 'rejected', title: 'No Encontrado / Rechazado', icon: <XCircle className="text-red-500" />, color: 'bg-red-50' }
    ];

    if (loading) return <div className="p-8 text-center">Cargando Kanban...</div>;

    return (
        <div className="p-6 h-full flex flex-col bg-slate-50">
            <header className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Sourcing Kanban</h1>
                    <p className="text-slate-500">Gestión de pedidos especiales y compras pendientes.</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar producto..."
                        className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 w-64"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
            </header>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
                {columns.map(col => (
                    <div key={col.id} className={`${col.color} rounded-2xl border-2 border-slate-200 flex flex-col overflow-hidden`}>
                        <div className="p-4 border-b border-slate-200 flex items-center gap-2 bg-white/50">
                            {col.icon}
                            <h2 className="font-bold text-slate-700 uppercase tracking-wider text-sm">{col.title}</h2>
                            <span className="ml-auto bg-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
                                {items.filter(i => i.status === col.id).length}
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {items
                                .filter(i => i.status === col.id && i.product.name.toLowerCase().includes(filter.toLowerCase()))
                                .map(item => (
                                    <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow group">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Orden #{item.order_id}</span>
                                            <span className="text-[10px] text-slate-400">{new Date(item.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <h3 className="font-bold text-slate-800 leading-tight mb-1">{item.product.name}</h3>
                                        <p className="text-xs text-slate-500 mb-3">{item.customer_name}</p>

                                        <div className="flex items-center gap-2 mb-4 bg-slate-50 p-2 rounded-lg">
                                            <DollarSign size={14} className="text-emerald-500" />
                                            <span className="text-xs font-bold text-slate-700">Costo Actual:</span>
                                            <input
                                                type="number"
                                                defaultValue={item.unit_cost}
                                                className="w-20 text-xs font-bold border rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-500"
                                                onBlur={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    if (val !== item.unit_cost) handleUpdateCost(item.id, item.product.id, val);
                                                }}
                                            />
                                        </div>

                                        <div className="flex gap-2">
                                            {col.id === 'pending_sourcing' && (
                                                <>
                                                    <button
                                                        onClick={() => handleUpdateStatus(item.id, 'sourced')}
                                                        className="flex-1 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <Truck size={12} /> COMPRADO
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const reason = prompt("Motivo del rechazo:");
                                                            if (reason) handleUpdateStatus(item.id, 'rejected', reason);
                                                        }}
                                                        className="py-1.5 px-3 bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold rounded-lg hover:bg-red-100 transition-colors"
                                                    >
                                                        RECHAZAR
                                                    </button>
                                                </>
                                            )}
                                            {col.id === 'sourced' && (
                                                <button
                                                    onClick={() => handleUpdateStatus(item.id, 'pending_sourcing')}
                                                    className="flex-1 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-slate-200 transition-colors"
                                                >
                                                    DEVOLVER A PENDIENTE
                                                </button>
                                            )}
                                            {col.id === 'rejected' && (
                                                <button
                                                    onClick={() => handleUpdateStatus(item.id, 'pending_sourcing')}
                                                    className="flex-1 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-slate-200 transition-colors"
                                                >
                                                    REINTENTAR
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SourcingKanban;
