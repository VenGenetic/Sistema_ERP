import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Account } from '../types/finance';
import { getAccountNatureLabel, categoryDisplayName } from '../utils/accountNature';
import { formatearMoneda } from '../utils/moneda';
import {
  Lightbulb,
  Pencil,
} from 'lucide-react';

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
        // Fetch from view to include current_balance
        const { data, error } = await supabase.from('account_balances').select('*').order('code');
        if (data) {
            setAccounts(data);
        } else {
            console.error(error);
        }
        setLoading(false);
    };

    const formatCurrency = (amount: number, currency: string = 'USD') => formatearMoneda(amount, currency);

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            <div className="flex gap-4 border-b border-subtle">
                <button
                    onClick={() => setActiveTab('accounts')}
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'accounts' ? 'border-primary text-primary' : 'border-transparent text-fg-muted hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Plan de Cuentas
                </button>
                <button
                    onClick={() => setActiveTab('rules')}
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'rules' ? 'border-primary text-primary' : 'border-transparent text-fg-muted hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Reglas de Transacción
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'settings' ? 'border-primary text-primary' : 'border-transparent text-fg-muted hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Configuración General
                </button>
            </div>

            {activeTab === 'accounts' && (
                <div className="bg-surface rounded-xl border border-subtle overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-surface-2 text-fg-muted font-medium text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-4 py-2.5">Código</th>
                                <th className="px-4 py-2.5">Nombre</th>
                                <th className="px-4 py-2.5">Tipo</th>
                                <th className="px-4 py-2.5">Naturaleza</th>
                                <th className="px-4 py-2.5 text-right">Balance Actual</th>
                                <th className="px-4 py-2.5 text-right">Moneda</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-3 text-center text-fg-muted">Cargando cuentas...</td>
                                </tr>
                            ) : accounts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-3 text-center text-fg-muted">No hay cuentas registradas</td>
                                </tr>
                            ) : (
                                accounts.map((account) => (
                                    <tr key={account.id}>
                                        <td className="px-4 py-3 font-mono text-fg-muted text-sm">{account.code}</td>
                                        <td className="px-4 py-3 font-medium text-fg">{account.name}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs ${['asset', 'income'].includes(account.category) ? 'bg-success-soft text-success' : 'bg-primary-soft text-primary' }`}>
                                                {categoryDisplayName(account.category)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {(() => {
                                                const nature = getAccountNatureLabel(account.category);
                                                const isDeudora = nature.nature === 'Deudora';
                                                return (
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${ isDeudora ? 'bg-primary-soft text-primary dark:text-primary' : 'bg-primary-soft text-primary dark:text-primary' }`}>
                                                        {nature.nature} (Débito {nature.debitEffect})
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-medium ${Number(account.current_balance || 0) < 0 ? 'text-danger' : 'text-slate-900 dark:text-white'}`}>
                                            {formatCurrency(account.current_balance || 0, account.currency)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-fg">{account.currency}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'rules' && (
                <div className="space-y-4">
                    <div className="bg-warning-soft p-4 rounded-lg flex gap-3 text-warning-soft-fg text-sm border border-warning/20">
                        <Lightbulb size={18} aria-hidden="true" />
                        <p>Define cómo se crean los asientos contables automáticamente cuando ocurren eventos en el sistema (ej. "Venta Completada").</p>
                    </div>

                    <div className="grid gap-4">
                        <div className="bg-surface p-4 rounded-xl border border-subtle flex justify-between items-center group hover:border-primary/50 transition-colors">
                            <div>
                                <h4 className="font-bold text-fg">Nueva Venta (Stripe)</h4>
                                <p className="text-sm text-fg-muted">Creditar: <span className="font-mono text-xs">4001 (Ingresos)</span> | Debitar: <span className="font-mono text-xs">1002 (Banco Stripe)</span></p>
                            </div>
                            <button className="text-fg-subtle hover:text-primary"><Pencil size={18} aria-hidden="true" /></button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="bg-surface p-6 rounded-xl border border-subtle max-w-2xl">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-fg mb-1">Moneda del Sistema</label>
                            <select className="w-full rounded-lg border-strong bg-surface text-fg">
                                <option>USD ($)</option>
                                <option>EUR (€)</option>
                                <option>MXN ($)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-fg mb-1">Prefijo de Factura</label>
                            <input type="text" defaultValue="INV-" className="w-full rounded-lg border-strong bg-surface text-fg" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinanceConfig;
