import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { setPreferredViewMode } from '../../utils/deviceDetection';
import { getPrintQueue } from '../../utils/mobilePrintQueue';
import { useProformaStore } from '../../store/useProformaStore';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { Download, FileText, House, LayoutGrid, Monitor, Printer, ScanLine, Smartphone, X } from 'lucide-react';

/** Un solo sitio para el estilo de las pestañas: activo = ámbar y algo más grande. */
const navItem = (isActive: boolean) =>
    `flex flex-col items-center justify-center gap-0.5 px-2 min-w-[56px] min-h-[56px] rounded-2xl transition-all duration-300 ${
        isActive ? 'text-amber-400 font-semibold scale-110' : 'text-slate-500 active:text-slate-200'
    }`;

const MobileLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [queueCount, setQueueCount] = useState(0);
    // El store persiste en localStorage, así que el contador sobrevive a
    // recargas y refleja lo agregado desde el catálogo sin pedir nada a la red.
    const proformaCount = useProformaStore(s => s.items.length);

    const { canInstall, promptInstall } = useInstallPrompt();
    // El descarte se recuerda entre sesiones: quien ya dijo que no, no debería
    // volver a ver el aviso cada vez que abre el sistema.
    const [installDismissed, setInstallDismissed] = useState(() => {
        try {
            return localStorage.getItem('install_prompt_dismissed') === 'true';
        } catch {
            return false;
        }
    });

    const dismissInstall = () => {
        setInstallDismissed(true);
        try {
            localStorage.setItem('install_prompt_dismissed', 'true');
        } catch {
            // Modo privado: se oculta igual durante esta sesión.
        }
    };

    const handleInstall = async () => {
        const outcome = await promptInstall();
        // Rechazar el diálogo del navegador también cuenta como "no me
        // interesa": insistir en cada visita sería molesto.
        if (outcome === 'dismissed') dismissInstall();
    };

    const refreshQueueCount = useCallback(async () => {
        const queue = await getPrintQueue();
        setQueueCount(queue.reduce((total, item) => total + item.quantity, 0));
    }, []);

    // Se refresca al montar y en cada cambio de ruta (por ejemplo al volver del
    // catálogo después de encolar). El efecto de montaje aparte sobraba: éste ya
    // corre en la primera pasada.
    useEffect(() => {
        refreshQueueCount();
    }, [location.pathname, refreshQueueCount]);

    // Refresh instantly on any queue mutation, even without navigating away
    // (e.g. adding several items from the catalog without leaving the page).
    useEffect(() => {
        window.addEventListener('print-queue-changed', refreshQueueCount);
        return () => window.removeEventListener('print-queue-changed', refreshQueueCount);
    }, [refreshQueueCount]);

    /*
        Tema oscuro forzado mientras dure el modo móvil.

        Los modales que esta parte comparte con el escritorio —editar producto,
        demanda, etiquetas, edición en lote, sourcing, equivalentes...— se pintan
        con tokens semánticos (`bg-surface`, `text-fg`) que siguen el tema del
        escritorio. Con el tema claro activo, cada uno se abría en blanco dentro
        de una interfaz que MASTER.md fija en `slate-950`: exactamente el fallo
        que MobileSearchBar documenta haber arreglado en su campo y su panel.

        La clase `dark` en <html> es lo único que decide esos tokens (ver
        utils/theme.ts), así que se pone al entrar y se devuelve al salir. La
        preferencia guardada del usuario no se toca: al volver al escritorio
        manda otra vez la suya.
    */
    useEffect(() => {
        const root = document.documentElement;
        const wasDark = root.classList.contains('dark');
        root.classList.add('dark');
        return () => {
            if (!wasDark) root.classList.remove('dark');
        };
    }, []);

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
                <div className="flex items-center gap-2">
                    {/*
                        La barra inferior ya está llena con cuatro destinos, así que
                        la proforma entra por aquí. Se muestra siempre, no sólo con
                        ítems: el catálogo ofrece «A proforma» en cada repuesto y sin
                        este acceso no habría dónde ver lo agregado.
                    */}
                    <NavLink
                        to="/mobile/proforma"
                        aria-label={proformaCount > 0 ? `Proforma, ${proformaCount} ítems` : 'Proforma'}
                        className={({ isActive }) =>
                            `relative flex items-center gap-1.5 text-xs font-semibold min-h-[44px] px-3.5 rounded-full border transition-colors ${
                                isActive
                                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                                    : 'bg-slate-900 text-slate-300 border-slate-800 active:bg-slate-800 active:text-white'
                            }`
                        }
                    >
                        <FileText size={14} aria-hidden="true" />
                        <span>Proforma</span>
                        {proformaCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-amber-500 text-slate-950 text-xs font-black rounded-full border-2 border-slate-950">
                                {proformaCount}
                            </span>
                        )}
                    </NavLink>
                    {/*
                        «Escritorio» se queda como icono a secas: es una salida de
                        emergencia que se usa una vez al día, y ocupaba tanto como
                        la proforma, que es donde se trabaja. El sitio que libera
                        se lo lleva la pastilla de la proforma.
                    */}
                    <button
                        onClick={handleSwitchToDesktop}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-slate-900 text-slate-400 rounded-full border border-slate-800 active:bg-slate-800 active:text-white active:border-amber-500/40 transition-colors"
                        aria-label="Ver versión completa de escritorio"
                    >
                        <Monitor size={16} aria-hidden="true" />
                    </button>
                </div>
            </header>

            {/*
                Invitación a instalar. Sólo aparece cuando Chrome confirma que el
                sitio es instalable y todavía no lo está; se descarta y no vuelve
                a molestar. Va aquí y no en la cabecera porque un tercer botón
                junto a «Proforma» y «Escritorio» no entra en pantallas angostas.
            */}
            {canInstall && !installDismissed && (
                <div className="mx-3 mt-2 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                    <Download size={18} className="text-amber-400 shrink-0" aria-hidden="true" />
                    <p className="flex-1 text-xs font-semibold text-slate-200 leading-snug">
                        Instala LV Parts en tu teléfono para abrirlo como una app
                    </p>
                    <button
                        onClick={handleInstall}
                        className="shrink-0 min-h-[36px] px-3 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold active:bg-amber-600"
                    >
                        Instalar
                    </button>
                    <button
                        onClick={dismissInstall}
                        aria-label="No instalar por ahora"
                        className="shrink-0 p-1.5 text-slate-500 active:text-slate-300"
                    >
                        <X size={16} aria-hidden="true" />
                    </button>
                </div>
            )}

            {/* Main Content Area */}
            {/* data-mobile-scroll: aquí vive el scroll del modo móvil (no en <body>).
                Las hojas inferiores lo congelan por su nombre mientras están abiertas. */}
            <main data-mobile-scroll className="flex-1 overflow-y-auto pb-nav-safe hide-scrollbar scroll-smooth">
                <div className="max-w-md mx-auto w-full h-full relative">
                    <Outlet />
                </div>
            </main>

            {/* Bottom Navigation Bar */}
            {/*
                z-[45]: por encima de la cabecera pegajosa y las barras flotantes de
                la página (z-30/z-40), pero por debajo de CUALQUIER modal (z-50+).
                Los modales del catálogo (registrar demanda, editar, etiquetas...) no
                usan un portal — se renderizan dentro de <main>, antes que este <nav>
                en el DOM — así que con el mismo z-index ganaba esta barra por venir
                después en el árbol: tapaba media pantalla del modal sin que hubiera
                nada que desplazar para alcanzar el botón de abajo.
            */}
            <nav className="fixed bottom-0 left-0 w-full z-[45] px-2 pb-safe pt-2">
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
                                        <span className="text-xs uppercase tracking-wide font-medium leading-none">Inicio</span>
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
                                        <span className="text-xs uppercase tracking-wide font-medium leading-none">Catálogo</span>
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
                                    <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] flex items-center justify-center bg-slate-950 text-amber-300 text-xs font-black rounded-full border-2 border-amber-300 shadow-md">
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
                                        <span className="text-xs uppercase tracking-wide font-medium leading-none">Inventario</span>
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
