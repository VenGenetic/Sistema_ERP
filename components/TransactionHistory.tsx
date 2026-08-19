import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Transaction, TransactionLine, Account } from '../types/finance';
import { useNavigate } from 'react-router-dom';
import { getAccountEffect, categoryDisplayName } from '../utils/accountNature';
import {
  ChevronRight,
  Search,
} from 'lucide-react';

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
                    <h2 className="text-xl font-bold text-fg">Historial de Transacciones</h2>
                    <p className="text-sm text-fg-muted">Libro diario global de todos los movimientos.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
                        <input
                            type="text"
                            placeholder="Buscar descripción..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-surface border border-subtle rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 w-full md:w-64"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            className="px-3 py-2 bg-surface border border-subtle rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <span className="text-fg-subtle">→</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            className="px-3 py-2 bg-surface border border-subtle rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-surface rounded-xl border border-subtle shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-subtle">
                                <th className="p-4 w-10"></th>
                                <th className="py-3 px-4 text-xs font-semibold text-fg-muted uppercase tracking-wider">Fecha</th>
                                <th className="py-3 px-4 text-xs font-semibold text-fg-muted uppercase tracking-wider">Referencia</th>
                                <th className="py-3 px-4 text-xs font-semibold text-fg-muted uppercase tracking-wider">Descripción</th>
                                <th className="py-3 px-4 text-xs font-semibold text-fg-muted uppercase tracking-wider">Cuentas</th>
                                <th className="py-3 px-4 text-xs font-semibold text-fg-muted uppercase tracking-wider text-right">Monto Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center text-fg-muted">Cargando transacciones...</td></tr>
                            ) : filteredTransactions.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-fg-muted">No se encontraron transacciones.</td></tr>
                            ) : (
                                filteredTransactions.map((t) => (
                                    <React.Fragment key={t.id}>
                                        <tr className="group hover:bg-surface-hover transition-colors cursor-pointer" onClick={() => toggleRow(t.id)}>
                                            <td className="p-4 text-center">
                                                <ChevronRight size={18} className={`text-fg-subtle transition-transform ${expandedRows.has(t.id) ? 'rotate-90' : ''}`} aria-hidden="true" />
                                            </td>
                                            <td className="py-4 px-4 text-sm text-fg-muted whitespace-nowrap">
                                                {new Date(t.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="px-2 py-0.5 rounded bg-surface-3 text-[11px] font-bold text-fg-muted uppercase">
                                                    {t.reference_type}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-sm font-medium text-fg">
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
                                            <td className="py-4 px-4 text-right text-sm font-bold text-fg whitespace-nowrap">
                                                {formatCurrency(getTransactionTotal(t))}
                                            </td>
                                        </tr>
                                        {expandedRows.has(t.id) && (
                                            <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                                                <td colSpan={6} className="p-0">
                                                    <div className="px-14 py-4 border-l-4 border-primary">
                                                        <table className="w-full text-xs">
                                                            <thead>
                                                                <tr className="text-fg-subtle font-semibold border-b border-subtle">
                                                                    <th className="pb-2 text-left">Cuenta</th>
                                                                    <th className="pb-2 text-right">Débito</th>
                                                                    <th className="pb-2 text-right">Crédito</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                                {t.transaction_lines.map((line, i) => {
                                                                    const effect = getAccountEffect(line.account?.category, line.debit || 0, line.credit || 0);
                                                                    return (
                                                                    <tr key={i} className="hover:bg-primary/5">
                                                                        <td className="py-2 text-fg font-medium">
                                                                            <span
                                                                                className="cursor-pointer hover:text-primary hover:underline"
                                                                                onClick={() => navigate(`account/${line.account_id}`)}
                                                                            >
                                                                                {line.account?.code} - {line.account?.name}
                                                                            </span>
                                                                            {line.account?.category && (
                                                                                <span className="ml-1.5 text-[12px] px-1.5 py-0.5 rounded bg-surface-3 text-fg-muted font-bold uppercase">
                                                                                    {categoryDisplayName(line.account.category)}
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td className="py-2 text-right text-fg-muted">
                                                                            {line.debit > 0 ? (
                                                                                <span className="inline-flex items-center gap-1">
                                                                                    {formatCurrency(line.debit, line.account?.currency)}
                                                                                    {effect && (
                                                                                        <span className={`text-2xs font-bold ${effect.direction === 'increase' ? 'text-success' : 'text-warning'}`}>
                                                                                            {effect.icon}
                                                                                        </span>
                                                                                    )}
                                                                                </span>
                                                                            ) : '-'}
                                                                        </td>
                                                                        <td className="py-2 text-right text-fg-muted">
                                                                            {line.credit > 0 ? (
                                                                                <span className="inline-flex items-center gap-1">
                                                                                    {formatCurrency(line.credit, line.account?.currency)}
                                                                                    {effect && (
                                                                                        <span className={`text-2xs font-bold ${effect.direction === 'increase' ? 'text-success' : 'text-warning'}`}>
                                                                                            {effect.icon}
                                                                                        </span>
                                                                                    )}
                                                                                </span>
                                                                            ) : '-'}
                                                                        </td>
                                                                    </tr>
                                                                    );
                                                                })}
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
