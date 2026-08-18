import React, { useState } from 'react';
import { useBackDismiss } from '../hooks/useBackDismiss';
import { supabase } from '../supabaseClient';
import {
  Telescope,
  X,
} from 'lucide-react';

interface SourcingQuickEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: any;
    onSuccess: () => void;
}

export const SourcingQuickEditModal: React.FC<SourcingQuickEditModalProps> = ({
    isOpen,
    onClose,
    product,
    onSuccess
}) => {
    const [status, setStatus] = useState<string>(product?.investigation_status || 'pending');
    const [autoOrderDisabled, setAutoOrderDisabled] = useState<boolean>(product?.auto_order_disabled || false);
    const [loading, setLoading] = useState(false);

    // El «atrás» del teléfono cierra este modal en vez de dejar la pantalla.
    useBackDismiss(isOpen && !!product, onClose);

    if (!isOpen || !product) return null;

    const handleSave = async () => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('products')
                .update({
                    investigation_status: status,
                    auto_order_disabled: autoOrderDisabled
                })
                .eq('id', product.id);

            if (error) throw error;
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error saving sourcing status:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    /*
        Anclado abajo en el teléfono (MASTER.md: las ventanas entran por
        abajo, al alcance del pulgar) y centrado a partir de `sm`, que es
        el escritorio. La versión grande no cambia.
    */
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-surface rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-subtle flex justify-between items-center bg-surface-2">
                    <div className="flex items-center gap-2 text-fg">
                        <Telescope size={20} className="text-primary" aria-hidden="true" />
                        <h2 className="text-lg font-bold tracking-tight">Estudio de Repuesto</h2>
                    </div>
                    <button onClick={onClose} className="text-fg-subtle hover:text-slate-600 dark:hover:text-slate-200">
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>

                <div className="p-6">
                    <div className="mb-6">
                        <span className="block font-medium text-fg">{product.name}</span>
                        <span className="block font-mono text-xs text-fg-muted">{product.sku}</span>
                    </div>

                    <div className="flex flex-col gap-5">
                        <div>
                            <label className="block text-sm font-medium text-fg mb-2">
                                Estado de Investigación
                            </label>
                            <select
                                value={status || 'pending'}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full px-3 py-2 border border-strong rounded-lg bg-surface text-fg"
                            >
                                <option value="pending">Pendiente (No iniciado)</option>
                                <option value="en_consulta">En Consulta (Buscando proveedor)</option>
                                <option value="no_encontrado">No Encontrado</option>
                                <option value="encontrado">Encontrado / Conseguido</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-3 bg-surface-2 p-3 rounded-lg border border-subtle">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={!autoOrderDisabled} // Checked = Auto-Order IS enabled
                                    onChange={(e) => setAutoOrderDisabled(!e.target.checked)}
                                />
                                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-success"></div>
                            </label>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-fg">
                                    Pedido Automático
                                </span>
                                <span className="text-xs text-fg-muted">
                                    {autoOrderDisabled ? 'No se agregará a próximos pedidos automáticamente.' : 'Se agregará al próximo pedido si hay stock.'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-subtle bg-surface-2 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-fg-muted">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-4 py-2 bg-primary hover:bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                        {loading ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
