import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface InviteUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onInvite: () => void;
}

const InviteUserModal: React.FC<InviteUserModalProps> = ({ isOpen, onClose, onInvite }) => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('Closer');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    if (!isOpen) return null;

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
                data: { role },
            });

            if (error) throw error;

            setMessage({ type: 'success', text: `Invitation sent to ${email}` });
            setTimeout(() => {
                onInvite();
                onClose();
                setEmail('');
                setMessage(null);
            }, 1500);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to send invitation' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-surface-dark border border-border-dark rounded-xl p-6 w-full max-w-md shadow-2xl bg-[#1e293b] text-white">
                <h2 className="text-xl font-bold mb-4">Invite New User</h2>

                {message && (
                    <div className={`p-3 rounded-lg mb-4 text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleInvite}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-text-secondary mb-1">Email Address</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                            placeholder="colleague@example.com"
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-text-secondary mb-1">Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                        >
                            <option value="Admin">Admin</option>
                            <option value="Closer">Closer</option>
                            <option value="Onsite">Onsite</option>
                            <option value="Dev">Dev</option>
                        </select>
                        <p className="text-xs text-text-secondary mt-1">
                            {role === 'Admin' && 'Full access to all modules.'}
                            {role === 'Closer' && 'Can manage orders and view customers.'}
                            {role === 'Onsite' && 'Warehouse and logistics management.'}
                            {role === 'Dev' && 'Technical configuration and API access.'}
                        </p>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-white hover:bg-background-dark transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-primary hover:bg-blue-600 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600"
                        >
                            {loading && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                            Send Invitation
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InviteUserModal;
