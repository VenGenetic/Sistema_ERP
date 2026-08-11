import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  LogOut,
  ShieldCheck,
  User,
} from 'lucide-react';

const HeaderAccount: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const navigate = useNavigate();

    useEffect(() => {
        let subscription: any;

        const getData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);

            if (user) {
                // Fetch initial profile data
                const { data } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (data) setProfile(data);

                // Subscribe to realtime changes
                const channel = supabase
                    .channel('header_profile_updates')
                    .on(
                        'postgres_changes',
                        {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'profiles',
                            filter: `id=eq.${user.id}`,
                        },
                        (payload) => {
                            console.log('Profile updated!', payload.new);
                            setProfile(payload.new);
                        }
                    )
                    .subscribe();

                subscription = channel;
            }
        };

        getData();

        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            if (subscription) supabase.removeChannel(subscription);
        };
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const getInitials = () => {
        const name = profile?.full_name || user?.user_metadata?.full_name;
        if (name) return name.substring(0, 2).toUpperCase();
        if (user?.email) return user.email.substring(0, 2).toUpperCase();
        return 'U';
    };

    // Derived display values
    const displayName = profile?.nickname || profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario';
    const displayEmail = user?.email || '';
    const avatarUrl = profile?.avatar_url;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-surface-hover transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
            >
                <div className="flex flex-col items-end hidden md:flex">
                    <span className="text-sm font-bold text-fg leading-none">{displayName}</span>
                    <span className="text-2xs text-fg-muted font-mono">{displayEmail}</span>
                </div>

                {avatarUrl ? (
                    <div className="w-9 h-9 rounded-full bg-background-dark border border-border-dark overflow-hidden shadow-lg shadow-primary/20">
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-primary/20">
                        {getInitials()}
                    </div>
                )}

                <ChevronDown size={18} className="text-fg-subtle transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}" aria-hidden="true" />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-surface rounded-xl shadow-xl border border-subtle overflow-hidden z-50 transform origin-top-right transition-all">

                    {/* Header del Dropdown */}
                    <div className="p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5">
                        <div className="flex items-center gap-3">
                            {avatarUrl ? (
                                <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden shadow-lg">
                                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-white shadow-lg">
                                    {getInitials()}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-fg truncate">{displayName}</p>
                                <p className="text-xs text-fg-muted truncate">{displayEmail}</p>
                            </div>
                        </div>
                        <div className="mt-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                                Administrador
                            </span>
                        </div>
                    </div>

                    {/* Opciones del Menú */}
                    <div className="p-2 space-y-0.5">
                        <Link to="/settings?tab=general" className="flex items-center gap-3 px-3 py-2.5 text-sm text-fg-muted hover:bg-surface-hover hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors group" onClick={() => setIsOpen(false)}>
                            <User size={20} className="text-fg-subtle group-hover:text-primary transition-colors" aria-hidden="true" />
                            Mi Perfil
                        </Link>
                        <Link to="/settings?tab=account" className="flex items-center gap-3 px-3 py-2.5 text-sm text-fg-muted hover:bg-surface-hover hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors group" onClick={() => setIsOpen(false)}>
                            <ShieldCheck size={20} className="text-fg-subtle group-hover:text-primary transition-colors" aria-hidden="true" />
                            Configuración de Cuenta
                        </Link>
                        <div className="h-px bg-slate-100 dark:bg-white/5 mx-2 my-1"></div>
                    </div>

                    {/* Logout */}
                    <div className="p-2">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-danger hover:bg-danger-soft hover:text-danger rounded-lg transition-colors"
                        >
                            <LogOut size={20} aria-hidden="true" />
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HeaderAccount;
