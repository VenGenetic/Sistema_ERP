import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

interface Brand {
    id: number;
    name: string;
}

interface BrandSelectProps {
    value: number | null;
    onChange: (brandId: number | null) => void;
    label?: string;
    required?: boolean;
}

export const BrandSelect: React.FC<BrandSelectProps> = ({ value, onChange, label = "Marca", required = false }) => {
    const [brands, setBrands] = useState<Brand[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    // For closing on click outside
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchBrands();
    }, []);

    useEffect(() => {
        // Update search term when value changes externally (e.g. edit mode)
        if (value) {
            const selected = brands.find(b => b.id === value);
            if (selected) setSearchTerm(selected.name);
        } else {
            setSearchTerm('');
        }
    }, [value, brands]);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                // Reset search term to selected value if closed without selection
                if (value) {
                    const selected = brands.find(b => b.id === value);
                    if (selected) setSearchTerm(selected.name);
                } else {
                    setSearchTerm('');
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [value, brands]);


    const fetchBrands = async () => {
        try {
            const { data, error } = await supabase.from('brands').select('*').order('name');
            if (error) throw error;
            setBrands(data || []);
        } catch (error) {
            console.error('Error fetching brands:', error);
        }
    };

    const handleCreateBrand = async () => {
        if (!searchTerm.trim()) return;
        setCreating(true);
        try {
            const newBrandName = searchTerm.trim();
            const { data, error } = await supabase
                .from('brands')
                .insert([{ name: newBrandName }])
                .select()
                .single();

            if (error) throw error;

            if (data) {
                setBrands([...brands, data].sort((a, b) => a.name.localeCompare(b.name)));
                onChange(data.id);
                setSearchTerm(data.name);
                setIsOpen(false);
            }
        } catch (error) {
            console.error('Error creating brand:', error);
            alert('Error creating brand');
        } finally {
            setCreating(false);
        }
    };

    const filteredBrands = brands.filter(b =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const showCreateOption = searchTerm && !filteredBrands.some(b => b.name.toLowerCase() === searchTerm.toLowerCase());

    return (
        <div className="relative" ref={containerRef}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    placeholder="Buscar o crear marca..."
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
                            {filteredBrands.map(brand => (
                                <button
                                    key={brand.id}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 text-sm transition-colors"
                                    onClick={() => {
                                        onChange(brand.id);
                                        setSearchTerm(brand.name);
                                        setIsOpen(false);
                                    }}
                                >
                                    {brand.name}
                                </button>
                            ))}

                            {showCreateOption && (
                                <button
                                    className="w-full text-left px-4 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium border-t border-slate-100 dark:border-slate-700 transition-colors flex items-center gap-2 sticky bottom-0"
                                    onClick={handleCreateBrand}
                                    disabled={creating}
                                >
                                    <span className="material-symbols-outlined text-[18px]">add</span>
                                    {creating ? 'Creando...' : `AGREGAR NUEVA MARCA "${searchTerm}"`}
                                </button>
                            )}

                            {!showCreateOption && filteredBrands.length === 0 && (
                                <div className="p-3 text-center text-slate-500 text-sm">
                                    No hay resultados.
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
