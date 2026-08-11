import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { EmailOtpType } from '@supabase/supabase-js';

const AuthConfirm: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [error, setError] = useState<string | null>(null);
    const [verifying, setVerifying] = useState(true);

    useEffect(() => {
        const verifyToken = async () => {
            const token_hash = searchParams.get('token_hash');
            const type = searchParams.get('type') as EmailOtpType | null;

            if (!token_hash || !type) {
                // Si no hay hash, comprobamos si ya hay sesión (quizás llegaron por magic link directo)
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    navigate('/');
                } else {
                    setError('Enlace inválido o expirado.');
                    setVerifying(false);
                }
                return;
            }

            try {
                const { error } = await supabase.auth.verifyOtp({
                    token_hash,
                    type,
                });

                if (error) throw error;

                // Redireccionar según el tipo
                if (type === 'recovery') {
                    navigate('/auth/reset-password');
                } else {
                    navigate('/');
                }
            } catch (err: any) {
                console.error('Error verifying OTP:', err);
                setError(err.message || 'Error al verificar el enlace.');
            } finally {
                setVerifying(false);
            }
        };

        verifyToken();
    }, [navigate, searchParams]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
            <div className="max-w-md w-full text-center space-y-6">
                {verifying ? (
                    <>
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                        <h2 className="text-2xl font-bold">Verificando...</h2>
                        <p className="text-fg-subtle">
                            Estamos confirmando tu acceso. Por favor espera.
                        </p>
                    </>
                ) : error ? (
                    <div className="bg-danger/10 border border-danger text-danger p-4 rounded-lg">
                        <h3 className="font-bold mb-2">Error de Verificación</h3>
                        <p className="text-sm">{error}</p>
                        <button
                            onClick={() => navigate('/login')}
                            className="mt-4 px-4 py-2 bg-danger hover:bg-danger rounded transition-colors text-sm"
                        >
                            Volver al inicio
                        </button>
                    </div>
                ) : (
                    <p className="text-success">¡Verificación exitosa!</p>
                )}
            </div>
        </div>
    );
};

export default AuthConfirm;
