import React, { useState } from 'react';

interface Warehouse {
    id: string;
    name: string;
    type: 'Físico' | 'Virtual';
    location: string;
    itemsCount: number;
    status: 'Activo' | 'Inactivo';
}

const Inventory: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'warehouses' | 'stock' | 'movements'>('warehouses');

    const warehouses: Warehouse[] = [
        { id: '1', name: 'Almacén Central', type: 'Físico', location: 'Ciudad de México, MX', itemsCount: 1240, status: 'Activo' },
        { id: '2', name: 'Oficina Principal', type: 'Físico', location: 'Guadalajara, MX', itemsCount: 45, status: 'Activo' },
        { id: '3', name: 'MegaDrop Logistics', type: 'Virtual', location: 'Shenzhen, CN', itemsCount: 5000, status: 'Activo' },
        { id: '4', name: 'Global Trade Co', type: 'Virtual', location: 'Miami, USA', itemsCount: 320, status: 'Activo' },
    ];

    const stockItems = [
        { id: 'P-101', name: 'Audífonos Pro', sku: 'AUD-PRO-BLK', stock: 45, minStock: 10, warehouse: 'Almacén Central', status: 'In Stock' },
        { id: 'P-102', name: 'Smart Watch V2', sku: 'SW-V2-SlV', stock: 8, minStock: 15, warehouse: 'Almacén Central', status: 'Low Stock' },
        { id: 'P-103', name: 'Case iPhone 14', sku: 'CASE-IP14-CLR', stock: 120, minStock: 20, warehouse: 'Oficina Principal', status: 'In Stock' },
    ];

    const movements = [
        { id: 'MOV-001', date: '2023-10-25', type: 'Entrada', reason: 'Compra Proveedor', quantity: 50, user: 'Admin', product: 'Audífonos Pro' },
        { id: 'MOV-002', date: '2023-10-24', type: 'Salida', reason: 'Venta', quantity: 2, user: 'System', product: 'Smart Watch V2' },
        { id: 'MOV-003', date: '2023-10-23', type: 'Salida', reason: 'Merma', quantity: 1, user: 'J. Doe', product: 'Case iPhone 14' },
    ];

    return (
        <div className="flex flex-col gap-6 p-6 md:p-8 max-w-[1400px] mx-auto">
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
                        <p className="text-slate-500 mt-1">Controla tus almacenes físicos y virtuales, stock y movimientos.</p>
                    </div>
                    <div className="flex gap-3">
                        <button className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                            <span className="material-symbols-outlined text-[18px]">settings</span>
                            Configurar Motivos
                        </button>
                        <button className="flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-primary/30">
                            <span className="material-symbols-outlined text-[18px]">add_home_work</span>
                            Nuevo Almacén
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
                        {warehouses.map(wh => (
                            <div key={wh.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-lg ${wh.type === 'Físico' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'}`}>
                                        <span className="material-symbols-outlined text-[24px]">{wh.type === 'Físico' ? 'store' : 'cloud'}</span>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${wh.status === 'Activo' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-600'}`}>
                                        {wh.status}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{wh.name}</h3>
                                <p className="text-sm text-slate-500 flex items-center gap-1 mb-4">
                                    <span className="material-symbols-outlined text-[16px]">location_on</span>
                                    {wh.location}
                                </p>

                                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700/50 flex justify-between items-center">
                                    <div>
                                        <span className="block text-2xl font-bold text-slate-900 dark:text-white">{wh.itemsCount}</span>
                                        <span className="text-xs text-slate-500">Items en stock</span>
                                    </div>
                                    <button className="text-primary text-sm font-medium hover:underline">Gestionar &rarr;</button>
                                </div>
                            </div>
                        ))}
                        {/* Add New Card */}
                        <button className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:text-primary hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all min-h-[200px]">
                            <span className="material-symbols-outlined text-4xl mb-2">add_circle</span>
                            <span className="font-medium">Registrar Nuevo Almacén</span>
                        </button>
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
                                        <th className="px-6 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {stockItems.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{item.name}</td>
                                            <td className="px-6 py-4 text-slate-500 font-mono text-sm">{item.sku}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{item.warehouse}</td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">{item.stock}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${item.status === 'Low Stock' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                                                    <span className="material-symbols-outlined text-[20px]">more_horiz</span>
                                                </button>
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
                                        <th className="px-6 py-3">Motivo</th>
                                        <th className="px-6 py-3 text-right">Cantidad</th>
                                        <th className="px-6 py-3">Usuario</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {movements.map(mov => (
                                        <tr key={mov.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-sm">{mov.date}</td>
                                            <td className="px-6 py-4">
                                                <span className={`flex items-center gap-1 text-sm font-medium ${mov.type === 'Entrada' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                    <span className="material-symbols-outlined text-[16px]">{mov.type === 'Entrada' ? 'arrow_downward' : 'arrow_upward'}</span>
                                                    {mov.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{mov.product}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-sm">{mov.reason}</td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">{mov.quantity}</td>
                                            <td className="px-6 py-4 text-slate-500 text-sm">{mov.user}</td>
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
