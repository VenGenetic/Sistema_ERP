import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface Tag {
    id: string;
    name: string;
    color: string;
    order_index: number;
}

const COLORS = [
    '#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#64748B', '#000000'
];

interface Props {
    onClose?: () => void;
    embedded?: boolean;
}

const SortableTagItem = ({ tag, onEdit, onDelete }: { tag: Tag, onEdit: () => void, onDelete: () => void }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: tag.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1 : 0,
        position: isDragging ? 'relative' as const : undefined
    };

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className={`flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 group hover:border-slate-300 dark:hover:border-slate-600 transition-colors ${isDragging ? 'shadow-lg border-blue-500 dark:border-blue-500' : ''}`}
        >
            <div className="flex items-center gap-3">
                <div 
                    {...attributes} 
                    {...listeners} 
                    className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-slate-300 dark:text-slate-600 hover:text-slate-500"
                >
                    <span className="material-symbols-outlined">drag_indicator</span>
                </div>
                <span 
                    className="px-2 py-0.5 text-xs font-bold rounded"
                    style={{ backgroundColor: tag.color + '20', color: tag.color, border: `1px solid ${tag.color}40` }}
                >
                    {tag.name}
                </span>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={onEdit} className="p-1 text-slate-400 hover:text-blue-500 rounded"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                <button onClick={onDelete} className="p-1 text-slate-400 hover:text-rose-500 rounded"><span className="material-symbols-outlined text-[18px]">delete</span></button>
            </div>
        </div>
    );
};

export const TagManager: React.FC<Props> = ({ onClose, embedded }) => {
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingTag, setEditingTag] = useState<Partial<Tag> | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        fetchTags();
    }, []);

    const fetchTags = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('tags').select('*').order('order_index', { ascending: true });
            if (error) throw error;
            setTags(data || []);
        } catch (error: any) {
            console.error('Error fetching tags:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!editingTag?.name || !editingTag?.color) return;
        
        try {
            if (editingTag.id) {
                // Update
                const { error } = await supabase.from('tags').update({
                    name: editingTag.name,
                    color: editingTag.color
                }).eq('id', editingTag.id);
                if (error) throw error;
            } else {
                // Insert
                const { error } = await supabase.from('tags').insert([{
                    name: editingTag.name,
                    color: editingTag.color,
                    order_index: tags.length
                }]);
                if (error) throw error;
            }
            setEditingTag(null);
            fetchTags();
        } catch (err: any) {
            alert('Error al guardar etiqueta: ' + err.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Eliminar esta etiqueta? Se quitará de todos los productos que la tengan.')) return;
        try {
            const { error } = await supabase.from('tags').delete().eq('id', id);
            if (error) throw error;
            fetchTags();
        } catch (err: any) {
            alert('Error al eliminar: ' + err.message);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setTags((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);

                const newItems = arrayMove(items, oldIndex, newIndex);
                updateOrder(newItems);
                return newItems;
            });
        }
    };

    const updateOrder = async (newTags: Tag[]) => {
        try {
            const updates = newTags.map((tag, index) => ({
                id: tag.id,
                name: tag.name,
                color: tag.color,
                order_index: index
            }));

            const { error } = await supabase.from('tags').upsert(updates);
            if (error) throw error;
        } catch (err: any) {
            console.error('Error updating order:', err);
            fetchTags(); // Revert on error
        }
    };

    const content = (
        <div className="flex flex-col h-full bg-white dark:bg-slate-800 rounded-xl">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 rounded-lg">
                        <span className="material-symbols-outlined text-[24px]">label</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Gestionar Etiquetas</h2>
                </div>
                {onClose && (
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                )}
            </div>

            <div className="p-6 overflow-y-auto flex-1">
                {/* Editor */}
                {editingTag && (
                    <div className="mb-6 p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900">
                        <h3 className="text-sm font-semibold mb-3 dark:text-white">
                            {editingTag.id ? 'Editar Etiqueta' : 'Nueva Etiqueta'}
                        </h3>
                        <div className="flex flex-col gap-3">
                            <input 
                                type="text" 
                                placeholder="Nombre (ej. Nuevo, Promoción, Fallado)"
                                value={editingTag.name || ''}
                                onChange={e => setEditingTag({ ...editingTag, name: e.target.value })}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm dark:text-white"
                            />
                            <div className="flex flex-wrap gap-2">
                                {COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setEditingTag({ ...editingTag, color: c })}
                                        className={`w-6 h-6 rounded-full border-2 ${editingTag.color === c ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                            <div className="flex gap-2 justify-end mt-2">
                                <button onClick={() => setEditingTag(null)} className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancelar</button>
                                <button onClick={handleSave} className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 font-medium">Guardar</button>
                            </div>
                        </div>
                    </div>
                )}

                {!editingTag && (
                    <button 
                        onClick={() => setEditingTag({ name: '', color: COLORS[0] })}
                        className="mb-4 w-full py-2 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Crear Etiqueta
                    </button>
                )}

                {/* List */}
                {loading ? (
                    <div className="text-center py-8 text-slate-400"><span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span></div>
                ) : (
                    <div className="flex flex-col gap-2">
                        <DndContext 
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext 
                                items={tags.map(t => t.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {tags.map(tag => (
                                    <SortableTagItem 
                                        key={tag.id} 
                                        tag={tag} 
                                        onEdit={() => setEditingTag(tag)}
                                        onDelete={() => handleDelete(tag.id)}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                        {tags.length === 0 && !editingTag && (
                            <div className="text-center py-8 text-slate-400 text-sm">No hay etiquetas creadas.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    if (embedded) return content;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md h-[80vh] shadow-2xl">
                {content}
            </div>
        </div>
    );
};
