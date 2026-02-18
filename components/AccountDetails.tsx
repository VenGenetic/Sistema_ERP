import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Account, Transaction, TransactionLine } from '../types/finance';

interface TransactionDisplay extends TransactionLine {
    transaction: Transaction;
    account: Account;
}

const AccountDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [account, setAccount] = useState<Account | null>(null);
    const [transactions, setTransactions] = useState<TransactionDisplay[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            fetchAccountData(parseInt(id));
        }
    }, [id]);

    const fetchAccountData = async (accountId: number) => {
        setLoading(true);
        try {
            // Fetch Account Details
            const { data: accountData, error: accountError } = await supabase
                .from('accounts')
                .select('*')
                .eq('id', accountId)
                .single();

            if (accountError) throw accountError;
            setAccount(accountData);

            // Fetch Transactions for this account
            const { data: lines, error: transactionsError } = await supabase
                .from('transaction_lines')
                .select(`
                    *,
                    transaction:transactions(*),
                    account:accounts(*)
                `)
                .eq('account_id', accountId)
                .order('id', { ascending: false })
                .limit(50);

            if (transactionsError) throw transactionsError;
            setTransactions(lines as any);

        } catch (error) {
            console.error('Error fetching account details:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number, currency: string = 'USD') => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
    };

    if (loading && !account) {
        return <div className="p-8 text-center text-slate-500">Cargando detalles de la cuenta...</div>;
    }

    if (!account) {
        return <div className="p-8 text-center text-slate-500">Cuenta no encontrada.</div>;
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{account.name}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{account.code}</span>
                        <span className="text-slate-500 text-sm">{account.currency}</span>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-primary/30">
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Nueva Transacción
                    </button>
                </div>
            </div>

            {/* Transactions Table for this Account */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 rounded-t-xl">
                    <h3 className="font-semibold text-slate-800 dark:text-white">Transacciones Recientes</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                                <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[140px]">Fecha</th>
                                <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descripción</th>
                                <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[120px]">Tipo</th>
                                <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[140px]">Ref</th>
                                <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right w-[160px]">Debito</th>
                                <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right w-[160px]">Credito</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-slate-500">No hay transacciones registradas</td>
                                </tr>
                            ) : (
                                transactions.map((row, index) => {
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
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.debit > 0
                                                        ? 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                                                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                    }`}>
                                                    {row.debit > 0 ? 'Débito' : 'Crédito'}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="text-sm text-primary hover:text-primary/80 hover:underline font-medium">
                                                    {row.transaction.order_id ? `#ORD-${row.transaction.order_id}` : '--'}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-right text-sm text-slate-600 dark:text-slate-300">
                                                {row.debit > 0 ? formatCurrency(row.debit, account.currency) : '-'}
                                            </td>
                                            <td className="py-4 px-6 text-right text-sm text-slate-600 dark:text-slate-300">
                                                {row.credit > 0 ? formatCurrency(row.credit, account.currency) : '-'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AccountDetails;
