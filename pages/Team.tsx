import React, { useState, useEffect } from 'react';
import InviteUserModal from '../components/InviteUserModal';

import { supabase } from '../supabaseClient';

interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: string;
  roleColor: string;
  status: 'Active' | 'Inactive';
  lastActive: string;
  avatarType: 'initials' | 'img';
  img?: string;
}

const getRoleColor = (role: string) => {
  const r = (role || '').toLowerCase();
  if (r.includes('admin')) return 'purple';
  if (r.includes('closer')) return 'amber';
  if (r.includes('onsite')) return 'emerald';
  if (r.includes('dev')) return 'cyan';
  return 'emerald'; // default
};

const Team: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [showRoleEditor, setShowRoleEditor] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, is_active, created_at, avatar_url');

      if (error) throw error;

      if (data) {
        const mappedUsers: User[] = data.map(p => {
          const name = p.full_name || 'Usuario Sin Nombre';
          const initials = name
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);

          return {
            id: p.id,
            name: name,
            email: 'Usuario Sistema', // Supabase profiles don't typically expose email to other users directly due to security
            initials: initials || 'U',
            role: (p.role || 'Usuario').charAt(0).toUpperCase() + (p.role || 'Usuario').slice(1),
            roleColor: getRoleColor(p.role),
            status: p.is_active ? 'Active' : 'Inactive',
            lastActive: new Date(p.created_at).toLocaleDateString(),
            avatarType: p.avatar_url ? 'img' : 'initials',
            img: p.avatar_url,
          };
        });
        setUsers(mappedUsers);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserStatus = async (id: string) => {
    try {
      const user = users.find(u => u.id === id);
      if (!user) return;

      const newStatus = user.status === 'Active' ? false : true;

      // Optimistic upate
      setUsers(users.map(u =>
        u.id === id ? { ...u, status: newStatus ? 'Active' : 'Inactive' } : u
      ));

      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newStatus })
        .eq('id', id);

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error("Error updating user status:", err);
      // Revert on error
      fetchUsers();
    }
  };

  const handleInvite = () => {
    // Refresh list or add optimistic update
    console.log("User invited");
  };

  return (
    <div className="flex flex-col h-full w-full max-w-[1200px] mx-auto px-4 md:px-8 py-8">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <span className="text-text-secondary hover:text-white transition-colors cursor-pointer">General</span>
        <span className="material-symbols-outlined text-text-secondary text-base">chevron_right</span>
        <span className="text-white font-medium">Equipos y Permisos</span>
      </div>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Gestión de Equipo</h1>
          <p className="text-text-secondary text-base max-w-2xl">Administra el acceso y define roles específicos (Closer, Onsite) para tu operación.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowRoleEditor(!showRoleEditor)}
            className="bg-surface-dark border border-border-dark hover:bg-surface-hover text-white font-medium py-2.5 px-5 rounded-lg flex items-center gap-2 transition-all whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[20px]">shield_person</span>
            Editor de Roles
          </button>
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="bg-primary hover:bg-blue-600 text-white font-medium py-2.5 px-5 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20 whitespace-nowrap bg-blue-600"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Invitar Miembro
          </button>
        </div>
      </div>

      {/* Role Editor Panel (Conditional) */}
      {showRoleEditor && (
        <div className="bg-surface-dark border border-border-dark rounded-xl p-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">gpp_maybe</span>
            Definición de Roles (RBAC)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { role: 'Closer', perms: ['Ver Leads', 'Crear Orden', 'Chat Clientes'], forbidden: ['Ver Balance', 'Ajustar Stock'] },
              { role: 'Onsite', perms: ['Ver Pedidos', 'Ajustar Inventario', 'Imprimir Etiquetas'], forbidden: ['Ver Finanzas', 'Invitar Usuarios'] },
              { role: 'Admin', perms: ['Acceso Total'], forbidden: [] },
              { role: 'Dev', perms: ['API Keys', 'Webhooks', 'Logs'], forbidden: ['Editar Finanzas'] }
            ].map((r) => (
              <div key={r.role} className="bg-background-dark/50 rounded-lg p-4 border border-border-dark">
                <div className="font-bold text-white mb-2">{r.role}</div>
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-green-400 uppercase tracking-wider">Permitido</div>
                  <ul className="list-disc list-inside text-xs text-text-secondary space-y-1">
                    {r.perms.map(p => <li key={p}>{p}</li>)}
                  </ul>
                  {r.forbidden.length > 0 && (
                    <>
                      <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mt-3">Restringido</div>
                      <ul className="list-disc list-inside text-xs text-text-secondary space-y-1">
                        {r.forbidden.map(p => <li key={p}>{p}</li>)}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button className="text-sm text-primary hover:underline">Configurar permisos avanzados &rarr;</button>
          </div>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="bg-surface-dark border border-border-dark rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="relative w-full md:max-w-md group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-text-secondary group-focus-within:text-primary transition-colors">search</span>
          </div>
          <input className="block w-full pl-10 pr-3 py-2.5 bg-background-dark border border-border-dark rounded-lg leading-5 text-white placeholder-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition-all" placeholder="Buscar por nombre, email o rol..." type="text" />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-secondary bg-background-dark border border-border-dark rounded-lg hover:text-white hover:border-gray-500 transition-colors whitespace-nowrap">
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            <span>Filtros</span>
          </button>
        </div>
      </div>

      {/* Team List Table */}
      <div className="bg-surface-dark border border-border-dark rounded-xl overflow-hidden shadow-sm flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-dark bg-surface-hover/50">
                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-[35%]">Usuario</th>
                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-[20%]">Rol</th>
                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-[20%]">Estado</th>
                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-[15%]">Último Acceso</th>
                <th className="px-6 py-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-[10%] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dark">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-secondary">Cargando equipo...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-secondary">No hay usuarios registrados.</td>
                </tr>
              ) : (
                users.map((user, index) => (
                  <tr key={user.id} className="group hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        {user.avatarType === 'initials' ? (
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md
                            ${index % 3 === 0 ? 'bg-gradient-to-br from-blue-500 to-purple-600' : ''}
                            ${index % 3 === 1 ? 'bg-surface-hover border border-border-dark text-text-secondary' : ''}
                            ${index % 3 === 2 ? 'bg-gradient-to-br from-indigo-500 to-blue-600' : ''}
                          `}>
                            {user.initials}
                          </div>
                        ) : (
                          <img alt={`${user.name} portrait`} className="h-10 w-10 rounded-full object-cover border border-border-dark" src={user.img} />
                        )}
                        <div>
                          <div className="text-sm font-semibold text-white">{user.name}</div>
                          <div className="text-sm text-text-secondary">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="relative inline-block text-left">
                        <span className="inline-flex justify-between items-center w-36 rounded-md border border-border-dark shadow-sm px-3 py-1.5 bg-background-dark text-sm font-medium text-white">
                          <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full 
                              ${user.roleColor === 'purple' ? 'bg-purple-500' : ''}
                              ${user.roleColor === 'emerald' ? 'bg-emerald-500' : ''}
                              ${user.roleColor === 'amber' ? 'bg-amber-500' : ''}
                              ${user.roleColor === 'cyan' ? 'bg-cyan-500' : ''}
                            `}></span>
                            {user.role}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={user.status === 'Active'}
                          onChange={() => toggleUserStatus(user.id)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        <span className={`ml-3 text-sm font-medium ${user.status === 'Active' ? 'text-white' : 'text-text-secondary'}`}>
                          {user.status === 'Active' ? 'Activo' : 'Bloqueado'}
                        </span>
                      </label>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                      {user.lastActive}
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

      <InviteUserModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onInvite={handleInvite}
      />
    </div>
  );
};

export default Team;