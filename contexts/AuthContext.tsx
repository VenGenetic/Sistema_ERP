import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Session } from '@supabase/supabase-js';

type Permissions = Record<string, { read?: boolean; write?: boolean }>;

interface UserProfile {
    id: string;
    role_id: number | null;
    current_session_id?: string | null;
    roles?: {
        name: string;
        permissions: any;
    } | null;
    [key: string]: any;
}

const getOrCreateDeviceSessionId = () => {
    let id = localStorage.getItem('device_session_id');
    if (!id) {
        id = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('device_session_id', id);
    }
    return id;
};

interface AuthContextType {
    session: Session | null;
    userProfile: UserProfile | null;
    permissions: Permissions | null;
    isAdmin: boolean;
    isCloser: boolean;
    isSourcingManager: boolean;
    isWarehouse: boolean;
    isSalesMonitor: boolean;
    loading: boolean;
    authenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const fetchSessionAndProfile = async () => {
            try {
                const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) throw sessionError;

                if (currentSession) {
                    if (mounted) setSession(currentSession);

                    // Obtener el perfil y el rol del usuario, incluyendo los permisos
                    const { data: profile, error: profileError } = await supabase
                        .from('profiles')
                        .select(`
              id,
              role_id,
              current_session_id,
              roles (
                name,
                permissions
              )
            `)
                        .eq('id', currentSession.user.id)
                        .single();

                    if (profileError) {
                        console.error('Error fetching user profile:', profileError);
                    } else if (mounted && profile) {
                        const localSessionId = getOrCreateDeviceSessionId();
                        if (profile.current_session_id !== localSessionId) {
                            await supabase
                                .from('profiles')
                                .update({ current_session_id: localSessionId })
                                .eq('id', currentSession.user.id);
                        }
                        
                        setUserProfile(profile as unknown as UserProfile);
                    }
                } else {
                    if (mounted) setSession(null);
                }
            } catch (error) {
                console.error('Error in fetchSessionAndProfile:', error);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchSessionAndProfile();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
            if (mounted) {
                setSession(currentSession);
                if (!currentSession) {
                    setUserProfile(null);
                    setLoading(false);
                } else {
                    // If a user just signed in or token refreshed, we might want to refetch profile
                    // But usually getSession inside fetchSessionAndProfile handles initial load
                    fetchSessionAndProfile();
                }
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (!session?.user?.id || !userProfile) return;

        const localSessionId = getOrCreateDeviceSessionId();

        const handleSignOutAggressive = async () => {
            await supabase.auth.signOut();
            localStorage.removeItem('device_session_id');
            alert("Tu sesión ha sido iniciada en otro dispositivo.");
            window.location.href = '/';
        };

        const checkSessionDb = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('current_session_id')
                    .eq('id', session.user.id)
                    .single();

                if (!error && data) {
                    if (data.current_session_id && data.current_session_id !== localSessionId) {
                        await handleSignOutAggressive();
                    }
                }
            } catch (err) {
                console.error('Error in aggressive session check:', err);
            }
        };

        // 1. Suscripción en Tiempo Real (Notificación inmediata)
        const channel = supabase
            .channel(`profile-session-${session.user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${session.user.id}`,
                },
                async (payload) => {
                    const dbSessionId = payload.new.current_session_id;
                    if (dbSessionId && dbSessionId !== localSessionId) {
                        await handleSignOutAggressive();
                    }
                }
            )
            .subscribe();

        // 2. Intervalo de verificación (Cada 10 segundos)
        const interval = setInterval(checkSessionDb, 10000);

        // 3. Verificación inmediata cuando el usuario vuelve a enfocar la pestaña
        const handleFocus = () => {
            checkSessionDb();
        };
        window.addEventListener('focus', handleFocus);

        // Verificación inicial inmediata
        checkSessionDb();

        return () => {
            channel.unsubscribe();
            clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
        };
    }, [session?.user?.id, userProfile]);

    const permissions = (userProfile?.roles?.permissions as Permissions) || null;
    const isAdmin = userProfile?.roles?.name === 'Admin' || userProfile?.role_id === 1;
    const isCloser = userProfile?.roles?.name === 'Closer' || userProfile?.role_id === 2;
    const isSourcingManager = userProfile?.roles?.name === 'Sourcing Manager' || userProfile?.role_id === 3;
    const isWarehouse = userProfile?.roles?.name === 'Warehouse' || userProfile?.role_id === 4;
    const isSalesMonitor = userProfile?.roles?.name === 'Sales Monitor' || userProfile?.role_id === 5;

    const value: AuthContextType = {
        session,
        userProfile,
        permissions,
        isAdmin,
        isCloser,
        isSourcingManager,
        isWarehouse,
        isSalesMonitor,
        loading,
        authenticated: !!session,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
