import React, { useState } from 'react';
import {
  Send,
  X,
} from 'lucide-react';

interface InviteUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onInvite?: () => void;
}

const InviteUserModal: React.FC<InviteUserModalProps> = ({ isOpen, onClose, onInvite }) => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('onsite');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: Implement Supabase invite logic
        console.log("Inviting user:", email, role);
        onInvite?.();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-surface rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-subtle flex justify-between items-center">
                    <h3 className="text-lg font-bold text-fg">Invitar Miembro</h3>
                    <button onClick={onClose} className="text-fg-muted hover:text-slate-700 dark:hover:text-slate-300">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-fg mb-1">Correo Electrónico</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-lg border-strong bg-surface text-fg focus:ring-primary focus:border-primary"
                            placeholder="colaborador@empresa.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-fg mb-1">Rol Asignado</label>
                        <div className="w-full rounded-lg border border-strong bg-surface-3 text-fg px-3 py-2 text-sm font-medium">
                            Admin (Acceso Total)
                        </div>
                        <p className="mt-2 text-xs text-fg-muted">
                            Tiene control total sobre la configuración, usuarios, inventario y finanzas de todo el sistema.
                        </p>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-fg hover:bg-surface-hover rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm shadow-primary/30 transition-colors flex items-center gap-2"
                        >
                            <Send size={18} aria-hidden="true" />
                            Enviar Invitación
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InviteUserModal;
