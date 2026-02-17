import React, { useState } from 'react';

interface InviteUserModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const InviteUserModal: React.FC<InviteUserModalProps> = ({ isOpen, onClose }) => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('onsite');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: Implement Supabase invite logic
        console.log("Inviting user:", email, role);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Invitar Miembro</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Correo Electrónico</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-primary focus:border-primary"
                            placeholder="colaborador@empresa.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rol Asignado</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-primary focus:border-primary"
                        >
                            <option value="admin">Admin (Acceso Total)</option>
                            <option value="onsite">Onsite (Bodega & Envíos)</option>
                            <option value="closer">Closer (Ventas & Clientes)</option>
                            <option value="dev">Developer (API & Webhooks)</option>
                        </select>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            {role === 'admin' && "Tiene control total sobre la configuración, usuarios y finanzas."}
                            {role === 'onsite' && "Puede gestionar inventario, movimientos y despachos."}
                            {role === 'closer' && "Acceso limitado a dashboard de ventas y gestión de clientes."}
                            {role === 'dev' && "Puede gestionar API Keys, webhooks y logs del sistema."}
                        </p>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm shadow-primary/30 transition-colors flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[18px]">send</span>
                            Enviar Invitación
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InviteUserModal;
