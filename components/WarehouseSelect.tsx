import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

interface Warehouse {
    id: number;
    name: string;
    type: string;
    is_active: boolean;
}

interface WarehouseSelectProps {
    value: number | null;
    onChange: (warehouseId: number | null) => void;
    label?: string;
    required?: boolean;
}

export const WarehouseSelect: React.FC<WarehouseSelectProps> = ({ value, onChange, label = "Almacén", required = false }) => {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // For closing on click outside
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchWarehouses();
    }, []);

    useEffect(() => {
        if (value) {
            const selected = warehouses.find(w => w.id === value);
            if (selected) setSearchTerm(selected.name);
        } else {
            setSearchTerm('');
        }
    }, [value, warehouses]);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                // Reset search term to selected value if closed without selection
                if (value) {
                    const selected = warehouses.find(w => w.id === value);
                    if (selected) setSearchTerm(selected.name);
                } else {
                    setSearchTerm('');
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [value, warehouses]);

    const fetchWarehouses = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('warehouses')
                .select('*')
                .eq('is_active', true)
                .order('name');

            if (error) throw error;
            setWarehouses(data || []);
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredWarehouses = warehouses.filter(w =>
        w.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="relative" ref={containerRef}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    placeholder="Buscar almacén..."
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsOpen(true);
                        if (!e.target.value) onChange(null);
                    }}
                    onFocus={() => setIsOpen(true)}
                />
                <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none">
                    <span className="material-symbols-outlined text-[20px]">expand_more</span>
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {loading ? (
                        <div className="p-3 text-center text-slate-500 text-sm">Cargando...</div>
                    ) : (
                        <>
                            {filteredWarehouses.map(warehouse => (
                                <button
                                    key={warehouse.id}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 text-sm transition-colors flex items-center justify-between"
                                    onClick={() => {
                                        onChange(warehouse.id);
                                        setSearchTerm(warehouse.name);
                                        setIsOpen(false);
                                    }}
                                >
                                    <span>{warehouse.name}</span>
                                    <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded capitalize">
                                        {warehouse.type === 'physical' ? 'Físico' : 'Virtual'}
                                    </span>
                                </button>
                            ))}

                            {filteredWarehouses.length === 0 && (
                                <div className="p-3 text-center text-slate-500 text-sm">
                                    No se encontraron almacenes.
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
