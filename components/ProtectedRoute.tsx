import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import SessionTimeoutHandler from './SessionTimeoutHandler';

interface UserProfile {
    role_id: number | null;
    roles?: {
        name: string;
        permissions: any;
    };
}

const ProtectedRoute: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const location = useLocation();

    useEffect(() => {
        let mounted = true;

        const checkUserAndRole = async () => {
            try {
                // Log for debugging
                console.log("ProtectedRoute: Checking session...");

                // Timeout promise to prevent hanging
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Session check timed out")), 5000)
                );

                const sessionPromise = supabase.auth.getSession();
                const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as any;

                if (!session) {
                    if (mounted) {
                        setAuthenticated(false);
                        setLoading(false);
                    }
                    return;
                }

                // Obtener el perfil y el rol del usuario
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select(`
                        role_id,
                        roles (
                            name,
                            permissions
                        )
                    `)
                    .eq('id', session.user.id)
                    .single();

                if (error) {
                    console.error("ProtectedRoute: Error fetching profile", error);
                }

                if (mounted) {
                    console.log("ProtectedRoute: Session found:", !!session);
                    setAuthenticated(true);
                    setUserProfile(profile as any);
                    setLoading(false);
                }
            } catch (error) {
                console.error("ProtectedRoute Error:", error);
                if (mounted) {
                    setAuthenticated(false);
                    setLoading(false);
                }
            }
        };

        checkUserAndRole();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("ProtectedRoute: Auth state change:", event, !!session);
            if (event === 'SIGNED_OUT') {
                if (mounted) {
                    setAuthenticated(false);
                    setUserProfile(null);
                    setLoading(false);
                }
            } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                checkUserAndRole();
            } else if (mounted) {
                setAuthenticated(!!session);
                if (!session) {
                    setLoading(false);
                }
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-gray-400">Verificando permisos y sesión...</p>
                    <p className="text-xs text-gray-600 mt-2">Si esto tarda mucho, recarga la página.</p>
                </div>
            </div>
        );
    }

    if (!authenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    // Role Fencing: Prevent cashiers from accessing unallowed routes
    if (userProfile?.role_id === 2) {
        const allowedRoutes = ['/pos', '/rep-dashboard', '/settings'];
        const isAllowed = allowedRoutes.includes(location.pathname) || location.pathname.startsWith('/orders');

        if (!isAllowed) {
            return <Navigate to="/rep-dashboard" replace />;
        }
    }

    // Lógica de Autorización Específica (RBAC)
    const isCloser = userProfile?.roles?.name === 'Closer';
    const isFinanceRoute = location.pathname.startsWith('/finance');

    if (isCloser && isFinanceRoute) {
        console.warn("Acceso denegado: Los Closers no pueden acceder a Finanzas");
        return <Navigate to="/" replace />; // Redirigir al Dashboard
    }

    return (
        <>
            <SessionTimeoutHandler />
            <Outlet />
        </>
    );
};

export default ProtectedRoute;
