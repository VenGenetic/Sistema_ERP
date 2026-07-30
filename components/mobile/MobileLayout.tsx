import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { setPreferredViewMode } from '../../utils/deviceDetection';
import { getPrintQueue } from '../../utils/mobilePrintQueue';

const MobileLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [queueCount, setQueueCount] = useState(0);

    const refreshQueueCount = useCallback(async () => {
        const queue = await getPrintQueue();
        setQueueCount(queue.length);
    }, []);

    useEffect(() => {
        refreshQueueCount();
    }, [refreshQueueCount]);

    // Refresh queue badge whenever the route changes (e.g., after adding from catalog)
    useEffect(() => {
        refreshQueueCount();
    }, [location.pathname, refreshQueueCount]);

    // Refresh instantly on any queue mutation, even without navigating away
    // (e.g. adding several items from the catalog without leaving the page).
    useEffect(() => {
        window.addEventListener('print-queue-changed', refreshQueueCount);
        return () => window.removeEventListener('print-queue-changed', refreshQueueCount);
    }, [refreshQueueCount]);

    const handleSwitchToDesktop = () => {
        setPreferredViewMode('desktop');
        navigate('/', { replace: true });
    };

    return (
        <div className="flex flex-col h-screen w-full bg-slate-950 overflow-hidden font-sans">
            {/* Header / Top Bar */}
            <header className="bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 text-white px-4 py-2 flex items-center justify-between z-40">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-400 text-xl">smartphone</span>
                    <span className="text-xs font-bold tracking-widest uppercase text-slate-300">Modo Móvil</span>
                </div>
                <button
                    onClick={handleSwitchToDesktop}
                    className="flex items-center gap-1 text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-2.5 py-1 rounded-full border border-slate-800 hover:border-amber-500/40 transition-colors"
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
                    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl border border-slate-800/70 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.5)] rounded-3xl"></div>
                    <ul className="relative flex justify-around items-center px-2 py-2">
                        <li>
                            <NavLink
                                to="/mobile"
                                end
                                className={({ isActive }) =>
                                    `flex flex-col items-center justify-center p-2 min-w-[56px] rounded-2xl transition-all duration-300 ${
                                        isActive
                                            ? 'text-amber-400 font-semibold transform scale-110'
                                            : 'text-slate-500 hover:text-slate-200'
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
                                            ? 'text-amber-400 font-semibold transform scale-110'
                                            : 'text-slate-500 hover:text-slate-200'
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
                                    `flex flex-col items-center justify-center w-[60px] h-[60px] rounded-full shadow-xl shadow-amber-500/30 transition-all duration-300 border-4 border-slate-950 ${
                                        isActive
                                            ? 'bg-amber-600 text-slate-950 transform scale-105'
                                            : 'bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 hover:opacity-90'
                                    }`
                                }
                            >
                                <span className="material-symbols-outlined text-[26px] font-variation-fill-1">
                                    print
                                </span>
                                {queueCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] flex items-center justify-center bg-slate-950 text-amber-300 text-[10px] font-black rounded-full border-2 border-amber-300 shadow-md">
                                        {queueCount}
                                    </span>
                                )}
                            </NavLink>
                        </li>
                        <li>
                            <NavLink
                                to="/mobile/inventory"
                                className={({ isActive }) =>
                                    `flex flex-col items-center justify-center p-2 min-w-[56px] rounded-2xl transition-all duration-300 ${
                                        isActive
                                            ? 'text-amber-400 font-semibold transform scale-110'
                                            : 'text-slate-500 hover:text-slate-200'
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
                                className="flex flex-col items-center justify-center p-2 min-w-[56px] rounded-2xl text-slate-500 hover:text-slate-200 transition-all duration-300"
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
