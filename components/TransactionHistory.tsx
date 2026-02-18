import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Transaction, TransactionLine, Account } from '../types/finance';
import { useNavigate } from 'react-router-dom';

interface ExpandedTransaction extends Transaction {
    transaction_lines: (TransactionLine & { account: Account })[];
}

const TransactionHistory: React.FC = () => {
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState<ExpandedTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchTransactions();
    }, [dateRange]);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select(`
                    *,
                    transaction_lines (
                        *,
                        account:accounts(*)
                    )
                `)
                .gte('created_at', `${dateRange.start}T00:00:00`)
                .lte('created_at', `${dateRange.end}T23:59:59`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTransactions(data as any || []);
        } catch (err) {
            console.error('Error fetching transactions:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleRow = (id: number) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedRows(newExpanded);
    };

    const filteredTransactions = transactions.filter(t =>
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.reference_type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatCurrency = (amount: number, currency: string = 'USD') => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
    };

    const getTransactionTotal = (t: ExpandedTransaction) => {
        // Total is sum of debits (should equal sum of credits)
        return t.transaction_lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    };

    return (
        <div className="flex flex-col gap-4 mt-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Historial de Transacciones</h2>
                    <p className="text-sm text-slate-500">Libro diario global de todos los movimientos.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                        <input
                            type="text"
                            placeholder="Buscar descripción..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 w-full md:w-64"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <span className="text-slate-400">→</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                <th className="p-4 w-10"></th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Referencia</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descripción</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cuentas</th>
                                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Monto Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-500">Cargando transacciones...</td></tr>
                            ) : filteredTransactions.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-500">No se encontraron transacciones.</td></tr>
                            ) : (
                                filteredTransactions.map((t) => (
                                    <React.Fragment key={t.id}>
                                        <tr className="group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => toggleRow(t.id)}>
                                            <td className="p-4 text-center">
                                                <span className={`material-symbols-outlined text-slate-400 transition-transform ${expandedRows.has(t.id) ? 'rotate-90' : ''}`}>
                                                    chevron_right
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                {new Date(t.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                                                    {t.reference_type}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-sm font-medium text-slate-900 dark:text-white">
                                                {t.description}
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {Array.from(new Set(t.transaction_lines.map(l => l.account?.name))).map((name, i) => (
                                                        <span
                                                            key={i}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const acc = t.transaction_lines.find(l => l.account?.name === name)?.account;
                                                                if (acc) navigate(`account/${acc.id}`);
                                                            }}
                                                            className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 transition-colors"
                                                        >
                                                            {name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-right text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                                {formatCurrency(getTransactionTotal(t))}
                                            </td>
                                        </tr>
                                        {expandedRows.has(t.id) && (
                                            <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                                                <td colSpan={6} className="p-0">
                                                    <div className="px-14 py-4 border-l-4 border-primary">
                                                        <table className="w-full text-xs">
                                                            <thead>
                                                                <tr className="text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                                                                    <th className="pb-2 text-left">Cuenta</th>
                                                                    <th className="pb-2 text-right">Débito</th>
                                                                    <th className="pb-2 text-right">Crédito</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                                {t.transaction_lines.map((line, i) => (
                                                                    <tr key={i} className="hover:bg-primary/5">
                                                                        <td className="py-2 text-slate-700 dark:text-slate-300 font-medium">
                                                                            <span
                                                                                className="cursor-pointer hover:text-primary hover:underline"
                                                                                onClick={() => navigate(`account/${line.account_id}`)}
                                                                            >
                                                                                {line.account?.code} - {line.account?.name}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-2 text-right text-slate-600 dark:text-slate-400">
                                                                            {line.debit > 0 ? formatCurrency(line.debit, line.account?.currency) : '-'}
                                                                        </td>
                                                                        <td className="py-2 text-right text-slate-600 dark:text-slate-400">
                                                                            {line.credit > 0 ? formatCurrency(line.credit, line.account?.currency) : '-'}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TransactionHistory;
