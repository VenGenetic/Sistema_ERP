import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { ShareDemandModal } from './ShareDemandModal';

interface ProductDemandModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: any;
}

export const ProductDemandModal: React.FC<ProductDemandModalProps> = ({
    isOpen,
    onClose,
    product
}) => {
    const { session } = useAuth();
    const user = session?.user;
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [createdDemand, setCreatedDemand] = useState<any>(null);

    if (!isOpen || !product) return null;

    if (showShare && createdDemand) {
        return (
            <ShareDemandModal 
                isOpen={true} 
                demand={createdDemand} 
                onClose={() => {
                    setShowShare(false);
                    setPhone('');
                    setName('');
                    setNotes('');
                    onClose();
                }} 
            />
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!phone.trim()) {
            alert('El número de teléfono es obligatorio');
            return;
        }

        setLoading(true);
        try {
            // Check if active demand already exists
            const { data: existing, error: checkError } = await supabase
                .from('product_demands')
                .select('id')
                .eq('product_id', product.id)
                .eq('phone_number', phone)
                .in('status', ['pending_stock', 'stock_available'])
                .limit(1);

            if (checkError) throw checkError;

            if (existing && existing.length > 0) {
                alert('Este número ya tiene una solicitud activa para este producto.');
                setLoading(false);
                return;
            }

            const { data: insertedData, error: insertError } = await supabase
                .from('product_demands')
                .insert([{
                    product_id: product.id,
                    phone_number: phone,
                    customer_name: name || null,
                    notes: notes || null,
                    created_by: user?.id,
                    status: 'pending_stock'
                }])
                .select()
                .single();

            if (insertError) throw insertError;

            const newDemand = {
                ...insertedData,
                product: {
                    name: product.name,
                    sku: product.sku,
                    image_url: product.image_url,
                    importer_stock: product.importer_stock,
                    inventory_levels: product.inventory_levels
                }
            };
            
            setCreatedDemand(newDemand);
            setShowShare(true);
        } catch (error: any) {
            console.error('Error saving demand:', error);
            alert(`Error al registrar la demanda: ${error.message}`);
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
                        <span className="material-symbols-outlined text-[20px] text-blue-500">notifications_active</span>
                        <h2 className="text-lg font-bold tracking-tight">Lista de Espera</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto">
                    <div className="mb-6 bg-slate-100 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                        <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Producto Solicitado</span>
                        <span className="block font-medium text-slate-900 dark:text-white line-clamp-2">{product.name}</span>
                        <span className="block font-mono text-xs text-slate-500 mt-1">{product.sku}</span>
                    </div>

                    <form id="demand-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Teléfono <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="tel"
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-[#161b22] text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="+593 99 999 9999"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Nombre del Cliente <span className="text-slate-400 text-xs font-normal">(Opcional)</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-[#161b22] text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="Ej. Juan Pérez"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Notas adicionales <span className="text-slate-400 text-xs font-normal">(Opcional)</span>
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-[#161b22] text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                                placeholder="Ej. Busca versión en color negro..."
                            />
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#161b22] flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="demand-form"
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm shadow-blue-500/20"
                    >
                        {loading ? (
                            <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                        ) : (
                            <span className="material-symbols-outlined text-[18px]">save</span>
                        )}
                        Registrar
                    </button>
                </div>

            </div>
        </div>
    );
};
