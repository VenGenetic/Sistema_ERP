import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { LayoutDashboard, Trash2, Edit2, RotateCcw, Plus, Search, Clock, Calendar, ShieldCheck, AlertCircle, Target } from 'lucide-react';
import { RotationClass, ROTATION_CLASSES, ROTATION_CLASS_BOUNDS, midpointOfClass } from '../utils/rotationClass';

interface GroupData {
    id: string;
    name: string;
    created_at: string;
    last_counted_at: string;
    session_started_at?: string;
    rotation_class?: RotationClass;
    interval_days?: number;
    last_accuracy_score?: number | null;
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
                    rotation_class,
                    interval_days,
                    last_accuracy_score,
                    inventory_group_items (count)
                `)
                .order('last_counted_at', { ascending: false });

            if (error) throw error;

            // Normalize default values
            const formattedData = (data || []).map((g: any) => ({
                ...g,
                rotation_class: (g.rotation_class ?? 'medium') as RotationClass,
                interval_days: g.interval_days ?? midpointOfClass('medium')
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
                    rotation_class: 'medium',
                    interval_days: midpointOfClass('medium'),
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

    // Cambiar la clase de rotación reclasifica el grupo — el intervalo salta al
    // punto medio de la nueva clase (misma convención que un grupo recién
    // creado) hasta que el próximo conteo lo recalibre con datos reales.
    const handleRotationClassChange = async (groupId: string, newClass: RotationClass) => {
        setUpdatingId(groupId);
        const newInterval = midpointOfClass(newClass);
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, rotation_class: newClass, interval_days: newInterval } : g));

        try {
            const { error } = await supabase
                .from('inventory_groups')
                .update({
                    rotation_class: newClass,
                    interval_days: newInterval
                })
                .eq('id', groupId);

            if (error) throw error;
        } catch (error: any) {
            console.error('Error guardando la clase de rotación:', error);
            alert('No se pudo actualizar la clase de rotación: ' + error.message);
            fetchGroups();
        } finally {
            setUpdatingId(null);
        }
    };

    const calculateNextCountInfo = (lastCountedAt?: string, intervalDays: number = 0) => {
        if (!lastCountedAt || intervalDays <= 0) {
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

        date.setDate(date.getDate() + intervalDays);

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
        <div className="p-6 max-w-[1600px] mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-fg flex items-center gap-3">
                        <LayoutDashboard className="w-8 h-8 text-primary" />
                        Modo Inventario
                    </h1>
                    <p className="text-fg-muted mt-1">
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

            <div className="bg-surface rounded-2xl shadow-sm border border-subtle overflow-hidden mb-8">
                <div className="p-4 border-b border-subtle flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="relative max-w-md w-full">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-subtle" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre de grupo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-subtle rounded-xl focus:ring-2 focus:ring-primary/50 outline-none transition-all dark:text-white text-sm"
                        />
                    </div>
                    <span className="text-xs font-semibold text-fg-muted hidden sm:inline-block">
                        Total Grupos: <strong className="text-primary">{filteredGroups.length}</strong>
                    </span>
                </div>

                {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center text-fg-subtle gap-3">
                        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                        <span className="text-sm font-medium">Cargando grupos y estados...</span>
                    </div>
                ) : filteredGroups.length === 0 ? (
                    <div className="p-12 text-center text-fg-muted">
                        No se encontraron grupos de inventario que coincidan con la búsqueda.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-surface-2 text-fg-muted text-xs uppercase tracking-wider font-bold">
                                    <th className="px-4 py-2.5">Nombre del Grupo</th>
                                    <th className="px-4 py-2.5 text-center">Productos</th>
                                    <th className="px-4 py-2.5">Última Vez Aplicado</th>
                                    <th className="px-4 py-2.5">Clase de Rotación</th>
                                    <th className="px-4 py-2.5">Próximo Conteo & Estado</th>
                                    <th className="px-4 py-2.5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle text-sm">
                                {filteredGroups.map(group => {
                                    const nextCountInfo = calculateNextCountInfo(
                                        group.last_counted_at,
                                        group.interval_days ?? 0
                                    );
                                    const rotationClass = group.rotation_class ?? 'medium';
                                    const classBounds = ROTATION_CLASS_BOUNDS[rotationClass];
                                    
                                    return (
                                        <tr 
                                            key={group.id} 
                                            onClick={() => navigate(`/inventory-mode/${group.id}`)}
                                            className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 cursor-pointer transition-all duration-150 group"
                                        >
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-fg text-base group-hover:text-primary transition-colors">
                                                    {group.name}
                                                </div>
                                                <div className="text-[11px] font-mono text-fg-subtle mt-0.5">
                                                    ID: {group.id.split('-')[0]}...
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex items-center justify-center bg-surface-3 text-fg px-3 py-1 rounded-xl text-xs font-bold border border-subtle shadow-2xs">
                                                    {group.inventory_group_items?.[0]?.count || 0} ítems
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-fg-muted font-medium">
                                                {group.last_counted_at ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="w-4 h-4 text-fg-subtle shrink-0" />
                                                        <span>{new Date(group.last_counted_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-fg-subtle italic">Nunca</span>
                                                )}
                                            </td>
                                            
                                            {/* Rotation Class Selector */}
                                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex flex-col gap-1 w-fit">
                                                    <select
                                                        value={rotationClass}
                                                        onChange={(e) => handleRotationClassChange(group.id, e.target.value as RotationClass)}
                                                        disabled={updatingId === group.id}
                                                        className="px-2.5 py-1.5 bg-surface border border-strong rounded-lg text-xs font-bold text-fg outline-none focus:ring-2 focus:ring-primary cursor-pointer shadow-2xs disabled:opacity-60"
                                                        title={classBounds.examples}
                                                    >
                                                        {ROTATION_CLASSES.map(rc => (
                                                            <option key={rc} value={rc}>
                                                                {ROTATION_CLASS_BOUNDS[rc].label} · {ROTATION_CLASS_BOUNDS[rc].min}-{ROTATION_CLASS_BOUNDS[rc].max}d
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <span className="text-[11px] text-fg-muted font-mono flex items-center gap-1 pl-0.5">
                                                        <Target className="w-3 h-3 text-fg-subtle" />
                                                        {group.interval_days ?? classBounds.min} días
                                                        {typeof group.last_accuracy_score === 'number' && (
                                                            <span className="text-fg-subtle">· últ. precisión {group.last_accuracy_score}%</span>
                                                        )}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Next Count & Automated Status Badge */}
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col items-start gap-1.5">
                                                    {nextCountInfo.status === 'Al día' ? (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-success-soft text-success-soft-fg rounded-full text-xs font-bold border border-success/20 shadow-2xs">
                                                            <span className="w-2 h-2 rounded-full bg-success" />
                                                            <ShieldCheck className="w-3.5 h-3.5" />
                                                            Al día
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-warning-soft text-warning-soft-fg rounded-full text-xs font-bold border border-warning/20 shadow-2xs">
                                                            <span className="w-2 h-2 rounded-full bg-warning" />
                                                            <AlertCircle className="w-3.5 h-3.5" />
                                                            Por inventariar
                                                        </span>
                                                    )}
                                                    <span className="text-[11px] text-fg-muted font-medium flex items-center gap-1">
                                                        <Calendar className="w-3.5 h-3.5 text-fg-subtle" />
                                                        Límite: <strong className="text-fg">{nextCountInfo.nextDateFormatted}</strong>
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => handleResetGroup(e, group.id, group.name)}
                                                        className="p-2 text-fg-muted hover:text-warning hover:bg-warning-soft rounded-xl transition-colors border border-transparent hover:border-warning/20"
                                                        title="Resetear conteo activo y sesión"
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleRenameGroup(e, group.id, group.name)}
                                                        className="p-2 text-fg-muted hover:text-primary hover:bg-primary-soft rounded-xl transition-colors border border-transparent hover:border-primary/20"
                                                        title="Renombrar grupo"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteGroup(e, group.id, group.name)}
                                                        className="p-2 text-fg-muted hover:text-danger hover:bg-danger-soft rounded-xl transition-colors border border-transparent hover:border-danger/20"
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
