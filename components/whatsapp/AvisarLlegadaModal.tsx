import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    ArrowLeft,
    Bell,
    Check,
    Loader2,
    HandCoins,
    MessageCircle,
    PhoneOff,
    Send,
    X,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useBackDismiss } from '../../hooks/useBackDismiss';
import { badge, button, cn, input, modal } from '../ui/styles';
import { FotoRepuesto } from '../FotoRepuesto';
import { avisoDeEnvio, haceCuanto, type EstadoAgente } from './agente';
import { formatearPrecio, precioParaCliente, stockUtil } from '../../utils/whatsappOutbox';
import { buildWhatsAppDemandURL, openWhatsApp } from '../../utils/whatsapp';
import {
    abonoSugerido,
    AVISOS_POR_HORA,
    DIAS_PARA_REINSISTIR,
    registrarAbonoPagado,
    avisarLlegada,
    cargarPorAvisar,
    contarAvisosRecientes,
    marcarAvisadoSinMensaje,
    mensajesDeAviso,
    solicitarAbono,
    textoDeAbono,
    textoDeAviso,
    type DemandaPorAvisar,
    type ModoAviso,
} from './avisarLlegada';

/**
 * "Ya llegó el repuesto que pediste", mandado desde la bandeja.
 *
 * Dos pasos a propósito -- lista y después vista previa -- en vez de un
 * botón que manda de una. Lo que sale de acá le llega al teléfono de un
 * cliente y no se puede volver atrás, así que nadie tiene que poder
 * mandarlo sin haber leído antes qué dice y a quién le va.
 *
 * Se abre en tres alcances, y es el mismo modal en los tres a propósito:
 * el texto, el precio, los avisos de stock y el archivado del pedido son
 * una sola implementación y no tres que se van separando con el tiempo.
 *
 *  * Desde el botón "Por avisar" de la bandeja, con TODOS los que están
 *    esperando. Este es el que hace que el sistema sirva: cuando entra un
 *    pedido a la importadora se destraban treinta clientes de una, y
 *    buscarlos chat por chat no lo hace nadie.
 *  * Desde el chat abierto (`soloTelefono`), para avisarle a la persona
 *    con la que se está hablando.
 *  * Desde el botón "Notificar" de Solicitudes (`soloDemandaId`), sobre
 *    una solicitud puntual. Ahí se salta la lista y se abre derecho la
 *    vista previa: la persona ya eligió cuál.
 */

interface Props {
    isOpen: boolean;
    onClose: () => void;
    userId: string | null;
    /** Limita la lista a un cliente. Sin esto, salen todos. */
    soloTelefono?: string;
    /**
     * Abre directo la vista previa de UNA solicitud, sin pasar por la
     * lista: la persona ya eligio cual desde la pantalla de Solicitudes,
     * volver a pedirsela seria hacerla elegir dos veces.
     */
    soloDemandaId?: number;
    /**
     * Cuál de los dos avisos.
     *
     * `llego`: está en la bodega, se le avisa y el pedido se archiva.
     * `abono`: está en la importadora, se le ofrece traerlo pidiéndole un
     * abono, y el pedido SIGUE activo -- el cliente todavía espera.
     */
    modo?: ModoAviso;
    /** Para que la pantalla de atrás refresque sus contadores. */
    onAvisado?: () => void;
    /** Saltar al chat del cliente. Si no se pasa, no se ofrece. */
    onAbrirChat?: (conversationId: number) => void;
}

/** true si ya pasó la semana y se le puede volver a pedir el abono. */
function puedeReinsistir(pedidoEl: string): boolean {
    return Date.now() - new Date(pedidoEl).getTime() > DIAS_PARA_REINSISTIR * 86400000;
}

/** "hoy" / "hace 3 días" / "hace 2 meses". */
function esperandoDesde(iso: string): string {
    const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (dias <= 0) return 'hoy';
    if (dias === 1) return 'hace 1 día';
    if (dias < 30) return `hace ${dias} días`;
    const meses = Math.round(dias / 30);
    return meses === 1 ? 'hace 1 mes' : `hace ${meses} meses`;
}

export const AvisarLlegadaModal: React.FC<Props> = ({
    isOpen,
    onClose,
    userId,
    soloTelefono,
    soloDemandaId,
    modo = 'llego',
    onAvisado,
    onAbrirChat,
}) => {
    const esAbono = modo === 'abono';
    const [demandas, setDemandas] = useState<DemandaPorAvisar[]>([]);
    const [hayMas, setHayMas] = useState(false);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /** El pedido abierto en la vista previa. `null` = estamos en la lista. */
    const [abierto, setAbierto] = useState<DemandaPorAvisar | null>(null);
    const [texto, setTexto] = useState('');
    const [editado, setEditado] = useState(false);
    const [conPrecio, setConPrecio] = useState(true);
    const [conFoto, setConFoto] = useState(true);
    /** Cuánto se le pide de abono. Solo en modo `abono`. */
    const [abono, setAbono] = useState<number | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [avisados, setAvisados] = useState(0);
    const [ultimo, setUltimo] = useState<string | null>(null);
    const [estadoAgente, setEstadoAgente] = useState<EstadoAgente | null>(null);
    /** Avisos mandados en la última hora, para el tope. */
    const [recientes, setRecientes] = useState(0);
    const enviandoRef = useRef(false);
    const cargaRef = useRef(0);

    useBackDismiss(isOpen, onClose);

    const cargar = useCallback(async () => {
        const turno = ++cargaRef.current;
        setCargando(true);
        setError(null);
        try {
            const { demandas: filas, hayMas: mas } = await cargarPorAvisar({
                soloTelefono,
                soloDemandaId,
                modo,
            });
            if (turno !== cargaRef.current) return;
            setDemandas(filas);
            setHayMas(mas);
            // Sin lista que mostrar: la solicitud ya venia elegida.
            if (soloDemandaId && filas.length === 1) abrirVistaPrevia(filas[0]);
            // Si no vino ninguna, el pedido dejo de ser avisable entre que
            // se dibujo la pantalla y se toco el boton: alguien lo cancelo,
            // lo archivo o ya lo aviso.
            if (soloDemandaId && filas.length === 0) {
                setError('Ese pedido ya no se puede avisar: lo archivaron, lo cancelaron o ya se aviso.');
            }
        } catch (err: any) {
            if (turno !== cargaRef.current) return;
            setError(err?.message ?? 'No se pudo cargar la lista.');
        } finally {
            if (turno === cargaRef.current) setCargando(false);
        }

        /*
            Y cómo está el agente.

            Importa acá más que en cualquier otra pantalla: mandar el aviso
            ARCHIVA el pedido, así que si el agente está caído el pedido sale
            de la lista de pendientes y el mensaje se queda en la cola. Se
            mandará solo cuando el agente vuelva -- pero quien avisó a
            cuarenta clientes tiene que saber que ninguno lo recibió todavía.

            Una sola lectura al abrir, no un latido: la bandeja de atrás ya
            tiene el suyo cada 30 segundos y no hace falta un segundo.
        */
        const { data } = await supabase
            .from('agent_settings')
            .select('agent_last_seen_at, agent_connection, agent_outbound_mode')
            .eq('id', 1)
            .maybeSingle();
        setEstadoAgente((data as EstadoAgente) ?? null);

        // Cuánto queda del tope por hora. Se lee al abrir y se recalcula
        // después de cada aviso, así el número que se ve es el de verdad.
        try {
            setRecientes(await contarAvisosRecientes());
        } catch {
            // Si no se puede contar, no se bloquea nada: el tope se vuelve
            // a comprobar en el servidor al mandar.
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [soloTelefono, soloDemandaId, modo]);

    useEffect(() => {
        if (!isOpen) {
            cargaRef.current += 1;
            return;
        }
        setAbierto(null);
        setAvisados(0);
        setUltimo(null);
        cargar();
    }, [isOpen, cargar]);

    /** Cuántos pedidos tiene por avisar cada teléfono, para no avisar de a uno sin saberlo. */
    const porTelefono = useMemo(() => {
        const cuenta = new Map<string, number>();
        for (const d of demandas) cuenta.set(d.phone_number, (cuenta.get(d.phone_number) ?? 0) + 1);
        return cuenta;
    }, [demandas]);

    /** El texto sugerido del modo que corresponda. */
    const sugerir = useCallback(
        (d: DemandaPorAvisar, incluirPrecio: boolean, abono: number | null) =>
            esAbono
                ? textoDeAbono(d, { incluirPrecio, abono: abono ?? undefined })
                : textoDeAviso(d, { incluirPrecio }),
        [esAbono],
    );

    const abrirVistaPrevia = (d: DemandaPorAvisar) => {
        const precio = d.product?.price != null ? precioParaCliente(d.product.price) : null;
        const abono = esAbono && precio != null ? abonoSugerido(precio) : null;
        setAbierto(d);
        setEditado(false);
        setConPrecio(true);
        setConFoto(!!d.product?.image_url);
        setAbono(abono);
        setTexto(sugerir(d, true, abono));
        setError(null);
    };

    // El texto sugerido sigue a los interruptores, salvo que lo hayan
    // escrito a mano: pisar lo que alguien acaba de redactar porque tocó
    // "incluir precio" es perder trabajo sin avisar.
    useEffect(() => {
        if (!abierto || editado) return;
        setTexto(sugerir(abierto, conPrecio, abono));
    }, [abierto, conPrecio, editado, abono, sugerir]);

    const quitarDeLaLista = (id: number) => {
        setDemandas((prev) => prev.filter((d) => d.id !== id));
    };

    const enviar = async () => {
        if (!abierto || enviandoRef.current) return;
        enviandoRef.current = true;
        setEnviando(true);
        setError(null);
        try {
            const resultado = esAbono
                ? await solicitarAbono({ demanda: abierto, texto, conFoto, userId })
                : await avisarLlegada({ demanda: abierto, texto, conFoto, userId });
            if (!resultado.ok) {
                setError(resultado.detalle);
                if (resultado.motivo === 'tope-por-hora') {
                    // El pedido NO se avisó y sigue pendiente: se queda en
                    // la lista. Sacarlo sería perderlo de vista justamente
                    // cuando hay que volver a intentarlo más tarde.
                    setRecientes(AVISOS_POR_HORA);
                    return;
                }
                // Alguien se le adelantó: ese pedido ya está avisado, así
                // que se saca de la lista porque no hay nada más que hacer.
                quitarDeLaLista(abierto.id);
                setAbierto(null);
                onAvisado?.();
                return;
            }
            quitarDeLaLista(abierto.id);
            setAvisados((n) => n + 1);
            setRecientes((n) => n + 1);
            setUltimo(abierto.customer_name?.trim() || abierto.phone_number);
            setAbierto(null);
            onAvisado?.();
        } catch (err: any) {
            setError(err?.message ?? 'No se pudo mandar el aviso.');
        } finally {
            enviandoRef.current = false;
            setEnviando(false);
        }
    };

    /**
     * El cliente pagó: se registra y el grupo de compras se entera solo.
     *
     * El monto se pregunta porque lo que se cobró no siempre es lo que se
     * pidió -- se negocia -- y lo que después hay que cerrar es lo que
     * puso de verdad. Se propone el sugerido para no tener que escribirlo
     * en el caso normal.
     */
    const marcarAbonado = async (d: DemandaPorAvisar) => {
        if (enviandoRef.current) return;
        const precio = d.product?.price != null ? precioParaCliente(d.product.price) : null;
        const sugerido = precio != null ? abonoSugerido(precio) : 0;
        const escrito = window.prompt(
            `¿Cuánto abonó ${d.customer_name?.trim() || d.phone_number} por "${d.product?.name ?? 'el repuesto'}"?`,
            String(sugerido || ''),
        );
        // Cancelar el diálogo no es cobrar cero: no se hace nada.
        if (escrito === null) return;
        const monto = Number(escrito.replace(',', '.'));
        if (!Number.isFinite(monto) || monto <= 0) {
            setError('El monto del abono tiene que ser un número mayor que cero.');
            return;
        }

        enviandoRef.current = true;
        setEnviando(true);
        setError(null);
        try {
            const resultado = await registrarAbonoPagado({ demanda: d, monto, userId });
            // `detalle` viene también cuando salió bien: dice si el grupo se
            // enteró o si hay que avisarle a mano.
            if (resultado.detalle) setError(resultado.detalle);
            if (resultado.ok) {
                // Ya está encargado: sale de la lista de abonos pendientes.
                quitarDeLaLista(d.id);
                onAvisado?.();
            }
        } catch (err: any) {
            setError(err?.message ?? 'No se pudo registrar el abono.');
        } finally {
            enviandoRef.current = false;
            setEnviando(false);
        }
    };

    const archivarSinMensaje = async () => {
        if (!abierto || enviandoRef.current) return;
        enviandoRef.current = true;
        setEnviando(true);
        setError(null);
        try {
            const resultado = await marcarAvisadoSinMensaje(abierto, userId);
            if (!resultado.ok) setError(resultado.detalle);
            quitarDeLaLista(abierto.id);
            setAbierto(null);
            onAvisado?.();
        } catch (err: any) {
            setError(err?.message ?? 'No se pudo archivar el pedido.');
        } finally {
            enviandoRef.current = false;
            setEnviando(false);
        }
    };

    if (!isOpen) return null;

    // La MISMA regla que usan la bandeja y el modo móvil: si estuviera
    // escrita otra vez acá, un día una pantalla avisaría y esta no.
    const aviso = avisoDeEnvio(estadoAgente, haceCuanto);
    const producto = abierto?.product ?? null;
    const stock = producto ? stockUtil(producto) : null;
    const precio = producto?.price != null ? precioParaCliente(producto.price) : null;

    return (
        <div className={modal.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div
                className={cn(modal.panel, abierto ? modal.width.xl : modal.width.full)}
                role="dialog"
                aria-modal="true"
                aria-label="Avisar que llegó el repuesto"
            >
                <div className={modal.header}>
                    <div className="min-w-0">
                        <h2 className={cn(modal.title, 'flex items-center gap-2')}>
                            <Bell
                                size={17}
                                className={cn('shrink-0', esAbono ? 'text-warning' : 'text-success')}
                                aria-hidden="true"
                            />
                            {abierto
                                ? 'Revisá el mensaje antes de mandarlo'
                                : esAbono
                                  ? 'Pedir abono para traerlo'
                                  : 'Avisar que llegó el repuesto'}
                        </h2>
                        <p className={modal.subtitle}>
                            {abierto
                                ? 'Sale por el chat del cliente y queda registrado en el hilo.'
                                : esAbono
                                  ? 'El repuesto no está en la bodega pero la importadora lo tiene. El pedido sigue esperando: pedir el abono no lo archiva.'
                                  : soloTelefono
                                    ? 'Repuestos de este cliente que ya se pueden entregar.'
                                    : 'Clientes que dejaron un pedido anotado y cuyo repuesto ya está.'}
                        </p>
                    </div>
                    <button onClick={onClose} className={modal.close} aria-label="Cerrar">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                <div className={modal.body}>
                    {/* Si el agente no está, el aviso se encola igual pero no
                        sale, y el pedido queda archivado. Hay que decirlo
                        ANTES, no después de haber avisado a cuarenta. */}
                    {aviso && (
                        <div className="mb-3 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2">
                            <p className="text-xs font-semibold text-warning-soft-fg">{aviso.titulo}</p>
                            <p className="mt-0.5 text-2xs text-warning-soft-fg">{aviso.detalle}</p>
                        </div>
                    )}

                    {error && (
                        <p className="mb-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger-soft-fg">
                            {error}
                        </p>
                    )}

                    {/* Cuánto queda del tope por hora. Se muestra siempre,
                        no solo al chocarlo: enterarse del límite recién
                        cuando frena, a mitad de una tanda de cien, es
                        peor que saberlo desde el principio. */}
                    {recientes > 0 && (
                        <p
                            className={cn(
                                'mb-3 rounded-lg border px-3 py-2 text-xs',
                                recientes >= AVISOS_POR_HORA
                                    ? 'border-danger/30 bg-danger-soft text-danger-soft-fg'
                                    : 'border-subtle bg-surface-2 text-fg-muted',
                            )}
                        >
                            {recientes >= AVISOS_POR_HORA ? (
                                <>
                                    Llegaste al tope de {AVISOS_POR_HORA} avisos por hora. Seguí más tarde: mandarle a
                                    mucha gente que nunca escribió, toda junta, es lo que hace que WhatsApp bloquee el
                                    número del negocio.
                                </>
                            ) : (
                                <>
                                    {recientes} de {AVISOS_POR_HORA} avisos en la última hora. Quedan{' '}
                                    {AVISOS_POR_HORA - recientes}.
                                </>
                            )}
                        </p>
                    )}

                    {avisados > 0 && !abierto && (
                        <p className="mb-3 rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-xs text-success-soft-fg flex items-center gap-1.5">
                            <Check size={13} aria-hidden="true" />
                            {avisados === 1 ? `Avisado a ${ultimo}.` : `${avisados} avisos mandados.`} Salen en cuanto
                            el agente los despache.
                        </p>
                    )}

                    {/* ------------------------------ VISTA PREVIA ---------------------------- */}
                    {abierto ? (
                        <div className="space-y-3">
                            <div className="flex items-start gap-3 rounded-xl border border-subtle bg-surface-2 p-3">
                                <FotoRepuesto
                                    url={producto?.image_url}
                                    sku={producto?.sku}
                                    nombre={producto?.name}
                                    iconSize={22}
                                    className="h-20 w-20 rounded-lg"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium leading-snug text-fg">
                                        {producto?.name ?? 'Repuesto sin vincular'}
                                    </p>
                                    <p className="mt-0.5 text-2xs text-fg-subtle">
                                        {producto?.sku}
                                        {precio != null && ` · ${formatearPrecio(precio)}`}
                                    </p>
                                    <p className="mt-1.5 text-2xs text-fg-muted">
                                        Para {abierto.customer_name?.trim() || 'este número'} · {abierto.phone_number}
                                    </p>
                                    {abierto.notes && (
                                        <p className="mt-1 text-2xs italic text-fg-subtle line-clamp-2">
                                            Nota del pedido: {abierto.notes}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Lo que se puede avisar es lo que está EN LA
                                BODEGA. Las listas ya filtran por eso, así que
                                este aviso solo se ve abriendo una solicitud
                                puntual desde Solicitudes, donde "Notificar"
                                aparece en toda solicitud activa. Es justo el
                                momento en que hace falta decirlo: la persona
                                ya eligió a quién avisarle. */}
                            {/* Lo que hay que advertir es distinto en cada
                                modo: para avisar que llegó, el problema es que
                                NO esté en la bodega; para pedir un abono, el
                                problema es el contrario -- que ya esté acá y
                                se le esté cobrando un adelanto al pedo. */}
                            {stock && !esAbono && stock.local === 0 && (
                                <p className="flex items-start gap-1.5 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger-soft-fg">
                                    <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
                                    {stock.hay
                                        ? 'Este repuesto NO está en la bodega: solo figura en la importadora. Avisar que llegó es prometer una fecha que no controlás, y el cliente viene al mostrador y no está.'
                                        : 'Este repuesto ya NO tiene stock en ningún lado. Si se vendió mientras tanto, avisar que llegó te deja en falta con el cliente.'}
                                </p>
                            )}
                            {stock && esAbono && stock.local > 0 && (
                                <p className="flex items-start gap-1.5 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger-soft-fg">
                                    <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
                                    Este repuesto SÍ está en la bodega. No hay nada que encargar ni por qué pedirle un
                                    abono: avisale que ya llegó y que lo venga a buscar.
                                </p>
                            )}
                            {stock && esAbono && stock.local === 0 && !stock.hay && (
                                <p className="flex items-start gap-1.5 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger-soft-fg">
                                    <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
                                    La importadora ya no lo tiene. Pedirle un abono ahora es cobrarle por algo que no
                                    sabés cuándo vas a poder conseguir.
                                </p>
                            )}

                            {/* Cuánto se le pide. Va aparte del texto para que
                                se pueda mover sin reescribir el mensaje, y
                                porque es el dato que después hay que cobrar. */}
                            {esAbono && (
                                <label className="flex items-center gap-2 text-xs text-fg-muted">
                                    Abono a pedir
                                    <span className="text-fg-subtle">$</span>
                                    <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={abono ?? ''}
                                        onChange={(e) => {
                                            const v = e.target.value.trim();
                                            setAbono(v === '' ? null : Math.max(0, Number(v)));
                                        }}
                                        disabled={editado}
                                        className={cn(input.base, input.size.sm, 'w-28')}
                                    />
                                    {precio != null && (
                                        <span className="text-2xs text-fg-subtle">
                                            sugerido {formatearPrecio(abonoSugerido(precio))} · precio{' '}
                                            {formatearPrecio(precio)}
                                        </span>
                                    )}
                                </label>
                            )}

                            {/* Este número nunca escribió: se le puede escribir
                                igual. Ya no bloquea el envío -- eran 124 de 134
                                pedidos -- pero conviene decir qué va a pasar,
                                porque es la primera vez que el negocio le
                                escribe a esa persona. */}
                            {!abierto.conversationId && (
                                <div className="rounded-lg border border-dashed border-strong px-3 py-3">
                                    <p className="flex items-center gap-1.5 text-xs font-semibold text-fg">
                                        <PhoneOff size={13} className="shrink-0" aria-hidden="true" />
                                        Este número nunca escribió al WhatsApp del negocio
                                    </p>
                                    <p className="mt-1 text-2xs text-fg-muted">
                                        Se le puede escribir igual: WhatsApp no exige que hayan escrito primero. Al
                                        mandar se abre el chat en la bandeja y el aviso queda registrado ahí como
                                        cualquier otro. Antes de enviarlo, el agente comprueba que el número tenga
                                        WhatsApp; si no lo tiene, el mensaje queda marcado como fallido y no se pierde
                                        el pedido.
                                    </p>
                                    <div className="mt-2.5 flex flex-wrap gap-2">
                                        <button
                                            onClick={() =>
                                                openWhatsApp(
                                                    buildWhatsAppDemandURL({
                                                        customerPhone: abierto.phone_number,
                                                        customerName: abierto.customer_name ?? undefined,
                                                        productSku: producto?.sku ?? '',
                                                        productName: producto?.name ?? 'el repuesto que pediste',
                                                    }),
                                                )
                                            }
                                            className={cn(button.base, button.variant.ghost, button.size.xs)}
                                        >
                                            <MessageCircle size={13} aria-hidden="true" />
                                            Escribirle por fuera
                                        </button>
                                        {/* Solo para "ya llegó": archivar un
                                            pedido al que se le pidió un abono
                                            lo sacaría de la lista de espera, y
                                            el cliente sigue esperando el
                                            repuesto. */}
                                        {!esAbono && (
                                            <button
                                                onClick={archivarSinMensaje}
                                                disabled={enviando}
                                                className={cn(button.base, button.variant.ghost, button.size.xs)}
                                            >
                                                Marcar avisado sin mandar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                            <label className="block">
                                <span className="text-xs font-semibold text-fg-muted">
                                    Lo que le va a llegar
                                </span>
                                <textarea
                                    value={texto}
                                    onChange={(e) => {
                                        setTexto(e.target.value);
                                        setEditado(true);
                                    }}
                                    rows={7}
                                    className={cn(input.textarea, 'mt-1')}
                                />
                            </label>

                            <div className="flex flex-wrap items-center gap-4">
                                <label className="flex items-center gap-2 text-xs text-fg-muted">
                                    <input
                                        type="checkbox"
                                        checked={conPrecio}
                                        onChange={(e) => setConPrecio(e.target.checked)}
                                        disabled={editado}
                                    />
                                    Incluir el precio
                                </label>
                                <label className="flex items-center gap-2 text-xs text-fg-muted">
                                    <input
                                        type="checkbox"
                                        checked={conFoto}
                                        onChange={(e) => setConFoto(e.target.checked)}
                                        disabled={!producto?.image_url}
                                    />
                                    Mandar la foto {!producto?.image_url && '(no tiene)'}
                                </label>
                                {editado && (
                                    <button
                                        onClick={() => {
                                            setEditado(false);
                                            setTexto(textoDeAviso(abierto, { incluirPrecio: conPrecio }));
                                        }}
                                        className={cn(button.base, button.variant.link, button.size.xs)}
                                    >
                                        Volver al texto sugerido
                                    </button>
                                )}
                            </div>

                            {(porTelefono.get(abierto.phone_number) ?? 0) > 1 && (
                                <p className="text-2xs text-fg-muted">
                                    Este cliente tiene {porTelefono.get(abierto.phone_number)} repuestos por
                                    avisar. Cada uno se manda por separado, con su foto.
                                </p>
                            )}
                        </div>
                    ) : (
                        /* --------------------------------- LISTA -------------------------------- */
                        <>
                            {cargando ? (
                                <p className="flex items-center gap-2 py-10 text-center text-sm text-fg-muted">
                                    <Loader2 size={15} className="animate-spin" aria-hidden="true" />{' '}
                                    {esAbono ? 'Buscando pedidos que se puedan encargar…' : 'Buscando pedidos con stock…'}
                                </p>
                            ) : demandas.length === 0 ? (
                                <p className="py-10 text-center text-sm text-fg-muted">
                                    {avisados > 0
                                        ? 'No queda nada pendiente.'
                                        : esAbono
                                          ? 'Ningún cliente está esperando un repuesto que la importadora tenga y la bodega no.'
                                          : soloTelefono
                                            ? 'Este cliente no tiene ningún pedido cuyo repuesto ya haya llegado.'
                                            : 'Ningún cliente está esperando un repuesto que ya haya llegado.'}
                                </p>
                            ) : (
                                <div className="divide-y divide-subtle">
                                    {demandas.map((d) => {
                                        const s = d.product ? stockUtil(d.product) : null;
                                        return (
                                            <div key={d.id} className="flex items-center gap-3 py-2.5">
                                                <FotoRepuesto
                                                    url={d.product?.image_url}
                                                    sku={d.product?.sku}
                                                    nombre={d.product?.name}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="line-clamp-2 text-xs font-medium leading-snug text-fg">
                                                        {d.product?.name ?? 'Repuesto sin vincular'}
                                                    </p>
                                                    <p className="truncate text-2xs text-fg-subtle">
                                                        {d.customer_name?.trim() || d.phone_number} · pedido{' '}
                                                        {esperandoDesde(d.created_at)}
                                                    </p>
                                                </div>

                                                <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                                                    {/* Que el stock sea solo de la importadora cambia lo
                                                        que hay que decirle al cliente, así que se ve
                                                        desde la lista. */}
                                                    {s && (
                                                        <span
                                                            className={cn(
                                                                badge.base,
                                                                badge.size.sm,
                                                                s.local > 0 ? badge.tone.success : badge.tone.warning,
                                                            )}
                                                        >
                                                            {s.local > 0 ? 'en bodega' : 'en importadora'}
                                                        </span>
                                                    )}
                                                    {!d.conversationId && (
                                                        <span className={cn(badge.base, badge.size.sm, badge.tone.neutral)}>
                                                            sin chat
                                                        </span>
                                                    )}
                                                </div>

                                                {d.conversationId && onAbrirChat && (
                                                    <button
                                                        onClick={() => {
                                                            onAbrirChat(d.conversationId!);
                                                            onClose();
                                                        }}
                                                        title="Abrir el chat"
                                                        className={cn(
                                                            button.base,
                                                            button.variant.ghost,
                                                            button.size.sm,
                                                            button.icon.sm,
                                                        )}
                                                    >
                                                        <MessageCircle size={14} aria-hidden="true" />
                                                    </button>
                                                )}
                                                {/* En modo abono cada fila
                                                    ofrece lo que corresponde a
                                                    su estado: pedirle el abono
                                                    a quien no se le pidió, y
                                                    registrar el pago de quien
                                                    ya lo recibió. Al segundo no
                                                    se le vuelve a pedir antes
                                                    de la semana: insistir al
                                                    día siguiente es hostigar. */}
                                                {esAbono && d.deposit_requested_at && (
                                                    <button
                                                        onClick={() => marcarAbonado(d)}
                                                        disabled={enviando}
                                                        title={`Se le pidió ${esperandoDesde(d.deposit_requested_at)}`}
                                                        className={cn(
                                                            button.base,
                                                            button.variant.success,
                                                            button.size.sm,
                                                        )}
                                                    >
                                                        <HandCoins size={14} aria-hidden="true" />
                                                        Abonó
                                                    </button>
                                                )}
                                                {(!esAbono ||
                                                    !d.deposit_requested_at ||
                                                    puedeReinsistir(d.deposit_requested_at)) && (
                                                    <button
                                                        onClick={() => abrirVistaPrevia(d)}
                                                        className={cn(
                                                            button.base,
                                                            esAbono
                                                                ? button.variant.secondary
                                                                : button.variant.success,
                                                            button.size.sm,
                                                        )}
                                                    >
                                                        {esAbono
                                                            ? d.deposit_requested_at
                                                                ? 'Volver a pedir'
                                                                : 'Pedir abono'
                                                            : 'Avisar'}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {hayMas && (
                                <p className="mt-3 text-2xs text-fg-subtle">
                                    Se muestran los primeros. A medida que vayas avisando aparecen los que faltan.
                                </p>
                            )}
                        </>
                    )}
                </div>

                <div className={modal.footer}>
                    {abierto ? (
                        <>
                            {/* Abierto en una solicitud puntual no hay lista
                                detras a la que volver: el boton mandaria a una
                                pantalla vacia. */}
                            {soloDemandaId ? (
                                <button
                                    onClick={onClose}
                                    className={cn(button.base, button.variant.secondary, button.size.md, 'mr-auto')}
                                >
                                    Cancelar
                                </button>
                            ) : (
                                <button
                                    onClick={() => setAbierto(null)}
                                    className={cn(button.base, button.variant.secondary, button.size.md, 'mr-auto')}
                                >
                                    <ArrowLeft size={15} aria-hidden="true" />
                                    Volver a la lista
                                </button>
                            )}
                            <button
                                onClick={enviar}
                                disabled={enviando || !texto.trim() || recientes >= AVISOS_POR_HORA}
                                className={cn(button.base, button.variant.success, button.size.md)}
                            >
                                {enviando ? (
                                    <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                                ) : (
                                    <Send size={15} aria-hidden="true" />
                                )}
                                {esAbono ? 'Mandar el pedido de abono' : 'Mandar el aviso'}
                            </button>
                        </>
                    ) : (
                        <button onClick={onClose} className={cn(button.base, button.variant.secondary, button.size.md)}>
                            Cerrar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AvisarLlegadaModal;
