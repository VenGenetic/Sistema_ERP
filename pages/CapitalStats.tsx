import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

interface ProductCapital {
    product_id: number;
    product_sku: string;
    product_name: string;
    category: string;
    current_stock: number;
    capital_cost: number;
    capital_pvp: number;
}

const CapitalStats: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [allData, setAllData] = useState<ProductCapital[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initial Fetch (Pull EVERYTHING once for extremely fast filtering)
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Calling the RPC with empty string brings all inventory with stock > 0
            const { data, error } = await supabase.rpc('get_capital_by_search', { p_keyword: '' });

            if (error) throw error;
            setAllData(data as ProductCapital[]);
        } catch (err: any) {
            console.error('Error fetching capital stats:', err);
            setError(err.message || 'Error al cargar inventario total.');
        } finally {
            setLoading(false);
        }
    };

    // Client-side filtering ensures instant UI response without DB latency
    const filteredData = useMemo(() => {
        if (!searchTerm.trim()) return allData;
        
        const lowerSearch = searchTerm.toLowerCase();
        return allData.filter(item => 
            item.product_name.toLowerCase().includes(lowerSearch) ||
            item.product_sku.toLowerCase().includes(lowerSearch)
        );
    }, [allData, searchTerm]);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    const formatNumber = (val: number) =>
        new Intl.NumberFormat('en-US').format(val);

    // KPI Counters for filtered list
    const totalCapitalCost = filteredData.reduce((acc, row) => acc + Number(row.capital_cost), 0);
    const totalCapitalPvp = filteredData.reduce((acc, row) => acc + Number(row.capital_pvp), 0);
    const totalItems = filteredData.reduce((acc, row) => acc + Number(row.current_stock), 0);

    return (
        <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Inteligencia de Inversión Dinámica
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Escribe "Monoshock", "Tekken" o un SKU para aislar su capital en tiempo real.
                    </p>
                </div>
                
                <button
                    onClick={fetchData}
                    disabled={loading}
                    title="Actualizar Datos Base"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-[#1c2128] transition-colors disabled:opacity-50 text-sm font-semibold text-slate-700 dark:text-slate-300"
                >
                    <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin text-blue-500' : 'text-slate-400'}`}>
                        sync
                    </span>
                    Sincronizar Bodega
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-3">
                    <span className="material-symbols-outlined text-rose-500 text-[20px]">error</span>
                    <p className="text-sm text-rose-700 dark:text-rose-400 font-medium">{error}</p>
                </div>
            )}

            {/* Smart Search Bar */}
            <div className="relative w-full max-w-2xl group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-slate-400 group-focus-within:text-blue-500 transition-colors">
                        search
                    </span>
                </div>
                <input
                    type="text"
                    className="block w-full pl-11 pr-4 py-4 bg-white dark:bg-[#161b22] border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm transition-all font-medium text-lg"
                    placeholder="Filtrar repuestos (Ej: Llantas, Daytona, 250CC)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                    <button 
                        onClick={() => setSearchTerm('')}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                )}
            </div>

            {/* General KPI Summary (Reacts to Search) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-[100px] -z-0"></div>
                    <div className="flex justify-between items-start z-10">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Costo Inmovilizado</span>
                        <span className="material-symbols-outlined text-blue-500">account_balance</span>
                    </div>
                    <div className="mt-4 text-3xl font-bold text-slate-900 dark:text-white font-mono z-10">
                        {loading ? '...' : formatCurrency(totalCapitalCost)}
                    </div>
                </div>
                <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-[100px] -z-0"></div>
                    <div className="flex justify-between items-start z-10">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Proyección de PVP</span>
                        <span className="material-symbols-outlined text-emerald-500">trending_up</span>
                    </div>
                    <div className="mt-4 text-3xl font-bold text-emerald-600 font-mono z-10">
                        {loading ? '...' : formatCurrency(totalCapitalPvp)}
                    </div>
                </div>
                <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-[100px] -z-0"></div>
                    <div className="flex justify-between items-start z-10">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unidades Aisladas</span>
                        <span className="material-symbols-outlined text-amber-500">inventory_2</span>
                    </div>
                    <div className="mt-4 text-3xl font-bold text-slate-900 dark:text-white font-mono z-10">
                        {loading ? '...' : formatNumber(totalItems)} <span className="text-sm text-slate-400 font-sans font-medium">unds</span>
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white dark:bg-[#161b22] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex-1">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d1117] flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        Desglose de Repuestos Encontrados <span className="text-blue-500">({filteredData.length})</span>
                    </h3>
                </div>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse relative">
                        <thead className="bg-slate-50/90 dark:bg-[#0d1117]/90 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-16 text-center">Rank</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">SKU & Repuesto</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Stock</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Costo Acumulado</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">PVP Acumulado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {loading && allData.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <span className="material-symbols-outlined text-4xl animate-spin text-blue-500">progress_activity</span>
                                            <p className="font-medium animate-pulse">Sincronizando inventarios...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                                                <span className="material-symbols-outlined text-3xl text-slate-400">search_off</span>
                                            </div>
                                            <p className="font-medium text-lg mt-2">No se encontraron piezas</p>
                                            <p className="text-sm text-slate-400">Prueba usando otras palabras o referencias como "GN125".</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((row, idx) => {
                                    return (
                                        <tr key={row.product_id} className="hover:bg-slate-50 dark:hover:bg-[#1c2128]/50 transition-colors">
                                            <td className="px-6 py-3 text-center">
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                                                    ${idx === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 
                                                      idx === 1 ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' : 
                                                      idx === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 
                                                      'text-slate-400'}`}>
                                                    {idx + 1}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-mono text-slate-400 mb-0.5">{row.product_sku}</span>
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1" title={row.product_name}>
                                                        {row.product_name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400 text-right font-mono font-medium">
                                                {formatNumber(row.current_stock)}
                                            </td>
                                            <td className="px-6 py-3 text-sm font-bold text-slate-900 dark:text-white text-right font-mono">
                                                {formatCurrency(Number(row.capital_cost))}
                                            </td>
                                            <td className="px-6 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400 text-right font-mono">
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
