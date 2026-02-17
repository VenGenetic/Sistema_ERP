import React from 'react';
import { useSearchParams } from 'react-router-dom';

const TeamPanel = () => {
    const users = [
        { name: "John Doe", email: "john@example.com", initials: "JD", role: "Admin", roleColor: "purple", status: "Activo", lastActive: "hace 2 min", avatarType: "initials" },
        { name: "Sarah Smith", email: "sarah@example.com", role: "Onsite", roleColor: "emerald", status: "Activo", lastActive: "hace 4 horas", avatarType: "img", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBNqrmWF5X-GT77B_zoPTAxQ4FqTtJjF4amtudbJVCfegZcmRsxS51uFxsc3FPa51I2G_Xl-C1YCIppbyMPz98fPvup0Fq7_ijEBP1EAaPxRy5AiM6U6Qt9-rSWIwtukRjxirzqPKLFsenYZZJEIp222SqAqzPozLXCxh56ZBfGyTjnMlz4O3ZQ3MbTDCgDrNqWmWlW0bOZWHfQEkjbcjwCP4ICSbXhA36BmgmRQEdx2ieQTlW7rw7XeASo2bbiP0KO0Htxy8r7" },
        { name: "Mike Johnson", email: "mike@example.com", initials: "MJ", role: "Closer", roleColor: "amber", status: "Inactivo", lastActive: "hace 2 días", avatarType: "initials" },
        { name: "Emily Davis", email: "emily@example.com", role: "Dev", roleColor: "cyan", status: "Activo", lastActive: "hace 1 semana", avatarType: "img", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuC93lzdbdkdIVNvOdSlJBTNAUQvBCn1Nt9YDASG9zdgydOD3hLcDbBnv91sgCfcyVJ3Jfo4SGrgptiiXkWUqaqLB7lvMWpdhnTo1MgONzTNwp2OH4MBtTLzztEoRMisvq0nkJ387hkbY1MJXNED4pMqnT1ahPbRu-UOk2oaDfKwxyyNWpqjyu3yzM93pdqm5NY3zwgZ6yOybacv1Ub-4V6GkH18nZFED-wKM89U2_4l5-i1XmPXD05e3MowKSJmMx_5Z2FGYxJr" },
        { name: "Chris Lee", email: "chris@example.com", initials: "CL", role: "Onsite", roleColor: "emerald", status: "Activo", lastActive: "Ayer", avatarType: "initials" },
    ];

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            {/* Team List Table */}
            <div className="bg-surface-dark border border-border-dark rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border-dark bg-surface-hover/50">
                                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-[35%]">Usuario</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-[20%]">Rol</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-[20%]">Estado</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-[15%]">Última Actividad</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-[10%] text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark">
                            {users.map((user, index) => (
                                <tr key={index} className="group hover:bg-surface-hover transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-4">
                                            {user.avatarType === 'initials' ? (
                                                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md
                          ${index === 0 ? 'bg-gradient-to-br from-blue-500 to-purple-600' : ''}
                          ${index === 2 ? 'bg-surface-hover border border-border-dark text-text-secondary' : ''}
                          ${index === 4 ? 'bg-gradient-to-br from-indigo-500 to-blue-600' : ''}
                        `}>
                                                    {user.initials}
                                                </div>
                                            ) : (
                                                <img alt={`${user.name} portrait`} className="h-10 w-10 rounded-full object-cover border border-border-dark" src={user.img} />
                                            )}
                                            <div>
                                                <div className="text-sm font-semibold text-white">{user.name}</div>
                                                <div className="text-sm text-text-secondary">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="relative inline-block text-left">
                                            <button className="inline-flex justify-between items-center w-36 rounded-md border border-border-dark shadow-sm px-3 py-1.5 bg-background-dark text-sm font-medium text-white hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-primary transition-all" type="button">
                                                <span className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full 
                            ${user.roleColor === 'purple' ? 'bg-purple-500' : ''}
                            ${user.roleColor === 'emerald' ? 'bg-emerald-500' : ''}
                            ${user.roleColor === 'amber' ? 'bg-amber-500' : ''}
                            ${user.roleColor === 'cyan' ? 'bg-cyan-500' : ''}
                          `}></span>
                                                    {user.role}
                                                </span>
                                                <span className="material-symbols-outlined text-[16px] text-text-secondary">arrow_drop_down</span>
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" defaultChecked={user.status === 'Activo'} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-border-dark peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                            <span className={`ml-3 text-sm font-medium ${user.status === 'Activo' ? 'text-white' : 'text-text-secondary'}`}>{user.status}</span>
                                        </label>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                                        {user.lastActive}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button className="text-text-secondary hover:text-white transition-colors p-2 rounded-full hover:bg-background-dark/50">
                                            <span className="material-symbols-outlined">more_vert</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Role Legend */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { role: "Admin", color: "bg-purple-500", desc: "Acceso total a inventario, finanzas y configuración de usuarios." },
                    { role: "Onsite", color: "bg-emerald-500", desc: "Gestión de bodegas, cumplimiento de pedidos y ajuste de stock." },
                    { role: "Closer", color: "bg-amber-500", desc: "Acceso a tablero de ventas, creación de pedidos y comunicación con clientes." },
                    { role: "Dev", color: "bg-cyan-500", desc: "Gestión de API Keys, configuración de webhooks e integraciones del sistema." }
                ].map((item, i) => (
                    <div key={i} className="p-4 rounded-lg bg-surface-dark border border-border-dark flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${item.color}`}></span>
                            <span className="text-sm font-semibold text-white">{item.role}</span>
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed">{item.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

const PartnersPanel = () => {
    return (
        <div className="flex flex-col gap-8 animate-fade-in">
            <div className="bg-surface-dark border border-border-dark rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1">Configuración de Webhooks</h3>
                        <p className="text-text-secondary text-sm">Endpoints para pedidos dropshipping entrantes de revendedores.</p>
                    </div>
                    <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 text-xs font-bold border border-emerald-500/20">Activo</span>
                </div>
                <div className="flex gap-2 items-center bg-background-dark border border-border-dark rounded-lg p-2">
                    <span className="material-symbols-outlined text-text-secondary pl-2">webhook</span>
                    <code className="text-sm font-mono text-white flex-1 overflow-x-auto">https://api.dropshiperp.com/webhooks/v1/orders/inbound</code>
                    <button className="p-2 hover:bg-surface-hover rounded text-text-secondary hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-[20px]">content_copy</span>
                    </button>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-text-secondary">
                    <span className="material-symbols-outlined text-[16px]">info</span>
                    Requiere header <span className="font-mono text-white">x-api-key</span> para autenticación.
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">Socios Conectados</h3>
                    <button className="text-sm text-primary hover:text-primary/80 font-medium">Gestionar Permisos</button>
                </div>
                <div className="bg-surface-dark border border-border-dark rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border-dark bg-surface-hover/50">
                                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider">Socio</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider">Tipo</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider">API Key</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark">
                            {[
                                { name: "MegaDrop Logistics", type: "Proveedor", key: "pk_live_...92xK" },
                                { name: "TrendyShop UK", type: "Revendedor", key: "pk_live_...88mQ" },
                                { name: "Nordic Home", type: "Revendedor", key: "pk_test_...11pL" },
                            ].map((p, i) => (
                                <tr key={i} className="group hover:bg-surface-hover transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-white">{p.name}</td>
                                    <td className="px-6 py-4 text-sm text-text-secondary">{p.type}</td>
                                    <td className="px-6 py-4">
                                        <code className="bg-background-dark px-2 py-1 rounded border border-border-dark text-xs font-mono text-text-secondary">{p.key}</code>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-primary hover:text-primary/80 text-sm font-medium">Rotar Clave</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

const FinancePanel = () => {
    return (
        <div className="flex flex-col gap-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-surface-dark border border-border-dark rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Moneda y Región</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Moneda Base</label>
                            <select className="w-full bg-background-dark border border-border-dark rounded-lg text-white text-sm p-2.5">
                                <option>USD ($)</option>
                                <option>EUR (€)</option>
                                <option>GBP (£)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Cierre Año Fiscal</label>
                            <select className="w-full bg-background-dark border border-border-dark rounded-lg text-white text-sm p-2.5">
                                <option>31 de Diciembre</option>
                                <option>31 de Marzo</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="bg-surface-dark border border-border-dark rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Automatizaciones</h3>
                    <div className="space-y-4">
                        <label className="flex items-center justify-between cursor-pointer group">
                            <div className="flex flex-col">
                                <span className="text-white font-medium">Auto-Sincronización Stripe</span>
                                <span className="text-text-secondary text-xs">Conciliar automáticamente los pagos de Stripe al libro.</span>
                            </div>
                            <input type="checkbox" defaultChecked className="form-checkbox rounded text-primary border-border-dark bg-background-dark focus:ring-primary h-5 w-5" />
                        </label>
                        <div className="h-px bg-border-dark"></div>
                        <label className="flex items-center justify-between cursor-pointer group">
                            <div className="flex flex-col">
                                <span className="text-white font-medium">Numeración de Facturas</span>
                                <span className="text-text-secondary text-xs">Auto-incrementar IDs de factura (INV-001).</span>
                            </div>
                            <input type="checkbox" defaultChecked className="form-checkbox rounded text-primary border-border-dark bg-background-dark focus:ring-primary h-5 w-5" />
                        </label>
                    </div>
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">Plan de Cuentas</h3>
                    <button className="flex items-center gap-2 text-sm bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        Añadir Cuenta
                    </button>
                </div>
                <div className="bg-surface-dark border border-border-dark rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border-dark bg-surface-hover/50">
                                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider">Código</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider">Nombre</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider">Tipo</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark">
                            {[
                                { code: "1001", name: "Efectivo Físico", type: "Activo", balance: "$4,250.00" },
                                { code: "1002", name: "Balance Stripe Web", type: "Activo", balance: "$12,430.50" },
                                { code: "1003", name: "Banco Central", type: "Activo", balance: "$55,000.00" },
                                { code: "2001", name: "Cuentas por Pagar", type: "Pasivo", balance: "($2,100.00)" },
                                { code: "4001", name: "Ingresos por Ventas", type: "Ingresos", balance: "$142,500.00" },
                            ].map((acc, i) => (
                                <tr key={i} className="group hover:bg-surface-hover transition-colors">
                                    <td className="px-6 py-4 text-sm font-mono text-text-secondary">{acc.code}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-white">{acc.name}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border
                                            ${acc.type === 'Activo' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : ''}
                                            ${acc.type === 'Pasivo' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : ''}
                                            ${acc.type === 'Ingresos' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : ''}
                                        `}>
                                            {acc.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm text-white font-mono">{acc.balance}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

const InventoryPanel = () => {
    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            <div className="bg-surface-dark border border-border-dark rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Alertas de Stock</h3>
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-text-secondary mb-1">Umbral Global de Stock Bajo</label>
                        <input type="number" defaultValue={10} className="w-full bg-background-dark border border-border-dark rounded-lg text-white text-sm p-2.5" />
                        <p className="text-xs text-text-secondary mt-1">Alertar cuando la cantidad de SKU caiga por debajo de este valor.</p>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-text-secondary mb-1">Email de Notificación de Reabastecimiento</label>
                        <input type="email" defaultValue="logistica@dropshiperp.com" className="w-full bg-background-dark border border-border-dark rounded-lg text-white text-sm p-2.5" />
                    </div>
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">Bodegas</h3>
                    <button className="flex items-center gap-2 text-sm bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[16px]">add_location</span>
                        Añadir Ubicación
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { name: "Sede Principal", type: "Física", location: "New York, USA", stock: "14,202 unidades" },
                        { name: "MegaDrop Virtual", type: "Socio Digital", location: "Enlace API", stock: "Sincronizando..." },
                        { name: "Centro Costa Oeste", type: "Física", location: "California, USA", stock: "8,500 unidades" },
                    ].map((w, i) => (
                        <div key={i} className="bg-surface-dark border border-border-dark rounded-xl p-4 hover:border-primary/50 transition-colors cursor-pointer group">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-white">{w.name}</h4>
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${w.type === 'Física' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-purple-500/10 text-purple-500 border-purple-500/20'}`}>{w.type}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-text-secondary mb-3">
                                <span className="material-symbols-outlined text-[16px]">location_on</span>
                                {w.location}
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-border-dark">
                                <span className="text-xs text-text-secondary">Stock Actual</span>
                                <span className="text-sm font-mono text-white">{w.stock}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

const DevPanel = () => {
    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            <div className="bg-surface-dark border border-border-dark rounded-xl overflow-hidden">
                <div className="bg-surface-hover/50 border-b border-border-dark px-4 py-2 flex justify-between items-center">
                    <span className="text-xs font-mono text-text-secondary uppercase">Logs del Sistema (Node.js)</span>
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
                <div className="p-4 bg-[#0d1117] font-mono text-xs text-slate-300 h-64 overflow-y-auto space-y-1">
                    <div className="flex gap-2"><span className="text-slate-500">[10:42:01]</span> <span className="text-emerald-400">INFO</span> Servidor iniciado en puerto 3000</div>
                    <div className="flex gap-2"><span className="text-slate-500">[10:42:05]</span> <span className="text-blue-400">DEBUG</span> Conectado a instancia Supabase</div>
                    <div className="flex gap-2"><span className="text-slate-500">[10:45:12]</span> <span className="text-emerald-400">INFO</span> Webhook recibido: order.created (ID: ord_129)</div>
                    <div className="flex gap-2"><span className="text-slate-500">[10:46:00]</span> <span className="text-yellow-400">WARN</span> Inventario bajo para SKU-992 (5 unidades restantes)</div>
                    <div className="flex gap-2"><span className="text-slate-500">[10:48:22]</span> <span className="text-emerald-400">INFO</span> Transacción sincronizada a Stripe (tx_9921)</div>
                    <div className="flex gap-2"><span className="text-slate-500">[10:52:10]</span> <span className="text-red-400">ERROR</span> Fallo al sincronizar con API de Socio (Tiempo de espera)</div>
                </div>
            </div>

            <div className="bg-surface-dark border border-border-dark rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Variables de Entorno</h3>
                <div className="space-y-3">
                    {[
                        "NEXT_PUBLIC_SUPABASE_URL",
                        "SUPABASE_SERVICE_ROLE_KEY",
                        "STRIPE_SECRET_KEY",
                        "NODE_ENV"
                    ].map((env, i) => (
                        <div key={i} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 pb-3 border-b border-border-dark last:border-0 last:pb-0">
                            <span className="font-mono text-sm text-text-secondary w-64">{env}</span>
                            <div className="flex-1 bg-background-dark border border-border-dark rounded px-3 py-1.5 flex justify-between items-center">
                                <span className="text-xs text-slate-500 font-mono">••••••••••••••••••••••••</span>
                                <span className="material-symbols-outlined text-[16px] text-text-secondary cursor-pointer hover:text-white">visibility</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

const Settings: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'team';

    const renderContent = () => {
        switch (activeTab) {
            case 'team': return <TeamPanel />;
            case 'partners': return <PartnersPanel />;
            case 'inventory': return <InventoryPanel />;
            case 'finance': return <FinancePanel />;
            case 'advanced': return <DevPanel />;
            case 'general':
            default:
                return (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div className="bg-surface-hover/50 p-4 rounded-full mb-4">
                            <span className="material-symbols-outlined text-4xl text-text-secondary">tune</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Configuración General</h3>
                        <p className="text-text-secondary max-w-md">Configura los detalles de tu perfil, preferencias de notificación y apariencia de la aplicación.</p>
                    </div>
                );
        }
    }

    const getTitle = () => {
        switch (activeTab) {
            case 'team': return 'Gestión de Equipos';
            case 'partners': return 'Configuración Dropshipping';
            case 'inventory': return 'Bodegas y Logística';
            case 'finance': return 'Configuración Financiera';
            case 'advanced': return 'Herramientas de Desarrollador';
            default: return 'Configuración General';
        }
    }

    const getDescription = () => {
        switch (activeTab) {
            case 'team': return 'Gestiona el acceso a tu inventario y configura permisos basados en roles.';
            case 'partners': return 'Configura API keys y webhooks para tus proveedores y revendedores.';
            case 'inventory': return 'Gestiona ubicaciones físicas y bodegas digitales de socios.';
            case 'finance': return 'Configura el plan de cuentas y reglas de transacción.';
            case 'advanced': return 'Ver logs del sistema y variables de entorno.';
            default: return 'Gestiona tu cuenta y preferencias de la aplicación.';
        }
    }

    const tabs = [
        { id: 'team', label: 'Gestión de Equipo', icon: 'group' },
        { id: 'partners', label: 'Dropshipping & Socios', icon: 'hub' },
        { id: 'inventory', label: 'Logística & Almacenes', icon: 'warehouse' },
        { id: 'finance', label: 'Contabilidad & Moneda', icon: 'payments' },
        { id: 'advanced', label: 'Desarrollador & API', icon: 'code' },
    ];

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden">
            {/* Settings Sidebar */}
            <div className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto hidden md:block">
                <div className="p-4">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-2">Configuración</h2>
                    <nav className="space-y-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setSearchParams({ tab: tab.id })}
                                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === tab.id
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0d1117]">
                <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
                    {/* Mobile Tab Select */}
                    <div className="md:hidden mb-6">
                        <select
                            value={activeTab}
                            onChange={(e) => setSearchParams({ tab: e.target.value })}
                            className="block w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white py-2 pl-3 pr-10 text-base focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                        >
                            {tabs.map((tab) => (
                                <option key={tab.id} value={tab.id}>{tab.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Header Section */}
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{getTitle()}</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">{getDescription()}</p>
                    </div>

                    {/* Content */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 min-h-[400px]">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;