import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { setPreferredViewMode } from '../../utils/deviceDetection';

const MobileLayout: React.FC = () => {
    const navigate = useNavigate();

    const handleSwitchToDesktop = () => {
        setPreferredViewMode('desktop');
        navigate('/', { replace: true });
    };

    return (
        <div className="flex flex-col h-screen w-full bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans">
            {/* Header / Top Bar */}
            <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 text-white px-4 py-2 flex items-center justify-between z-40">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-400 text-xl">smartphone</span>
                    <span className="text-xs font-semibold tracking-wide uppercase text-slate-300">Modo Móvil</span>
                </div>
                <button
                    onClick={handleSwitchToDesktop}
                    className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-full border border-slate-700 transition-colors"
                    title="Ver versión completa de escritorio"
                >
                    <span className="material-symbols-outlined text-sm">desktop_windows</span>
                    <span>Escritorio</span>
                </button>
            </header>
            
            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto pb-[72px] hide-scrollbar scroll-smooth">
                <div className="max-w-md mx-auto w-full h-full relative">
                    <Outlet />
                </div>
            </main>

            {/* Bottom Navigation Bar */}
            <nav className="fixed bottom-0 left-0 w-full z-50 px-2 pb-4 pt-2">
                <div className="max-w-md mx-auto relative">
                    <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.1)] rounded-3xl"></div>
                    <ul className="relative flex justify-around items-center px-2 py-2">
                        <li>
                            <NavLink
                                to="/mobile"
                                end
                                className={({ isActive }) =>
                                    `flex flex-col items-center justify-center p-2 min-w-[56px] rounded-2xl transition-all duration-300 ${
                                        isActive
                                            ? 'text-blue-600 dark:text-blue-400 font-semibold transform scale-110'
                                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <span className={`material-symbols-outlined text-[22px] mb-0.5 transition-all duration-300 ${isActive ? 'font-variation-fill-1 drop-shadow-md' : ''}`}>
                                            home
                                        </span>
                                        <span className="text-[9px] uppercase tracking-wider font-medium">Inicio</span>
                                    </>
                                )}
                            </NavLink>
                        </li>
                        <li>
                            <NavLink
                                to="/mobile/catalog"
                                className={({ isActive }) =>
                                    `flex flex-col items-center justify-center p-2 min-w-[56px] rounded-2xl transition-all duration-300 ${
                                        isActive
                                            ? 'text-blue-600 dark:text-blue-400 font-semibold transform scale-110'
                                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <span className={`material-symbols-outlined text-[22px] mb-0.5 transition-all duration-300 ${isActive ? 'font-variation-fill-1 drop-shadow-md' : ''}`}>
                                            view_cozy
                                        </span>
                                        <span className="text-[9px] uppercase tracking-wider font-medium">Catálogo</span>
                                    </>
                                )}
                            </NavLink>
                        </li>
                        <li className="relative -top-5">
                            <NavLink
                                to="/mobile/labels"
                                className={({ isActive }) =>
                                    `flex flex-col items-center justify-center w-[60px] h-[60px] rounded-full shadow-xl shadow-emerald-500/40 transition-all duration-300 border-4 border-slate-50 dark:border-slate-900 ${
                                        isActive
                                            ? 'bg-emerald-700 text-white transform scale-105'
                                            : 'bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white hover:opacity-90'
                                    }`
                                }
                            >
                                <span className="material-symbols-outlined text-[26px]">
                                    print
                                </span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink
                                to="/mobile/inventory"
                                className={({ isActive }) =>
                                    `flex flex-col items-center justify-center p-2 min-w-[56px] rounded-2xl transition-all duration-300 ${
                                        isActive
                                            ? 'text-blue-600 dark:text-blue-400 font-semibold transform scale-110'
                                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <span className={`material-symbols-outlined text-[22px] mb-0.5 transition-all duration-300 ${isActive ? 'font-variation-fill-1 drop-shadow-md' : ''}`}>
                                            qr_code_scanner
                                        </span>
                                        <span className="text-[9px] uppercase tracking-wider font-medium">Inventario</span>
                                    </>
                                )}
                            </NavLink>
                        </li>
                        <li>
                            <button
                                onClick={handleSwitchToDesktop}
                                className="flex flex-col items-center justify-center p-2 min-w-[56px] rounded-2xl text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-all duration-300"
                            >
                                <span className="material-symbols-outlined text-[22px] mb-0.5">
                                    desktop_windows
                                </span>
                                <span className="text-[9px] uppercase tracking-wider font-medium">Desktop</span>
                            </button>
                        </li>
                    </ul>
                </div>
            </nav>
            <style>{`
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .font-variation-fill-1 {
                    font-variation-settings: 'FILL' 1;
                }
            `}</style>
        </div>
    );
};

export default MobileLayout;
