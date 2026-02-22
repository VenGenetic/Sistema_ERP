import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

interface ApiKey {
    id: string;
    name: string;
    key_hash: string;
    provider: string;
    is_active: boolean;
    last_used_at: string | null;
    created_at: string;
}

const ApiKeysPanel: React.FC = () => {
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);

    // New Key Modal state
    const [showNewKeyModal, setShowNewKeyModal] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyProvider, setNewKeyProvider] = useState('external_vendor');
    const [generatedKeyValue, setGeneratedKeyValue] = useState<string | null>(null);

    useEffect(() => {
        fetchApiKeys();
    }, []);

    const fetchApiKeys = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('api_keys')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching API keys:', error);
            setError('Error al cargar las claves API.');
        } else {
            setApiKeys(data || []);
        }
        setLoading(false);
    };

    // Helper to generate a random API key
    const generateRandomKey = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = 'sk_';
        for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    const handleGenerateKey = async (e: React.FormEvent) => {
        e.preventDefault();
        setGenerating(true);
        setError(null);

        try {
            const rawKey = generateRandomKey();

            // In a real production app, we would hash this key before saving to DB.
            // For simplicity in this demo, since we only added key_hash without a hashing trigger,
            // we will store the raw key.
            const { data, error: insertError } = await supabase
                .from('api_keys')
                .insert([{
                    name: newKeyName,
                    key_hash: rawKey, // Storing raw key for easy retrieval in MVP
                    provider: newKeyProvider
                }])
                .select()
                .single();

            if (insertError) throw insertError;

            setGeneratedKeyValue(rawKey);
            setApiKeys([data, ...apiKeys]);
            setNewKeyName('');
        } catch (err: any) {
            console.error('Error creating API key:', err);
            setError('Error al crear la clave: ' + err.message);
        } finally {
            setGenerating(false);
        }
    };

    const handleRevokeKey = async (id: string) => {
        if (!confirm('¿Estás seguro de que deseas revocar esta clave? Esta acción no se puede deshacer.')) return;

        try {
            const { error } = await supabase
                .from('api_keys')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setApiKeys(apiKeys.filter(k => k.id !== id));
        } catch (err: any) {
            console.error('Error deleting API key:', err);
            alert('Error al eliminar la clave: ' + err.message);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Copiado al portapapeles');
    };

    return (
        <div className="bg-surface-dark border border-border-dark rounded-xl p-6 mt-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-white">Claves API (API Keys)</h3>
                    <p className="text-sm text-text-secondary mt-1">
                        Gestiona el acceso de aplicaciones externas a tu sistema.
                    </p>
                </div>
                <button
                    onClick={() => { setShowNewKeyModal(true); setGeneratedKeyValue(null); }}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]">key</span>
                    Generar Clave
                </button>
            </div>

            {error && (
                <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
            ) : apiKeys.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-border-dark rounded-lg">
                    <span className="material-symbols-outlined text-4xl text-text-secondary mb-2">vpn_key_off</span>
                    <p className="text-text-secondary">No hay claves API generadas.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-text-secondary">
                        <thead className="text-xs text-text-secondary uppercase bg-background-dark/50">
                            <tr>
                                <th className="px-4 py-3 font-medium">Nombre</th>
                                <th className="px-4 py-3 font-medium">Clave</th>
                                <th className="px-4 py-3 font-medium">Proveedor</th>
                                <th className="px-4 py-3 font-medium">Último Uso</th>
                                <th className="px-4 py-3 font-medium text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {apiKeys.map((key) => (
                                <tr key={key.id} className="border-b border-border-dark hover:bg-background-dark/20 transition-colors">
                                    <td className="px-4 py-3 font-medium text-white">{key.name}</td>
                                    <td className="px-4 py-3 font-mono text-xs">
                                        <div className="flex items-center gap-2">
                                            {/* We only show a preview to simulate hashed keys, though we stored raw for demo */}
                                            <span>{key.key_hash.substring(0, 8)}...</span>
                                            <button
                                                onClick={() => copyToClipboard(key.key_hash)}
                                                className="text-primary hover:text-white"
                                                title="Copiar Clave Completa"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="bg-surface-hover px-2 py-1 rounded text-xs">{key.provider}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Nunca'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleRevokeKey(key.id)}
                                            className="text-red-500 hover:text-red-400 p-1"
                                            title="Revocar"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal for new key */}
            {showNewKeyModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-surface-dark border border-border-dark rounded-xl w-full max-w-md overflow-hidden shadow-xl">
                        <div className="p-6 border-b border-border-dark flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">Nueva Clave API</h2>
                            <button onClick={() => setShowNewKeyModal(false)} className="text-text-secondary hover:text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6">
                            {generatedKeyValue ? (
                                <div>
                                    <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-lg mb-6">
                                        <div className="flex items-center gap-2 mb-2 font-bold">
                                            <span className="material-symbols-outlined">check_circle</span>
                                            ¡Clave generada exitosamente!
                                        </div>
                                        <p className="text-sm">Por favor, copia tu nueva clave API. Por razones de seguridad, no podrás volver a verla completa una vez cierres esta ventana.</p>
                                    </div>

                                    <div className="bg-background-dark border border-border-dark rounded-lg p-4 flex justify-between items-center mb-6">
                                        <code className="text-white font-mono text-sm break-all">{generatedKeyValue}</code>
                                        <button
                                            onClick={() => copyToClipboard(generatedKeyValue)}
                                            className="ml-4 bg-surface-hover hover:bg-primary text-white p-2 rounded-lg transition-colors"
                                        >
                                            <span className="material-symbols-outlined">content_copy</span>
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => setShowNewKeyModal(false)}
                                        className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-2 rounded-lg transition-colors"
                                    >
                                        He guardado mi clave
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleGenerateKey} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-text-secondary mb-1">Nombre de la clave</label>
                                        <input
                                            type="text"
                                            required
                                            value={newKeyName}
                                            onChange={(e) => setNewKeyName(e.target.value)}
                                            placeholder="Ej: Integración Shopify"
                                            className="w-full bg-background-dark border border-border-dark rounded-lg text-white p-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-text-secondary mb-1">Proveedor / Uso</label>
                                        <select
                                            value={newKeyProvider}
                                            onChange={(e) => setNewKeyProvider(e.target.value)}
                                            className="w-full bg-background-dark border border-border-dark rounded-lg text-white p-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                        >
                                            <option value="external_vendor">Proveedor Externo</option>
                                            <option value="internal_scraper">Sincronización Interna (Scraper)</option>
                                            <option value="erp_integration">Integración ERP</option>
                                            <option value="other">Otro</option>
                                        </select>
                                    </div>

                                    <div className="pt-4 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowNewKeyModal(false)}
                                            className="px-4 py-2 text-text-secondary hover:text-white transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={generating}
                                            className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                                        >
                                            {generating ? (
                                                <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                                            ) : (
                                                <span className="material-symbols-outlined text-[18px]">key</span>
                                            )}
                                            Generar
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApiKeysPanel;
