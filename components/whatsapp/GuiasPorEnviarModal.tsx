import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, PackageCheck, RefreshCw, Send, Truck, UserSearch } from 'lucide-react';
import Modal from '../ui/Modal';
import { badge, button, cn } from '../ui/styles';
import {
    guiasDeHoy,
    reenviarGuia,
    type CandidatoConNombre,
    type GuiaPendiente,
} from '../../utils/reenvioDeGuias';

/**
 * Las guías de transporte de hoy y a quién le toca cada una.
 *
 * El transportista manda las guías a un solo chat. Esta pantalla las lee,
 * dice de quién es cada una -- cruzando el nombre, la ciudad y la dirección
 * de la guía contra lo que el propio cliente escribió en su conversación --
 * y las reenvía.
 *
 * DECISIONES QUE SE VEN EN LA PANTALLA, y por qué:
 *
 *   - Se muestran TAMBIÉN las ya enviadas y las que no se pudieron
 *     emparejar. Una guía que no salió es un cliente esperando un paquete
 *     sin saber por dónde viene: esconderla sería el peor resultado.
 *   - Cuando dos clientes empatan, no se elige solo. La guía lleva impresa
 *     la dirección de una persona; mandársela a otra no se puede deshacer.
 *   - Cada envío dice QUÉ campos coincidieron. Sin eso, «se lo mandé a
 *     este» es un acto de fe.
 */

interface Props {
    isOpen: boolean;
    onClose: () => void;
    /** Teléfono del chat por donde entran las guías. */
    telefonoOrigen: string;
    userId: string | null;
}

const NOMBRE_CAMPO: Record<string, string> = {
    nombre: 'nombre',
    cedula: 'cédula',
    telefono: 'teléfono',
    ciudad: 'ciudad',
    direccion: 'dirección',
};

const etiquetaCliente = (c: CandidatoConNombre) => c.nombre?.trim() || `+${c.telefono}`;

export const GuiasPorEnviarModal: React.FC<Props> = ({ isOpen, onClose, telefonoOrigen, userId }) => {
    const [cargando, setCargando] = useState(false);
    const [guias, setGuias] = useState<GuiaPendiente[]>([]);
    const [origen, setOrigen] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState<Set<number>>(new Set());
    const [aviso, setAviso] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const r = await guiasDeHoy(telefonoOrigen);
            setOrigen(r.conversationId);
            setGuias(r.guias);
        } catch (err: any) {
            setError(err?.message ?? 'No se pudieron leer las guías.');
        } finally {
            setCargando(false);
        }
    }, [telefonoOrigen]);

    useEffect(() => {
        if (isOpen) void cargar();
    }, [isOpen, cargar]);

    const enviarUna = async (g: GuiaPendiente, destino: CandidatoConNombre) => {
        if (enviando.has(g.mensajeId)) return;
        setEnviando((prev) => new Set(prev).add(g.mensajeId));
        setError(null);
        try {
            await reenviarGuia({
                guia: g.guia,
                mediaUrl: g.mediaUrl,
                conversationId: destino.conversationId,
                mensajeOrigenId: g.mensajeId,
                campos: destino.campos,
                userId,
            });
            setAviso(`Guía ${g.guia.numero} enviada a ${etiquetaCliente(destino)}.`);
            // Se relee en vez de parchear en memoria: así el estado que se ve
            // es el que quedó en la base, incluida la barrera de doble envío.
            await cargar();
        } catch (err: any) {
            setError(err?.message ?? 'No se pudo enviar la guía.');
        } finally {
            setEnviando((prev) => {
                const s = new Set(prev);
                s.delete(g.mensajeId);
                return s;
            });
        }
    };

    const seguras = guias.filter((g) => !g.yaEnviada && g.decision.tipo === 'enviar');

    const enviarTodasLasSeguras = async () => {
        for (const g of seguras) {
            const decision = g.decision;
            if (decision.tipo !== 'enviar') continue;
            const destino = g.candidatos.find(
                (c) => c.conversationId === decision.destinatario.conversationId,
            );
            if (destino) await enviarUna(g, destino);
        }
    };

    const pendientes = guias.filter((g) => !g.yaEnviada);
    const enviadas = guias.filter((g) => g.yaEnviada);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            width="xl"
            title="Guías de envío de hoy"
            subtitle={`Se leen del chat +${telefonoOrigen.replace(/\D/g, '')}. Solo las de hoy.`}
            footer={
                <>
                    <button
                        onClick={() => void cargar()}
                        disabled={cargando}
                        className={cn(button.base, button.variant.secondary, button.size.md)}
                    >
                        {cargando ? (
                            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                        ) : (
                            <RefreshCw size={15} aria-hidden="true" />
                        )}
                        Volver a revisar
                    </button>
                    <button
                        onClick={() => void enviarTodasLasSeguras()}
                        disabled={cargando || seguras.length === 0 || enviando.size > 0}
                        className={cn(button.base, button.variant.primary, button.size.md)}
                    >
                        <Send size={15} aria-hidden="true" />
                        Enviar las {seguras.length} seguras
                    </button>
                </>
            }
        >
            {error && (
                <p role="alert" className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-soft-fg">
                    {error}
                </p>
            )}
            {aviso && (
                <p className="mb-3 rounded-lg bg-success-soft px-3 py-2 text-sm text-success-soft-fg">{aviso}</p>
            )}

            {cargando && guias.length === 0 && (
                <p className="py-8 text-center text-sm text-fg-muted">Buscando las guías de hoy…</p>
            )}

            {!cargando && origen === null && (
                <div className="rounded-xl border border-warning/35 bg-warning-soft p-4 text-sm text-warning-soft-fg">
                    <p className="font-semibold">No existe una conversación con ese número.</p>
                    <p className="mt-1 leading-5">
                        Todavía no llegó ningún mensaje desde <strong>+{telefonoOrigen.replace(/\D/g, '')}</strong>, así
                        que no hay guías que leer. En cuanto reenvíes la primera a ese chat, aparece acá.
                    </p>
                </div>
            )}

            {!cargando && origen !== null && guias.length === 0 && (
                <div className="rounded-xl border border-subtle bg-surface-2 p-4 text-sm text-fg-muted">
                    <p className="font-semibold text-fg">Hoy no llegó ninguna guía a ese chat.</p>
                    <p className="mt-1 leading-5">
                        Se miran solo los mensajes de hoy, para no reenviar envíos viejos a clientes que ya
                        recibieron su paquete.
                    </p>
                </div>
            )}

            <div className="space-y-2">
                {pendientes.map((g) => (
                    <FilaDeGuia
                        key={g.mensajeId}
                        guia={g}
                        enviando={enviando.has(g.mensajeId)}
                        onEnviar={(destino) => void enviarUna(g, destino)}
                    />
                ))}
            </div>

            {enviadas.length > 0 && (
                <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-semibold text-fg-muted">
                        Ya enviadas hoy ({enviadas.length})
                    </summary>
                    <div className="mt-2 space-y-2">
                        {enviadas.map((g) => (
                            <FilaDeGuia key={g.mensajeId} guia={g} enviando={false} onEnviar={() => {}} />
                        ))}
                    </div>
                </details>
            )}
        </Modal>
    );
};

const FilaDeGuia: React.FC<{
    guia: GuiaPendiente;
    enviando: boolean;
    onEnviar: (destino: CandidatoConNombre) => void;
}> = ({ guia: g, enviando, onEnviar }) => {
    /* La decisión se copia a una constante antes de usarla dentro de un
       callback: TypeScript no conserva el estrechamiento de la unión al
       entrar en la función de `find`. */
    const decision = g.decision;
    const destinatario =
        decision.tipo === 'enviar'
            ? g.candidatos.find((c) => c.conversationId === decision.destinatario.conversationId)
            : undefined;
    const empatados = decision.tipo === 'ambiguo' ? decision.empatados : [];

    return (
        <div className="flex gap-3 rounded-xl border border-subtle bg-surface p-3">
            {g.mediaUrl ? (
                <img
                    src={g.mediaUrl}
                    alt={`Guía ${g.guia.numero ?? ''}`}
                    className="h-20 w-20 shrink-0 rounded-lg border border-subtle object-cover"
                />
            ) : (
                <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-subtle">
                    <Truck size={22} aria-hidden="true" />
                </span>
            )}

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="tnum text-sm font-bold text-fg">Guía {g.guia.numero ?? 'sin número'}</span>
                    {g.guia.ciudad && (
                        <span className={cn(badge.base, badge.size.sm, badge.tone.neutral)}>{g.guia.ciudad}</span>
                    )}
                </div>
                <p className="mt-0.5 truncate text-xs text-fg-muted">
                    {g.guia.nombre ?? 'Sin destinatario en la guía'}
                    {g.guia.direccion && ` · ${g.guia.direccion}`}
                </p>

                {/* El estado, que es lo que decide qué hacer con esta fila. */}
                {g.yaEnviada ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-success">
                        <CheckCircle2 size={14} aria-hidden="true" />
                        Ya se envió{' '}
                        {g.yaEnviada.via === 'chat'
                            ? '(se encontró en el chat del cliente)'
                            : g.yaEnviada.via === 'cola'
                              ? '(está saliendo ahora)'
                              : ''}
                        {g.yaEnviada.cuando && ` · ${new Date(g.yaEnviada.cuando).toLocaleString('es-EC')}`}
                    </p>
                ) : g.decision.tipo === 'enviar' && destinatario ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-fg-muted">
                            Es de <strong className="text-fg">{etiquetaCliente(destinatario)}</strong> — coincide{' '}
                            {destinatario.campos.map((c) => NOMBRE_CAMPO[c] ?? c).join(' y ')}
                        </span>
                        <button
                            onClick={() => onEnviar(destinatario)}
                            disabled={enviando}
                            className={cn(button.base, button.variant.primary, button.size.xs)}
                        >
                            {enviando ? (
                                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                            ) : (
                                <PackageCheck size={13} aria-hidden="true" />
                            )}
                            Enviar
                        </button>
                    </div>
                ) : decision.tipo === 'ambiguo' ? (
                    <div className="mt-2">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-warning-soft-fg">
                            <AlertTriangle size={14} aria-hidden="true" />
                            Coinciden {empatados.length} clientes por igual. Elegí vos cuál es.
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {g.candidatos
                                .filter((c) => empatados.some((e) => e.conversationId === c.conversationId))
                                .map((c) => (
                                    <button
                                        key={c.conversationId}
                                        onClick={() => onEnviar(c)}
                                        disabled={enviando}
                                        className={cn(button.base, button.variant.secondary, button.size.xs)}
                                    >
                                        {etiquetaCliente(c)}
                                        <span className="text-fg-subtle">
                                            ({c.campos.map((x) => NOMBRE_CAMPO[x] ?? x).join('+')})
                                        </span>
                                    </button>
                                ))}
                        </div>
                    </div>
                ) : (
                    <div className="mt-2">
                        <p className="flex items-center gap-1.5 text-xs text-fg-muted">
                            <UserSearch size={14} aria-hidden="true" />
                            Ningún cliente coincide en dos datos. Nadie escribió estos datos en su chat.
                        </p>
                        {g.candidatos.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {g.candidatos.slice(0, 4).map((c) => (
                                    <button
                                        key={c.conversationId}
                                        onClick={() => onEnviar(c)}
                                        disabled={enviando}
                                        title={`Coincide solo ${c.campos.map((x) => NOMBRE_CAMPO[x] ?? x).join(' y ')}`}
                                        className={cn(button.base, button.variant.secondary, button.size.xs)}
                                    >
                                        {etiquetaCliente(c)}
                                        <span className="text-fg-subtle">
                                            ({c.campos.map((x) => NOMBRE_CAMPO[x] ?? x).join('+')})
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GuiasPorEnviarModal;
