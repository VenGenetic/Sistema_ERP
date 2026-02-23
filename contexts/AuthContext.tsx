import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Session } from '@supabase/supabase-js';

type Permissions = Record<string, { read?: boolean; write?: boolean }>;

interface UserProfile {
    id: string;
    role_id: number | null;
    roles?: {
        name: string;
        permissions: any;
    } | null;
    [key: string]: any;
}

interface AuthContextType {
    session: Session | null;
    userProfile: UserProfile | null;
    permissions: Permissions | null;
    isAdmin: boolean;
    isCloser: boolean;
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

    const permissions = (userProfile?.roles?.permissions as Permissions) || null;
    const isAdmin = userProfile?.roles?.name === 'Admin' || userProfile?.role_id === 1;
    const isCloser = userProfile?.roles?.name === 'Closer' || userProfile?.role_id === 2;

    const value: AuthContextType = {
        session,
        userProfile,
        permissions,
        isAdmin,
        isCloser,
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
