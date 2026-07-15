import React from 'react';
import { useNavigate } from 'react-router-dom';

const MobileDashboard: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="p-6 h-full flex flex-col pt-12 animate-fade-in">
            {/* Header */}
            <div className="mb-8">
                <div className="flex justify-between items-center mb-2">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                        Hola,
                    </h1>
                    <button 
                        onClick={() => navigate('/')} 
                        className="p-2 rounded-full bg-white dark:bg-slate-800 shadow-sm text-slate-500 hover:text-primary transition-colors"
                        title="Volver al escritorio"
                    >
                        <span className="material-symbols-outlined text-xl">desktop_windows</span>
                    </button>
                </div>
                <p className="text-slate-500 dark:text-slate-400">Bienvenido a la versión móvil</p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <button
                    onClick={() => navigate('/mobile/catalog')}
                    className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-slate-100 dark:border-slate-700/50 hover:border-blue-200 transition-all active:scale-95"
                >
                    <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-[32px] font-variation-fill-1">view_cozy</span>
                    </div>
                    <span className="font-semibold text-slate-800 dark:text-white">Catálogo</span>
                    <span className="text-xs text-slate-400 mt-1">Explorar stock</span>
                </button>

                <button
                    onClick={() => navigate('/mobile/inventory')}
                    className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-600 to-blue-500 rounded-3xl shadow-[0_8px_30px_rgba(37,99,235,0.2)] hover:shadow-[0_8px_30px_rgba(37,99,235,0.3)] transition-all active:scale-95 text-white"
                >
                    <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-3 backdrop-blur-sm">
                        <span className="material-symbols-outlined text-[32px] font-variation-fill-1">qr_code_scanner</span>
                    </div>
                    <span className="font-semibold">Inventario</span>
                    <span className="text-xs text-blue-100 mt-1">Escanear</span>
                </button>
            </div>

            {/* Recent Info / Tips */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-3xl border border-blue-100 dark:border-blue-900/30">
                <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-blue-500 mt-0.5">lightbulb</span>
                    <div>
                        <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">Tip de Inventario</h3>
                        <p className="text-sm text-blue-700/80 dark:text-blue-300/80 leading-relaxed">
                            Usa la pantalla de Inventario para ajustar cantidades rápidas físicamente mientras recorres la bodega.
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
