import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient'; // Adjusted path if moved to components/settings

const AccountPanel: React.FC = () => {
    const [user, setUser] = useState<any>(null);
    const [email, setEmail] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [verifying, setVerifying] = useState(false);
    const [loadingEmail, setLoadingEmail] = useState(false);
    const [loadingPass, setLoadingPass] = useState(false);

    const [message, setMessage] = useState<{ type: 'success' | 'info' | 'error', text: string } | null>(null);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);
                setEmail(user.email || '');
            }
        };
        getUser();
    }, []);

    const handleResendVerification = async () => {
        if (!user?.email) return;
        try {
            setVerifying(true);
            setMessage(null);

            // Supabase auth.resend doesn't exactly exist in v2 the same way for verify, usually it's just requesting the same auth action or using update.
            // But usually we can re-request verification by trying to update the email to itself or using a specific endpoint if configured.
            // A common workaround is attempting a signup again which triggers "user already registered" or utilizing reset password flow, OR using the explicitly documented way:
            // Actually, for a logged in user whose email is not confirmed, we can use:
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: user.email,
            })

            if (error) throw error;
            setMessage({ type: 'success', text: 'Correo de verificación reenviado. Revisa tu bandeja.' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setVerifying(false);
        }
    };

    const handleUpdateEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoadingEmail(true);
            setMessage(null);

            const { error } = await supabase.auth.updateUser({ email: newEmail });
            if (error) throw error;

            setMessage({ type: 'info', text: 'Se ha enviado un correo de confirmación a ambas direcciones (actual y nueva) para verificar el cambio.' });
            setNewEmail('');
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoadingEmail(false);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Las contraseñas no coinciden.' });
            return;
        }
        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres.' });
            return;
        }

        try {
            setLoadingPass(true);
            setMessage(null);

            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;

            setMessage({ type: 'success', text: 'Tu contraseña ha sido actualizada correctamente.' });
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoadingPass(false);
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-fade-in max-w-3xl">
            {/* Feedback Message */}
            {message && (
                <div className={`p-4 rounded-lg flex items-start gap-3 border ${message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                    message.type === 'info' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                        'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                    <span className="material-symbols-outlined text-[20px] mt-0.5">
                        {message.type === 'success' ? 'check_circle' : message.type === 'info' ? 'info' : 'error'}
                    </span>
                    <p className="text-sm">{message.text}</p>
                </div>
            )}

            {/* Verification Status */}
            <div className="bg-surface-dark border border-border-dark rounded-xl p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1">Estado de Verificación</h3>
                        <p className="text-sm text-text-secondary">Tu dirección de correo actual es <span className="text-white font-mono">{email}</span></p>
                    </div>
                    {user?.email_confirmed_at ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-bold border border-green-500/20">
                            <span className="material-symbols-outlined text-[16px]">verified</span>
                            Verificado
                        </span>
                    ) : (
                        <div className="flex flex-col items-end gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-bold border border-amber-500/20">
                                <span className="material-symbols-outlined text-[16px]">warning</span>
                                No Verificado
                            </span>
                            <button
                                onClick={handleResendVerification}
                                disabled={verifying}
                                className="text-xs text-primary hover:text-white transition-colors underline disabled:opacity-50"
                            >
                                {verifying ? 'Enviando...' : 'Reenviar correo'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Change Email */}
            <div className="bg-surface-dark border border-border-dark rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-6">Cambiar Correo Electrónico</h3>
                <form onSubmit={handleUpdateEmail} className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-text-secondary mb-1.5">Nuevo Correo</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 material-symbols-outlined text-text-secondary text-[20px]">mail</span>
                            <input
                                type="email"
                                required
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                className="w-full bg-background-dark border border-border-dark rounded-lg text-white text-sm py-2.5 pl-10 pr-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                placeholder="nuevo@ejemplo.com"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loadingEmail || !newEmail}
                        className="px-4 py-2.5 bg-surface-hover hover:bg-border-dark border border-border-dark text-white font-medium rounded-lg transition-colors mb-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loadingEmail ? '...' : 'Actualizar'}
                    </button>
                </form>
                <p className="text-xs text-text-secondary mt-3">
                    Se enviará un enlace de confirmación a tu nuevo correo.
                </p>
            </div>

            {/* Change Password */}
            <div className="bg-surface-dark border border-border-dark rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-6">Seguridad (Contraseña)</h3>
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1.5">Nueva Contraseña</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 material-symbols-outlined text-text-secondary text-[20px]">lock</span>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-background-dark border border-border-dark rounded-lg text-white text-sm py-2.5 pl-10 pr-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1.5">Confirmar Contraseña</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 material-symbols-outlined text-text-secondary text-[20px]">lock_reset</span>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-background-dark border border-border-dark rounded-lg text-white text-sm py-2.5 pl-10 pr-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={loadingPass || !newPassword || !confirmPassword}
                            className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loadingPass ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                                <span className="material-symbols-outlined text-[20px]">key</span>
                            )}
                            Cambiar Contraseña
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AccountPanel;
