import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, QrCode, ShieldAlert, Smartphone, TriangleAlert, X } from 'lucide-react';
import { useBackDismiss } from '../../hooks/useBackDismiss';
import { supabase } from '../../supabaseClient';
import { button, cn, focusRing, modal } from '../ui/styles';

/**
 * Volver a vincular el WhatsApp del agente escaneando un QR, sin ir hasta
 * la máquina donde corre.
 *
 * EL CASO REAL
 * ------------
 * WhatsApp rechaza la sesión (401) a media mañana. El proceso del agente
 * sigue vivo -- late, corre sus trabajos, todo parece normal -- pero no
 * entra ni sale un mensaje y lo que el equipo escribe se acumula en la
 * cola. El 14/9/2026 eso costó dos horas de silencio, y hay tres 401 en
 * cuatro días. Arreglarlo exigía estar frente a la laptop.
 *
 * QUIÉN DECIDE QUÉ
 * ----------------
 * Esta pantalla no protege nada: esconder un botón se saltea desde la
 * consola del navegador. Las reglas viven en la base
 * (`solicitar_vinculacion_whatsapp`, migración 0079 del agente), que exige
 * ser administrador, que el agente esté vivo y que WhatsApp NO esté ya
 * conectado. Acá sólo se muestra lo que la base contesta -- incluso
 * cuando dice que no.
 *
 * POR QUÉ SE NARRA TANTO
 * ----------------------
 * El QR lo emite WhatsApp, no el ERP: entre pedir la revinculación y que
 * Baileys levante una sesión nueva pasan varios segundos, y después el
 * código se renueva solo cada ~20 s. Quien mira la pantalla con el
 * teléfono en la mano necesita saber en cuál de esos momentos está, o
 * escanea un código vencido y da por roto el sistema. Cada estado dice qué
 * pasa y qué se espera de él.
 */

/** Fila de `agent_whatsapp_link`. Sólo la ve un admin (RLS de la 0079). */
interface FilaVinculo {
    state: 'idle' | 'preparing' | 'waiting_scan' | 'linked' | 'failed';
    qr_png: string | null;
    qr_expires_at: string | null;
    detail: string | null;
    updated_at: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

/** true cuando el error de PostgREST es "esa tabla/función no existe". */
function faltaLaMigracion(error: { code?: string } | null | undefined): boolean {
    return error?.code === '42P01' || error?.code === 'PGRST205' || error?.code === 'PGRST202';
}

const MENSAJE_SIN_MIGRACION =
    'Falta aplicar la migración 0079 del agente ' +
    '(supabase/migrations/0079_vinculacion_de_whatsapp_desde_el_erp.sql) y reiniciar el proceso. ' +
    'Mientras tanto se revincula desde la máquina, con REVINCULAR-WHATSAPP.bat.';

/**
 * Un paso de las instrucciones.
 *
 * El número va en su propio círculo y no como "1." dentro del texto: en una
 * lista de tres pasos que se leen de reojo mientras se busca el menú en el
 * teléfono, el ancla visual vale más que el punto.
 */
const Paso: React.FC<{ n: number; children: React.ReactNode }> = ({ n, children }) => (
    <li className="flex items-start gap-2.5">
        <span
            aria-hidden="true"
            className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-bold text-fg-muted"
        >
            {n}
        </span>
        <span className="text-xs leading-relaxed text-fg-muted">{children}</span>
    </li>
);

export const VincularWhatsAppModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const [fila, setFila] = useState<FilaVinculo | null>(null);
    const [pidiendo, setPidiendo] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /**
     * `null` = todavía no se sabe. Se distingue de `false` a propósito: no
     * es lo mismo "no podés ver esto" que "todavía no llegó la respuesta".
     */
    const [permitido, setPermitido] = useState<boolean | null>(null);
    const [sinMigracion, setSinMigracion] = useState(false);

    const panelRef = useRef<HTMLDivElement>(null);

    useBackDismiss(isOpen, onClose);

    // El foco entra al diálogo al abrirse: quien navega con teclado queda
    // dentro de lo que acaba de aparecer, no en el botón de atrás.
    useEffect(() => {
        if (isOpen) panelRef.current?.focus();
    }, [isOpen]);

    const leer = useCallback(async () => {
        const { data, error: err } = await supabase
            .from('agent_whatsapp_link')
            .select('state, qr_png, qr_expires_at, detail, updated_at')
            .eq('id', 1)
            .maybeSingle();

        if (err) {
            if (faltaLaMigracion(err)) { setSinMigracion(true); setPermitido(false); return; }
            setPermitido(false);
            return;
        }
        /*
            Sin fila no es un error: con RLS, una fila que no se puede ver
            llega como "no hay nada". O sea que esto es exactamente lo que
            ve alguien que no es administrador.
        */
        if (!data) { setPermitido(false); return; }
        setPermitido(true);
        setFila(data as FilaVinculo);
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        leer();

        /*
            Realtime y no sondeo: el QR se renueva cada ~20 s y hay una
            persona mirando la pantalla con el teléfono en la mano. Sondear
            desde cada pestaña abierta sería una consulta cada pocos
            segundos; así llega en cuanto el agente lo escribe.
        */
        const canal = supabase
            .channel('vinculacion-whatsapp')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'agent_whatsapp_link', filter: 'id=eq.1' },
                (payload) => {
                    const nueva = payload.new as FilaVinculo | undefined;
                    if (nueva) { setFila(nueva); setPermitido(true); }
                },
            )
            .subscribe();

        return () => { supabase.removeChannel(canal); };
    }, [isOpen, leer]);

    /**
     * Cuenta atrás del QR.
     *
     * No sirve para ocultarlo -- el agente manda el siguiente antes de que
     * venza --, sino para que quien escanea entienda que si se le pasó no
     * rompió nada: en un segundo aparece otro.
     */
    const [ahora, setAhora] = useState(() => Date.now());
    useEffect(() => {
        if (!isOpen || !fila?.qr_expires_at) return;
        const t = setInterval(() => setAhora(Date.now()), 1000);
        return () => clearInterval(t);
    }, [isOpen, fila?.qr_expires_at]);

    const vigencia = useMemo(() => {
        if (!fila?.qr_expires_at) return null;
        const restanMs = new Date(fila.qr_expires_at).getTime() - ahora;
        const segundos = Math.max(0, Math.round(restanMs / 1000));
        // 25s es la vigencia con la que publica el agente (VIGENCIA_QR_MS).
        return { segundos, fraccion: Math.min(1, Math.max(0, restanMs / 25_000)) };
    }, [fila?.qr_expires_at, ahora]);

    const pedir = async () => {
        if (pidiendo) return;
        setPidiendo(true);
        setError(null);
        const { error: err } = await supabase.rpc('solicitar_vinculacion_whatsapp');
        setPidiendo(false);
        if (err) {
            // Los mensajes de la función están escritos para leerse tal
            // cual ("el agente no está corriendo...", "ya está conectado").
            // Reemplazarlos por uno genérico perdería justo lo accionable.
            setError(faltaLaMigracion(err) ? MENSAJE_SIN_MIGRACION : err.message);
            return;
        }
        // La fila la trae Realtime; no hace falta releerla acá.
    };

    if (!isOpen) return null;

    const estado = fila?.state ?? 'idle';
    const esperandoQr = estado === 'preparing' || (pidiendo && estado !== 'waiting_scan');

    return (
        <div className={modal.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div
                ref={panelRef}
                tabIndex={-1}
                className={cn(modal.panel, modal.width.sm, 'focus:outline-none')}
                role="dialog"
                aria-modal="true"
                aria-labelledby="vincular-wa-titulo"
            >
                <div className={modal.header}>
                    <div className="min-w-0">
                        <h2 id="vincular-wa-titulo" className={modal.title}>Vincular WhatsApp</h2>
                        <p className={modal.subtitle}>
                            Como en WhatsApp Web: escaneás el código y la sesión vuelve.
                        </p>
                    </div>
                    <button onClick={onClose} className={cn(modal.close, focusRing)} aria-label="Cerrar">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                {/* `aria-live`: los cambios de estado llegan solos por Realtime,
                    sin que nadie toque nada. Un lector de pantalla no tendría
                    forma de enterarse de que apareció el QR o de que ya vinculó. */}
                <div className={cn(modal.body, 'flex flex-col items-center gap-3.5 text-center')} aria-live="polite">
                    {permitido === null && (
                        <div className="flex flex-col items-center gap-2 py-10">
                            <Loader2 size={22} className="animate-spin text-fg-subtle" aria-hidden="true" />
                            <p className="text-xs text-fg-subtle">Consultando el estado…</p>
                        </div>
                    )}

                    {permitido === false && (
                        <div className="flex flex-col items-center gap-2 py-5">
                            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-warning-soft">
                                <ShieldAlert size={22} className="text-warning-soft-fg" aria-hidden="true" />
                            </span>
                            <p className="text-sm font-semibold text-fg">
                                {sinMigracion ? 'Falta preparar la base' : 'No tenés permiso para esto'}
                            </p>
                            <p className="max-w-[17rem] text-xs leading-relaxed text-fg-muted">
                                {sinMigracion
                                    ? MENSAJE_SIN_MIGRACION
                                    : 'El código QR deja entrar a todas las conversaciones del negocio, así que sólo lo puede usar un administrador. Pedile a quien administre el sistema que lo haga, o revinculá desde la máquina del agente.'}
                            </p>
                        </div>
                    )}

                    {permitido === true && (
                        <>
                            {estado === 'linked' && (
                                <div className="flex flex-col items-center gap-2 py-5">
                                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-soft">
                                        <CheckCircle2 size={22} className="text-success-soft-fg" aria-hidden="true" />
                                    </span>
                                    <p className="text-sm font-semibold text-fg">WhatsApp quedó vinculado</p>
                                    <p className="max-w-[17rem] text-xs leading-relaxed text-fg-muted">
                                        Los mensajes que estaban en cola salen solos en los próximos segundos.
                                    </p>
                                </div>
                            )}

                            {estado === 'waiting_scan' && fila?.qr_png && (
                                <>
                                    {/*
                                        Fondo blanco fijo, no un token de tema: un QR sobre
                                        fondo oscuro no lo lee ningún teléfono.

                                        El tamaño lo fija el CONTENEDOR y la imagen va a
                                        w-full: con Tailwind por CDN, una medida puesta en
                                        el className de un <img> puede perder contra la
                                        hoja de estilos, y el QR saldría a un tamaño
                                        impredecible.
                                    */}
                                    <div className="w-[248px] rounded-xl bg-white p-3 shadow-sm">
                                        <img
                                            src={fila.qr_png}
                                            alt="Código QR para vincular WhatsApp"
                                            className="block w-full"
                                        />
                                    </div>

                                    {/* La barra dice lo mismo que el número, pero se entiende
                                        sin leer. `scaleX` y no `width`: el navegador la
                                        compone en la GPU y no rehace el diseño cada segundo. */}
                                    <div className="w-[248px]">
                                        <div className="h-1 overflow-hidden rounded-full bg-surface-3">
                                            <div
                                                className="h-full origin-left rounded-full bg-primary transition-transform duration-1000 ease-linear motion-reduce:transition-none"
                                                style={{ transform: `scaleX(${vigencia?.fraccion ?? 0})` }}
                                            />
                                        </div>
                                        <p className="mt-1.5 text-2xs text-fg-subtle">
                                            {vigencia && vigencia.segundos > 0
                                                ? `El código se renueva en ${vigencia.segundos} s. Si se te pasa, esperá al siguiente.`
                                                : 'Renovando el código…'}
                                        </p>
                                    </div>

                                    <ol className="w-full max-w-[17rem] space-y-1.5 text-left">
                                        <Paso n={1}>Abrí WhatsApp en el teléfono del negocio.</Paso>
                                        <Paso n={2}>
                                            Entrá a <strong className="font-semibold text-fg">Dispositivos vinculados</strong>.
                                        </Paso>
                                        <Paso n={3}>
                                            Tocá <strong className="font-semibold text-fg">Vincular un dispositivo</strong> y
                                            apuntá a esta pantalla.
                                        </Paso>
                                    </ol>
                                </>
                            )}

                            {esperandoQr && (
                                <div className="flex flex-col items-center gap-2 py-10">
                                    <Loader2 size={24} className="animate-spin text-fg-subtle" aria-hidden="true" />
                                    <p className="text-sm text-fg">Preparando el código…</p>
                                    <p className="max-w-[17rem] text-xs leading-relaxed text-fg-subtle">
                                        Se está apartando la sesión anterior. El código lo genera WhatsApp, no el ERP, así
                                        que suele tardar unos segundos.
                                    </p>
                                </div>
                            )}

                            {estado === 'failed' && (
                                <div className="flex flex-col items-center gap-2 py-5">
                                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft">
                                        <TriangleAlert size={22} className="text-danger-soft-fg" aria-hidden="true" />
                                    </span>
                                    <p className="text-sm font-semibold text-fg">No se pudo vincular</p>
                                    {fila?.detail && (
                                        <p className="max-w-[17rem] break-words text-xs leading-relaxed text-fg-muted">
                                            {fila.detail}
                                        </p>
                                    )}
                                    <p className="max-w-[17rem] text-2xs leading-relaxed text-fg-subtle">
                                        Si vuelve a fallar queda el camino de siempre: REVINCULAR-WHATSAPP.bat en la
                                        máquina del agente.
                                    </p>
                                </div>
                            )}

                            {estado === 'idle' && !pidiendo && (
                                <div className="flex flex-col items-center gap-2 py-5">
                                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-3">
                                        <Smartphone size={22} className="text-fg-muted" aria-hidden="true" />
                                    </span>
                                    <p className="max-w-[17rem] text-xs leading-relaxed text-fg-muted">
                                        Esto cierra la sesión actual de WhatsApp y pide una nueva. Vas a necesitar el
                                        teléfono del negocio a mano para escanear.
                                    </p>
                                </div>
                            )}

                            {/* `role="alert"` y no sólo color: un fallo que se marca
                                nada más que en rojo no existe para quien usa lector de
                                pantalla -- y es el momento en que más falta hace. */}
                            {error && (
                                <p role="alert" className="max-w-[17rem] text-xs leading-relaxed text-danger">
                                    {error}
                                </p>
                            )}

                            {estado !== 'linked' && (
                                <button
                                    onClick={pedir}
                                    disabled={pidiendo || esperandoQr}
                                    className={cn(button.base, button.variant.primary, button.size.md, focusRing)}
                                >
                                    {pidiendo ? (
                                        <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                                    ) : (
                                        <QrCode size={15} aria-hidden="true" />
                                    )}
                                    {estado === 'waiting_scan' || estado === 'failed'
                                        ? 'Generar otro código'
                                        : 'Generar código QR'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VincularWhatsAppModal;
