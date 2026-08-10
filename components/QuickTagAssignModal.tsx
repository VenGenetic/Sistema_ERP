import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Tag } from './TagManager';

interface QuickTagAssignModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    productId: number;
    productName: string;
}

export const QuickTagAssignModal: React.FC<QuickTagAssignModalProps> = ({ isOpen, onClose, onSuccess, productId, productName }) => {
    const [availableTags, setAvailableTags] = useState<Tag[]>([]);
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadTags();
        }
    }, [isOpen, productId]);

    const loadTags = async () => {
        setLoading(true);
        try {
            // 1. Fetch all available tags
            const { data: allTags } = await supabase.from('tags').select('*').order('order_index');
            if (allTags) setAvailableTags(allTags);

            // 2. Fetch tags for this product
            const { data: prodTags } = await supabase.from('product_tags').select('tag_id').eq('product_id', productId);
            if (prodTags) {
                setSelectedTags(new Set(prodTags.map(pt => pt.tag_id)));
            } else {
                setSelectedTags(new Set());
            }
        } catch (error) {
            console.error('Error loading tags:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleTag = (tagId: string) => {
        setSelectedTags(prev => {
            const next = new Set(prev);
            if (next.has(tagId)) {
                next.delete(tagId);
            } else {
                next.add(tagId);
            }
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Remove existing tags
            await supabase.from('product_tags').delete().eq('product_id', productId);
            
            // Insert new tags
            if (selectedTags.size > 0) {
                const tagInserts = Array.from(selectedTags).map(tagId => ({ product_id: productId, tag_id: tagId }));
                const { error } = await supabase.from('product_tags').insert(tagInserts);
                if (error) throw error;
            }
            
            onSuccess();
            onClose();
        } catch (error: any) {
            alert('Error al guardar etiquetas: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-slate-400">label</span>
                            Etiquetas del Producto
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[250px]">{productName}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
                
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center py-6">
                            <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
                        </div>
                    ) : availableTags.length === 0 ? (
                        <div className="text-center text-sm text-slate-500 py-4">
                            No hay etiquetas creadas en el sistema. Puedes crearlas en la pestaña "Etiquetas".
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {availableTags.map(tag => {
                                const isSelected = selectedTags.has(tag.id);
                                return (
                                    <button
                                        key={tag.id}
                                        onClick={() => toggleTag(tag.id)}
                                        className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                                            isSelected 
                                            ? 'border-transparent bg-slate-50 dark:bg-slate-700/50' 
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div 
                                                className="w-4 h-4 rounded flex items-center justify-center transition-colors"
                                                style={{ 
                                                    backgroundColor: isSelected ? tag.color : 'transparent',
                                                    border: `2px solid ${tag.color}`
                                                }}
                                            >
                                                {isSelected && <span className="material-symbols-outlined text-[12px] text-white font-bold">check</span>}
                                            </div>
                                            <span 
                                                className="px-2 py-0.5 text-xs font-bold rounded"
                                                style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                            >
                                                {tag.name}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 bg-slate-50/50 dark:bg-slate-900/30">
                    <button 
                        onClick={onClose} 
                        className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={saving || loading}
                        className="px-4 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {saving && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};
