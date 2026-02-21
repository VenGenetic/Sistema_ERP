import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

interface Brand {
    id: number;
    name: string;
    is_active: boolean;
}

const BrandsPanel: React.FC = () => {
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [newBrandName, setNewBrandName] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchBrands();
    }, []);

    const fetchBrands = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('brands')
            .select('*')
            .order('name');

        if (!error && data) {
            setBrands(data);
        }
        setLoading(false);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBrandName.trim()) return;
        setSubmitting(true);

        const { data, error } = await supabase
            .from('brands')
            .insert([{ name: newBrandName.trim() }])
            .select()
            .single();

        if (!error && data) {
            setBrands([...brands, data].sort((a, b) => a.name.localeCompare(b.name)));
            setNewBrandName('');
        }
        setSubmitting(false);
    };

    const handleUpdate = async (id: number) => {
        if (!editName.trim()) return;
        setSubmitting(true);

        const { error } = await supabase
            .from('brands')
            .update({ name: editName.trim() })
            .eq('id', id);

        if (!error) {
            setBrands(brands.map(b => b.id === id ? { ...b, name: editName.trim() } : b));
            setIsEditing(null);
        }
        setSubmitting(false);
    };

    const toggleStatus = async (id: number, currentStatus: boolean) => {
        const { error } = await supabase
            .from('brands')
            .update({ is_active: !currentStatus })
            .eq('id', id);

        if (!error) {
            setBrands(brands.map(b => b.id === id ? { ...b, is_active: !currentStatus } : b));
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Administrar Marcas</h2>

            <form onSubmit={handleCreate} className="flex gap-2 mb-8">
                <input
                    type="text"
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                    placeholder="Nueva marca..."
                    className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-slate-900 dark:text-white"
                />
                <button
                    type="submit"
                    disabled={submitting || !newBrandName.trim()}
                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Agregar
                </button>
            </form>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-medium text-xs uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Nombre de Marca</th>
                            <th className="px-6 py-4 text-center">Estado</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {loading ? (
                            <tr><td colSpan={3} className="text-center py-8 text-slate-500">Cargando marcas...</td></tr>
                        ) : brands.length === 0 ? (
                            <tr><td colSpan={3} className="text-center py-8 text-slate-500">No hay marcas registradas.</td></tr>
                        ) : (
                            brands.map(brand => (
                                <tr key={brand.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="px-6 py-4">
                                        {isEditing === brand.id ? (
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded focus:ring-2 focus:ring-primary outline-none"
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="font-medium text-slate-900 dark:text-white">{brand.name}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => toggleStatus(brand.id, brand.is_active)}
                                            className={`px-2 py-1 rounded-full text-xs font-medium ${brand.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}
                                        >
                                            {brand.is_active ? 'Activo' : 'Inactivo'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {isEditing === brand.id ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleUpdate(brand.id)}
                                                    disabled={submitting}
                                                    className="p-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">check</span>
                                                </button>
                                                <button
                                                    onClick={() => setIsEditing(null)}
                                                    disabled={submitting}
                                                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setIsEditing(brand.id);
                                                    setEditName(brand.name);
                                                }}
                                                className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">edit</span>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BrandsPanel;
