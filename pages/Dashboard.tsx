import React from 'react';

const Dashboard: React.FC = () => {
    // Activity Stream consolidado basado en INVENTORY_LOGS, TRANSACTIONS y ORDERS
    const activityStream = [
        { type: 'PEDIDO', id: 'ORD-9942', time: '10:42 AM', user: 'Sistema (Auto)', detail: 'Nuevo Pedido Dropship vía TrendyShop UK', status: 'Pendiente', amount: '$124.00' },
        { type: 'STOCK', id: 'LOG-4421', time: '10:38 AM', user: 'Juan Pérez', detail: 'Movidas 50u SKU-991 Bodega Central -> Oeste', status: 'Completado', meta: 'Bodega' },
        { type: 'FINANZAS', id: 'TX-1102', time: '10:15 AM', user: 'Stripe API', detail: 'Pago recibido en Cuenta Stripe Web', status: 'Liquidado', amount: '+$2,450.00' },
        { type: 'ALERTA', id: 'SYS-001', time: '09:55 AM', user: 'Bot Inventario', detail: 'Alerta Stock Bajo: Audífonos (5 restantes)', status: 'Advertencia', meta: 'SKU-882' },
        { type: 'PEDIDO', id: 'ORD-9941', time: '09:30 AM', user: 'Sara M.', detail: 'Pedido completado manualmente', status: 'Completado', amount: '$45.00' },
    ];

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen">
            {/* Header / HUD */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Centro de Comando</h1>
                    <p className="text-slate-500 text-sm font-mono mt-1">
                        <span className="text-emerald-500 animate-pulse">● En Vivo</span> | Monitoreando 3 Bodegas, 5 Cuentas, 142 Socios
                    </p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-[#161b22] border border-slate-700 hover:border-slate-500 rounded text-slate-300 text-sm font-medium transition-all">
                        <span className="material-symbols-outlined text-[18px]">terminal</span>
                        Ejecutar Script
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded text-sm font-bold shadow-lg shadow-primary/20 transition-all">
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Crear Pedido
                    </button>
                </div>
            </div>

            {/* High Density Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                {/* Finance Metric */}
                <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] flex flex-col justify-between h-32 hover:border-slate-400 dark:hover:border-slate-600 transition-colors group cursor-pointer shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Liquidez Neta</span>
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-white transition-colors">account_balance</span>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">$71,680.50</div>
                        <div className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">trending_up</span>
                            +12.5% esta semana
                        </div>
                    </div>
                </div>

                {/* Orders Metric */}
                <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] flex flex-col justify-between h-32 hover:border-slate-400 dark:hover:border-slate-600 transition-colors group cursor-pointer shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Pendientes de Despacho</span>
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-white transition-colors">local_shipping</span>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">24 Pedidos</div>
                        <div className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            4 requieren atención
                        </div>
                    </div>
                </div>

                {/* Inventory Metric */}
                <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] flex flex-col justify-between h-32 hover:border-slate-400 dark:hover:border-slate-600 transition-colors group cursor-pointer shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Salud del Inventario</span>
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-white transition-colors">inventory_2</span>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">98.2%</div>
                        <div className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">warning</span>
                            3 SKUs bajo umbral
                        </div>
                    </div>
                </div>

                 {/* Partners Metric */}
                 <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] flex flex-col justify-between h-32 hover:border-slate-400 dark:hover:border-slate-600 transition-colors group cursor-pointer shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Socios Activos</span>
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-white transition-colors">hub</span>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">142</div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            Sistemas operativos
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Operational Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Col: Live Operations Feed */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                         <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Flujo de Operaciones Unificado</h3>
                         <div className="flex gap-2">
                             <span className="px-2 py-1 rounded bg-slate-200 dark:bg-[#161b22] text-[10px] font-mono text-slate-500 border border-slate-300 dark:border-slate-800">TIEMPO REAL</span>
                         </div>
                    </div>

                    <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-[#0d1117] border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Hora</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Tipo</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Detalles</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Usuario/Actor</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono text-right">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {activityStream.map((item, idx) => (
                                    <tr key={idx} className="group hover:bg-slate-50 dark:hover:bg-[#1c2128] transition-colors cursor-pointer">
                                        <td className="px-6 py-4 text-xs font-mono text-slate-500">{item.time}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold border
                                                ${item.type === 'PEDIDO' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : ''}
                                                ${item.type === 'STOCK' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' : ''}
                                                ${item.type === 'FINANZAS' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : ''}
                                                ${item.type === 'ALERTA' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : ''}
                                            `}>
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm text-slate-900 dark:text-slate-200 font-medium">{item.detail}</span>
                                                <span className="text-xs text-slate-400 font-mono mt-0.5">{item.id} {item.amount && `• ${item.amount}`}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-500">{item.user}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`text-xs font-medium 
                                                ${item.status === 'Advertencia' ? 'text-rose-500' : 'text-slate-900 dark:text-white'}
                                            `}>{item.status}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d1117] text-center">
                            <button className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">Ver registro de auditoría completo</button>
                        </div>
                    </div>
                </div>

                {/* Right Col: Technical Status */}
                <div className="flex flex-col gap-6">
                    {/* Deployment Status */}
                    <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Infraestructura</h3>
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-800">
                                        <span className="material-symbols-outlined text-[18px]">dns</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-slate-900 dark:text-white">Supabase DB</span>
                                        <span className="text-[10px] text-slate-500 font-mono">us-east-1 • 24ms</span>
                                    </div>
                                </div>
                                <span className="text-xs text-emerald-500 font-medium">Saludable</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-800">
                                        <span className="material-symbols-outlined text-[18px]">javascript</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-slate-900 dark:text-white">Node.js Workers</span>
                                        <span className="text-[10px] text-slate-500 font-mono">v18.x • 99.9% Uptime</span>
                                    </div>
                                </div>
                                <span className="text-xs text-emerald-500 font-medium">Activo</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-800">
                                        <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-slate-900 dark:text-white">Vercel Edge</span>
                                        <span className="text-[10px] text-slate-500 font-mono">Última build: 4m atrás</span>
                                    </div>
                                </div>
                                <span className="text-xs text-slate-500">Listo</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Transfer Widget */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 shadow-sm">
                         <div className="flex items-center gap-2 mb-3 text-primary">
                            <span className="material-symbols-outlined">move_up</span>
                            <span className="text-sm font-bold uppercase tracking-wide">Movimiento Rápido</span>
                         </div>
                         <div className="space-y-3">
                             <div>
                                 <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">SKU del Producto</label>
                                 <input type="text" className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-sm font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="ej. SKU-123" />
                             </div>
                             <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Desde</label>
                                    <select className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-slate-800 rounded px-2 py-2 text-sm text-slate-500">
                                        <option>Bodega Central</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Hasta</label>
                                    <select className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-slate-800 rounded px-2 py-2 text-sm text-slate-500">
                                        <option>Socio X</option>
                                    </select>
                                </div>
                             </div>
                             <button className="w-full bg-primary hover:bg-primary/90 text-white text-sm font-bold py-2 rounded shadow-sm mt-1 transition-colors">
                                 Transferir Stock
                             </button>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;