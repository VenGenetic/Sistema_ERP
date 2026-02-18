import React, { useState, useEffect } from 'react';
import FinanceConfig from '../components/FinanceConfig';
import { supabase } from '../supabaseClient';
import { Transaction, TransactionLine, Account } from '../types/finance';

interface TransactionDisplay extends TransactionLine {
    transaction: Transaction;
    account: Account;
}

const Finance: React.FC = () => {
    const [view, setView] = useState<'dashboard' | 'config'>('dashboard');
    const [transactions, setTransactions] = useState<TransactionDisplay[]>([]);
    const [loading, setLoading] = useState(true);
    const [accountBalances, setAccountBalances] = useState<Record<string, number>>({});

    useEffect(() => {
        if (view === 'dashboard') {
            fetchData();
        }
    }, [view]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch recent transaction lines with related data
            const { data: lines, error } = await supabase
                .from('transaction_lines')
                .select(`
                    *,
                    transaction:transactions(*),
                    account:accounts(*)
                `)
                .order('id', { ascending: false })
                .limit(50);

            if (error) throw error;

            // Fetch all account balances (simplified calculation for now)
            // In a real app, you might have a dedicated balances table or materialized view
            const { data: allLines, error: balanceError } = await supabase
                .from('transaction_lines')
                .select('account_id, debit, credit, account:accounts(category)');

            if (balanceError) throw balanceError;

            const balances: Record<string, number> = {};

            // Calculate balances
            // Asset/Expense: Debit - Credit
            // Liability/Income/Equity: Credit - Debit
            allLines?.forEach((line: any) => {
                const accountId = line.account_id;
                const category = line.account?.category;
                const debit = Number(line.debit || 0);
                const credit = Number(line.credit || 0);

                if (!balances[accountId]) balances[accountId] = 0;

                if (['asset', 'expense'].includes(category)) {
                    balances[accountId] += (debit - credit);
                } else {
                    balances[accountId] += (credit - debit);
                }
            });

            setTransactions(lines as any);
            setAccountBalances(balances);

        } catch (error) {
            console.error('Error fetching finance data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Helper to get balance for specific account codes (hardcoded IDs for demo based on migration)
    // 1001: General Cash, 1002: Stripe, 1003: Central Bank
    // We need to map code to ID or just use code if we fetch it. 
    // For now, let's assume we can map or standard IDs from migration.
    // Actually, migration uses serial IDs. We should use codes if possible, or mapping.
    // Let's fetch accounts to map codes to IDs.
    const [accountMap, setAccountMap] = useState<Record<string, number>>({});

    useEffect(() => {
        const fetchAccounts = async () => {
            const { data } = await supabase.from('accounts').select('id, code');
            if (data) {
                const map: Record<string, number> = {};
                data.forEach(acc => map[acc.code] = acc.id);
                setAccountMap(map);
            }
        };
        fetchAccounts();
    }, []);

    const getBalanceByCode = (code: string) => {
        const id = accountMap[code];
        return id ? (accountBalances[id] || 0) : 0;
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

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
                        {/* Physical Cash (1001) */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-6xl text-slate-400">payments</span>
                            </div>
                            <div className="flex flex-col gap-1 relative z-10">
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Efectivo Físico</span>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(getBalanceByCode('1001'))}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 mt-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 w-fit px-2 py-0.5 rounded-full">
                                    <span className="material-symbols-outlined text-[16px]">trending_up</span>
                                    <span className="font-medium">--</span>
                                </div>
                            </div>
                        </div>
                        {/* Stripe Web (1002) */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-6xl text-slate-400">credit_card</span>
                            </div>
                            <div className="flex flex-col gap-1 relative z-10">
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Balance Stripe Web</span>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(getBalanceByCode('1002'))}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 mt-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 w-fit px-2 py-0.5 rounded-full">
                                    <span className="material-symbols-outlined text-[16px]">trending_up</span>
                                    <span className="font-medium">--</span>
                                </div>
                            </div>
                        </div>
                        {/* Central Bank (1003) */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <span className="material-symbols-outlined text-6xl text-slate-400">account_balance</span>
                            </div>
                            <div className="flex flex-col gap-1 relative z-10">
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Banco Central</span>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(getBalanceByCode('1003'))}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 mt-2 text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/20 w-fit px-2 py-0.5 rounded-full">
                                    <span className="material-symbols-outlined text-[16px]">trending_down</span>
                                    <span className="font-medium">--</span>
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
                            </div>
                            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                                <button onClick={fetchData} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                                    <span className="material-symbols-outlined text-slate-500">refresh</span>
                                </button>
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
                                        <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[140px]">Ref</th>
                                        <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right w-[160px]">Monto</th>
                                        <th className="py-3 px-6 w-[60px]"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-8 text-slate-500">Cargando transacciones...</td>
                                        </tr>
                                    ) : transactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-8 text-slate-500">No hay transacciones registradas</td>
                                        </tr>
                                    ) : (
                                        transactions.map((row, index) => {
                                            const isDebit = row.debit > 0;
                                            const amount = isDebit ? row.debit : row.credit;
                                            const typeLabel = isDebit ? 'Débito' : 'Crédito';
                                            const typeColor = isDebit
                                                ? 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
                                            const amountColor = isDebit ? 'text-rose-600' : 'text-emerald-600';
                                            const amountPrefix = isDebit ? '-' : '+';

                                            // Format date
                                            const date = new Date(row.transaction.created_at).toLocaleDateString();

                                            return (
                                                <tr key={index} className="group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                    <td className="py-4 px-6 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{date}</td>
                                                    <td className="py-4 px-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium text-slate-900 dark:text-white">{row.transaction.description}</span>
                                                            <span className="text-xs text-slate-500">{row.transaction.reference_type}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                            {row.account.name}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeColor}`}>
                                                            {typeLabel}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <span className="text-sm text-primary hover:text-primary/80 hover:underline font-medium">
                                                            {row.transaction.order_id ? `#ORD-${row.transaction.order_id}` : '--'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 text-right">
                                                        <span className={`text-sm font-bold ${amountColor}`}>
                                                            {amountPrefix}{formatCurrency(amount)}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 text-right">
                                                        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100">
                                                            <span className="material-symbols-outlined text-[20px]">more_vert</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Finance;