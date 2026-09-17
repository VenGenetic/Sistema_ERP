import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, Copy, Loader2, QrCode, ShieldAlert, Smartphone, TriangleAlert, X } from 'lucide-react';
import { useBackDismiss } from '../../hooks/useBackDismiss';
import { supabase } from '../../supabaseClient';
import { button, cn, focusRing, input, modal } from '../ui/styles';

/**
 * Volver a vincular el WhatsApp del agente escaneando un QR o tipeando un
 * código, sin ir hasta la máquina donde corre.
 *
 * EL CASO REAL
 * ------------
 * WhatsApp rechaza la sesión (401) a media mañana. El proceso del agente
 * sigue vivo -- late, corre sus trabajos, todo parece normal -- pero no
 * entra ni sale un mensaje y lo que el equipo escribe se acumula en la
 * cola. El 14/9/2026 eso costó dos horas de silencio, y hay tres 401 en
 * cuatro días. Arreglarlo exigía estar frente a la laptop.
 *
 * POR QUÉ HAY DOS CAMINOS
 * -----------------------
 * El QR se renueva cada ~20 s. Entre que la pantalla lo muestra, alguien
 * saca el teléfono, abre WhatsApp, entra a Dispositivos vinculados y apunta
 * la cámara, se venció. El 16/9/2026 se intentó cinco veces seguidas sin
 * que ninguna entrara -- y como cada pedido reinicia la revinculación,
 * insistir empeoraba las cosas.
 *
 * El código de 8 caracteres no tiene esa carrera: dura minutos y se tipea.
 * Es el mismo par que ofrece WhatsApp Web, y acá el orden está invertido a
 * propósito respecto de la web de WhatsApp: el código va primero porque en
 * este negocio es el que funciona.
 *
 * QUIÉN DECIDE QUÉ
 * ----------------
 * Esta pantalla no protege nada: esconder un botón se saltea desde la
 * consola del navegador. Las reglas viven en la base
 * (`solicitar_vinculacion_whatsapp` y `solicitar_codigo_whatsapp`,
 * migraciones 0079 y 0081 del agente), que exigen ser administrador, que el
 * agente esté vivo y que WhatsApp NO esté ya conectado. Acá sólo se muestra
 * lo que la base contesta -- incluso cuando dice que no.
 *
 * POR QUÉ SE NARRA TANTO
 * ----------------------
 * El QR y el código los emite WhatsApp, no el ERP: entre pedirlos y que
 * Baileys levante una sesión nueva pasan varios segundos. Quien mira la
 * pantalla con el teléfono en la mano necesita saber en cuál de esos
 * momentos está, o da por roto el sistema. Cada estado dice qué pasa y qué
 * se espera de él.
 */

/** Fila de `agent_whatsapp_link`. Sólo la ve un admin (RLS de la 0079). */
interface FilaVinculo {
    state: 'idle' | 'preparing' | 'waiting_scan' | 'waiting_code' | 'linked' | 'failed';
    qr_png: string | null;
    qr_expires_at: string | null;
    detail: string | null;
    updated_at: string;
    /*
        Las tres de la 0081 van OPCIONALES a propósito. La fila se lee con
        `select('*')`, así que en una base sin esa migración simplemente no
        vienen -- y `undefined` (la columna no existe) es lo que distingue
        eso de `null` (existe y está vacía). Esa diferencia es la que decide
        si se ofrece el camino del código, sin una consulta extra.
    */
    pairing_code?: string | null;
    pairing_phone?: string | null;
    pairing_expires_at?: string | null;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    /** Cierra una sesión que todavía aparece conectada antes de mostrar el QR. */
    forzarDesconexion?: boolean;
}

type Metodo = 'codigo' | 'qr';

/** true cuando el error de PostgREST es "esa tabla/función no existe". */
function faltaLaMigracion(error: { code?: string } | null | undefined): boolean {
    return error?.code === '42P01' || error?.code === 'PGRST205' || error?.code === 'PGRST202';
}

const MENSAJE_SIN_MIGRACION =
    'Falta aplicar la migración 0079 del agente ' +
    '(supabase/migrations/0079_vinculacion_de_whatsapp_desde_el_erp.sql) y reiniciar el proceso. ' +
    'Mientras tanto se revincula desde la máquina, con REVINCULAR-WHATSAPP.bat.';

const MENSAJE_SIN_CODIGO =
    'Falta aplicar la migración 0081 del agente ' +
    '(supabase/migrations/0081_vincular_whatsapp_con_codigo.sql). ' +
    'Mientras tanto se vincula con el QR, que sí funciona.';

const MENSAJE_SIN_REINICIO_FORZADO =
    'Falta aplicar la migración de recuperación ' +
    '(supabase/migrations/20260917130000_force_whatsapp_relink.sql). ' +
    'Mientras tanto hay que desvincular desde la máquina del agente.';

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

/**
 * El código, partido en dos mitades de cuatro.
 *
 * WhatsApp lo entrega como ocho caracteres pegados y así es ilegible para
 * tipear: se pierde el lugar a mitad de camino y hay que empezar de nuevo.
 * Cada carácter en su casilla, en dos grupos, se lee de un vistazo -- que es
 * como se lee un código que alguien está copiando a un teléfono.
 *
 * Las casillas van `aria-hidden` y el nombre accesible lo pone el contenedor:
 * un lector de pantalla que anuncie ocho casillas sueltas dicta una letra por
 * vez sin decir nunca el código.
 */
const CodigoGrande: React.FC<{ codigo: string }> = ({ codigo }) => {
    const limpio = codigo.replace(/\s+/g, '');
    const mitades = limpio.length === 8 ? [limpio.slice(0, 4), limpio.slice(4)] : [limpio];
    return (
        <div
            className="flex items-center justify-center gap-1.5"
            aria-label={`Código de emparejamiento: ${limpio.split('').join(' ')}`}
        >
            {mitades.map((mitad, i) => (
                <React.Fragment key={i}>
                    {i > 0 && <span aria-hidden="true" className="px-0.5 text-lg font-light text-fg-subtle">-</span>}
                    <span className="flex gap-1">
                        {mitad.split('').map((ch, j) => (
                            <span
                                key={j}
                                aria-hidden="true"
                                className="flex h-12 w-9 items-center justify-center rounded-lg border border-subtle bg-surface-3 font-mono text-xl font-bold text-fg"
                            >
                                {ch}
                            </span>
                        ))}
                    </span>
                </React.Fragment>
            ))}
        </div>
    );
};

export const VincularWhatsAppModal: React.FC<Props> = ({ isOpen, onClose, forzarDesconexion = false }) => {
    const [fila, setFila] = useState<FilaVinculo | null>(null);
    const [pidiendo, setPidiendo] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /**
     * `null` = todavía no se sabe. Se distingue de `false` a propósito: no
     * es lo mismo "no podés ver esto" que "todavía no llegó la respuesta".
     */
    const [permitido, setPermitido] = useState<boolean | null>(null);
    const [sinMigracion, setSinMigracion] = useState(false);
    const [metodo, setMetodo] = useState<Metodo>('codigo');
    const [telefono, setTelefono] = useState('');
    const [copiado, setCopiado] = useState(false);
    const [reinicioSolicitado, setReinicioSolicitado] = useState(false);
    const [reinicioEnMarcha, setReinicioEnMarcha] = useState(false);

    const panelRef = useRef<HTMLDivElement>(null);

    useBackDismiss(isOpen, onClose);

    // El foco entra al diálogo al abrirse: quien navega con teclado queda
    // dentro de lo que acaba de aparecer, no en el botón de atrás.
    useEffect(() => {
        if (isOpen) panelRef.current?.focus();
    }, [isOpen]);

    const leer = useCallback(async () => {
        /*
            `select('*')` y no la lista de columnas: con la lista, una base
            sin la 0081 contesta 42703 ("no existe pairing_code") y se
            llevaría puesto TAMBIÉN el QR, que ahí sí funciona. Con el
            asterisco llega lo que haya, y las columnas que falten quedan en
            `undefined`, que es justo la señal que hace falta más abajo.
        */
        const { data, error: err } = await supabase
            .from('agent_whatsapp_link')
            .select('*')
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
        setCopiado(false);
        setMetodo(forzarDesconexion ? 'qr' : 'codigo');
        setReinicioSolicitado(false);
        setReinicioEnMarcha(false);
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
    }, [isOpen, leer, forzarDesconexion]);

    const estado = fila?.state ?? 'idle';

    useEffect(() => {
        if (reinicioSolicitado && estado !== 'linked') setReinicioEnMarcha(true);
    }, [estado, reinicioSolicitado]);

    /**
     * ¿La base sabe de códigos?
     *
     * `undefined` es "la columna no existe" (base sin la 0081) y `null` es
     * "existe y está vacía". Distinguirlos acá evita ofrecer un camino que
     * va a fallar, y evita también una consulta al catálogo sólo para
     * preguntarlo.
     */
    const hayCodigo = fila !== null && fila.pairing_code !== undefined;

    // Con la base vieja no hay nada que elegir: sólo existe el QR.
    useEffect(() => {
        if (fila !== null && !hayCodigo) setMetodo('qr');
    }, [fila, hayCodigo]);

    /**
     * Cuenta atrás de lo que esté en pantalla.
     *
     * No sirve para ocultarlo -- el agente manda el siguiente antes de que
     * venza --, sino para que quien mira entienda que si se le pasó no
     * rompió nada. El código y el QR duran cosas muy distintas (3 min contra
     * 25 s), así que la fracción se calcula contra el total de cada uno o la
     * barra mentiría.
     */
    const [ahora, setAhora] = useState(() => Date.now());
    const venceEn = estado === 'waiting_code' ? fila?.pairing_expires_at : fila?.qr_expires_at;
    const totalMs = estado === 'waiting_code' ? 3 * 60_000 : 25_000;

    useEffect(() => {
        if (!isOpen || !venceEn) return;
        const t = setInterval(() => setAhora(Date.now()), 1000);
        return () => clearInterval(t);
    }, [isOpen, venceEn]);

    const vigencia = useMemo(() => {
        if (!venceEn) return null;
        const restanMs = new Date(venceEn).getTime() - ahora;
        const segundos = Math.max(0, Math.round(restanMs / 1000));
        return { segundos, fraccion: Math.min(1, Math.max(0, restanMs / totalMs)) };
    }, [venceEn, ahora, totalMs]);

    const pedirQr = async () => {
        if (pidiendo) return;
        setPidiendo(true);
        setError(null);
        const { error: err } = await supabase.rpc(
            forzarDesconexion ? 'forzar_vinculacion_whatsapp' : 'solicitar_vinculacion_whatsapp',
        );
        setPidiendo(false);
        if (err) {
            // Los mensajes de la función están escritos para leerse tal
            // cual ("el agente no está corriendo...", "ya está conectado").
            // Reemplazarlos por uno genérico perdería justo lo accionable.
            setError(
                faltaLaMigracion(err)
                    ? forzarDesconexion
                        ? MENSAJE_SIN_REINICIO_FORZADO
                        : MENSAJE_SIN_MIGRACION
                    : err.message,
            );
            return;
        }
        // La fila la trae Realtime; no hace falta releerla acá.
        if (forzarDesconexion) setReinicioSolicitado(true);
    };

    const pedirCodigo = async () => {
        if (pidiendo) return;
        const soloDigitos = telefono.replace(/\D/g, '');
        /*
            Se valida acá ADEMÁS de en la base. No para proteger nada -- eso
            lo hace la función, y esconder un botón no protege de nadie --
            sino para no gastar un viaje ni apartar la sesión de WhatsApp por
            un número que ya se ve incompleto.
        */
        if (soloDigitos.length < 8) {
            setError('Poné el número con código de país y sin el +, por ejemplo 593991234567.');
            return;
        }
        setPidiendo(true);
        setError(null);
        const { error: err } = await supabase.rpc('solicitar_codigo_whatsapp', { p_telefono: soloDigitos });
        setPidiendo(false);
        if (err) setError(faltaLaMigracion(err) ? MENSAJE_SIN_CODIGO : err.message);
    };

    const copiar = async () => {
        if (!fila?.pairing_code) return;
        try {
            await navigator.clipboard.writeText(fila.pairing_code);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch {
            /*
                Sin portapapeles (contexto no seguro, permiso denegado) no hay
                nada que avisar: el código está a la vista y se tipea igual.
                Un error acá sería ruido sobre algo que no bloquea nada.
            */
        }
    };

    if (!isOpen) return null;

    const enCurso = estado === 'waiting_scan' || estado === 'waiting_code';
    const esperandoCambioForzado = forzarDesconexion && reinicioSolicitado && !reinicioEnMarcha && estado === 'linked';
    const sesionActualParaForzar = forzarDesconexion && estado === 'linked' && !reinicioSolicitado;
    const esperando = estado === 'preparing' || esperandoCambioForzado || (pidiendo && !enCurso);

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
                        <h2 id="vincular-wa-titulo" className={modal.title}>
                            {forzarDesconexion ? 'Desconectar y vincular WhatsApp' : 'Vincular WhatsApp'}
                        </h2>
                        <p className={modal.subtitle}>
                            {forzarDesconexion
                                ? 'Se cerrará la sesión actual y se mostrará un QR nuevo.'
                                : 'Como en WhatsApp Web: con un código o escaneando.'}
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
                                    : 'Vincular deja entrar a todas las conversaciones del negocio, así que sólo lo puede hacer un administrador. Pedile a quien administre el sistema que lo haga, o revinculá desde la máquina del agente.'}
                            </p>
                        </div>
                    )}

                    {permitido === true && (
                        <>
                            {estado === 'linked' && !sesionActualParaForzar && !esperandoCambioForzado && (
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

                            {/* El selector aparece sólo cuando hay algo que elegir Y
                                cuando elegir todavía sirve: con un código ya en
                                pantalla, cambiar de pestaña sólo sirve para perderlo. */}
                            {estado !== 'linked' && hayCodigo && !forzarDesconexion && !enCurso && !esperando && (
                                <div role="tablist" aria-label="Cómo vincular" className="flex w-full rounded-xl bg-surface-3 p-1">
                                    {([
                                        ['codigo', 'Con un código'],
                                        ['qr', 'Con el QR'],
                                    ] as Array<[Metodo, string]>).map(([valor, etiqueta]) => (
                                        <button
                                            key={valor}
                                            role="tab"
                                            aria-selected={metodo === valor}
                                            onClick={() => { setMetodo(valor); setError(null); }}
                                            className={cn(
                                                focusRing,
                                                'flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                                                metodo === valor ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted hover:text-fg',
                                            )}
                                        >
                                            {etiqueta}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {estado === 'waiting_code' && fila?.pairing_code && (
                                <>
                                    <CodigoGrande codigo={fila.pairing_code} />

                                    <button
                                        onClick={copiar}
                                        className={cn(button.base, button.variant.secondary, button.size.sm, focusRing)}
                                    >
                                        {copiado ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                                        {copiado ? 'Copiado' : 'Copiar el código'}
                                    </button>

                                    {fila.pairing_phone && (
                                        <p className="text-2xs text-fg-subtle">
                                            Para el teléfono{' '}
                                            <strong className="font-semibold text-fg-muted">+{fila.pairing_phone}</strong>
                                        </p>
                                    )}

                                    <ol className="w-full max-w-[17rem] space-y-1.5 text-left">
                                        <Paso n={1}>Abrí WhatsApp en el teléfono del negocio.</Paso>
                                        <Paso n={2}>
                                            Entrá a <strong className="font-semibold text-fg">Dispositivos vinculados</strong> y
                                            tocá <strong className="font-semibold text-fg">Vincular un dispositivo</strong>.
                                        </Paso>
                                        <Paso n={3}>
                                            Abajo, tocá{' '}
                                            <strong className="font-semibold text-fg">Vincular con el número de teléfono</strong>{' '}
                                            y escribí este código.
                                        </Paso>
                                    </ol>

                                    <p className="text-2xs text-fg-subtle">
                                        {vigencia && vigencia.segundos > 0
                                            ? `Sirve durante ${Math.floor(vigencia.segundos / 60)}:${String(vigencia.segundos % 60).padStart(2, '0')} más.`
                                            : 'El código venció. Pedí otro.'}
                                    </p>
                                </>
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

                                    {/* La salida para el caso que motivó todo esto: el QR
                                        se vence antes de llegar a escanearlo. */}
                                    {hayCodigo && (
                                        <button
                                            onClick={() => { setMetodo('codigo'); setError(null); }}
                                            className={cn(focusRing, 'rounded text-xs font-semibold text-primary underline-offset-4 hover:underline')}
                                        >
                                            ¿Se te vence antes de escanear? Usá un código
                                        </button>
                                    )}
                                </>
                            )}

                            {esperando && (
                                <div className="flex flex-col items-center gap-2 py-10">
                                    <Loader2 size={24} className="animate-spin text-fg-subtle" aria-hidden="true" />
                                    <p className="text-sm text-fg">
                                        {metodo === 'codigo' && hayCodigo ? 'Pidiendo el código…' : 'Preparando el QR…'}
                                    </p>
                                    <p className="max-w-[17rem] text-xs leading-relaxed text-fg-subtle">
                                        Se está apartando la sesión anterior. Lo emite WhatsApp, no el ERP, así que suele
                                        tardar unos segundos.
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

                            {(estado === 'idle' || sesionActualParaForzar) && !pidiendo && (
                                <div className="flex flex-col items-center gap-2 py-3">
                                    <span className={cn(
                                        'flex h-11 w-11 items-center justify-center rounded-full',
                                        forzarDesconexion ? 'bg-warning-soft' : 'bg-surface-3',
                                    )}>
                                        <Smartphone
                                            size={22}
                                            className={forzarDesconexion ? 'text-warning-soft-fg' : 'text-fg-muted'}
                                            aria-hidden="true"
                                        />
                                    </span>
                                    <p className="max-w-[17rem] text-xs leading-relaxed text-fg-muted">
                                        {forzarDesconexion
                                            ? 'Vas a cerrar la sesión que ahora figura conectada. Los mensajes quedan en cola hasta escanear el QR nuevo.'
                                            : 'Esto cierra la sesión actual de WhatsApp y pide una nueva. Vas a necesitar el teléfono del negocio a mano.'}
                                    </p>
                                </div>
                            )}

                            {/* El número va antes del botón y sólo en el camino del
                                código: pedirlo siempre obligaría a tipear un teléfono
                                a quien únicamente quiere escanear. */}
                            {metodo === 'codigo' && hayCodigo && !enCurso && !esperando && estado !== 'linked' && (
                                <label className="w-full text-left">
                                    <span className="mb-1 block text-xs font-medium text-fg-muted">
                                        Número del teléfono del negocio
                                    </span>
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        autoComplete="tel"
                                        value={telefono}
                                        onChange={(e) => setTelefono(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') pedirCodigo(); }}
                                        placeholder="593991234567"
                                        className={cn(input.base, input.size.lg, focusRing, 'w-full')}
                                    />
                                    <span className="mt-1 block text-2xs text-fg-subtle">
                                        Con código de país y sin el signo +.
                                    </span>
                                </label>
                            )}

                            {/* `role="alert"` y no sólo color: un fallo que se marca
                                nada más que en rojo no existe para quien usa lector de
                                pantalla -- y es el momento en que más falta hace. */}
                            {error && (
                                <p role="alert" className="max-w-[17rem] text-xs leading-relaxed text-danger">
                                    {error}
                                </p>
                            )}

                            {(estado !== 'linked' || sesionActualParaForzar) && (
                                <button
                                    onClick={metodo === 'codigo' && hayCodigo ? pedirCodigo : pedirQr}
                                    disabled={pidiendo || esperando}
                                    /*
                                        `xl` y ancho completo: 48 px de alto cumple el
                                        mínimo táctil y es la única acción de la pantalla.
                                        Este mismo modal se abre en el teléfono, donde se
                                        pulsa con el pulgar y sin mirar.
                                    */
                                    className={cn(button.base, button.variant.primary, button.size.xl, focusRing, 'w-full')}
                                >
                                    {pidiendo ? (
                                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                                    ) : (
                                        <QrCode size={16} aria-hidden="true" />
                                    )}
                                    {enCurso || estado === 'failed'
                                        ? 'Generar otro'
                                        : metodo === 'codigo' && hayCodigo
                                            ? 'Pedir el código'
                                            : forzarDesconexion
                                                ? 'Desconectar y generar QR'
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
