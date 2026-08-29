import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import {
  FilePen,
  Info,
  Loader2,
  Phone,
  Save,
  User,
  X,
} from 'lucide-react';

interface ProductDemand {
    id: number;
    product_id: number;
    phone_number: string;
    customer_name: string | null;
    notes: string | null;
    status: string;
    created_at?: string;
    creator_name?: string;
    is_approved?: boolean;
    product?: {
        name: string;
        sku: string;
        inventory_levels?: any[];
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
    const [isApproved, setIsApproved] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (demand && isOpen) {
            setPhone(demand.phone_number || '');
            setName(demand.customer_name || '');
            setNotes(demand.notes || '');
            setIsApproved(demand.is_approved || false);
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
                    notes: notes || null,
                    is_approved: isApproved
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-surface rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90dvh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-subtle flex justify-between items-center bg-surface-2">
                    <div className="flex items-center gap-2 text-fg">
                        <FilePen size={20} className="text-primary" aria-hidden="true" />
                        <h2 className="text-lg font-bold tracking-tight">Editar Solicitud</h2>
                    </div>
                    <button onClick={onClose} className="text-fg-subtle hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto">
                    <div className="mb-4 bg-surface-3 p-3 rounded-lg border border-subtle">
                        <span className="block text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1">Producto Solicitado</span>
                        <span className="block font-medium text-fg line-clamp-2">{demand.product?.name || 'Producto Desconocido'}</span>
                        <span className="block font-mono text-xs text-fg-muted mt-1">{demand.product?.sku || ''}</span>
                    </div>

                    {(demand.created_at || demand.creator_name) && (
                        <div className="mb-6 bg-surface-2 p-3 rounded-lg border border-subtle text-xs text-fg-muted flex flex-col gap-1.5">
                            {demand.created_at && (
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold text-fg-subtle">Fecha de Registro:</span>
                                    <span>{new Date(demand.created_at).toLocaleDateString()} {new Date(demand.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}</span>
                                </div>
                            )}
                            {demand.creator_name && (
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold text-fg-subtle">Registrado por:</span>
                                    <span className="font-medium text-fg flex items-center gap-1">
                                        <User size={14} aria-hidden="true" />
                                        {demand.creator_name}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        
                        <div>
                            <label className="block text-sm font-semibold text-fg mb-1.5">
                                Nombre del Cliente <span className="text-fg-subtle font-normal">(Opcional)</span>
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User size={18} className="text-fg-subtle" aria-hidden="true" />
                                </div>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ej. Juan Pérez"
                                    className="w-full pl-10 pr-3 py-2 bg-surface border border-strong rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white transition-shadow"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-fg mb-1.5">
                                Número de WhatsApp <span className="text-danger">*</span>
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Phone size={18} className="text-fg-subtle" aria-hidden="true" />
                                </div>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9+\s-]/g, ''))}
                                    placeholder="Ej. 0991234567"
                                    required
                                    className="w-full pl-10 pr-3 py-2 bg-surface border border-strong rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white transition-shadow"
                                />
                            </div>
                            <p className="text-xs text-fg-muted mt-1.5 flex items-center gap-1">
                                <Info size={14} aria-hidden="true" />
                                Se usará para enviar el mensaje automático
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-fg mb-1.5">
                                Notas Adicionales <span className="text-fg-subtle font-normal">(Opcional)</span>
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Ej. El cliente busca solo color rojo, llamar por la tarde..."
                                rows={3}
                                className="w-full p-3 bg-surface border border-strong rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white transition-shadow resize-none"
                            />
                        </div>

                        {demand.status === 'pending_stock' && (
                            <div className="flex items-center gap-3 mt-2 bg-surface-2 p-3 rounded-lg border border-subtle">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!isApproved) {
                                            let importerStock = 0;
                                            if (demand.product?.inventory_levels) {
                                                importerStock = demand.product.inventory_levels.find((l: any) => l.warehouses?.type === 'digital_partner')?.current_stock || 0;
                                            }
                                            if (importerStock <= 0) {
                                                alert("No se puede aprobar: No hay stock en la importadora.\n\nDisclaimer: Si ya hay stock porque han revisado aparte, se debe solicitar a la administración la actualización del sistema con el stock visible en la importadora para poder aprobar este pedido.");
                                                return;
                                            }
                                        }
                                        setIsApproved(!isApproved);
                                    }}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${ isApproved ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600' }`}
                                    role="switch"
                                    aria-checked={isApproved}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-surface shadow ring-0 transition duration-200 ease-in-out ${ isApproved ? 'translate-x-5' : 'translate-x-0' }`}
                                    />
                                </button>
                                <div>
                                    <span className={`block text-sm font-semibold ${isApproved ? 'text-primary dark:text-primary' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {isApproved ? 'Pedido Aprobado en espera' : 'Pedido No Aprobado'}
                                    </span>
                                    <span className="block text-xs text-fg-muted">
                                        Activa esto si verificaste el stock en la importadora.
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Footer / Actions */}
                        <div className="mt-4 pt-4 border-t border-subtle flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="px-4 py-2 text-sm font-medium text-fg-muted bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading || !phone.trim()}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-primary rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Save size={18} aria-hidden="true" />
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
