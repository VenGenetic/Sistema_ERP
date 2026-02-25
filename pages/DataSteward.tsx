import React, { useState, useEffect } from 'react';
import { Database, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

interface DraftProduct {
    id: number;
    sku: string;
    name: string;
    price: number;
    demand_count: number;
    created_at: string;
}

const DataSteward: React.FC = () => {
    const { session } = useAuth();
    const user = session?.user;
    const [drafts, setDrafts] = useState<DraftProduct[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDrafts();
    }, []);

    const fetchDrafts = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, sku, name, price, demand_count, created_at')
                .eq('status', 'draft')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDrafts(data || []);
        } catch (error) {
            console.error("Error fetching drafts:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (draftId: number) => {
        if (!user) return alert("Usuario no autenticado");

        try {
            const { error } = await supabase
                .from('products')
                .update({ status: 'official' })
                .eq('id', draftId);

            if (error) throw error;

            alert("Producto aprobado y convertido en Oficial (M3 triggers should fire if implemented correctly in DB).");

            // Optionally, we could call the RPC manually if the trigger isn't sufficient
            // await supabase.rpc('award_gamification_points', { p_user_id: user.id, p_role_id: 3, p_order_item_id: null, p_points: 5, p_milestone: 'M3_Data' });

            setDrafts(prev => prev.filter(d => d.id !== draftId));
        } catch (error) {
            console.error("Error approving draft:", error);
            alert("Error al aprobar producto.");
        }
    };

    const handleReject = async (draftId: number) => {
        try {
            // Either delete or mark as rejected
            const { error } = await supabase
                .from('products')
                .update({ status: 'rejected' })
                .eq('id', draftId);

            if (error) throw error;
            alert("Producto rechazado.");
            setDrafts(prev => prev.filter(d => d.id !== draftId));
        } catch (error) {
            console.error("Error rejecting draft:", error);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] p-6 bg-slate-50 dark:bg-[#0d1117] overflow-hidden gap-4">
            <div className="flex justify-between items-center z-10">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <Database className="text-blue-500" />
                        Data Steward (M3)
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Aprobación de Productos Draft a Oficiales.</p>
                </div>
            </div>

            <div className="flex-1 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-blue-50 dark:bg-blue-900/10">
                    <h2 className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2">Productos Pendientes de Normalización</h2>
                </div>

                <div className="flex-1 p-4 overflow-y-auto">
                    {loading ? <p className="text-slate-500">Cargando...</p> :
                        drafts.length === 0 ? <p className="text-slate-500 text-center py-10">No hay productos en estado draft.</p> :
                            (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500">
                                            <th className="pb-2 font-medium">SKU (Draft)</th>
                                            <th className="pb-2 font-medium">Nombre Solicitado</th>
                                            <th className="pb-2 font-medium">Precio Est.</th>
                                            <th className="pb-2 font-medium">Demanda</th>
                                            <th className="pb-2 font-medium text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {drafts.map(draft => (
                                            <tr key={draft.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-[#0c1117] transition-colors">
                                                <td className="py-3 font-mono text-sm text-slate-500">{draft.sku}</td>
                                                <td className="py-3 font-medium text-slate-900 dark:text-white">{draft.name}</td>
                                                <td className="py-3 font-mono text-slate-700 dark:text-slate-300">${draft.price.toFixed(2)}</td>
                                                <td className="py-3">
                                                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded">
                                                        {draft.demand_count}
                                                    </span>
                                                </td>
                                                <td className="py-3 flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleReject(draft.id)}
                                                        className="bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-700 p-2 rounded transition-colors"
                                                        title="Rechazar"
                                                    >
                                                        <XCircle size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleApprove(draft.id)}
                                                        className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1.5 rounded text-sm font-bold flex items-center gap-1 transition-colors"
                                                    >
                                                        <CheckCircle size={16} /> Normalizar / Aprobar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )
                    }
                </div>
            </div>
        </div>
    );
};

export default DataSteward;
