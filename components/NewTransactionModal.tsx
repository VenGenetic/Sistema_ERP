import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Account } from '../types/finance';

interface NewTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialAccountId?: number;
}

interface TempLine {
    account_id: string;
    debit: string;
    credit: string;
}

const NewTransactionModal: React.FC<NewTransactionModalProps> = ({ isOpen, onClose, onSuccess, initialAccountId }) => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [description, setDescription] = useState('');
    const [referenceType, setReferenceType] = useState('Manual');
    const [orderId, setOrderId] = useState<string>('');
    const [lines, setLines] = useState<TempLine[]>([
        { account_id: initialAccountId?.toString() || '', debit: '', credit: '' },
        { account_id: '', debit: '', credit: '' }
    ]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchAccounts();
            // Reset form
            setDescription('');
            setReferenceType('Manual');
            setOrderId('');
            setLines([
                { account_id: initialAccountId?.toString() || '', debit: '', credit: '' },
                { account_id: '', debit: '', credit: '' }
            ]);
            setError(null);
        }
    }, [isOpen, initialAccountId]);

    const fetchAccounts = async () => {
        const { data, error } = await supabase
            .from('accounts')
            .select('*')
            .order('name');
        if (data) setAccounts(data);
    };

    const addLine = () => {
        setLines([...lines, { account_id: '', debit: '', credit: '' }]);
    };

    const removeLine = (index: number) => {
        if (lines.length <= 2) return;
        setLines(lines.filter((_, i) => i !== index));
    };

    const handleLineChange = (index: number, field: keyof TempLine, value: string) => {
        const newLines = [...lines];
        newLines[index] = { ...newLines[index], [field]: value };

        // Auto-clear other field if one is filled (debit vs credit)
        if (field === 'debit' && value !== '') {
            newLines[index].credit = '';
        } else if (field === 'credit' && value !== '') {
            newLines[index].debit = '';
        }

        setLines(newLines);
    };

    const totalDebit = lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isBalanced) {
            setError('La transacción no está balanceada (Débitos != Créditos) o el total es cero.');
            return;
        }

        const validLines = lines.filter(l => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
        if (validLines.length < 2) {
            setError('Se requieren al menos dos líneas con cuenta y monto.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data, error: rpcError } = await supabase.rpc('create_transaction_v1', {
                p_description: description,
                p_reference_type: referenceType,
                p_order_id: orderId ? parseInt(orderId) : null,
                p_lines: validLines.map(l => ({
                    account_id: parseInt(l.account_id),
                    debit: parseFloat(l.debit) || 0,
                    credit: parseFloat(l.credit) || 0
                }))
            });

            if (rpcError) throw rpcError;

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error creating transaction:', err);
            setError(err.message || 'Error al crear la transacción');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Nueva Transacción</h2>
                        <p className="text-sm text-slate-500">Registra un movimiento contable manual o referencia.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descripción</label>
                            <input
                                required
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
                                placeholder="Ej: Pago de servicios, Transferencia entre cuentas..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Ref.</label>
                            <select
                                value={referenceType}
                                onChange={(e) => setReferenceType(e.target.value)}
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
                            >
                                <option value="Manual">Manual</option>
                                <option value="Order">Orden</option>
                                <option value="Adjustment">Ajuste</option>
                                <option value="Transfer">Transferencia</option>
                            </select>
                        </div>
                        {referenceType === 'Order' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ID Orden/Pedido</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">#</span>
                                    <input
                                        type="number"
                                        value={orderId}
                                        onChange={(e) => setOrderId(e.target.value)}
                                        className="w-full pl-6 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white font-mono"
                                        placeholder="12345"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mb-6 overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                    <th className="pb-2 pr-4">Cuenta</th>
                                    <th className="pb-2 px-2 w-32 text-right">Débito</th>
                                    <th className="pb-2 px-2 w-32 text-right">Crédito</th>
                                    <th className="pb-2 pl-4 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {lines.map((line, index) => (
                                    <tr key={index} className="group border-t border-slate-100 dark:border-slate-700/50">
                                        <td className="py-3 pr-4">
                                            <select
                                                required
                                                value={line.account_id}
                                                onChange={(e) => handleLineChange(index, 'account_id', e.target.value)}
                                                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:border-primary transition-all dark:text-white text-sm"
                                            >
                                                <option value="">Seleccionar cuenta...</option>
                                                {accounts.map(acc => (
                                                    <option key={acc.id} value={acc.id}>
                                                        {acc.code} - {acc.name} ({acc.currency})
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="py-3 px-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={line.debit}
                                                onChange={(e) => handleLineChange(index, 'debit', e.target.value)}
                                                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:border-primary text-right text-sm dark:text-white"
                                                placeholder="0.00"
                                            />
                                        </td>
                                        <td className="py-3 px-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={line.credit}
                                                onChange={(e) => handleLineChange(index, 'credit', e.target.value)}
                                                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:border-primary text-right text-sm dark:text-white"
                                                placeholder="0.00"
                                            />
                                        </td>
                                        <td className="py-3 pl-4 text-center">
                                            {lines.length > 2 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeLine(index)}
                                                    className="text-slate-400 hover:text-red-500 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-slate-100 dark:border-slate-700 font-bold">
                                    <td className="py-4 text-right pr-4 text-sm text-slate-500">Totales:</td>
                                    <td className={`py-4 px-2 text-right ${isBalanced ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}>
                                        ${totalDebit.toFixed(2)}
                                    </td>
                                    <td className={`py-4 px-2 text-right ${isBalanced ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}>
                                        ${totalCredit.toFixed(2)}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <button
                        type="button"
                        onClick={addLine}
                        className="flex items-center gap-1 text-primary hover:text-primary-hover font-medium text-sm transition-colors mb-6"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Agregar línea
                    </button>

                    {error && (
                        <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg text-red-600 dark:text-red-400 text-sm flex items-start gap-2">
                            <span className="material-symbols-outlined text-[18px]">error</span>
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !isBalanced}
                            className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                        >
                            {loading ? 'Procesando...' : 'Crear Transacción'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewTransactionModal;
