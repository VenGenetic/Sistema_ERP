import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Account, Transaction, TransactionLine } from '../types/finance';
import NewTransactionModal from './NewTransactionModal';

interface TransactionDisplay extends TransactionLine {
    transaction: Transaction;
    account: Account;
    runningBalance?: number;
}

const AccountDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [account, setAccount] = useState<Account | null>(null);
    const [transactions, setTransactions] = useState<TransactionDisplay[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        if (id) {
            fetchAccountData(parseInt(id));
        }
    }, [id, refreshKey]);

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

            // Fetch ALL transactions for this account to calculate running balance accurately
            // Note: In a massive database, we would need a more sophisticated approach (initial balance + window)
            const { data: lines, error: transactionsError } = await supabase
                .from('transaction_lines')
                .select(`
                    *,
                    transaction:transactions(*),
                    account:accounts(*)
                `)
                .eq('account_id', accountId)
                .order('id', { ascending: true });

            if (transactionsError) throw transactionsError;

            // Calculate running balances
            let currentBalance = 0;
            const linesWithBalance = (lines || []).map(line => {
                const debit = Number(line.debit || 0);
                const credit = Number(line.credit || 0);

                // Balance logic depends on account category
                // Asset/Expense: +Debit, -Credit
                // Liability/Income/Equity: +Credit, -Debit
                if (['asset', 'expense'].includes(accountData.category)) {
                    currentBalance += (debit - credit);
                } else {
                    currentBalance += (credit - debit);
                }

                return { ...line, runningBalance: currentBalance };
            });

            // Set transactions in reverse order (newest first)
            setTransactions(linesWithBalance.reverse() as any);

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

    // Get current balance (from the latest transaction or 0)
    const currentBalance = transactions.length > 0 ? transactions[0].runningBalance : 0;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{account.name}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{account.code}</span>
                        <span className="text-slate-500 text-sm uppercase font-medium">{account.currency}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${account.category === 'asset' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                account.category === 'liability' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                    'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                            }`}>
                            {account.category}
                        </span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Saldo Actual</span>
                    <span className={`text-3xl font-black ${Number(currentBalance) < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {formatCurrency(Number(currentBalance) || 0, account.currency)}
                    </span>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-primary/30"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Nueva Transacción
                    </button>
                </div>
            </div>

            {/* Transactions Table for this Account */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 rounded-t-xl">
                    <h3 className="font-semibold text-slate-800 dark:text-white">Auxiliar de Cuenta / Estado de Cuenta</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                                <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[120px]">Fecha</th>
                                <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descripción / Referencia</th>
                                <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right w-[140px]">Débito (Entrada)</th>
                                <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right w-[140px]">Crédito (Salida)</th>
                                <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right w-[160px]">Saldo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="material-symbols-outlined text-4xl opacity-20">history</span>
                                            <p>No hay transacciones registradas para esta cuenta</p>
                                        </div>
                                    </td>
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
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase">{row.transaction.reference_type}</span>
                                                        {row.transaction.order_id && (
                                                            <span className="text-[10px] text-primary font-medium hover:underline cursor-pointer">#ORD-{row.transaction.order_id}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-right text-sm font-medium text-slate-900 dark:text-white">
                                                {row.debit > 0 ? formatCurrency(row.debit, account.currency) : '-'}
                                            </td>
                                            <td className="py-4 px-6 text-right text-sm font-medium text-slate-900 dark:text-white">
                                                {row.credit > 0 ? formatCurrency(row.credit, account.currency) : '-'}
                                            </td>
                                            <td className={`py-4 px-6 text-right text-sm font-bold ${Number(row.runningBalance) < 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                                                {formatCurrency(Number(row.runningBalance) || 0, account.currency)}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <NewTransactionModal
                isOpen={isModalOpen}
                initialAccountId={account.id}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => setRefreshKey(prev => prev + 1)}
            />
        </div>
    );
};

export default AccountDetails;
