import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface StatRow {
    group_name: string;
    capital_cost: number;
    capital_pvp: number;
    total_items: number;
}

const CapitalStats: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'category' | 'model'>('category');
    const [dataCategory, setDataCategory] = useState<StatRow[]>([]);
    const [dataModel, setDataModel] = useState<StatRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch both RPCs in parallel
            const [catRes, modRes] = await Promise.all([
                supabase.rpc('get_capital_by_category'),
                supabase.rpc('get_capital_by_model')
            ]);

            if (catRes.error) throw catRes.error;
            if (modRes.error) throw modRes.error;

            setDataCategory(catRes.data as StatRow[]);
            setDataModel(modRes.data as StatRow[]);
        } catch (err: any) {
            console.error('Error fetching capital stats:', err);
            setError(err.message || 'Error al cargar estadísticas.');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    const formatNumber = (val: number) =>
        new Intl.NumberFormat('en-US').format(val);

    const activeData = activeTab === 'category' ? dataCategory : dataModel;
    const totalCapitalCost = activeData.reduce((acc, row) => acc + Number(row.capital_cost), 0);
    const totalCapitalPvp = activeData.reduce((acc, row) => acc + Number(row.capital_pvp), 0);
    const totalItems = activeData.reduce((acc, row) => acc + Number(row.total_items), 0);
    
    // Sort logic (can be expanded later if we want table column sorting)
    const sortedData = [...activeData].sort((a, b) => Number(b.capital_cost) - Number(a.capital_cost));

    return (
        <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Inteligencia de Inversión
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Analiza cuánto capital tienes invertido en tu bodega según categorías o compatibilidades exactas.
                    </p>
                </div>
                
                <button
                    onClick={fetchStats}
                    disabled={loading}
                    title="Actualizar Datos"
                    className="p-2 h-10 rounded-lg bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-[#1c2128] transition-colors disabled:opacity-50"
                >
                    <span className={`material-symbols-outlined text-slate-500 text-[20px] ${loading ? 'animate-spin' : ''}`}>
                        refresh
                    </span>
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-3">
                    <span className="material-symbols-outlined text-rose-500 text-[20px]">error</span>
                    <p className="text-sm text-rose-700 dark:text-rose-400 font-medium">{error}</p>
                </div>
            )}

            {/* General KPI Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Costo Inventario (Aprox)</span>
                        <span className="material-symbols-outlined text-blue-500">account_balance</span>
                    </div>
                    <div className="mt-4 text-3xl font-bold text-slate-900 dark:text-white font-mono">
                        {loading ? '...' : formatCurrency(totalCapitalCost)}
                    </div>
                </div>
                <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Capital de Venta (PVP)</span>
                        <span className="material-symbols-outlined text-emerald-500">attach_money</span>
                    </div>
                    <div className="mt-4 text-3xl font-bold text-emerald-600 font-mono">
                        {loading ? '...' : formatCurrency(totalCapitalPvp)}
                    </div>
                </div>
                <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Repuestos Asignados</span>
                        <span className="material-symbols-outlined text-amber-500">inventory_2</span>
                    </div>
                    <div className="mt-4 text-3xl font-bold text-slate-900 dark:text-white font-mono">
                        {loading ? '...' : formatNumber(totalItems)}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 mt-2">
                <button
                    onClick={() => setActiveTab('category')}
                    className={`px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
                        activeTab === 'category'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                >
                    <span className="material-symbols-outlined text-[18px]">category</span>
                    1. Por Categoría / Tipo
                </button>
                <button
                    onClick={() => setActiveTab('model')}
                    className={`px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
                        activeTab === 'model'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                >
                    <span className="material-symbols-outlined text-[18px]">two_wheeler</span>
                    2. Por Modelo de Moto
                </button>
            </div>

            {/* Data Table */}
            <div className="bg-white dark:bg-[#161b22] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex-1">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-[#0d1117] border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-16 text-center">Rank</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    {activeTab === 'category' ? 'Categoría' : 'Modelo Compatible'}
                                </th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Repuestos Activos</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Capital Costo</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Proyección PVP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <span className="material-symbols-outlined text-4xl animate-spin text-blue-500">progress_activity</span>
                                            <p className="font-medium animate-pulse">Calculando millones de combinaciones...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : sortedData.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <span className="material-symbols-outlined text-4xl text-slate-300">search_off</span>
                                            <p className="font-medium">No hay datos suficientes de inventario.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                sortedData.map((row, idx) => {
                                    const percentOfTotal = totalCapitalCost > 0 
                                        ? (Number(row.capital_cost) / totalCapitalCost) * 100 
                                        : 0;

                                    return (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-[#1c2128]/50 transition-colors group">
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                                                    ${idx === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 
                                                      idx === 1 ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' : 
                                                      idx === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 
                                                      'text-slate-400'}`}>
                                                    {idx + 1}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white uppercase">
                                                        {row.group_name}
                                                    </span>
                                                    {/* Heatbar */}
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-48 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full ${idx === 0 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                                                style={{ width: `${Math.min(percentOfTotal, 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 font-bold font-mono">
                                                            {percentOfTotal.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 text-right font-mono font-medium">
                                                {formatNumber(row.total_items)} und
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white text-right font-mono">
                                                {formatCurrency(Number(row.capital_cost))}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-emerald-600 dark:text-emerald-400 text-right font-mono">
                                                {formatCurrency(Number(row.capital_pvp))}
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

export default CapitalStats;
