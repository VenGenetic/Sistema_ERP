import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';

const MobileLayout: React.FC = () => {
    return (
        <div className="flex flex-col h-screen w-full bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans">
            {/* Header / Top Bar (Optional, can be specific to each page) */}
            
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
                    <ul className="relative flex justify-around items-center px-4 py-2">
                        <li>
                            <NavLink
                                to="/mobile"
                                end
                                className={({ isActive }) =>
                                    `flex flex-col items-center justify-center p-2 min-w-[64px] rounded-2xl transition-all duration-300 ${
                                        isActive
                                            ? 'text-blue-600 dark:text-blue-400 font-semibold transform scale-110'
                                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <span className={`material-symbols-outlined text-[24px] mb-1 transition-all duration-300 ${isActive ? 'font-variation-fill-1 drop-shadow-md' : ''}`}>
                                            home
                                        </span>
                                        <span className="text-[10px] uppercase tracking-wider font-medium">Inicio</span>
                                    </>
                                )}
                            </NavLink>
                        </li>
                        <li>
                            <NavLink
                                to="/mobile/catalog"
                                className={({ isActive }) =>
                                    `flex flex-col items-center justify-center p-2 min-w-[64px] rounded-2xl transition-all duration-300 ${
                                        isActive
                                            ? 'text-blue-600 dark:text-blue-400 font-semibold transform scale-110'
                                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <span className={`material-symbols-outlined text-[24px] mb-1 transition-all duration-300 ${isActive ? 'font-variation-fill-1 drop-shadow-md' : ''}`}>
                                            view_cozy
                                        </span>
                                        <span className="text-[10px] uppercase tracking-wider font-medium">Catálogo</span>
                                    </>
                                )}
                            </NavLink>
                        </li>
                        <li className="relative -top-6">
                            <NavLink
                                to="/mobile/inventory"
                                className={({ isActive }) =>
                                    `flex flex-col items-center justify-center w-16 h-16 rounded-full shadow-xl shadow-blue-500/40 transition-all duration-300 border-4 border-slate-50 dark:border-slate-900 ${
                                        isActive
                                            ? 'bg-blue-700 text-white transform scale-105'
                                            : 'bg-gradient-to-tr from-blue-600 to-blue-400 text-white hover:opacity-90'
                                    }`
                                }
                            >
                                <span className="material-symbols-outlined text-[28px]">
                                    qr_code_scanner
                                </span>
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
                .font-variation-fill-1 {
                    font-variation-settings: 'FILL' 1;
                }
            `}</style>
        </div>
    );
};

export default MobileLayout;
