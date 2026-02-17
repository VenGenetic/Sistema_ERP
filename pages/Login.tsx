import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            navigate('/');
        } catch (err: any) {
            setError(err.message || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-dark-bg font-display antialiased text-slate-100 min-h-screen flex flex-col">
            <div className="flex flex-1 flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
                <div className="w-full max-w-md bg-dark-card shadow-glow rounded-xl overflow-hidden border border-white/10">
                    <div className="px-8 pt-10 pb-6 flex flex-col items-center">
                        <div className="h-16 w-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 shadow-[0_0_15px_rgba(24,119,242,0.15)]">
                            <span className="material-symbols-outlined text-4xl text-primary drop-shadow-md">inventory_2</span>
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-center text-white">
                            Iniciar Sesión en el Sistema ERP
                        </h2>
                        <p className="mt-2 text-sm text-gray-400 text-center">
                            Centro de Control de Inventario y Dropshipping
                        </p>
                    </div>
                    <div className="px-8 pb-10">
                        {error && (
                            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                                {error}
                            </div>
                        )}
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium leading-6 text-gray-300" htmlFor="email">
                                    Correo electrónico
                                </label>
                                <div className="relative mt-2 rounded-md shadow-sm group">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <span className="material-symbols-outlined text-gray-500 text-[20px] transition-colors group-focus-within:text-primary">mail</span>
                                    </div>
                                    <input
                                        className="block w-full rounded-lg border border-dark-border bg-dark-input py-3 pl-10 text-white placeholder:text-gray-600 focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm sm:leading-6 transition-all duration-200"
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
                                        className="block w-full rounded-lg border border-dark-border bg-dark-input py-3 pl-10 text-white placeholder:text-gray-600 focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm sm:leading-6 transition-all duration-200"
                                        id="password"
                                        name="password"
                                        placeholder="••••••••"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                        <button className="text-gray-500 hover:text-gray-300 focus:outline-none transition-colors" type="button">
                                            <span className="material-symbols-outlined text-[20px]">visibility_off</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <button
                                    disabled={loading}
                                    className="flex w-full justify-center rounded-lg gradient-btn px-3 py-3 text-sm font-semibold leading-6 text-white shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    type="submit"
                                >
                                    {loading ? 'Iniciando...' : 'Iniciar Sesión'}
                                </button>
                            </div>
                        </form>
                        <div className="mt-6 text-center">
                            <a className="text-sm font-medium text-gray-400 hover:text-primary transition-colors" href="#">
                                ¿Olvidaste tu contraseña?
                            </a>
                        </div>
                    </div>
                    <div className="border-t border-white/5 bg-[#1a1a1a] py-4 px-8 flex items-center justify-between text-xs text-gray-500">
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
