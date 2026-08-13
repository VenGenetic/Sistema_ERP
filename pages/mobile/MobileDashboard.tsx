import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, LayoutGrid, Lightbulb, Monitor, Printer, ScanLine } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Nombre para saludar. El apodo manda sobre el nombre completo, y del nombre
 * completo solo se usa el primero: «Hola, Fernando» y no «Hola, Fernando Avila».
 */
const useGreetingName = () => {
    const { userProfile, session } = useAuth();
    const raw =
        userProfile?.nickname ||
        userProfile?.full_name ||
        session?.user?.user_metadata?.full_name ||
        session?.user?.email?.split('@')[0];
    return raw ? String(raw).trim().split(' ')[0] : null;
};

const MobileDashboard: React.FC = () => {
    const navigate = useNavigate();
    const name = useGreetingName();

    return (
        <div className="p-6 h-full flex flex-col pt-12 animate-fade-in">
            {/* Header */}
            <div className="mb-8">
                <div className="flex justify-between items-center mb-2">
                    <h1 className="text-3xl font-black text-white tracking-tight">
                        {name ? `Hola, ${name}` : 'Hola'}
                    </h1>
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 rounded-full bg-slate-900 border border-slate-800 shadow-sm text-slate-500 active:text-amber-400 active:bg-slate-800 transition-colors"
                        title="Volver al escritorio"
                        aria-label="Volver al escritorio"
                    >
                        <Monitor size={20} aria-hidden="true" />
                    </button>
                </div>
                <p className="text-slate-400">Bienvenido a la versión móvil</p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <button
                    onClick={() => navigate('/mobile/catalog')}
                    className="flex flex-col items-center justify-center p-6 bg-slate-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-slate-800 active:border-amber-500/30 transition-all active:scale-95"
                >
                    <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
                        <LayoutGrid size={30} aria-hidden="true" />
                    </div>
                    <span className="font-semibold text-white">Catálogo</span>
                    <span className="text-xs text-slate-500 mt-1">Explorar stock</span>
                </button>

                <button
                    onClick={() => navigate('/mobile/inventory')}
                    className="flex flex-col items-center justify-center p-6 bg-slate-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-slate-800 active:border-cyan-500/30 transition-all active:scale-95"
                >
                    <div className="w-14 h-14 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3">
                        <ScanLine size={30} aria-hidden="true" />
                    </div>
                    <span className="font-semibold text-white">Inventario</span>
                    <span className="text-xs text-slate-500 mt-1">Ajuste rápido</span>
                </button>
            </div>

            {/* Labels Quick Action - Full Width, Primary */}
            <button
                onClick={() => navigate('/mobile/labels')}
                className="w-full flex items-center gap-4 p-5 bg-gradient-to-r from-amber-500 to-amber-400 rounded-3xl shadow-[0_8px_30px_rgba(245,158,11,0.25)] transition-all active:scale-[0.98] active:shadow-[0_8px_30px_rgba(245,158,11,0.4)] text-slate-950 mb-8"
            >
                <div className="w-14 h-14 rounded-full bg-slate-950/10 flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                    <Printer size={30} aria-hidden="true" />
                </div>
                <div className="flex-1 text-left">
                    <span className="font-black text-lg block">Imprimir Etiquetas</span>
                    <span className="text-slate-950/70 text-sm font-semibold">Buscar → Imprimir → Siguiente</span>
                </div>
                <ArrowRight size={26} className="text-slate-950/50" aria-hidden="true" />
            </button>

            {/* Tip */}
            <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800">
                <div className="flex items-start gap-3">
                    <Lightbulb size={22} className="text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
                    <div>
                        <h3 className="font-semibold text-white mb-1">Flujo Rápido</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Usa <strong className="text-slate-300">Imprimir Etiquetas</strong> para escanear o buscar un repuesto, imprimir sus códigos de barras, y pasar al siguiente automáticamente.
                        </p>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.4s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default MobileDashboard;
