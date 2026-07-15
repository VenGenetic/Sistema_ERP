import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

interface Expense {
    id: string;
    description: string;
    amount: number;
    category: string;
    date: string;
    created_at: string;
    created_by: string;
}

const todayLocal = (): string => {
    const now = new Date();
    // Shift to Ecuador Time (UTC-5)
    const localMs = now.getTime() - 5 * 60 * 60 * 1000;
    return new Date(localMs).toISOString().split('T')[0];
};

const startOfWeekLocal = (): string => {
    const now = new Date();
    const localMs = now.getTime() - 5 * 60 * 60 * 1000;
    const d = new Date(localMs);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
};

const startOfMonthLocal = (): string => {
    const now = new Date();
    const localMs = now.getTime() - 5 * 60 * 60 * 1000;
    const d = new Date(localMs);
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};

const Expenses: React.FC = () => {
    const { userProfile } = useAuth();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('Envíos');
    const [customCategory, setCustomCategory] = useState('');
    const [date, setDate] = useState(todayLocal());
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filter State
    const [filterMonth, setFilterMonth] = useState(() => {
        const today = todayLocal();
        return today.substring(0, 7); // YYYY-MM
    });

    const fetchExpenses = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Load expenses for the selected month to keep it performant
            const startOfMonth = `${filterMonth}-01`;
            // Get end of month date
            const year = parseInt(filterMonth.split('-')[0]);
            const month = parseInt(filterMonth.split('-')[1]);
            const lastDay = new Date(year, month, 0).getDate();
            const endOfMonth = `${filterMonth}-${lastDay}`;

            const { data, error: fetchErr } = await supabase
                .from('daily_expenses')
                .select('*')
                .gte('date', startOfMonth)
                .lte('date', endOfMonth)
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });

            if (fetchErr) throw fetchErr;
            setExpenses(data || []);
        } catch (err: any) {
            console.error('Error fetching expenses:', err);
            setError(err.message || 'Error al cargar los gastos.');
        } finally {
            setLoading(false);
        }
    }, [filterMonth]);

    useEffect(() => {
        fetchExpenses();
    }, [fetchExpenses]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const parsedAmount = parseFloat(amount);
        if (!description.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
            alert('Por favor introduce una descripción válida y un monto mayor a cero.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        const finalCategory = category === 'Personalizada' ? customCategory.trim() : category;
        if (!finalCategory) {
            alert('Por favor selecciona o escribe una categoría.');
            setIsSubmitting(false);
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;

            const { error: insertErr } = await supabase
                .from('daily_expenses')
                .insert({
                    description: description.trim().toUpperCase(), // Uppercase like user's excel
                    amount: parsedAmount,
                    category: finalCategory.toUpperCase(), // Uppercase like user's excel
                    date: date,
                    created_by: userId
                });

            if (insertErr) throw insertErr;

            // Reset form
            setDescription('');
            setAmount('');
            setCustomCategory('');
            if (category === 'Personalizada') {
                setCategory('Envíos');
            }
            
            // Re-fetch list
            fetchExpenses();
        } catch (err: any) {
            console.error('Error adding expense:', err);
            setError(err.message || 'Error al registrar el gasto.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Estás seguro de que quieres eliminar este registro de gasto?')) {
            return;
        }

        try {
            const { error: deleteErr } = await supabase
                .from('daily_expenses')
                .delete()
                .eq('id', id);

            if (deleteErr) throw deleteErr;
            fetchExpenses();
        } catch (err: any) {
            console.error('Error deleting expense:', err);
            alert(err.message || 'Error al eliminar el gasto.');
        }
    };

    // --- Calculations ---
    const today = todayLocal();
    const startOfWeek = startOfWeekLocal();
    const startOfMonth = startOfMonthLocal();

    const stats = expenses.reduce(
        (acc, curr) => {
            const amt = curr.amount;
            if (curr.date === today) {
                acc.today += amt;
            }
            if (curr.date >= startOfWeek && curr.date <= today) {
                acc.week += amt;
            }
            if (curr.date >= startOfMonth && curr.date <= today) {
                acc.month += amt;
            }
            return acc;
        },
        { today: 0, week: 0, month: 0 }
    );

    // Group expenses by category for the category boxes
    const categoryGroups = expenses.reduce((groups: Record<string, { total: number; items: Expense[] }>, expense) => {
        const cat = expense.category || 'OTROS';
        if (!groups[cat]) {
            groups[cat] = { total: 0, items: [] };
        }
        groups[cat].total += expense.amount;
        groups[cat].items.push(expense);
        return groups;
    }, {});

    return (
        <div className="p-6 md:p-8 max-w-[1400px] mx-auto flex flex-col gap-6">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                <span className="hover:text-primary transition-colors cursor-pointer" onClick={() => window.location.hash = '/'}>Inicio</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                <span className="text-slate-900 dark:text-white font-medium">Registro de Gastos</span>
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-red-500 text-[28px]">payments</span>
                        Registro de Gastos Diarios
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Control rápido del dinero que sale diario, semanal y mensual.</p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="text-sm text-slate-500 font-medium">Mes:</label>
                    <input
                        type="month"
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="px-3 py-1.5 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-lg text-sm dark:text-white outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>

            {/* Stats Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-[#0c1117] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gastado Hoy</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                            ${stats.today.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h3>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-xl">
                        <span className="material-symbols-outlined text-[24px]">calendar_today</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#0c1117] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gasto esta Semana</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                            ${stats.week.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h3>
                    </div>
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-xl">
                        <span className="material-symbols-outlined text-[24px]">date_range</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#0c1117] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gasto este Mes</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                            ${stats.month.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h3>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-500 rounded-xl">
                        <span className="material-symbols-outlined text-[24px]">monitoring</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form Card */}
                <div className="lg:col-span-1 bg-white dark:bg-[#0c1117] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                        Nuevo Registro
                    </h2>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Descripción (DATO)
                            </label>
                            <input
                                required
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Ej: COMPRAS TUTI, ENVIO A GUAYAQUIL"
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-lg dark:text-white focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Monto (GASTO)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">$</span>
                                <input
                                    required
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full pl-7 pr-4 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-lg dark:text-white focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-mono"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Categoría
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-lg dark:text-white focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                            >
                                <option value="Envíos">ENVÍOS</option>
                                <option value="Gastos Casa">GASTOS CASA</option>
                                <option value="Alimentación">ALIMENTACIÓN</option>
                                <option value="Servicios">SERVICIOS</option>
                                <option value="Otros">OTROS</option>
                                <option value="Personalizada">OTRO (ESCRIBIR...)</option>
                            </select>
                        </div>

                        {category === 'Personalizada' && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                    Nombre de Categoría Personalizada
                                </label>
                                <input
                                    required
                                    type="text"
                                    value={customCategory}
                                    onChange={(e) => setCustomCategory(e.target.value)}
                                    placeholder="Ej: GASOLINA, TRANSPORTE"
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-lg dark:text-white focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Fecha
                            </label>
                            <input
                                required
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-lg dark:text-white focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs rounded-lg border border-red-200 dark:border-red-900/50 flex items-start gap-1">
                                <span className="material-symbols-outlined text-[16px]">error</span>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1 shadow-md shadow-primary/20 mt-2"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[18px]">add</span>
                                    Registrar Gasto
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Categorized Excel-like View */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    {/* Resumen por Categorías estilo Excel */}
                    <div className="bg-white dark:bg-[#0c1117] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">
                            Resumen de Categorías (Estilo Excel)
                        </h2>
                        {Object.keys(categoryGroups).length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-6">No hay gastos registrados para este mes.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {Object.entries(categoryGroups).map(([catName, data]) => (
                                    <div key={catName} className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-[#161b22]/30 flex flex-col">
                                        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                                            <span className="text-sm font-bold text-slate-850 dark:text-slate-200 tracking-wider">
                                                {catName}
                                            </span>
                                            <span className="text-sm font-extrabold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded font-mono">
                                                ${data.total.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                                            {data.items.map((item) => (
                                                <div key={item.id} className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
                                                    <span className="truncate pr-4 flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600"></span>
                                                        {item.description}
                                                    </span>
                                                    <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold shrink-0">
                                                        ${item.amount.toFixed(2)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Historical Log */}
                    <div className="bg-white dark:bg-[#0c1117] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">
                            Historial de Gastos
                        </h2>
                        {loading ? (
                            <div className="flex justify-center py-8">
                                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : expenses.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-6">No hay historial para este período.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead>
                                        <tr className="text-slate-400 font-medium border-b border-slate-200 dark:border-slate-800 pb-2">
                                            <th className="py-2">Fecha</th>
                                            <th className="py-2">Descripción (DATO)</th>
                                            <th className="py-2">Categoría</th>
                                            <th className="py-2 text-right">Gasto ($)</th>
                                            <th className="py-2 w-12 text-center"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {expenses.map((exp) => (
                                            <tr key={exp.id} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/50 dark:hover:bg-[#161b22]/30 transition-colors">
                                                <td className="py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{exp.date}</td>
                                                <td className="py-3 font-semibold text-slate-800 dark:text-slate-200">{exp.description}</td>
                                                <td className="py-3">
                                                    <span className="inline-block text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">
                                                        {exp.category}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-right font-bold text-slate-800 dark:text-slate-200 font-mono">${exp.amount.toFixed(2)}</td>
                                                <td className="py-3 text-center">
                                                    <button
                                                        onClick={() => handleDelete(exp.id)}
                                                        className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                                                        title="Eliminar gasto"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Expenses;
