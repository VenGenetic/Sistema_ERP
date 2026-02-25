import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SessionTimeoutHandler from './SessionTimeoutHandler';

const ProtectedRoute: React.FC = () => {
    const { loading, authenticated, userProfile, isAdmin, permissions } = useAuth();
    const location = useLocation();

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
        return (
            <>
                <SessionTimeoutHandler />
                <Outlet />
            </>
        );
    }

    // Default Denial Logic based on permissions JSON
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const topLevelRoute = pathSegments[0];

    // Módulos que requieren permisos explícitos
    const protectedModules = ['team', 'customers', 'products', 'inventory', 'orders', 'dispatch', 'commissions', 'finance', 'settings'];

    if (topLevelRoute === 'data-steward') {
        // Solo Admin o Compras / Supply Chain (role_id === 6)
        if (!isAdmin && userProfile?.role_id !== 6) {
            console.warn(`[RBAC] Acceso denegado a módulo: ${topLevelRoute}`);
            return <Navigate to="/" replace />;
        }
    } else if (topLevelRoute && protectedModules.includes(topLevelRoute)) {
        // If not Admin, check permissions object
        if (!isAdmin) {
            const hasAccess = permissions?.[topLevelRoute]?.read === true;
            if (!hasAccess) {
                console.warn(`[RBAC] Acceso denegado a módulo: ${topLevelRoute}`);
                return <Navigate to="/" replace />;
            }
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
