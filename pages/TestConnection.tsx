import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import {
  Wifi,
} from 'lucide-react';

const TestConnection: React.FC = () => {
    const [status, setStatus] = useState<string>('Probando...');
    const [error, setError] = useState<string | null>(null);
    const [envCheck, setEnvCheck] = useState<any>({});
    const [pingResult, setPingResult] = useState<string>('Esperando...');

    useEffect(() => {
        checkConnection();
    }, []);

    const checkConnection = async () => {
        setStatus('Iniciando diagnóstico...');
        setError(null);

        // 1. Verificación de Variables de Entorno
        const envVars = {
            VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'Definido' : 'Faltante',
            VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Definido (Oculto)' : 'Faltante',
        };
        setEnvCheck(envVars);

        // 2. Prueba Básica de Fetch (Ping)
        try {
            const url = import.meta.env.VITE_SUPABASE_URL;
            if (!url) throw new Error('URL de Supabase no definida');

            setPingResult('Haciendo fetch a ' + url + '...');
            // Supabase postgrest endpoint usually responds to /rest/v1/ with proper headers or 404/401 depending on config,
            // but the root URL might return 404 or welcome.
            // Let's try to fetch the health check or just the root.
            const response = await fetch(url, { method: 'HEAD' }).catch(e => {
                // Fetch might fail with CORS if we just hit root, but it proves network activity
                throw e;
            });
            setPingResult(`Fetch status: ${response.status} ${response.statusText}`);
        } catch (e: any) {
            setPingResult(`Error de Fetch: ${e.message}`);
        }

        // 3. Prueba de Cliente Supabase (Auth)
        try {
            const { data, error } = await supabase.auth.getSession();
            if (error) {
                setStatus('Error de conexión a Supabase');
                setError(error.message);
                console.error('Supabase Error:', error);
            } else {
                setStatus('Conexión a Supabase Exitosa');
                console.log('Session Data:', data);
            }
        } catch (e: any) {
            setStatus('Excepción crítica al conectar');
            setError(e.message);
            console.error('Exception:', e);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-2xl mx-auto bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
                <h1 className="text-2xl font-bold mb-6 text-primary flex items-center gap-2">
                    <Wifi size={18} aria-hidden="true" />
                    Diagnóstico de Conexión
                </h1>

                <div className="space-y-6">
                    {/* Estado General */}
                    <div className={`p-4 rounded-lg border ${error ? 'bg-danger/30 border-danger/50' : 'bg-success/30 border-success/50'}`}>
                        <h2 className="text-lg font-semibold mb-2">Estado de Autenticación</h2>
                        <p className="text-xl">{status}</p>
                        {error && <p className="mt-2 text-danger font-mono text-sm break-all">{error}</p>}
                    </div>

                    {/* Variables de Entorno */}
                    <div className="bg-gray-700/50 p-4 rounded-lg">
                        <h2 className="text-lg font-semibold mb-2 text-fg-subtle">Variables de Entorno</h2>
                        <ul className="space-y-1 font-mono text-sm">
                            {Object.entries(envCheck).map(([key, val]) => (
                                <li key={key} className="flex justify-between">
                                    <span className="text-fg-subtle">{key}:</span>
                                    <span className={val === 'Faltante' ? 'text-danger' : 'text-success'}>{val as string}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Prueba de Red Directa */}
                    <div className="bg-gray-700/50 p-4 rounded-lg">
                        <h2 className="text-lg font-semibold mb-2 text-fg-subtle">Prueba de Red Directa (Fetch)</h2>
                        <p className="font-mono text-sm">{pingResult}</p>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            onClick={checkConnection}
                            className="px-4 py-2 bg-primary hover:bg-primary rounded-lg font-medium transition-colors"
                        >
                            Reintentar
                        </button>
                        <Link
                            to="/login"
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-medium transition-colors"
                        >
                            Volver al Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TestConnection;
