import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import InventoryMovementModal from '../components/InventoryMovementModal';

// Define types based on our join queries
interface StockItem {
    id: number;
    current_stock: number;
    products: {
        name: string;
        sku: string;
    };
    warehouses: {
        name: string;
    };
}

interface Movement {
    id: number;
    created_at: string;
    quantity_change: number;
    reason: string;
    type: string; // derived
    products: {
        name: string;
    };
    warehouses: {
        name: string;
    };
    user_id: string; // We might want to join profiles if available
}

interface Warehouse {
    id: number;
    name: string;
    type: string;
    location: string;
    is_active: boolean;
}

const Inventory: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'warehouses' | 'stock' | 'movements'>('warehouses');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Data states
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [movements, setMovements] = useState<Movement[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchData();
    }, [activeTab]); // Refetch when tab changes

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'warehouses') {
                const { data, error } = await supabase.from('warehouses').select('*').order('id');
                if (error) throw error;
                setWarehouses(data || []);
            } else if (activeTab === 'stock') {
                const { data, error } = await supabase
                    .from('inventory_levels')
                    .select(`
                        id, current_stock,
                        products (name, sku),
                        warehouses (name)
                    `)
                    .order('product_id'); // Order by product
                if (error) throw error;
                // @ts-ignore - Supabase types are tricky with joins sometimes
                setStockItems(data || []);
            } else if (activeTab === 'movements') {
                const { data, error } = await supabase
                    .from('inventory_logs')
                    .select(`
                        id, created_at, quantity_change, reason, user_id,
                        products (name),
                        warehouses (name)
                    `)
                    .order('created_at', { ascending: false })
                    .limit(50);
                if (error) throw error;
                // @ts-ignore
                setMovements(data || []);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleMovementSuccess = () => {
        // Refresh data after successful transaction
        fetchData();
    };

    return (
        <div className="flex flex-col gap-6 p-6 md:p-8 max-w-[1400px] mx-auto">
            <InventoryMovementModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleMovementSuccess}
            />

            {/* Breadcrumbs & Header */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span className="hover:text-primary transition-colors cursor-pointer">Inicio</span>
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    <span className="text-slate-900 dark:text-white font-medium">Inventario y Logística</span>
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Gestión de Inventario</h1>
                        <p className="text-slate-500 mt-1">Controla tus almacenes físicos y virtuales, stock y movimientos (ACID Compliant).</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={fetchData}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        >
                            <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
                            Actualizar
                        </button>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-primary/30"
                        >
                            <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                            Registrar Movimiento
                        </button>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="flex gap-6">
                    <button
                        onClick={() => setActiveTab('warehouses')}
                        className={`py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'warehouses' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        <span className="material-symbols-outlined text-[20px]">warehouse</span>
                        Almacenes
                    </button>
                    <button
                        onClick={() => setActiveTab('stock')}
                        className={`py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'stock' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                        Inventario Global
                    </button>
                    <button
                        onClick={() => setActiveTab('movements')}
                        className={`py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'movements' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        <span className="material-symbols-outlined text-[20px]">history</span>
                        Historial de Movimientos
                    </button>
                </nav>
            </div>

            {/* Content Area */}
            <div className="min-h-[400px]">
                {activeTab === 'warehouses' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {warehouses.length === 0 && !loading && (
                            <div className="col-span-full text-center py-10 text-slate-500">
                                No se encontraron almacenes.
                            </div>
                        )}
                        {warehouses.map(wh => (
                            <div key={wh.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-lg ${wh.type === 'physical' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'}`}>
                                        <span className="material-symbols-outlined text-[24px]">{wh.type === 'physical' ? 'store' : 'cloud'}</span>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${wh.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-600'}`}>
                                        {wh.is_active ? 'Activo' : 'Inactivo'}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{wh.name}</h3>
                                <p className="text-sm text-slate-500 flex items-center gap-1 mb-4">
                                    <span className="material-symbols-outlined text-[16px]">location_on</span>
                                    {wh.location || 'N/A'}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'stock' && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-medium text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-3">Producto</th>
                                        <th className="px-6 py-3">SKU</th>
                                        <th className="px-6 py-3">Almacén</th>
                                        <th className="px-6 py-3 text-right">Stock Actual</th>
                                        <th className="px-6 py-3 text-center">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {stockItems.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                                No hay registros de inventario. Comienza registrando un movimiento.
                                            </td>
                                        </tr>
                                    )}
                                    {stockItems.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                                {/* @ts-ignore */}
                                                {item.products?.name}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 font-mono text-sm">
                                                {/* @ts-ignore */}
                                                {item.products?.sku}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {/* @ts-ignore */}
                                                {item.warehouses?.name}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">{item.current_stock}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${item.current_stock < 10 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
                                                    {item.current_stock < 10 ? 'Low Stock' : 'In Stock'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'movements' && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-medium text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-3">Fecha</th>
                                        <th className="px-6 py-3">Tipo</th>
                                        <th className="px-6 py-3">Producto</th>
                                        <th className="px-6 py-3">Almacén</th>
                                        <th className="px-6 py-3">Motivo</th>
                                        <th className="px-6 py-3 text-right">Cantidad</th>
                                        <th className="px-6 py-3">Usuario</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {movements.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                                No hay movimientos registrados.
                                            </td>
                                        </tr>
                                    )}
                                    {movements.map(mov => (
                                        <tr key={mov.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-sm">
                                                {new Date(mov.created_at).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`flex items-center gap-1 text-sm font-medium ${mov.quantity_change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                    <span className="material-symbols-outlined text-[16px]">{mov.quantity_change > 0 ? 'arrow_downward' : 'arrow_upward'}</span>
                                                    {mov.quantity_change > 0 ? 'Entrada' : 'Salida'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                                {/* @ts-ignore */}
                                                {mov.products?.name}
                                            </td>
                                            <td className="px-6 py-4 text-slate-900 dark:text-white">
                                                {/* @ts-ignore */}
                                                {mov.warehouses?.name}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-sm">{mov.reason}</td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">{Math.abs(mov.quantity_change)}</td>
                                            <td className="px-6 py-4 text-slate-500 text-sm">{mov.user_id?.substring(0, 8)}...</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Inventory;
