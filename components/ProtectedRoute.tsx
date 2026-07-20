import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SessionTimeoutHandler from './SessionTimeoutHandler';
import { shouldRedirectToMobile } from '../utils/deviceDetection';

const ProtectedRoute: React.FC = () => {
    const { loading, authenticated } = useAuth();
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

    // Redirección automática a modo móvil (/mobile) si es un dispositivo móvil y no está en modo escritorio forzado
    const isMobileRoute = location.pathname.startsWith('/mobile');
    if (!isMobileRoute && shouldRedirectToMobile()) {
        return <Navigate to="/mobile" replace />;
    }

    return (
        <>
            <SessionTimeoutHandler />
            <Outlet />
        </>
    );
};

export default ProtectedRoute;
