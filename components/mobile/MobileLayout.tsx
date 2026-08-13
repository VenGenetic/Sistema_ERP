import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { setPreferredViewMode } from '../../utils/deviceDetection';
import { getPrintQueue } from '../../utils/mobilePrintQueue';
import { House, LayoutGrid, Monitor, Printer, ScanLine, Smartphone } from 'lucide-react';

/** Un solo sitio para el estilo de las pestañas: activo = ámbar y algo más grande. */
const navItem = (isActive: boolean) =>
    `flex flex-col items-center justify-center p-2 min-w-[56px] rounded-2xl transition-all duration-300 ${
        isActive ? 'text-amber-400 font-semibold scale-110' : 'text-slate-500 active:text-slate-200'
    }`;

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
        <div className="flex flex-col h-dvh-screen w-full bg-slate-950 overflow-hidden font-sans">
            {/* Header / Top Bar */}
            <header className="bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 text-white px-4 py-2 flex items-center justify-between z-40">
                <div className="flex items-center gap-2">
                    <Smartphone size={18} className="text-amber-400" aria-hidden="true" />
                    <span className="text-xs font-bold tracking-widest uppercase text-slate-300">Modo Móvil</span>
                </div>
                <button
                    onClick={handleSwitchToDesktop}
                    className="flex items-center gap-1.5 text-xs bg-slate-900 text-slate-300 px-2.5 py-1.5 rounded-full border border-slate-800 active:bg-slate-800 active:text-white active:border-amber-500/40 transition-colors"
                    title="Ver versión completa de escritorio"
                >
                    <Monitor size={14} aria-hidden="true" />
                    <span>Escritorio</span>
                </button>
            </header>

            {/* Main Content Area */}
            {/* data-mobile-scroll: aquí vive el scroll del modo móvil (no en <body>).
                Las hojas inferiores lo congelan por su nombre mientras están abiertas. */}
            <main data-mobile-scroll className="flex-1 overflow-y-auto pb-nav-safe hide-scrollbar scroll-smooth">
                <div className="max-w-md mx-auto w-full h-full relative">
                    <Outlet />
                </div>
            </main>

            {/* Bottom Navigation Bar */}
            <nav className="fixed bottom-0 left-0 w-full z-50 px-2 pb-safe pt-2">
                <div className="max-w-md mx-auto relative">
                    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl border border-slate-800/70 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.5)] rounded-3xl"></div>
                {/*
                    Cuatro destinos, no cinco: «Escritorio» estaba aquí y en la cabecera,
                    y gastaba uno de los pocos huecos de la barra. Se queda solo arriba.
                */}
                    <ul className="relative flex justify-around items-center px-2 py-2">
                        <li>
                            <NavLink to="/mobile" end className={({ isActive }) => navItem(isActive)}>
                                {({ isActive }) => (
                                    <>
                                        <House
                                            size={22}
                                            strokeWidth={isActive ? 2.5 : 2}
                                            className={`mb-0.5 transition-all duration-300 ${isActive ? 'drop-shadow-md' : ''}`}
                                            aria-hidden="true"
                                        />
                                        <span className="text-[9px] uppercase tracking-wider font-medium">Inicio</span>
                                    </>
                                )}
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/mobile/catalog" className={({ isActive }) => navItem(isActive)}>
                                {({ isActive }) => (
                                    <>
                                        <LayoutGrid
                                            size={22}
                                            strokeWidth={isActive ? 2.5 : 2}
                                            className={`mb-0.5 transition-all duration-300 ${isActive ? 'drop-shadow-md' : ''}`}
                                            aria-hidden="true"
                                        />
                                        <span className="text-[9px] uppercase tracking-wider font-medium">Catálogo</span>
                                    </>
                                )}
                            </NavLink>
                        </li>
                        <li className="relative -top-5">
                            <NavLink
                                to="/mobile/labels"
                                aria-label="Imprimir etiquetas"
                                className={({ isActive }) =>
                                    `flex flex-col items-center justify-center w-[60px] h-[60px] rounded-full shadow-xl shadow-amber-500/30 transition-all duration-300 border-4 border-slate-950 ${
                                        isActive
                                            ? 'bg-amber-600 text-slate-950 scale-105'
                                            : 'bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 active:opacity-90'
                                    }`
                                }
                            >
                                <Printer size={26} strokeWidth={2.25} aria-hidden="true" />
                                {queueCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] flex items-center justify-center bg-slate-950 text-amber-300 text-[10px] font-black rounded-full border-2 border-amber-300 shadow-md">
                                        {queueCount}
                                    </span>
                                )}
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/mobile/inventory" className={({ isActive }) => navItem(isActive)}>
                                {({ isActive }) => (
                                    <>
                                        <ScanLine
                                            size={22}
                                            strokeWidth={isActive ? 2.5 : 2}
                                            className={`mb-0.5 transition-all duration-300 ${isActive ? 'drop-shadow-md' : ''}`}
                                            aria-hidden="true"
                                        />
                                        <span className="text-[9px] uppercase tracking-wider font-medium">Inventario</span>
                                    </>
                                )}
                            </NavLink>
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
            `}</style>
        </div>
    );
};

export default MobileLayout;
