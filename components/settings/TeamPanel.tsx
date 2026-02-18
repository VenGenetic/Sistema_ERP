import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import InviteUserModal from '../InviteUserModal'; // Fixed default import and path

const TeamPanel: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);

    useEffect(() => {
        fetchTeam();
    }, []);

    const fetchTeam = async () => {
        try {
            setLoading(true);
            // Fetch profiles. In a real app we might join with auth.users if we have permissions,
            // but for now we rely on the public 'profiles' table.
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching team:', error);
        } finally {
            setLoading(false);
        }
    };

    const getInitials = (name: string, email: string) => {
        if (name) return name.substring(0, 2).toUpperCase();
        return email ? email.substring(0, 2).toUpperCase() : 'U';
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Miembros del Equipo</h3>
                <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-primary/20"
                >
                    <span className="material-symbols-outlined text-[20px]">person_add</span>
                    Invitar Miembro
                </button>
            </div>

            {/* Team List Table */}
            <div className="bg-surface-dark border border-border-dark rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border-dark bg-surface-hover/50">
                                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-[40%]">Usuario</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-[20%]">Rol</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-[20%]">Estado</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-[20%] text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-text-secondary">
                                        <div className="flex justify-center items-center gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                            Cargando equipo...
                                        </div>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-text-secondary">
                                        No hay miembros en el equipo aún.
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id} className="group hover:bg-surface-hover transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md bg-gradient-to-br from-blue-500 to-purple-600 border border-white/10 overflow-hidden">
                                                    {user.avatar_url ? (
                                                        <img src={user.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                                                    ) : (
                                                        getInitials(user.full_name, user.email)
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-white">
                                                        {user.full_name || user.nickname || 'Usuario sin nombre'}
                                                    </div>
                                                    <div className="text-sm text-text-secondary">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-hover border border-border-dark text-xs font-medium text-slate-300">
                                                {/* In a real app, join role_id with roles table. Placeholder for now */}
                                                Member
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                Activo
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button className="text-text-secondary hover:text-white transition-colors p-2 rounded-full hover:bg-background-dark/50">
                                                <span className="material-symbols-outlined">more_vert</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <InviteUserModal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} />
            )}
        </div>
    );
};

export default TeamPanel;
