import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Search, Plus, CheckCircle, Package, ArrowRight, X, Layers, AlertCircle } from 'lucide-react';

interface InventoryGroupSelectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    selectedIds: Set<string | number>;
}

interface GroupData {
    id: string;
    name: string;
    created_at: string;
    last_counted_at: string;
    inventory_group_items: { count: number }[];
}

interface SuccessState {
    groupId: string;
    groupName: string;
    addedCount: number;
    existingCount: number;
    totalSelected: number;
}

export const InventoryGroupSelectModal: React.FC<InventoryGroupSelectModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    selectedIds,
}) => {
    const navigate = useNavigate();
    const [mode, setMode] = useState<'select' | 'create'>('select');
    const [groups, setGroups] = useState<GroupData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [newGroupName, setNewGroupName] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [successState, setSuccessState] = useState<SuccessState | null>(null);

    useEffect(() => {
        if (isOpen) {
            setMode('select');
            setSuccessState(null);
            setError(null);
            setSearchTerm('');
            setNewGroupName('');
            fetchGroups();
        }
    }, [isOpen]);

    const fetchGroups = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('inventory_groups')
                .select(`
                    id, 
                    name, 
                    created_at, 
                    last_counted_at,
                    inventory_group_items (count)
                `)
                .order('last_counted_at', { ascending: false });

            if (fetchError) throw fetchError;
            setGroups(data || []);
        } catch (err: any) {
            console.error('Error fetching inventory groups:', err);
            setError('No se pudieron cargar los grupos de inventario: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectExistingGroup = async (group: GroupData) => {
        setSaving(true);
        setError(null);
        try {
            const selectedIdsArray = Array.from(selectedIds);
            
            // 1. Verificar qué productos ya están presentes en este grupo
            const { data: existingItems, error: existingError } = await supabase
                .from('inventory_group_items')
                .select('product_id')
                .eq('group_id', group.id)
                .in('product_id', selectedIdsArray);

            if (existingError) throw existingError;

            const existingSet = new Set((existingItems || []).map(item => String(item.product_id)));
            const newIdsToInsert = selectedIdsArray.filter(id => !existingSet.has(String(id)));

            // 2. Insertar únicamente los que faltan
            if (newIdsToInsert.length > 0) {
                const itemsToInsert = newIdsToInsert.map(productId => ({
                    group_id: group.id,
                    product_id: productId,
                    counted_stock: 0,
                    is_manually_added: false
                }));

                const { error: insertError } = await supabase
                    .from('inventory_group_items')
                    .insert(itemsToInsert);

                if (insertError) throw insertError;
            }

            setSuccessState({
                groupId: group.id,
                groupName: group.name,
                addedCount: newIdsToInsert.length,
                existingCount: existingSet.size,
                totalSelected: selectedIdsArray.length
            });
        } catch (err: any) {
            console.error('Error adding items to group:', err);
            setError('Error al añadir productos al grupo: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCreateNewGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = newGroupName.trim();
        if (!trimmedName) return;

        setSaving(true);
        setError(null);
        try {
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;

            // 1. Crear el grupo
            const { data: groupData, error: groupError } = await supabase
                .from('inventory_groups')
                .insert([{ name: trimmedName, created_by: userData.user?.id }])
                .select()
                .single();

            if (groupError) throw groupError;

            // 2. Insertar todos los ítems seleccionados
            const selectedIdsArray = Array.from(selectedIds);
            const itemsToInsert = selectedIdsArray.map(productId => ({
                group_id: groupData.id,
                product_id: productId,
                counted_stock: 0,
                is_manually_added: false
            }));

            const { error: insertError } = await supabase
                .from('inventory_group_items')
                .insert(itemsToInsert);

            if (insertError) throw insertError;

            setSuccessState({
                groupId: groupData.id,
                groupName: groupData.name,
                addedCount: selectedIdsArray.length,
                existingCount: 0,
                totalSelected: selectedIdsArray.length
            });
        } catch (err: any) {
            console.error('Error creating inventory group:', err);
            setError('Error al crear el grupo de inventario: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const filteredGroups = groups.filter(g =>
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-base">
                                Añadir a Grupo de Inventario
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Has seleccionado <strong className="text-primary">{selectedIds.size}</strong> producto{selectedIds.size !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mx-5 mt-4 p-3 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Body Content */}
                <div className="p-5">
                    {successState ? (
                        /* PANTALLA DE ÉXITO */
                        <div className="py-4 text-center">
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-300">
                                <CheckCircle className="w-9 h-9" />
                            </div>
                            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                ¡Productos añadidos con éxito!
                            </h4>
                            
                            <div className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 my-4 max-w-sm mx-auto border border-slate-200 dark:border-slate-600">
                                {successState.addedCount > 0 && successState.existingCount === 0 && (
                                    <span>Se añadieron los <strong>{successState.addedCount}</strong> producto(s) al grupo <strong>"{successState.groupName}"</strong>.</span>
                                )}
                                {successState.addedCount > 0 && successState.existingCount > 0 && (
                                    <span>
                                        Se añadieron <strong>{successState.addedCount}</strong> producto(s) nuevos al grupo <strong>"{successState.groupName}"</strong>.
                                        <br/>
                                        <span className="text-xs text-slate-500 mt-1 block">
                                            ({successState.existingCount} ya existían en el grupo y no se duplicaron).
                                        </span>
                                    </span>
                                )}
                                {successState.addedCount === 0 && successState.existingCount > 0 && (
                                    <span>
                                        Los <strong>{successState.totalSelected}</strong> producto(s) seleccionados ya estaban en el grupo <strong>"{successState.groupName}"</strong>.
                                        <br/>
                                        <span className="text-xs text-slate-500 mt-1 block">
                                            No se generaron duplicados.
                                        </span>
                                    </span>
                                )}
                            </div>

                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-6">
                                ¿Qué deseas hacer a continuación?
                            </p>

                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <button
                                    onClick={() => {
                                        onSuccess();
                                        onClose();
                                        navigate(`/inventory-mode/${successState.groupId}`);
                                    }}
                                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-colors shadow-md shadow-emerald-600/20"
                                >
                                    <span>Ir a Pantalla de Conteo</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => {
                                        onSuccess();
                                        onClose();
                                    }}
                                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-sm transition-colors"
                                >
                                    Quedarme en el Catálogo
                                </button>
                            </div>
                        </div>
                    ) : mode === 'create' ? (
                        /* MODO: CREAR NUEVO GRUPO */
                        <form onSubmit={handleCreateNewGroup} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Nombre del Nuevo Grupo
                                </label>
                                <input
                                    type="text"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    placeholder="ej. Repuestos Bodega Principal, Llantas Zona Norte..."
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                                    autoFocus
                                    disabled={saving}
                                />
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-3.5 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2.5">
                                <Package className="w-4 h-4 shrink-0 text-blue-500" />
                                <span>Se inicializará este grupo con los <strong>{selectedIds.size}</strong> productos seleccionados. Su conteo físico empezará en 0.</span>
                            </div>
                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                                <button
                                    type="button"
                                    onClick={() => setMode('select')}
                                    disabled={saving}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-xl text-sm transition-colors"
                                >
                                    Volver a Lista
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || !newGroupName.trim()}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold rounded-xl text-sm transition-colors flex items-center gap-2"
                                >
                                    {saving ? 'Creando...' : 'Crear y Añadir Productos'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        /* MODO: SELECCIONAR GRUPO EXISTente O IR A CREAR */
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Buscar grupo de inventario existente..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        if (searchTerm.trim()) setNewGroupName(searchTerm.trim());
                                        setMode('create');
                                    }}
                                    className="px-3.5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Nuevo Grupo</span>
                                </button>
                            </div>

                            {/* Listado de Grupos */}
                            <div className="border border-slate-200 dark:border-slate-700 rounded-xl max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-900/50">
                                {loading ? (
                                    <div className="p-8 text-center text-slate-400 text-sm">
                                        Cargando grupos de inventario...
                                    </div>
                                ) : filteredGroups.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                                            {searchTerm ? 'No se encontraron grupos que coincidan.' : 'No hay grupos de inventario Creados.'}
                                        </p>
                                        <button
                                            onClick={() => {
                                                if (searchTerm.trim()) setNewGroupName(searchTerm.trim());
                                                setMode('create');
                                            }}
                                            className="mt-3 text-primary font-semibold text-sm hover:underline inline-flex items-center gap-1"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Crear "{searchTerm || 'Nuevo Grupo'}" ahora
                                        </button>
                                    </div>
                                ) : (
                                    filteredGroups.map((group) => {
                                        const itemCount = group.inventory_group_items?.[0]?.count || 0;
                                        return (
                                            <div
                                                key={group.id}
                                                onClick={() => !saving && handleSelectExistingGroup(group)}
                                                className={`p-3.5 hover:bg-blue-50/50 dark:hover:bg-slate-800/80 cursor-pointer transition-all flex items-center justify-between gap-4 group ${
                                                    saving ? 'opacity-50 pointer-events-none' : ''
                                                }`}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate group-hover:text-primary transition-colors">
                                                        {group.name}
                                                    </div>
                                                    <div className="text-xs text-slate-400 mt-0.5">
                                                        Actualizado: {new Date(group.last_counted_at).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-lg text-xs font-medium">
                                                        <Package className="w-3.5 h-3.5 text-slate-400" />
                                                        {itemCount} ítems
                                                    </span>
                                                    <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-primary group-hover:text-white flex items-center justify-center transition-colors">
                                                        <Plus className="w-4 h-4" />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="text-right pt-1">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-sm font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
