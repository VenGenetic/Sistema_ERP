import React from 'react';
import { useNavigate } from 'react-router-dom';

const MobileDashboard: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="p-6 h-full flex flex-col pt-12 animate-fade-in">
            {/* Header */}
            <div className="mb-8">
                <div className="flex justify-between items-center mb-2">
                    <h1 className="text-3xl font-black text-white tracking-tight">
                        Hola,
                    </h1>
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 rounded-full bg-slate-900 border border-slate-800 shadow-sm text-slate-500 hover:text-amber-400 transition-colors"
                        title="Volver al escritorio"
                    >
                        <span className="material-symbols-outlined text-xl">desktop_windows</span>
                    </button>
                </div>
                <p className="text-slate-400">Bienvenido a la versión móvil</p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <button
                    onClick={() => navigate('/mobile/catalog')}
                    className="flex flex-col items-center justify-center p-6 bg-slate-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-slate-800 hover:border-amber-500/30 transition-all active:scale-95"
                >
                    <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-[32px] font-variation-fill-1">view_cozy</span>
                    </div>
                    <span className="font-semibold text-white">Catálogo</span>
                    <span className="text-xs text-slate-500 mt-1">Explorar stock</span>
                </button>

                <button
                    onClick={() => navigate('/mobile/inventory')}
                    className="flex flex-col items-center justify-center p-6 bg-slate-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-slate-800 hover:border-cyan-500/30 transition-all active:scale-95"
                >
                    <div className="w-14 h-14 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-[32px] font-variation-fill-1">qr_code_scanner</span>
                    </div>
                    <span className="font-semibold text-white">Inventario</span>
                    <span className="text-xs text-slate-500 mt-1">Ajuste rápido</span>
                </button>
            </div>

            {/* Labels Quick Action - Full Width, Primary */}
            <button
                onClick={() => navigate('/mobile/labels')}
                className="w-full flex items-center gap-4 p-5 bg-gradient-to-r from-amber-500 to-amber-400 rounded-3xl shadow-[0_8px_30px_rgba(245,158,11,0.25)] hover:shadow-[0_8px_30px_rgba(245,158,11,0.4)] transition-all active:scale-[0.98] text-slate-950 mb-8"
            >
                <div className="w-14 h-14 rounded-full bg-slate-950/10 flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                    <span className="material-symbols-outlined text-[32px] font-variation-fill-1">print</span>
                </div>
                <div className="flex-1 text-left">
                    <span className="font-black text-lg block">Imprimir Etiquetas</span>
                    <span className="text-slate-950/70 text-sm font-semibold">Buscar → Imprimir → Siguiente</span>
                </div>
                <span className="material-symbols-outlined text-slate-950/50 text-[28px]">arrow_forward</span>
            </button>

            {/* Tip */}
            <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800">
                <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-amber-400 mt-0.5">lightbulb</span>
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
