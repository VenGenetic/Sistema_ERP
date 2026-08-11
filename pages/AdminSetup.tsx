import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../components/ui';

const AdminSetup: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const navigate = useNavigate();

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) throw error;

            setMessage({ type: 'success', text: 'Usuario administrador creado correctamente. Revisa tu correo para confirmar (si es necesario) o intenta iniciar sesión.' });
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Error al crear usuario' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg flex items-center justify-center px-4">
            <div className="max-w-md w-full bg-surface rounded-xl shadow-lg p-8 border border-subtle">
                <h2 className="text-xl font-bold text-fg mb-6 text-center tracking-tight">
                    Configuración Inicial: Crear Admin
                </h2>

                {message && (
                    <div
                        role="alert"
                        className={`mb-4 p-3 rounded-lg text-sm border ${message.type === 'success' ? 'bg-success-soft text-success-soft-fg border-success/20' : 'bg-danger-soft text-danger-soft-fg border-danger/20'}`}
                    >
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSignUp} className="space-y-4">
                    <Input
                        label="Correo Electrónico"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <Input
                        label="Contraseña"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        hint="Mínimo 6 caracteres."
                    />
                    <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
                        {loading ? 'Creando…' : 'Crear Usuario Admin'}
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default AdminSetup;
