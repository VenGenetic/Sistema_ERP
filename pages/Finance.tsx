import React, { useState } from 'react';
import FinanceConfig from '../components/FinanceConfig';

const Finance: React.FC = () => {
    const [view, setView] = useState<'dashboard' | 'config'>('dashboard');

    return (
        <div className="flex flex-col gap-6 p-6 md:p-8 max-w-[1400px] mx-auto">
            {/* Breadcrumbs & Header */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span className="hover:text-primary transition-colors cursor-pointer">Inicio</span>
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    <span className="hover:text-primary transition-colors cursor-pointer">Finanzas</span>
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    <span className="text-slate-900 dark:text-white font-medium">
                        {view === 'dashboard' ? 'Libro de Cuentas' : 'Configuración Financiera'}
                    </span>
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Cuentas y Libro Financiero</h1>
                        <p className="text-slate-500 mt-1">Resumen en tiempo real de todas las cuentas financieras y transacciones recientes.</p>
                    </div>
                    <div className="flex gap-3">
                        {view === 'dashboard' ? (
                            <>
                                <button
                                    onClick={() => setView('config')}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                                >
                                    <span className="material-symbols-outlined text-[18px]">settings</span>
                                    Configurar
                                </button>
                                <button className="flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-primary/30">
                                    <span className="material-symbols-outlined text-[18px]">add</span>
                                    Nueva Transacción
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setView('dashboard')}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                            >
                                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                                Volver al Dashboard
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {view === 'config' ? (
                <FinanceConfig />
            ) : (
                <>
                    {/* Account Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Physical Cash */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-6xl text-slate-400">payments</span>
                            </div>
                            <div className="flex flex-col gap-1 relative z-10">
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Efectivo Físico</span>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-2xl font-bold text-slate-900 dark:text-white">$4,250.00</span>
                                </div>
                                <div className="flex items-center gap-1 mt-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 w-fit px-2 py-0.5 rounded-full">
                                    <span className="material-symbols-outlined text-[16px]">trending_up</span>
                                    <span className="font-medium">+2.5%</span>
                                    <span className="text-slate-500 ml-1 text-xs">vs mes anterior</span>
                                </div>
                            </div>
                        </div>
                        {/* Stripe Web */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-6xl text-slate-400">credit_card</span>
                            </div>
                            <div className="flex flex-col gap-1 relative z-10">
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Balance Stripe Web</span>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-2xl font-bold text-slate-900 dark:text-white">$12,430.50</span>
                                </div>
                                <div className="flex items-center gap-1 mt-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 w-fit px-2 py-0.5 rounded-full">
                                    <span className="material-symbols-outlined text-[16px]">trending_up</span>
                                    <span className="font-medium">+12.4%</span>
                                    <span className="text-slate-500 ml-1 text-xs">vs mes anterior</span>
                                </div>
                            </div>
                        </div>
                        {/* Central Bank */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-6xl text-slate-400">account_balance</span>
                            </div>
                            <div className="flex flex-col gap-1 relative z-10">
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Banco Central</span>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-2xl font-bold text-slate-900 dark:text-white">$55,000.00</span>
                                </div>
                                <div className="flex items-center gap-1 mt-2 text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/20 w-fit px-2 py-0.5 rounded-full">
                                    <span className="material-symbols-outlined text-[16px]">trending_down</span>
                                    <span className="font-medium">-5.0%</span>
                                    <span className="text-slate-500 ml-1 text-xs">vs mes anterior</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Transactions Section */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                        {/* Filters Toolbar */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 rounded-t-xl">
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <div className="relative w-full md:w-64">
                                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[20px]">search</span>
                                    <input className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-shadow text-slate-700 dark:text-white" placeholder="Buscar transacciones..." type="text" />
                                </div>
                                <div className="hidden md:flex items-center border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
                                    <button className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 border-r border-slate-300 dark:border-slate-600 transition-colors">
                                        Últimos 30 Días
                                    </button>
                                    <button className="px-2 py-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-50 dark:bg-slate-800 transition-colors">
                                        <span className="material-symbols-outlined text-[20px]">calendar_month</span>
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                                <div className="relative group">
                                    <button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-primary/50 transition-colors">
                                        <span className="material-symbols-outlined text-[18px] text-slate-400">filter_list</span>
                                        Cuenta: Todas
                                        <span className="material-symbols-outlined text-[18px] text-slate-400">arrow_drop_down</span>
                                    </button>
                                </div>
                                <div className="relative group">
                                    <button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-primary/50 transition-colors">
                                        <span className="material-symbols-outlined text-[18px] text-slate-400">swap_vert</span>
                                        Ordenar: Fecha
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Data Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                                        <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[140px]">Fecha</th>
                                        <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descripción</th>
                                        <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[160px]">Cuenta</th>
                                        <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[120px]">Tipo</th>
                                        <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[140px]">ID Pedido</th>
                                        <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right w-[160px]">Monto</th>
                                        <th className="py-3 px-6 w-[60px]"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                    {[
                                        { date: "Oct 24, 2023", desc: "Pago a Proveedor: TechGadgets Ltd", sub: "Reabastecimiento inventario lote #204", account: "Banco Central", type: "Débito", order: "#ORD-992", amount: "-$2,400.00", amountColor: "text-rose-600", typeColor: "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300", icon: "account_balance" },
                                        { date: "Oct 23, 2023", desc: "Compra Cliente", sub: "Audífonos Inalámbricos - Modelo Pro", account: "Stripe Web", type: "Crédito", order: "#ORD-995", amount: "+$120.00", amountColor: "text-emerald-600", typeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", icon: "credit_card" },
                                        { date: "Oct 22, 2023", desc: "Suministros Oficina", sub: "Papel de impresora y cartuchos", account: "Efectivo Físico", type: "Débito", order: "--", amount: "-$45.00", amountColor: "text-rose-600", typeColor: "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300", icon: "payments" },
                                        { date: "Oct 21, 2023", desc: "Compra Cliente", sub: "Hub Casa Inteligente", account: "Stripe Web", type: "Crédito", order: "#ORD-991", amount: "+$249.00", amountColor: "text-emerald-600", typeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", icon: "credit_card" },
                                        { date: "Oct 21, 2023", desc: "Tarifas Envío: DHL Express", sub: "Liquidación factura mensual", account: "Banco Central", type: "Débito", order: "--", amount: "-$530.50", amountColor: "text-rose-600", typeColor: "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300", icon: "account_balance" },
                                    ].map((row, index) => (
                                        <tr key={index} className="group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="py-4 px-6 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{row.date}</td>
                                            <td className="py-4 px-6">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-slate-900 dark:text-white">{row.desc}</span>
                                                    <span className="text-xs text-slate-500">{row.sub}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                    <span className="material-symbols-outlined text-[18px] text-slate-400">{row.icon}</span>
                                                    {row.account}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.typeColor}`}>
                                                    {row.type}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                {row.order !== '--' ? (
                                                    <a href="#" className="text-sm text-primary hover:text-primary/80 hover:underline font-medium">{row.order}</a>
                                                ) : (
                                                    <span className="text-sm text-slate-400 italic">--</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <span className={`text-sm font-bold ${row.amountColor}`}>{row.amount}</span>
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100">
                                                    <span className="material-symbols-outlined text-[20px]">more_vert</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between rounded-b-xl bg-slate-50/50 dark:bg-slate-800/50">
                            <p className="text-sm text-slate-500">Mostrando <span className="font-medium">1-5</span> de <span className="font-medium">248</span> transacciones</p>
                            <div className="flex items-center gap-2">
                                <button className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                                </button>
                                <button className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                    <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Finance;