import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { LayoutDashboard, Trash2, Edit2, RotateCcw, Plus, Search, Clock, Calendar, ShieldCheck, AlertCircle } from 'lucide-react';

interface GroupData {
    id: string;
    name: string;
    created_at: string;
    last_counted_at: string;
    session_started_at?: string;
    interval_value?: number;
    interval_unit?: string;
    inventory_group_items?: { count: number }[];
}

export const InventoryMode: React.FC = () => {
    const navigate = useNavigate();
    const [groups, setGroups] = useState<GroupData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingId, setUpdatingId] = useState<string | null>(null);

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
                    session_started_at,
                    interval_value,
                    interval_unit,
                    inventory_group_items (count)
                `)
                .order('last_counted_at', { ascending: false });

            if (error) throw error;
            
            // Normalize default values
            const formattedData = (data || []).map((g: any) => ({
                ...g,
                interval_value: g.interval_value ?? 0,
                interval_unit: g.interval_unit ?? 'days'
            }));
            
            setGroups(formattedData);
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
                .insert([{ 
                    name, 
                    created_by: userData.user?.id,
                    interval_value: 0,
                    interval_unit: 'days',
                    session_started_at: new Date().toISOString()
                }])
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
            const nowIso = new Date().toISOString();
            const { error } = await supabase
                .from('inventory_group_items')
                .update({ counted_stock: 0 })
                .eq('group_id', id);
            
            if (error) throw error;
            
            await supabase
                .from('inventory_groups')
                .update({ 
                    session_started_at: nowIso
                })
                .eq('id', id);

            alert('Conteos encerados y reloj de sesión reiniciado correctamente.');
            fetchGroups();
        } catch (error: any) {
            alert('Error al resetear: ' + error.message);
        }
    };

    const handleIntervalChange = async (groupId: string, newVal: number, newUnit: string) => {
        setUpdatingId(groupId);
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, interval_value: newVal, interval_unit: newUnit } : g));
        
        try {
            const { error } = await supabase
                .from('inventory_groups')
                .update({
                    interval_value: newVal,
                    interval_unit: newUnit
                })
                .eq('id', groupId);

            if (error) throw error;
        } catch (error: any) {
            console.error('Error guardando intervalo:', error);
            alert('No se pudo actualizar el intervalo: ' + error.message);
            fetchGroups();
        } finally {
            setUpdatingId(null);
        }
    };

    const calculateNextCountInfo = (lastCountedAt?: string, intervalVal: number = 0, intervalUnit: string = 'days') => {
        if (!lastCountedAt || intervalVal <= 0) {
            return {
                status: 'Por inventariar' as const,
                nextDate: null,
                nextDateFormatted: 'Sin intervalo / Pendiente'
            };
        }

        const date = new Date(lastCountedAt);
        if (isNaN(date.getTime())) {
            return {
                status: 'Por inventariar' as const,
                nextDate: null,
                nextDateFormatted: 'Fecha inválida'
            };
        }

        if (intervalUnit === 'months') {
            date.setMonth(date.getMonth() + intervalVal);
        } else if (intervalUnit === 'weeks') {
            date.setDate(date.getDate() + (intervalVal * 7));
        } else {
            // default days
            date.setDate(date.getDate() + intervalVal);
        }

        const now = new Date();
        const isUpToDate = date.getTime() > now.getTime();

        return {
            status: (isUpToDate ? 'Al día' : 'Por inventariar') as ('Al día' | 'Por inventariar'),
            nextDate: date,
            nextDateFormatted: date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        };
    };

    const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                        <LayoutDashboard className="w-8 h-8 text-primary" />
                        Modo Inventario
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Gestiona grupos de productos para realizar conteos físicos con código de barras y programa frecuencias de inspección.
                    </p>
                </div>
                
                <button
                    onClick={handleCreateGroup}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-primary/25 active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    Nuevo Grupo
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-8">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="relative max-w-md w-full">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre de grupo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all dark:text-white text-sm"
                        />
                    </div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline-block">
                        Total Grupos: <strong className="text-primary">{filteredGroups.length}</strong>
                    </span>
                </div>

                {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                        <span className="text-sm font-medium">Cargando grupos y estados...</span>
                    </div>
                ) : filteredGroups.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                        No se encontraron grupos de inventario que coincidan con la búsqueda.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-extrabold">
                                    <th className="px-6 py-4">Nombre del Grupo</th>
                                    <th className="px-5 py-4 text-center">Productos</th>
                                    <th className="px-5 py-4">Última Vez Aplicado</th>
                                    <th className="px-5 py-4">Intervalo de Conteo</th>
                                    <th className="px-5 py-4">Próximo Conteo & Estado</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                                {filteredGroups.map(group => {
                                    const nextCountInfo = calculateNextCountInfo(
                                        group.last_counted_at, 
                                        group.interval_value ?? 0, 
                                        group.interval_unit ?? 'days'
                                    );
                                    
                                    return (
                                        <tr 
                                            key={group.id} 
                                            onClick={() => navigate(`/inventory-mode/${group.id}`)}
                                            className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 cursor-pointer transition-all duration-150 group"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900 dark:text-white text-base group-hover:text-primary transition-colors">
                                                    {group.name}
                                                </div>
                                                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                                    ID: {group.id.split('-')[0]}...
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className="inline-flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 shadow-2xs">
                                                    {group.inventory_group_items?.[0]?.count || 0} ítems
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-slate-600 dark:text-slate-300 font-medium">
                                                {group.last_counted_at ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                                        <span>{new Date(group.last_counted_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic">Nunca</span>
                                                )}
                                            </td>
                                            
                                            {/* Interval Selector Controls */}
                                            <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 w-fit">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="365"
                                                        value={group.interval_value ?? 0}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value, 10) || 0;
                                                            setGroups(prev => prev.map(g => g.id === group.id ? { ...g, interval_value: val } : g));
                                                        }}
                                                        onBlur={(e) => {
                                                            const val = parseInt(e.target.value, 10) || 0;
                                                            handleIntervalChange(group.id, val, group.interval_unit ?? 'days');
                                                        }}
                                                        className="w-14 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono font-black text-center text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary shadow-2xs"
                                                        title="Número de días/semanas/meses"
                                                    />
                                                    <select
                                                        value={group.interval_unit ?? 'days'}
                                                        onChange={(e) => handleIntervalChange(group.id, group.interval_value ?? 0, e.target.value)}
                                                        className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary cursor-pointer shadow-2xs"
                                                    >
                                                        <option value="days">Días</option>
                                                        <option value="weeks">Semanas</option>
                                                        <option value="months">Meses</option>
                                                    </select>
                                                </div>
                                            </td>

                                            {/* Next Count & Automated Status Badge */}
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col items-start gap-1.5">
                                                    {nextCountInfo.status === 'Al día' ? (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 rounded-full text-xs font-black border border-emerald-300 dark:border-emerald-800/80 shadow-2xs">
                                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                            <ShieldCheck className="w-3.5 h-3.5" />
                                                            Al día
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 rounded-full text-xs font-black border border-amber-300 dark:border-amber-800/80 shadow-2xs">
                                                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                                                            <AlertCircle className="w-3.5 h-3.5" />
                                                            Por inventariar
                                                        </span>
                                                    )}
                                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                        Límite: <strong className="text-slate-700 dark:text-slate-300">{nextCountInfo.nextDateFormatted}</strong>
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => handleResetGroup(e, group.id, group.name)}
                                                        className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-xl transition-colors border border-transparent hover:border-amber-200 dark:hover:border-amber-800"
                                                        title="Resetear conteo activo y sesión"
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleRenameGroup(e, group.id, group.name)}
                                                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                                                        title="Renombrar grupo"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteGroup(e, group.id, group.name)}
                                                        className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-800"
                                                        title="Eliminar grupo"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
