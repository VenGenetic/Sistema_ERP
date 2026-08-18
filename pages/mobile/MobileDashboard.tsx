import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Download, FileText, LayoutGrid, Lightbulb, Printer, ScanLine, ShieldAlert, Smartphone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getPrintQueue, getQueueTotalLabels } from '../../utils/mobilePrintQueue';
import { getPrintHistory } from '../../utils/mobilePrintHistory';
import { useProformaStore } from '../../store/useProformaStore';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';

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

    /*
        La pantalla de inicio no decía nada: tres botones de navegación y un
        consejo fijo. Lo que importa al abrir la app es qué quedó a medias, y
        esos datos ya están en memoria —la cola en su caché de módulo, la
        proforma en su store— así que enseñarlos no cuesta ni una petición.
    */
    const proformaCount = useProformaStore(s => s.items.length);
    const [queueLabels, setQueueLabels] = useState(0);
    const [lastPrinted, setLastPrinted] = useState<string | null>(null);

    const refreshCounters = useCallback(async () => {
        setQueueLabels(getQueueTotalLabels(await getPrintQueue()));
        setLastPrinted(getPrintHistory()[0]?.sku ?? null);
    }, []);

    useEffect(() => { refreshCounters(); }, [refreshCounters]);

    useEffect(() => {
        window.addEventListener('print-queue-changed', refreshCounters);
        return () => window.removeEventListener('print-queue-changed', refreshCounters);
    }, [refreshCounters]);

    /*
        Instalación en la pantalla de inicio.

        El aviso de la cabecera sólo aparece cuando Chrome ofrece el evento, y
        se puede posponer. Esta entrada está siempre: si se puede instalar,
        instala; y si no, dice qué falta en vez de dejar al usuario buscando un
        botón que nunca existió.
    */
    const { canInstall, installed, blocker, promptInstall } = useInstallPrompt();
    const [installHelp, setInstallHelp] = useState(false);

    return (
        <div className="p-6 pt-12 pb-mobile-page min-h-full flex flex-col animate-fade-in">
            {/* Header */}
            <div className="mb-8">
                {/* «Escritorio» vivía aquí y también en la cabecera del layout,
                    que está en todas las pantallas. Se queda solo allí. */}
                <h1 className="text-3xl font-black text-white tracking-tight mb-2">
                    {name ? `Hola, ${name}` : 'Hola'}
                </h1>
                <p className="text-slate-400 text-sm">
                    {queueLabels > 0 || proformaCount > 0
                        ? 'Tienes trabajo a medias'
                        : 'Todo al día. Escanea para empezar.'}
                </p>

                {(queueLabels > 0 || proformaCount > 0) && (
                    <div className="flex flex-wrap gap-2 mt-3">
                        {queueLabels > 0 && (
                            <button
                                type="button"
                                onClick={() => navigate('/mobile/labels')}
                                className="min-h-[44px] px-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-bold flex items-center gap-2 active:bg-amber-500/20"
                            >
                                <Printer size={16} aria-hidden="true" />
                                {queueLabels} etiqueta{queueLabels !== 1 ? 's' : ''} en cola
                            </button>
                        )}
                        {proformaCount > 0 && (
                            <button
                                type="button"
                                onClick={() => navigate('/mobile/proforma')}
                                className="min-h-[44px] px-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-sm font-bold flex items-center gap-2 active:bg-slate-800"
                            >
                                <FileText size={16} aria-hidden="true" />
                                {proformaCount} ítem{proformaCount !== 1 ? 's' : ''} en proforma
                            </button>
                        )}
                    </div>
                )}
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
                    <span className="text-slate-950/70 text-sm font-semibold">
                        {lastPrinted ? `Último: ${lastPrinted}` : 'Buscar → Imprimir → Siguiente'}
                    </span>
                </div>
                <ArrowRight size={26} className="text-slate-950/50" aria-hidden="true" />
            </button>

            {/* Instalar en el teléfono */}
            {!installed && (
                <div className="bg-slate-900 rounded-3xl border border-slate-800 mb-4 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => (canInstall ? promptInstall() : setInstallHelp(v => !v))}
                        className="w-full flex items-center gap-3 p-5 text-left active:bg-slate-800/60"
                    >
                        <div className="w-12 h-12 shrink-0 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center">
                            <Download size={24} aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="font-semibold text-white block">Instalar en el teléfono</span>
                            <span className="text-sm text-slate-500">
                                {canInstall
                                    ? 'Queda como una app, sin barra del navegador'
                                    : blocker === 'sin-https'
                                        ? 'No se puede desde esta dirección'
                                        : blocker === 'ios'
                                            ? 'En iPhone se añade a mano'
                                            : 'Cómo hacerlo'}
                            </span>
                        </div>
                        <ArrowRight size={20} className="text-slate-600 shrink-0" aria-hidden="true" />
                    </button>

                    {installHelp && !canInstall && (
                        <div className="px-5 pb-5 -mt-1 animate-fade-in">
                            {blocker === 'sin-https' ? (
                                <div className="flex gap-3 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30">
                                    <ShieldAlert size={18} className="text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                                    <div className="text-sm text-slate-300 leading-relaxed">
                                        <p className="font-bold text-rose-300 mb-1">Estás entrando por una dirección sin candado</p>
                                        <p>
                                            El navegador sólo instala sitios servidos por HTTPS, así que desde
                                            <code className="mx-1 px-1 py-0.5 rounded bg-slate-800 text-slate-200 text-xs">{window.location.host}</code>
                                            no va a ofrecerlo. Abre la dirección publicada del sistema —la que empieza por
                                            <strong className="text-slate-100"> https://</strong>— y vuelve a intentarlo desde ahí.
                                        </p>
                                    </div>
                                </div>
                            ) : blocker === 'ios' ? (
                                <ol className="flex flex-col gap-2.5 text-sm text-slate-300">
                                    <li className="flex gap-2.5">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-slate-800 text-slate-400 text-xs font-bold flex items-center justify-center">1</span>
                                        Toca el botón <strong className="text-slate-100">Compartir</strong> de Safari, el cuadrado con la flecha hacia arriba.
                                    </li>
                                    <li className="flex gap-2.5">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-slate-800 text-slate-400 text-xs font-bold flex items-center justify-center">2</span>
                                        Baja hasta <strong className="text-slate-100">Añadir a pantalla de inicio</strong>.
                                    </li>
                                    <li className="flex gap-2.5">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-slate-800 text-slate-400 text-xs font-bold flex items-center justify-center">3</span>
                                        Confirma con <strong className="text-slate-100">Añadir</strong>. El icono queda junto al resto de tus apps.
                                    </li>
                                </ol>
                            ) : (
                                <ol className="flex flex-col gap-2.5 text-sm text-slate-300">
                                    <li className="flex gap-2.5">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-slate-800 text-slate-400 text-xs font-bold flex items-center justify-center">1</span>
                                        Abre el menú de Chrome, los <strong className="text-slate-100">tres puntos</strong> de arriba a la derecha.
                                    </li>
                                    <li className="flex gap-2.5">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-slate-800 text-slate-400 text-xs font-bold flex items-center justify-center">2</span>
                                        Elige <strong className="text-slate-100">Instalar aplicación</strong> o <strong className="text-slate-100">Añadir a pantalla de inicio</strong>.
                                    </li>
                                    <li className="flex gap-2.5">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-slate-800 text-slate-400 text-xs font-bold flex items-center justify-center">3</span>
                                        Si no aparece, recarga la página una vez y vuelve a mirar: Chrome tarda unos segundos en decidir que el sitio es instalable.
                                    </li>
                                </ol>
                            )}
                        </div>
                    )}
                </div>
            )}

            {installed && (
                <div className="flex items-center gap-3 p-4 mb-4 rounded-3xl bg-emerald-500/5 border border-emerald-500/20">
                    <CheckCircle2 size={20} className="text-emerald-400 shrink-0" aria-hidden="true" />
                    <span className="text-sm font-semibold text-slate-300">
                        Estás usando LV Parts como app instalada
                    </span>
                    <Smartphone size={18} className="text-slate-600 ml-auto shrink-0" aria-hidden="true" />
                </div>
            )}

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
        </div>
    );
};

export default MobileDashboard;
