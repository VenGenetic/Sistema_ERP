import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface FitmentSearchProps {
    onSearch: (make: string, model: string, year: number | null) => void;
    onReset: () => void;
}

export const FitmentSearch: React.FC<FitmentSearchProps> = ({ onSearch, onReset }) => {
    const [makes, setMakes] = useState<string[]>([]);
    const [models, setModels] = useState<string[]>([]);

    const [selectedMake, setSelectedMake] = useState<string>('');
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<number | ''>('');

    const [loadingMakes, setLoadingMakes] = useState(false);
    const [loadingModels, setLoadingModels] = useState(false);

    useEffect(() => {
        fetchMakes();
    }, []);

    useEffect(() => {
        if (selectedMake) {
            fetchModels(selectedMake);
        } else {
            setModels([]);
            setSelectedModel('');
        }
    }, [selectedMake]);

    const fetchMakes = async () => {
        setLoadingMakes(true);
        // Using the RPC we created
        const { data, error } = await supabase.rpc('get_unique_makes');
        if (!error && data) {
            setMakes(data.map((r: any) => r.make));
        }
        setLoadingMakes(false);
    };

    const fetchModels = async (make: string) => {
        setLoadingModels(true);
        // Using the RPC we created
        const { data, error } = await supabase.rpc('get_models_by_make', { p_make: make });
        if (!error && data) {
            setModels(data.map((r: any) => r.model));
        }
        setLoadingModels(false);
    };

    const handleSearch = () => {
        onSearch(selectedMake, selectedModel, selectedYear || null);
    };

    const handleReset = () => {
        setSelectedMake('');
        setSelectedModel('');
        setSelectedYear('');
        onReset();
    };

    const currentYear = new Date().getFullYear() + 1;
    const years = Array.from({ length: 40 }, (_, i) => currentYear - i); // From Next Year back 40 years

    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-primary/20 shadow-sm flex flex-col md:flex-row gap-3 items-end">
            <div className="flex-1 min-w-[150px] w-full">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Marca de Moto</label>
                <select
                    value={selectedMake}
                    onChange={(e) => {
                        setSelectedMake(e.target.value);
                        setSelectedModel('');
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                    disabled={loadingMakes}
                >
                    <option value="">Todas las marcas</option>
                    {makes.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>

            <div className="flex-1 min-w-[150px] w-full">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Modelo</label>
                <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
                    disabled={!selectedMake || loadingModels}
                >
                    <option value="">Todos los modelos</option>
                    {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>

            <div className="flex-1 min-w-[120px] w-full">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Año</label>
                <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                >
                    <option value="">Cualquier Año</option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                <button
                    onClick={handleSearch}
                    disabled={!selectedMake && !selectedModel && !selectedYear}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-semibold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span className="material-symbols-outlined text-[18px]">search</span>
                    Buscar
                </button>
                <button
                    onClick={handleReset}
                    disabled={!selectedMake && !selectedModel && !selectedYear}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition disabled:opacity-50"
                    title="Limpiar filtros"
                >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
            </div>
        </div>
    );
};
