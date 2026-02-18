import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Account } from '../types/finance';

const FinanceConfig: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'accounts' | 'rules' | 'settings'>('accounts');
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (activeTab === 'accounts') {
            fetchAccounts();
        }
    }, [activeTab]);

    const fetchAccounts = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('accounts').select('*').order('code');
        if (data) {
            setAccounts(data);
        } else {
            console.error(error);
        }
        setLoading(false);
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => setActiveTab('accounts')}
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'accounts' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Plan de Cuentas
                </button>
                <button
                    onClick={() => setActiveTab('rules')}
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'rules' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Reglas de Transacción
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'settings' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Configuración General
                </button>
            </div>

            {activeTab === 'accounts' && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-medium text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-3">Código</th>
                                <th className="px-6 py-3">Nombre</th>
                                <th className="px-6 py-3">Tipo</th>
                                <th className="px-6 py-3 text-right">Moneda</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-center text-slate-500">Cargando cuentas...</td>
                                </tr>
                            ) : accounts.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-center text-slate-500">No hay cuentas registradas</td>
                                </tr>
                            ) : (
                                accounts.map((account) => (
                                    <tr key={account.id}>
                                        <td className="px-6 py-4 font-mono text-slate-500 text-sm">{account.code}</td>
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{account.name}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs ${['asset', 'income'].includes(account.category)
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {account.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-slate-900 dark:text-white">{account.currency}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'rules' && (
                <div className="space-y-4">
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg flex gap-3 text-amber-700 dark:text-amber-300 text-sm border border-amber-100 dark:border-amber-900/30">
                        <span className="material-symbols-outlined">lightbulb</span>
                        <p>Define cómo se crean los asientos contables automáticamente cuando ocurren eventos en el sistema (ej. "Venta Completada").</p>
                    </div>

                    <div className="grid gap-4">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center group hover:border-primary/50 transition-colors">
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white">Nueva Venta (Stripe)</h4>
                                <p className="text-sm text-slate-500">Creditar: <span className="font-mono text-xs">4001 (Ingresos)</span> | Debitar: <span className="font-mono text-xs">1002 (Banco Stripe)</span></p>
                            </div>
                            <button className="text-slate-400 hover:text-primary"><span className="material-symbols-outlined">edit</span></button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 max-w-2xl">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Moneda del Sistema</label>
                            <select className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                                <option>USD ($)</option>
                                <option>EUR (€)</option>
                                <option>MXN ($)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Prefijo de Factura</label>
                            <input type="text" defaultValue="INV-" className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinanceConfig;
