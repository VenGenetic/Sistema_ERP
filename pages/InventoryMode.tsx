import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { LayoutDashboard, Trash2, Edit2, RotateCcw, Plus, Search } from 'lucide-react';

export const InventoryMode: React.FC = () => {
    const navigate = useNavigate();
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('inventory_groups')
                .select(`
                    id, 
                    name, 
                    created_at, 
                    last_counted_at,
                    inventory_group_items (count)
                `)
                .order('last_counted_at', { ascending: false });

            if (error) throw error;
            setGroups(data || []);
        } catch (error: any) {
            console.error('Error fetching inventory groups:', error);
            alert('Error al cargar los grupos: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    const handleCreateGroup = async () => {
        const name = prompt('Ingresa un nombre para el nuevo grupo de inventario (ej. Llantas Bodega A):');
        if (!name) return;

        try {
            const { data: userData } = await supabase.auth.getUser();
            const { data, error } = await supabase
                .from('inventory_groups')
                .insert([{ name, created_by: userData.user?.id }])
                .select()
                .single();

            if (error) throw error;
            navigate(`/inventory-mode/${data.id}`);
        } catch (error: any) {
            console.error('Error creating group:', error);
            alert('Error al crear el grupo: ' + error.message);
        }
    };

    const handleRenameGroup = async (e: React.MouseEvent, id: string, currentName: string) => {
        e.stopPropagation();
        const newName = prompt('Nuevo nombre:', currentName);
        if (!newName || newName === currentName) return;

        try {
            const { error } = await supabase
                .from('inventory_groups')
                .update({ name: newName })
                .eq('id', id);
            
            if (error) throw error;
            fetchGroups();
        } catch (error: any) {
            alert('Error al renombrar: ' + error.message);
        }
    };

    const handleDeleteGroup = async (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation();
        if (!window.confirm(`¿Estás seguro de que quieres eliminar el grupo "${name}"? Esta acción no se puede deshacer.`)) return;

        try {
            const { error } = await supabase
                .from('inventory_groups')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            fetchGroups();
        } catch (error: any) {
            alert('Error al eliminar: ' + error.message);
        }
    };

    const handleResetGroup = async (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation();
        if (!window.confirm(`¿Estás seguro de que quieres ENCERAR todos los conteos del grupo "${name}"? Los productos seguirán en el grupo, pero su conteo volverá a 0.`)) return;

        try {
            const { error } = await supabase
                .from('inventory_group_items')
                .update({ counted_stock: 0 })
                .eq('group_id', id);
            
            if (error) throw error;
            
            await supabase
                .from('inventory_groups')
                .update({ last_counted_at: new Date().toISOString() })
                .eq('id', id);

            alert('Conteos encerados correctamente.');
            fetchGroups();
        } catch (error: any) {
            alert('Error al resetear: ' + error.message);
        }
    };

    const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                        <LayoutDashboard className="w-8 h-8 text-primary" />
                        Modo Inventario
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Gestiona grupos de productos para realizar conteos físicos con código de barras.
                    </p>
                </div>
                
                <button
                    onClick={handleCreateGroup}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-primary/25"
                >
                    <Plus className="w-5 h-5" />
                    Nuevo Grupo
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-8">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar grupo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all dark:text-white"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 flex justify-center">
                        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                    </div>
                ) : filteredGroups.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                        No se encontraron grupos de inventario.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-sm uppercase tracking-wider">
                                    <th className="px-6 py-4 font-medium">Nombre del Grupo</th>
                                    <th className="px-6 py-4 font-medium">Productos</th>
                                    <th className="px-6 py-4 font-medium">Último Conteo</th>
                                    <th className="px-6 py-4 font-medium text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {filteredGroups.map(group => (
                                    <tr 
                                        key={group.id} 
                                        onClick={() => navigate(`/inventory-mode/${group.id}`)}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-800 dark:text-slate-200">{group.name}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">ID: {group.id.split('-')[0]}...</div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                            <span className="inline-flex items-center justify-center bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg text-sm font-medium">
                                                {group.inventory_group_items?.[0]?.count || 0} ítems
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                            {new Date(group.last_counted_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => handleResetGroup(e, group.id, group.name)}
                                                    className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors"
                                                    title="Resetear conteos"
                                                >
                                                    <RotateCcw className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => handleRenameGroup(e, group.id, group.name)}
                                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                                                    title="Renombrar"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteGroup(e, group.id, group.name)}
                                                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
