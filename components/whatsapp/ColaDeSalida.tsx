import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Ban, Clock3, FileText, Mic, RotateCw } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { cn } from '../ui/styles';
import {
    CAMPOS_COLA,
    cancelarMensaje,
    KINDS_MENSAJE,
    reintentarMensaje,
    type MensajeEnCola,
} from '../../utils/whatsappOutbox';

/**
 * Lo que se mandó pero todavía no salió.
 *
 * Es lo que hace visible el tramo entre "le di a enviar" y "el cliente lo
 * recibió": mientras el proceso del agente no lo despache, el mensaje se ve
 * al final del hilo marcado como en cola y se puede cancelar. Sin esto, ese
 * hueco de unos segundos parece que el envío no funcionó -- y la persona
 * manda el mismo mensaje tres veces.
 *
 * El hook y la burbuja viven juntos y los usan LAS DOS pantallas: el modo
 * móvil no tenía nada de esto, así que desde el teléfono se enviaba a
 * ciegas.
 */

/** Cada cuánto se relee la cola mientras hay algo esperando salir. */
const REPASO_MS = 4000;

interface Opciones {
    /** Fallos que la pantalla tiene que mostrar. */
    onError: (mensaje: string) => void;
    /**
     * Se llama cuando un mensaje que se quiso cancelar YA había salido: el
     * hilo tiene que recargarse porque ese mensaje ahora está en él.
     */
    onYaHabiaSalido?: () => void;
}

export function useColaDeSalida(conversationId: number | null, { onError, onYaHabiaSalido }: Opciones) {
    const [enCola, setEnCola] = useState<MensajeEnCola[]>([]);

    // El id va por referencia para que `recargar` no cambie de identidad en
    // cada render: la caja de escribir la llama después de enviar.
    const idRef = useRef<number | null>(conversationId);
    idRef.current = conversationId;

    /**
     * Solo `pending` y `failed`: lo que ya salió aparece en el hilo real
     * (`agent_messages`), y mostrarlo dos veces haría dudar de si se mandó
     * una vez o dos.
     *
     * Y solo MENSAJES. Por esta misma cola viajan las acciones que el
     * agente ejecuta contra WhatsApp -- marcar leído, marcar sin leer,
     * borrar, reaccionar -- y ninguna le muestra nada al cliente. Sin el
     * filtro, abrir un chat sin leer dibujaba al final del hilo una
     * burbuja verde vacía diciendo "En cola" con un botón de cancelar: el
     * acuse de lectura disfrazado de mensaje por enviar.
     */
    const recargar = useCallback(async () => {
        const id = idRef.current;
        if (!id) {
            setEnCola([]);
            return;
        }
        const { data, error } = await supabase
            .from('agent_outbox')
            .select(CAMPOS_COLA)
            .eq('conversation_id', id)
            .in('status', ['pending', 'failed'])
            .in('kind', KINDS_MENSAJE)
            .order('created_at', { ascending: true });
        if (error) {
            console.error('No se pudo leer la cola de salida:', error.message);
            return;
        }
        setEnCola((data ?? []) as unknown as MensajeEnCola[]);
    }, []);

    useEffect(() => {
        if (!conversationId) {
            setEnCola([]);
            return;
        }
        recargar();

        const canal = supabase
            .channel(`agent_outbox_conversation_${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'agent_outbox',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                () => recargar(),
            )
            .subscribe();

        return () => {
            canal.unsubscribe();
        };
    }, [conversationId, recargar]);

    /**
     * Además del realtime, se repasa mientras haya algo pendiente.
     *
     * Es a propósito: `agent_outbox` tiene que estar agregada a la
     * publicación `supabase_realtime` para que lleguen eventos (migración
     * 0028), y si esa migración no se aplicó el mensaje se quedaría marcado
     * como "En cola" para siempre aunque el cliente ya lo tenga. Solo corre
     * mientras hay pendientes, así que en un chat quieto no consulta nada.
     */
    const hayPendientes = enCola.some((q) => q.status === 'pending');
    useEffect(() => {
        if (!hayPendientes) return;
        const t = setInterval(() => recargar(), REPASO_MS);
        return () => clearInterval(t);
    }, [hayPendientes, recargar]);

    const cancelar = useCallback(
        async (item: MensajeEnCola) => {
            try {
                const cancelado = await cancelarMensaje(item.id);
                if (!cancelado) {
                    // Se despachó entre el toque y el update: decirle a la
                    // persona que se canceló sería mentirle sobre algo que el
                    // cliente ya tiene en el teléfono.
                    onError('Ese mensaje ya había salido, no se pudo cancelar.');
                    onYaHabiaSalido?.();
                }
                await recargar();
            } catch (err: any) {
                onError(`No se pudo cancelar: ${err?.message ?? err}`);
            }
        },
        [onError, onYaHabiaSalido, recargar],
    );

    const reintentar = useCallback(
        async (item: MensajeEnCola) => {
            try {
                await reintentarMensaje(item.id);
                await recargar();
            } catch (err: any) {
                onError(`No se pudo reintentar: ${err?.message ?? err}`);
            }
        },
        [onError, recargar],
    );

    return { enCola, recargar, cancelar, reintentar };
}

interface PropsBurbujas {
    items: MensajeEnCola[];
    onCancelar: (item: MensajeEnCola) => void;
    onReintentar: (item: MensajeEnCola) => void;
    /** En el teléfono: texto y zonas táctiles más grandes. */
    tactil?: boolean;
}

/**
 * Las burbujas de lo que espera salir. Van al final del hilo, con la misma
 * burbuja verde que un mensaje enviado pero atenuada y con el relojito: se
 * ve dónde va a quedar sin fingir que el cliente ya lo recibió.
 */
export const BurbujasEnCola: React.FC<PropsBurbujas> = ({ items, onCancelar, onReintentar, tactil = false }) => (
    <>
        {items.map((q) => (
            <div key={`cola-${q.id}`} className="group mt-0.5 flex justify-end px-2 md:px-4">
                <div
                    className={cn(
                        'relative min-w-0 max-w-[85%] rounded-lg px-2 py-[6px] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] md:max-w-[65%]',
                        q.status === 'failed'
                            ? 'bg-danger-soft text-danger-soft-fg'
                            : 'bg-wa-out text-wa-text opacity-80',
                    )}
                >
                    {q.media_url && q.kind === 'image' && (
                        <img
                            src={q.media_url}
                            alt={q.body ?? 'Foto por enviar'}
                            className="mb-1 max-h-56 w-auto rounded-[6px] object-cover"
                        />
                    )}
                    {q.media_url && q.kind === 'audio' && (
                        <p className="mb-1 flex items-center gap-1.5 text-[13px]">
                            <Mic size={14} aria-hidden="true" />
                            Nota de voz
                        </p>
                    )}
                    {q.media_url && q.kind !== 'image' && q.kind !== 'audio' && (
                        <p className="mb-1 flex items-center gap-1.5 text-[13px]">
                            <FileText size={14} aria-hidden="true" />
                            {q.media_filename ?? 'archivo'}
                        </p>
                    )}

                    {q.body && (
                        <p
                            className={cn(
                                'whitespace-pre-wrap break-words',
                                tactil ? 'text-[15px] leading-[20px]' : 'text-[14.2px] leading-[19px]',
                            )}
                        >
                            {q.body}
                        </p>
                    )}

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-wa-meta-out">
                        {q.status === 'failed' ? (
                            <>
                                <span className="font-semibold">No se pudo enviar</span>
                                <button
                                    onClick={() => onReintentar(q)}
                                    className={cn(
                                        'inline-flex items-center gap-1 underline underline-offset-2 hover:no-underline',
                                        tactil && 'min-h-[32px] px-1',
                                    )}
                                >
                                    <RotateCw size={12} aria-hidden="true" /> Reintentar
                                </button>
                            </>
                        ) : (
                            <>
                                <span className="inline-flex items-center gap-1">
                                    <Clock3 size={13} aria-hidden="true" /> En cola
                                </span>
                                <button
                                    onClick={() => onCancelar(q)}
                                    className={cn(
                                        'inline-flex items-center gap-1 underline underline-offset-2 hover:no-underline',
                                        tactil && 'min-h-[32px] px-1',
                                    )}
                                >
                                    <Ban size={12} aria-hidden="true" /> Cancelar
                                </button>
                            </>
                        )}
                    </div>

                    {/* El motivo exacto del fallo: sin esto, "no se pudo enviar" no
                        le dice a nadie qué hacer al respecto. */}
                    {q.error && <p className="mt-1 text-[11px] opacity-80">{q.error}</p>}
                </div>
            </div>
        ))}
    </>
);

export default BurbujasEnCola;
