import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { buildWhatsAppDemandURL, openWhatsApp } from '../utils/whatsapp';

interface ProductDemand {
    id: number;
    product_id: number;
    phone_number: string;
    customer_name: string | null;
    notes: string | null;
    status: 'pending_stock' | 'stock_available' | 'notified' | 'cancelled';
    created_at: string;
    stock_detected_at: string | null;
    notified_at: string | null;
    product: {
        id: number;
        name: string;
        sku: string;
        importer_stock: number;
        local_stock: number;
        inventory_levels: { current_stock: number }[];
    } | null;
}

const ProductDemands: React.FC = () => {
    const { user } = useAuth();
    const [demands, setDemands] = useState<ProductDemand[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
    const [searchTerm, setSearchTerm] = useState('');

    const fetchDemands = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('product_demands')
                .select(`
                    *,
                    product:products(id, name, sku, importer_stock, local_stock, inventory_levels(current_stock))
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDemands(data || []);
        } catch (error: any) {
            console.error('Error fetching demands:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDemands();
    }, []);

    const handleNotify = async (demand: ProductDemand) => {
        if (!demand.product) return;
        
        const url = buildWhatsAppDemandURL({
            customerPhone: demand.phone_number,
            customerName: demand.customer_name || undefined,
            productSku: demand.product.sku,
            productName: demand.product.name
        });

        openWhatsApp(url);

        // Preguntar si se quiere marcar como notificado
        if (window.confirm(`¿Se envió el mensaje a ${demand.customer_name || demand.phone_number} correctamente?`)) {
            try {
                const { error } = await supabase
                    .from('product_demands')
                    .update({
                        status: 'notified',
                        notified_at: new Date().toISOString(),
                        notified_by: user?.id
                    })
                    .eq('id', demand.id);

                if (error) throw error;
                fetchDemands();
            } catch (error: any) {
                alert(`Error al marcar como notificado: ${error.message}`);
            }
        }
    };

    const handleMarkAvailable = async (demand: ProductDemand) => {
        if (window.confirm(`¿Marcar como disponible manualmente? (Útil cuando llega un producto equivalente)`)) {
            try {
                const { error } = await supabase
                    .from('product_demands')
                    .update({
                        status: 'stock_available',
                        stock_detected_at: new Date().toISOString()
                    })
                    .eq('id', demand.id);

                if (error) throw error;
                fetchDemands();
            } catch (error: any) {
                alert(`Error: ${error.message}`);
            }
        }
    };

    const handleCancel = async (demand: ProductDemand) => {
        if (window.confirm('¿Estás seguro de cancelar esta solicitud?')) {
            try {
                const { error } = await supabase
                    .from('product_demands')
                    .update({ status: 'cancelled' })
                    .eq('id', demand.id);

                if (error) throw error;
                fetchDemands();
            } catch (error: any) {
                alert(`Error: ${error.message}`);
            }
        }
    };

    const handleDelete = async (demand: ProductDemand) => {
        if (window.confirm('¿Eliminar permanentemente del historial?')) {
            try {
                const { error } = await supabase
                    .from('product_demands')
                    .delete()
                    .eq('id', demand.id);

                if (error) throw error;
                fetchDemands();
            } catch (error: any) {
                alert(`Error: ${error.message}`);
            }
        }
    };

    const filteredDemands = useMemo(() => {
        let filtered = demands.filter(d => {
            if (activeTab === 'active') {
                return d.status === 'pending_stock' || d.status === 'stock_available';
            } else {
                return d.status === 'notified' || d.status === 'cancelled';
            }
        });

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(d => 
                (d.phone_number && d.phone_number.includes(lowerTerm)) ||
                (d.customer_name && d.customer_name.toLowerCase().includes(lowerTerm)) ||
                (d.product?.name && d.product.name.toLowerCase().includes(lowerTerm)) ||
                (d.product?.sku && d.product.sku.toLowerCase().includes(lowerTerm))
            );
        }

        return filtered;
    }, [demands, activeTab, searchTerm]);

    const getStockValue = (prod: any) => {
        if (!prod) return 0;
        const local = prod.inventory_levels ? prod.inventory_levels.reduce((acc: number, lvl: any) => acc + (lvl.current_stock || 0), 0) : 0;
        return local + (prod.importer_stock || 0);
    };

    return (
        <div className="p-6 md:p-8 max-w-[1400px] mx-auto flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold dark:text-white tracking-tight">Demanda de Stock</h1>
                    <p className="text-slate-500 mt-1">Lista de espera para notificar a clientes cuando un producto agotado vuelva a tener stock.</p>
                </div>
                <button
                    onClick={fetchDemands}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                >
                    <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
                    Actualizar
                </button>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-[#0c1117] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-full md:w-auto">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'active' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'}`}
                    >
                        Cola Activa
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'}`}
                    >
                        Historial
                    </button>
                </div>

                <div className="relative w-full md:w-72">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por cliente, teléfono o producto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white transition-all"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-[#0c1117] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-[#161b22] border-b border-slate-200 dark:border-slate-800">
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cliente / Teléfono</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Producto (SKU)</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estado de Solicitud</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fecha / Stock</th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {filteredDemands.map(demand => {
                                const totalStock = getStockValue(demand.product);
                                const isReady = demand.status === 'stock_available';
                                return (
                                    <tr key={demand.id} className={`transition-colors ${isReady ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                        <td className="px-6 py-4 align-top">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-900 dark:text-white">{demand.customer_name || 'Sin Nombre'}</span>
                                                <span className="text-sm font-mono text-slate-500 dark:text-slate-400">{demand.phone_number}</span>
                                                {demand.notes && (
                                                    <span className="text-xs text-slate-400 mt-1 italic max-w-[200px] truncate" title={demand.notes}>{demand.notes}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-top max-w-[250px]">
                                            {demand.product ? (
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-900 dark:text-slate-200 line-clamp-2" title={demand.product.name}>
                                                        {demand.product.name}
                                                    </span>
                                                    <span className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                                                        {demand.product.sku}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic">Producto no encontrado</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 align-top">
                                            {demand.status === 'pending_stock' && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                                                    Agotado / Esperando
                                                </span>
                                            )}
                                            {demand.status === 'stock_available' && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                                    Listo para Notificar
                                                </span>
                                            )}
                                            {demand.status === 'notified' && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                                    <span className="material-symbols-outlined text-[14px]">done_all</span>
                                                    Notificado
                                                </span>
                                            )}
                                            {demand.status === 'cancelled' && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                    <span className="material-symbols-outlined text-[14px]">cancel</span>
                                                    Cancelado
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 align-top">
                                            <div className="flex flex-col gap-1 text-sm">
                                                <span className="text-slate-500 dark:text-slate-400">
                                                    Reg: {new Date(demand.created_at).toLocaleDateString()}
                                                </span>
                                                {demand.product && (
                                                    <span className={`font-semibold ${totalStock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                                        Stock Actual: {totalStock}
                                                    </span>
                                                )}
                                                {demand.status === 'notified' && demand.notified_at && (
                                                    <span className="text-blue-600 dark:text-blue-400 text-xs">
                                                        Notif: {new Date(demand.notified_at).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center align-top">
                                            <div className="flex flex-col items-center gap-2">
                                                {activeTab === 'active' ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleNotify(demand)}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 w-full justify-center rounded-lg text-sm font-semibold text-white transition-colors shadow-sm ${
                                                                isReady ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-blue-500 hover:bg-blue-600'
                                                            }`}
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">chat</span>
                                                            Notificar
                                                        </button>
                                                        {!isReady && (
                                                            <button
                                                                onClick={() => handleMarkAvailable(demand)}
                                                                className="text-xs text-slate-500 hover:text-emerald-600 transition-colors"
                                                            >
                                                                Marcar Disp. (Similar)
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleCancel(demand)}
                                                            className="text-xs text-rose-500 hover:text-rose-700 transition-colors mt-1"
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => handleDelete(demand)}
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                                        title="Eliminar registro"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredDemands.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="material-symbols-outlined text-[36px] text-slate-300">inbox</span>
                                            <span>No hay solicitudes en esta vista.</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ProductDemands;
