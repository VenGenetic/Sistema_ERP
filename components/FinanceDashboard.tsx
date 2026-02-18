import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Account } from '../types/finance';
import { useNavigate } from 'react-router-dom';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Item Component
const SortableAccountCard = ({ account, balance, onClick, formatCurrency }: any) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: account.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={() => onClick(account.id)}
            className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group cursor-pointer hover:border-primary/50 transition-all touch-none"
        >
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-6xl text-slate-400">
                    {account.category === 'asset' ? 'account_balance_wallet' :
                        account.category === 'liability' ? 'credit_card' : 'payments'}
                </span>
            </div>
            <div className="flex flex-col gap-1 relative z-10">
                <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate pr-2">{account.name}</span>
                    <span className="material-symbols-outlined text-slate-300 text-sm cursor-grab active:cursor-grabbing">drag_indicator</span>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatCurrency(balance || 0, account.currency)}
                    </span>
                </div>
                <div className="flex items-center gap-1 mt-2 text-sm text-slate-400">
                    <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{account.code}</span>
                </div>
            </div>
        </div>
    );
};

const FinanceDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [balances, setBalances] = useState<Record<number, number>>({});
    const [loading, setLoading] = useState(true);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch accounts ordered by position
            const { data: accountsData, error: accountsError } = await supabase
                .from('accounts')
                .select('*')
                .eq('is_nominal', false)
                .order('position', { ascending: true }); // Order by position

            if (accountsError) throw accountsError;

            // Fetch balances
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

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setAccounts((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over?.id);

                const newItems = arrayMove(items, oldIndex, newIndex);

                // Update positions in DB
                // We update all items with their new index as position
                const updates = newItems.map((item, index) => ({
                    id: item.id,
                    position: index,
                }));

                // Fire and forget update (or handle error if needed)
                updatePositions(updates);

                return newItems;
            });
        }
    };

    const updatePositions = async (updates: { id: number; position: number }[]) => {
        try {
            // Upsert allows updating multiple rows if we format it right, but Supabase simple client might need loop or custom RPC.
            // For small number of accounts, loop is fine or Promise.all.
            // Better: use upsert with the full object if we had it, but we only have ID and position.
            // Let's use a loop for now as it's simple and robust for < 50 items.

            // Actually, best way with Supabase/PostgREST for bulk update is usually upsert()
            const { error } = await supabase
                .from('accounts')
                .upsert(updates.map(u => ({ id: u.id, position: u.position, updated_at: new Date().toISOString() })) as any, { onConflict: 'id', ignoreDuplicates: false }); // We need to include other required fields if not nullable? No, upsert updates existing.

            // However, types might complain if we miss required fields. 
            // Ideally we should just update 'position'. 
            // RPC is cleaner but requires migration. 
            // Loop is safest for quick implementation without new RPC.

            // Let's try Promise.all for parallel updates
            await Promise.all(updates.map(u =>
                supabase.from('accounts').update({ position: u.position }).eq('id', u.id)
            ));

        } catch (error) {
            console.error('Error updating positions:', error);
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

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {loading ? (
                        <div className="col-span-3 text-center py-8 text-slate-500">Cargando cuentas...</div>
                    ) : accounts.length === 0 ? (
                        <div className="col-span-3 text-center py-8 text-slate-500">No hay cuentas para mostrar.</div>
                    ) : (
                        <SortableContext
                            items={accounts.map(acc => acc.id)}
                            strategy={rectSortingStrategy}
                        >
                            {accounts.map(account => (
                                <SortableAccountCard
                                    key={account.id}
                                    account={account}
                                    balance={balances[account.id]}
                                    onClick={(id: number) => navigate(`account/${id}`)}
                                    formatCurrency={formatCurrency}
                                />
                            ))}
                        </SortableContext>
                    )}
                </div>
            </DndContext>
        </div>
    );
};

export default FinanceDashboard;
