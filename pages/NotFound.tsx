import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

const NotFound: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B0F1A] p-4 font-['Outfit',sans-serif]">
            <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
                {/* Error Code */}
                <div className="relative">
                    <h1 className="text-[150px] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-blue-500/20 to-blue-600/5 select-none">
                        404
                    </h1>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-32 h-32 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
                    </div>
                </div>

                {/* Message */}
                <div className="space-y-3 relative z-10">
                    <h2 className="text-3xl font-bold text-white tracking-tight">
                        Página No Encontrada
                    </h2>
                    <p className="text-gray-400 text-lg">
                        Lo sentimos, la página que estás buscando no existe o ha sido movida.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all active:scale-95 group"
                    >
                        <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                        <span>Volver Atrás</span>
                    </button>

                    <button
                        onClick={() => navigate('/')}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 group"
                    >
                        <Home className="w-5 h-5 transition-transform group-hover:-translate-y-1" />
                        <span>Ir al Inicio</span>
                    </button>
                </div>

                {/* Decorative elements */}
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
                    <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[120px]"></div>
                    <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-purple-600/5 rounded-full blur-[120px]"></div>
                </div>
            </div>
        </div>
    );
};

export default NotFound;
