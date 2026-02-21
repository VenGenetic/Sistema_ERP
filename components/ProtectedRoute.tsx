import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import SessionTimeoutHandler from './SessionTimeoutHandler';

const ProtectedRoute: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);
    const [roleId, setRoleId] = useState<number | null>(null);
    const location = useLocation();

    useEffect(() => {
        let mounted = true;

        const checkUser = async () => {
            try {
                // Log for debugging
                console.log("ProtectedRoute: Checking session...");

                // Timeout promise to prevent hanging
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Session check timed out")), 5000)
                );

                const sessionPromise = supabase.auth.getSession();

                const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as any;

                if (session) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('role_id')
                        .eq('id', session.user.id)
                        .single();
                    if (profile) setRoleId(profile.role_id);
                }

                if (mounted) {
                    console.log("ProtectedRoute: Session found:", !!session);
                    setAuthenticated(!!session);
                    setLoading(false);
                }
            } catch (error) {
                console.error("ProtectedRoute: Error checking session:", error);
                if (mounted) {
                    setAuthenticated(false);
                    setLoading(false);
                }
            }
        };

        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("ProtectedRoute: Auth state change:", event, !!session);
            if (mounted) {
                setAuthenticated(!!session);
                setLoading(false);
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
                    <p className="text-sm text-gray-400">Verificando sesión...</p>
                    <p className="text-xs text-gray-600 mt-2">Si esto tarda mucho, recarga la página.</p>
                </div>
            </div>
        );
    }

    if (!authenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    // Role Fencing: Prevent cashiers from accessing unallowed routes
    if (roleId === 2) {
        const allowedRoutes = ['/pos', '/rep-dashboard', '/settings'];
        const isAllowed = allowedRoutes.includes(location.pathname) || location.pathname.startsWith('/orders');

        if (!isAllowed) {
            return <Navigate to="/rep-dashboard" replace />;
        }
    }

    return (
        <>
            <SessionTimeoutHandler />
            <Outlet />
        </>
    );
};

export default ProtectedRoute;
