import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

interface ProductDemand {
    id: number;
    product_id: number;
    phone_number: string;
    customer_name: string | null;
    notes: string | null;
    status: string;
    product?: {
        name: string;
        sku: string;
    } | null;
}

interface EditDemandModalProps {
    isOpen: boolean;
    onClose: () => void;
    demand: ProductDemand | null;
    onSuccess: () => void;
}

export const EditDemandModal: React.FC<EditDemandModalProps> = ({
    isOpen,
    onClose,
    demand,
    onSuccess
}) => {
    const { session } = useAuth();
    const user = session?.user;
    
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (demand && isOpen) {
            setPhone(demand.phone_number || '');
            setName(demand.customer_name || '');
            setNotes(demand.notes || '');
        }
    }, [demand, isOpen]);

    if (!isOpen || !demand) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!phone.trim()) {
            alert('El número de teléfono es obligatorio');
            return;
        }

        setLoading(true);
        try {
            // Check if active demand already exists with the same phone (excluding current demand)
            if (phone !== demand.phone_number) {
                const { data: existing, error: checkError } = await supabase
                    .from('product_demands')
                    .select('id')
                    .eq('product_id', demand.product_id)
                    .eq('phone_number', phone)
                    .in('status', ['pending_stock', 'stock_available'])
                    .neq('id', demand.id)
                    .limit(1);

                if (checkError) throw checkError;

                if (existing && existing.length > 0) {
                    alert('Este número ya tiene otra solicitud activa para este producto.');
                    setLoading(false);
                    return;
                }
            }

            const { error: updateError } = await supabase
                .from('product_demands')
                .update({
                    phone_number: phone,
                    customer_name: name || null,
                    notes: notes || null
                })
                .eq('id', demand.id);

            if (updateError) throw updateError;

            alert('Solicitud actualizada correctamente.');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error updating demand:', error);
            alert(`Error al actualizar la demanda: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0c1117] rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-[#161b22]">
                    <div className="flex items-center gap-2 text-slate-800 dark:text-white">
                        <span className="material-symbols-outlined text-[20px] text-blue-500">edit_note</span>
                        <h2 className="text-lg font-bold tracking-tight">Editar Solicitud</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto">
                    <div className="mb-6 bg-slate-100 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                        <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Producto Solicitado</span>
                        <span className="block font-medium text-slate-900 dark:text-white line-clamp-2">{demand.product?.name || 'Producto Desconocido'}</span>
                        <span className="block font-mono text-xs text-slate-500 mt-1">{demand.product?.sku || ''}</span>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Nombre del Cliente <span className="text-slate-400 font-normal">(Opcional)</span>
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-slate-400 text-[18px]">person</span>
                                </div>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ej. Juan Pérez"
                                    className="w-full pl-10 pr-3 py-2 bg-white dark:bg-[#0c1117] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white transition-shadow"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Número de WhatsApp <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-slate-400 text-[18px]">call</span>
                                </div>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9+\s-]/g, ''))}
                                    placeholder="Ej. 0991234567"
                                    required
                                    className="w-full pl-10 pr-3 py-2 bg-white dark:bg-[#0c1117] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white transition-shadow"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">info</span>
                                Se usará para enviar el mensaje automático
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Notas Adicionales <span className="text-slate-400 font-normal">(Opcional)</span>
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Ej. El cliente busca solo color rojo, llamar por la tarde..."
                                rows={3}
                                className="w-full p-3 bg-white dark:bg-[#0c1117] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white transition-shadow resize-none"
                            />
                        </div>

                        {/* Footer / Actions */}
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading || !phone.trim()}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[18px]">save</span>
                                        Guardar Cambios
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
