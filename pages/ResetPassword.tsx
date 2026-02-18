import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const ResetPassword: React.FC = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: 'Las contraseñas no coinciden' });
            return;
        }

        setLoading(true);
        setMessage(null);

        const { error } = await supabase.auth.updateUser({
            password: password
        });

        if (error) {
            setMessage({ type: 'error', text: error.message });
            setLoading(false);
        } else {
            setMessage({ type: 'success', text: 'Contraseña actualizada con éxito. Redirigiendo...' });
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4 font-sans">
            <div className="max-w-md w-full bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700">
                <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                    Nueva Contraseña
                </h2>

                <p className="text-gray-400 text-center mb-8 text-sm">
                    Introduce tu nueva contraseña para recuperar el acceso a tu cuenta.
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Confirmar Contraseña</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    {message && (
                        <div className={`p-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/50' : 'bg-red-500/10 text-red-400 border border-red-500/50'
                            }`}>
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-3 rounded-lg transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                    >
                        {loading ? 'Actualizando...' : 'Cambiar Contraseña'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;
