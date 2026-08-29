import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Account } from '../types/finance';
import { useNavigate } from 'react-router-dom';
import NewTransactionModal from './NewTransactionModal';
import TransactionHistory from './TransactionHistory';
import { getAccountNatureLabel, categoryDisplayName } from '../utils/accountNature';
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
import { formatearMoneda } from '../utils/moneda';
import {
  Banknote,
  CreditCard,
  GripVertical,
  Package,
  Plus,
  Settings,
  TrendingUp,
} from 'lucide-react';

// Sortable Item Component
const SortableAccountCard = ({ account, balance, onClick, formatCurrency }: any) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: String(account.id) });

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
            className="bg-surface rounded-xl p-5 border border-subtle shadow-sm relative overflow-hidden group cursor-pointer hover:border-primary/50 transition-all touch-none"
        >
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                {account.category === 'asset' ? 'account_balance_wallet' :
                        account.category === 'liability' ? <CreditCard size={18} className="text-6xl text-fg-subtle" aria-hidden="true" /> : <Banknote size={18} className="text-6xl text-fg-subtle" aria-hidden="true" />}
            </div>
            <div className="flex flex-col gap-1 relative z-10">
                <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-fg-muted tracking-wide truncate pr-2">{account.name}</span>
                    <GripVertical size={14} className="text-fg-subtle cursor-grab active:cursor-grabbing" aria-hidden="true" />
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-fg">
                        {formatCurrency(balance || 0, account.currency)}
                    </span>
                </div>
                <div className="flex items-center gap-1 mt-2 text-sm text-fg-subtle">
                    <span className="font-mono text-xs bg-surface-3 px-1.5 py-0.5 rounded">{account.code}</span>
                    {(() => {
                        const nature = getAccountNatureLabel(account.category);
                        return (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${ nature.nature === 'Deudora' ? 'bg-primary-soft text-primary dark:text-primary' : 'bg-primary-soft text-primary dark:text-primary' }`}>
                                {categoryDisplayName(account.category)} · Débito {nature.debitEffect}
                            </span>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};

const FinanceDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [balances, setBalances] = useState<Record<number, number>>({});
    const [cogs, setCogs] = useState(0);
    const [grossMargin, setGrossMargin] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

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
    }, [refreshKey]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch accounts ordered by position
            const { data: accountsData, error: accountsError } = await supabase
                .from('accounts')
                .select('*')
                .eq('is_nominal', false)
                .order('position', { ascending: true, nullsFirst: false })
                .order('id', { ascending: true }); // deterministic tiebreaker

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

            // Fetch COGS and Sales from order_items
            const { data: orderItemsData, error: orderItemsError } = await supabase
                .from('order_items')
                .select('quantity, unit_price, unit_cost, orders!inner(status)')
                .eq('orders.status', 'Entregado'); // Only calculate for completed POS sales

            if (!orderItemsError && orderItemsData) {
                let totalCogs = 0;
                let totalSales = 0;
                orderItemsData.forEach((item: any) => {
                    totalCogs += (Number(item.unit_cost) || 0) * Number(item.quantity);
                    totalSales += (Number(item.unit_price) || 0) * Number(item.quantity);
                });
                setCogs(totalCogs);
                setGrossMargin(totalSales > 0 ? ((totalSales - totalCogs) / totalSales) * 100 : 0);
            }

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

        if (over && active.id !== over.id) {
            setAccounts((items) => {
                const oldIndex = items.findIndex((item) => String(item.id) === String(active.id));
                const newIndex = items.findIndex((item) => String(item.id) === String(over.id));

                if (oldIndex === -1 || newIndex === -1) return items;

                const newItems = arrayMove(items, oldIndex, newIndex);

                const updates = newItems.map((item: Account, index: number) => ({
                    id: item.id,
                    position: index,
                }));

                updatePositions(updates);

                return newItems;
            });
        }
    };

    const updatePositions = async (updates: { id: number; position: number }[]) => {
        try {
            console.log('Sending updates to Supabase:', updates);
            const promises = updates.map(async (u) => {
                const { data, error } = await supabase
                    .from('accounts')
                    .update({ position: u.position })
                    .eq('id', u.id)
                    .select();
                
                if (error) throw error;
                if (!data || data.length === 0) {
                    throw new Error(`Update for account ${u.id} matched no rows. Posible problema de RLS.`);
                }
                return data;
            });
            await Promise.all(promises);
            console.log('Positions updated successfully in Supabase');
        } catch (error) {
            console.error('Error updating positions in Supabase:', error);
            alert('Hubo un error al guardar las posiciones en la base de datos: ' + (error instanceof Error ? error.message : JSON.stringify(error)));
        }
    };

    const formatCurrency = (amount: number, currency: string) => formatearMoneda(amount, currency);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-fg tracking-tight">Cuentas y Libro Financiero</h1>
                    <p className="text-fg-muted mt-1">Resumen en tiempo real de todas las cuentas financieras.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('config')}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-surface border border-subtle rounded-lg text-fg text-sm font-medium hover:bg-surface-hover transition-colors shadow-sm"
                    >
                        <Settings size={18} aria-hidden="true" />
                        Configurar
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-primary/30"
                    >
                        <Plus size={18} aria-hidden="true" />
                        Nueva Transacción
                    </button>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                {/* Metrics row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-surface rounded-xl p-5 border border-subtle shadow-sm flex flex-col justify-between h-32 hover:border-primary transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-semibold text-fg-muted">Costo de Ventas (COGS)</span>
                            <Package size={18} className="text-primary" aria-hidden="true" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-fg">
                                {loading ? '...' : formatCurrency(cogs, 'USD')}
                            </div>
                            <div className="text-xs text-fg-subtle mt-1">Acumulado ventas completadas</div>
                        </div>
                    </div>

                    <div className="bg-surface rounded-xl p-5 border border-subtle shadow-sm flex flex-col justify-between h-32 hover:border-success transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-semibold text-fg-muted">Margen Bruto</span>
                            <TrendingUp size={18} className="text-success" aria-hidden="true" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-fg">
                                {loading ? '...' : `${grossMargin.toFixed(1)}%`}
                            </div>
                            <div className="text-xs text-fg-subtle mt-1">Margen real sobre costo promedio</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {loading ? (
                        <div className="col-span-3 text-center py-8 text-fg-muted">Cargando cuentas...</div>
                    ) : accounts.length === 0 ? (
                        <div className="col-span-3 text-center py-8 text-fg-muted">No hay cuentas para mostrar.</div>
                    ) : (
                        <SortableContext
                            items={accounts.map(acc => String(acc.id))}
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

            {/* Global Transactions History */}
            <TransactionHistory key={`history-${refreshKey}`} />

            <NewTransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => setRefreshKey(prev => prev + 1)}
            />
        </div>
    );
};

export default FinanceDashboard;
