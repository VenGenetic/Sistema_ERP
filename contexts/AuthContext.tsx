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
              full_name,
              nickname,
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
                        // The user requested that all devices can access the POS concurrently
                        // and not be logged out. We disable the aggressive sign out here.
                        // await handleSignOutAggressive();
                        console.warn("Multiple sessions detected but aggressive sign-out is disabled.");
                    }
                }
            } catch (err) {
                console.error('Error in session check:', err);
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
                (payload) => {
                    const updatedSessionId = payload.new.current_session_id;
                    if (updatedSessionId && updatedSessionId !== localSessionId) {
                        // user requested multiple concurrent sessions
                        // handleSignOutAggressive();
                        console.warn("Multiple sessions detected via realtime but aggressive sign-out is disabled.");
                    }
                }
            )
            .subscribe();

        // 2. Verificación inmediata cuando el usuario vuelve a enfocar la pestaña
        // (el polling periódico por setInterval se retiró: la suscripción
        // realtime de arriba ya notifica el mismo cambio al instante, y
        // sondear cada 10s a `profiles` en cada sesión activa era trabajo
        // redundante sin beneficio adicional)
        const handleFocus = () => {
            checkSessionDb();
        };
        window.addEventListener('focus', handleFocus);

        // Verificación inicial inmediata
        checkSessionDb();

        return () => {
            channel.unsubscribe();
            window.removeEventListener('focus', handleFocus);
        };
    }, [session?.user?.id, userProfile]);

    const permissions = (userProfile?.roles?.permissions as Permissions) || null;
    const isAdmin = true;
    const isCloser = false;
    const isSourcingManager = false;
    const isWarehouse = false;
    const isSalesMonitor = false;

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
