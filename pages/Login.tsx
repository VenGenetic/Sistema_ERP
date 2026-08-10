import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { shouldRedirectToMobile } from '../utils/deviceDetection';

type AuthMode = 'password' | 'forgot' | 'magic_link';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [authMode, setAuthMode] = useState<AuthMode>('password');
    const [resetMessage, setResetMessage] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResetMessage(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            // Check role in profiles
            const { data: profile } = await supabase
                .from('profiles')
                .select('role_id')
                .eq('id', data.session?.user.id)
                .single();

            // Si es un dispositivo móvil y no tiene preferencia forzada de escritorio, redirigir a /mobile
            if (shouldRedirectToMobile()) {
                navigate('/mobile', { replace: true });
            } else if (profile && profile.role_id === 2) {
                // Vendedor / Cashier
                navigate('/rep-dashboard', { replace: true });
            } else {
                // Admin or others
                navigate('/', { replace: true });
            }
        } catch (err: any) {
            setError(err.message || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResetMessage(null);

        if (!email) {
            setError('Por favor, ingresa tu correo electrónico para restablecer la contraseña.');
            setLoading(false);
            return;
        }

        try {
            // Include hash in the redirect URL since we use HashRouter
            const redirectUrl = `${window.location.origin}${window.location.pathname}#/auth/reset-password`;
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: redirectUrl,
            });

            if (error) throw error;

            setResetMessage('Te hemos enviado un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada.');
        } catch (err: any) {
            setError(err.message || 'Error al solicitar el restablecimiento');
        } finally {
            setLoading(false);
        }
    };

    const handleMagicLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResetMessage(null);

        if (!email) {
            setError('Por favor, ingresa tu correo electrónico.');
            setLoading(false);
            return;
        }

        try {
            const redirectUrl = `${window.location.origin}${window.location.pathname}#/auth/confirm`;
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: redirectUrl,
                },
            });

            if (error) throw error;

            setResetMessage('¡Enlace mágico enviado! Revisa tu bandeja de entrada para ingresar directamente sin contraseña.');
        } catch (err: any) {
            setError(err.message || 'Error al enviar el enlace mágico');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        if (authMode === 'password') handleLogin(e);
        else if (authMode === 'forgot') handleForgotPassword(e);
        else if (authMode === 'magic_link') handleMagicLink(e);
    };

    return (
        <div className="bg-dark-bg font-display antialiased text-fg min-h-screen flex flex-col">
            <div className="flex flex-1 flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
                <div className="w-full max-w-md bg-surface shadow-lg rounded-xl overflow-hidden border border-subtle">
                    <div className="px-8 pt-10 pb-6 flex flex-col items-center">
                        <div className="h-16 w-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 shadow-[0_0_15px_rgba(24,119,242,0.15)]">
                            <span className="material-symbols-outlined text-4xl text-primary drop-shadow-md">
                                {authMode === 'magic_link' ? 'auto_awesome' : 'inventory_2'}
                            </span>
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-center text-fg">
                            {authMode === 'password' && 'Iniciar Sesión en el Sistema ERP'}
                            {authMode === 'forgot' && 'Recuperar Contraseña'}
                            {authMode === 'magic_link' && 'Acceso con Enlace Mágico'}
                        </h2>
                        <p className="mt-2 text-sm text-gray-400 text-center">
                            {authMode === 'password' && 'Centro de Control de Inventario y Dropshipping'}
                            {authMode === 'forgot' && 'Ingresa tu correo para enviarte las instrucciones'}
                            {authMode === 'magic_link' && 'Ingresa sin contraseña directamente desde tu correo'}
                        </p>
                    </div>
                    <div className="px-8 pb-10">
                        {error && (
                            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                                {error}
                            </div>
                        )}
                        {resetMessage && (
                            <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm text-center">
                                {resetMessage}
                            </div>
                        )}
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium leading-6 text-gray-300" htmlFor="email">
                                    Correo electrónico
                                </label>
                                <div className="relative mt-2 rounded-md shadow-sm group">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <span className="material-symbols-outlined text-gray-500 text-[20px] transition-colors group-focus-within:text-primary">mail</span>
                                    </div>
                                    <input
                                        className="block w-full rounded-lg border border-dark-border bg-dark-input py-3 pl-10 text-fg placeholder:text-gray-600 focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm sm:leading-6 transition-all duration-200"
                                        id="email"
                                        name="email"
                                        placeholder="nombre@compania.com"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            
                            {authMode === 'password' && (
                                <div>
                                    <div className="flex items-center justify-between">
                                        <label className="block text-sm font-medium leading-6 text-gray-300" htmlFor="password">
                                            Contraseña
                                        </label>
                                    </div>
                                    <div className="relative mt-2 rounded-md shadow-sm group">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <span className="material-symbols-outlined text-gray-500 text-[20px] transition-colors group-focus-within:text-primary">lock</span>
                                        </div>
                                        <input
                                            className="block w-full rounded-lg border border-dark-border bg-dark-input py-3 pl-10 pr-10 text-fg placeholder:text-gray-600 focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm sm:leading-6 transition-all duration-200"
                                            id="password"
                                            name="password"
                                            placeholder="••••••••"
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 z-10">
                                            <button 
                                                className="text-gray-500 hover:text-gray-300 focus:outline-none transition-colors" 
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                            >
                                                <span className="material-symbols-outlined text-[20px]">
                                                    {showPassword ? "visibility" : "visibility_off"}
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <button
                                    disabled={loading}
                                    className="flex w-full justify-center rounded-lg gradient-btn px-3 py-3 text-sm font-semibold leading-6 text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    type="submit"
                                >
                                    {loading 
                                        ? 'Procesando...' 
                                        : authMode === 'password' 
                                            ? 'Iniciar Sesión' 
                                            : authMode === 'forgot' 
                                                ? 'Enviar enlace de recuperación' 
                                                : 'Enviar Enlace Mágico ✨'}
                                </button>
                            </div>
                        </form>

                        <div className="mt-6 flex flex-col gap-2 text-center text-sm">
                            {authMode === 'password' && (
                                <>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setAuthMode('magic_link');
                                            setError(null);
                                            setResetMessage(null);
                                        }}
                                        className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors flex items-center justify-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                                        Ingresar con Enlace Mágico (Sin contraseña)
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setAuthMode('forgot');
                                            setError(null);
                                            setResetMessage(null);
                                        }}
                                        className="font-medium text-gray-400 hover:text-primary transition-colors mt-1"
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                </>
                            )}

                            {(authMode === 'forgot' || authMode === 'magic_link') && (
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setAuthMode('password');
                                        setError(null);
                                        setResetMessage(null);
                                    }}
                                    className="font-medium text-gray-400 hover:text-primary transition-colors"
                                >
                                    ← Volver al inicio de sesión con contraseña
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="border-t border-subtle bg-surface-2 py-4 px-8 flex items-center justify-between text-xs text-fg-muted">
                        <div className="flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400/50 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Conexión Segura
                        </div>
                        <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                            <span className="material-symbols-outlined text-[16px]">bolt</span>
                            <span>Impulsado por Supabase</span>
                        </div>
                    </div>
                </div>
                <p className="mt-10 text-center text-xs text-gray-600">
                    © 2024 Enterprise ERP Systems Inc. Todos los derechos reservados.
                </p>
            </div>
        </div>
    );
};

export default Login;
