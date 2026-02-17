import React, { useState } from 'react';

const FinanceConfig: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'accounts' | 'rules' | 'general'>('accounts');

    // Mock Data
    const [accounts, setAccounts] = useState([
        { id: 1, name: 'Caja Chica', type: 'Activo', balance: 4250.00 },
        { id: 2, name: 'Banco Central', type: 'Activo', balance: 55000.00 },
        { id: 3, name: 'Stripe Web', type: 'Activo', balance: 12430.50 },
        { id: 4, name: 'Deuda Proveedores', type: 'Pasivo', balance: -2400.00 },
    ]);

    const [rules, setRules] = useState([
        { id: 1, event: 'Orden Creada (Pago Confirmado)', action: 'Credit', account: 'Stripe Web' },
        { id: 2, event: 'Orden Enviada', action: 'Debit', account: 'Inventario' },
        { id: 3, event: 'Reembolso', action: 'Debit', account: 'Stripe Web' },
    ]);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="flex gap-6 px-6">
                    <button
                        onClick={() => setActiveTab('accounts')}
                        className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'accounts' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        Catálogo de Cuentas
                    </button>
                    <button
                        onClick={() => activeTab !== 'rules' && setActiveTab('rules')}
                        className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'rules' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        Reglas de Transacción
                    </button>
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'general' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        Moneda y Prefijos
                    </button>
                </nav>
            </div>

            <div className="p-6">
                {activeTab === 'accounts' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium text-slate-900 dark:text-white">Cuentas Maestras</h3>
                            <button className="text-sm bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors">
                                + Nueva Cuenta
                            </button>
                        </div>
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">Nombre de Cuenta</th>
                                        <th className="px-4 py-3">Tipo</th>
                                        <th className="px-4 py-3 text-right">Balance Actual</th>
                                        <th className="px-4 py-3 w-[50px]"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {accounts.map(acc => (
                                        <tr key={acc.id} className="bg-white dark:bg-slate-800">
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{acc.name}</td>
                                            <td className="px-4 py-3 text-slate-500">{acc.type}</td>
                                            <td className="px-4 py-3 text-right text-slate-900 dark:text-white">${acc.balance.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'rules' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium text-slate-900 dark:text-white">Automatización de Asientos</h3>
                            <button className="text-sm bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors">
                                + Nueva Regla
                            </button>
                        </div>
                        <p className="text-sm text-slate-500">Define qué cuentas se afectan automáticamente cuando ocurren eventos en el sistema.</p>
                        <div className="space-y-3">
                            {rules.map(rule => (
                                <div key={rule.id} className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                            <span className="material-symbols-outlined">bolt</span>
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-900 dark:text-white">{rule.event}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1">
                                                <span>Acción:</span>
                                                <span className={`font-semibold ${rule.action === 'Credit' ? 'text-emerald-500' : 'text-rose-500'}`}>{rule.action}</span>
                                                <span>&rarr;</span>
                                                <span className="text-slate-700 dark:text-slate-300">{rule.account}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" defaultChecked className="sr-only peer" />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary dark:peer-focus:ring-primary rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'general' && (
                    <div className="max-w-lg space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">Configuración Regional</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Moneda del Sistema</label>
                                    <select className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2">
                                        <option value="USD">USD - Dólar Estadounidense ($)</option>
                                        <option value="EUR">EUR - Euro (€)</option>
                                        <option value="MXN">MXN - Peso Mexicano ($)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Formato de Fecha</label>
                                    <select className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2">
                                        <option>MM/DD/YYYY</option>
                                        <option>DD/MM/YYYY</option>
                                        <option>YYYY-MM-DD</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">Facturación</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Prefijo Facturas</label>
                                    <input type="text" className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2" defaultValue="INV-" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Próximo Número</label>
                                    <input type="number" className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2" defaultValue="1001" />
                                </div>
                            </div>
                        </div>
                        <div className="pt-4">
                            <button className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-sm">
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FinanceConfig;
