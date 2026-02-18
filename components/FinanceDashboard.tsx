import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Account } from '../types/finance';
import { useNavigate } from 'react-router-dom';

const FinanceDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [balances, setBalances] = useState<Record<number, number>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch only non-nominal accounts
            const { data: accountsData, error: accountsError } = await supabase
                .from('accounts')
                .select('*')
                .eq('is_nominal', false)
                .order('code');

            if (accountsError) throw accountsError;

            // Fetch balances for these accounts
            // Note: This is a simplified balance fetching. In a real app, you'd likely sum transaction lines.
            // For now, we'll fetch all transaction lines and sum them up in JS as per previous implementation structure,
            // but filtered for these accounts.
            const { data: allLines, error: balanceError } = await supabase
                .from('transaction_lines')
                .select('account_id, debit, credit, account:accounts(category)');

            if (balanceError) throw balanceError;

            const newBalances: Record<number, number> = {};

            allLines?.forEach((line: any) => {
                const accountId = line.account_id;
                const category = line.account?.category;
                const debit = Number(line.debit || 0);
                const credit = Number(line.credit || 0);

                if (!newBalances[accountId]) newBalances[accountId] = 0;

                if (['asset', 'expense'].includes(category)) {
                    newBalances[accountId] += (debit - credit);
                } else {
                    newBalances[accountId] += (credit - debit);
                }
            });

            setAccounts(accountsData || []);
            setBalances(newBalances);

        } catch (error) {
            console.error('Error fetching finance dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Cuentas y Libro Financiero</h1>
                    <p className="text-slate-500 mt-1">Resumen en tiempo real de todas las cuentas financieras.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('config')}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">settings</span>
                        Configurar
                    </button>
                    <button className="flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-primary/30">
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Nueva Transacción
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-3 text-center py-8 text-slate-500">Cargando cuentas...</div>
                ) : accounts.length === 0 ? (
                    <div className="col-span-3 text-center py-8 text-slate-500">No hay cuentas para mostrar.</div>
                ) : (
                    accounts.map(account => (
                        <div
                            key={account.id}
                            onClick={() => navigate(`account/${account.id}`)}
                            className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group cursor-pointer hover:border-primary/50 transition-all"
                        >
                            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-6xl text-slate-400">
                                    {account.category === 'asset' ? 'account_balance_wallet' :
                                        account.category === 'liability' ? 'credit_card' : 'payments'}
                                </span>
                            </div>
                            <div className="flex flex-col gap-1 relative z-10">
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{account.name}</span>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(balances[account.id] || 0, account.currency)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 mt-2 text-sm text-slate-400">
                                    <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{account.code}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default FinanceDashboard;
