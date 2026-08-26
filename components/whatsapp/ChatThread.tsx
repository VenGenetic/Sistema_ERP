import React, { memo } from 'react';
import { badge, cn } from '../ui/styles';
import MessageMedia from './MessageMedia';
import MessageActions from './MessageActions';

/**
 * El hilo de la conversación.
 *
 * Vive aparte de la página por dos razones, y la segunda es la que
 * importa: cada burbuja es un componente MEMOIZADO. Antes el hilo entero
 * se redibujaba con cada mensaje que llegaba por realtime, con cada tecla
 * del buscador y con cada recarga de la cola -- con cien mensajes, y con
 * fotos y reproductores de audio dentro, eso se siente lento justo cuando
 * el chat está activo. Ahora solo se redibuja la burbuja que cambió.
 *
 * Los mensajes se agrupan por DÍA y por autor, como en WhatsApp: un
 * separador de fecha cada vez que cambia el día, y los mensajes seguidos
 * de la misma persona se pegan sin repetir la hora. Un hilo de cien
 * mensajes sin eso es un muro de burbujas donde no se distingue una
 * conversación de ayer de una de hace un mes.
 */

export type ContentType =
    | 'text' | 'image' | 'audio' | 'system' | 'video'
    | 'document' | 'sticker' | 'location' | 'contact' | 'other';

export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface MensajeHilo {
    id: number;
    direction: 'inbound' | 'outbound';
    content_type: ContentType;
    body: string | null;
    created_at: string;
    delivery_status: DeliveryStatus | null;
    action_taken: string | null;
    media_url: string | null;
    whatsapp_message_id: string | null;
    deleted_at: string | null;
    reaction: string | null;
}

/** Lo que WhatsApp confirmó de cada mensaje que se mandó. */
export const ENTREGA: Record<DeliveryStatus, { texto: string; tono: keyof typeof badge.tone }> = {
    pending: { texto: 'Sin confirmar', tono: 'warning' },
    sent: { texto: 'Enviado', tono: 'info' },
    delivered: { texto: 'Entregado', tono: 'success' },
    read: { texto: 'Leído', tono: 'success' },
    failed: { texto: 'No se entregó', tono: 'danger' },
};

const SIN_TEXTO: Partial<Record<ContentType, string>> = {
    image: '(foto)',
    audio: '(nota de voz)',
    video: '(video)',
    document: '(archivo)',
    sticker: '(sticker)',
    location: '(ubicación)',
    contact: '(contacto)',
};

/** Tipos que DEBERÍAN traer archivo. Si no lo traen, se aclara. */
const CON_ARCHIVO = new Set<ContentType>(['image', 'audio', 'video', 'document', 'sticker']);

export const textoDe = (m: Pick<MensajeHilo, 'body' | 'content_type'>): string =>
    m.body || SIN_TEXTO[m.content_type] || '(sin texto)';

/** "Hoy" / "Ayer" / "12 de marzo" -- lo que se lee de un vistazo. */
function etiquetaDeDia(iso: string): string {
    const fecha = new Date(iso);
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);

    const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    if (mismoDia(fecha, hoy)) return 'Hoy';
    if (mismoDia(fecha, ayer)) return 'Ayer';
    return fecha.toLocaleDateString('es-EC', {
        day: 'numeric',
        month: 'long',
        // El año solo cuando no es el actual: repetirlo en cada separador
        // de una conversación de esta semana es ruido.
        ...(fecha.getFullYear() !== hoy.getFullYear() ? { year: 'numeric' } : {}),
    });
}

const hora = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });

interface BurbujaProps {
    m: MensajeHilo;
    /** Sigue al anterior del mismo autor: se pega y no repite la hora. */
    pegadoAlAnterior: boolean;
    onAbrirFoto: (m: MensajeHilo) => void;
    onResponder: (m: MensajeHilo) => void;
    onReaccionar: (m: MensajeHilo, emoji: string) => void;
    onBorrar: (m: MensajeHilo) => void;
}

const Burbuja = memo<BurbujaProps>(
    ({ m, pegadoAlAnterior, onAbrirFoto, onResponder, onReaccionar, onBorrar }) => {
        const entrante = m.direction === 'inbound';
        return (
            <div className={cn('flex group', entrante ? 'justify-start' : 'justify-end', pegadoAlAnterior ? 'mt-0.5' : 'mt-3')}>
                <div
                    className={cn(
                        'max-w-[80%] px-3.5 py-2 text-sm whitespace-pre-wrap break-words rounded-2xl',
                        entrante ? 'bg-surface-2 text-fg' : 'bg-primary-soft text-primary-soft-fg',
                        // La esquina del lado del autor se achica cuando el
                        // mensaje sigue al anterior: es lo que hace que un
                        // grupo se lea como un bloque y no como piezas sueltas.
                        pegadoAlAnterior && (entrante ? 'rounded-tl-md' : 'rounded-tr-md'),
                        m.deleted_at && 'line-through opacity-50',
                    )}
                >
                    {m.media_url && (
                        <div className="mb-1.5">
                            <MessageMedia
                                url={m.media_url}
                                contentType={m.content_type}
                                body={m.body}
                                onAbrirFoto={() => onAbrirFoto(m)}
                            />
                        </div>
                    )}
                    {(m.body || !m.media_url) && textoDe(m)}
                    {!m.media_url && CON_ARCHIVO.has(m.content_type) && (
                        <span className="ml-1 text-2xs text-fg-subtle">· archivo no guardado</span>
                    )}

                    {m.reaction && (
                        <span className="ml-1 inline-block rounded-full border border-subtle bg-surface px-1.5 text-sm leading-none">
                            {m.reaction}
                        </span>
                    )}

                    <div className="text-2xs text-fg-subtle mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>{hora(m.created_at)}</span>
                        {m.action_taken === 'human_reply' && <span>· vendedor</span>}

                        {/* El menú aparece al pasar el mouse: tenerlo siempre
                            visible en cien mensajes es ruido constante. Igual
                            queda accesible por teclado (focus-within). */}
                        {m.whatsapp_message_id && !m.deleted_at && (
                            <span className="ml-auto opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                <MessageActions
                                    onResponder={() => onResponder(m)}
                                    onReaccionar={(emoji) => onReaccionar(m, emoji)}
                                    onBorrar={m.direction === 'outbound' ? () => onBorrar(m) : undefined}
                                    alineacion={entrante ? 'izquierda' : 'derecha'}
                                />
                            </span>
                        )}

                        {/* El acuse aplica a todo lo que salió por el agente. Lo
                            escrito desde el teléfono del vendedor no lo tiene. */}
                        {!entrante && m.delivery_status && (
                            <span className={cn(badge.base, badge.size.sm, badge.tone[ENTREGA[m.delivery_status].tono])}>
                                {ENTREGA[m.delivery_status].texto}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    },
);
Burbuja.displayName = 'Burbuja';

const SeparadorDia: React.FC<{ etiqueta: string }> = ({ etiqueta }) => (
    <div className="flex items-center gap-3 my-4" role="separator" aria-label={etiqueta}>
        <span className="flex-1 h-px bg-subtle" />
        <span className="text-2xs font-semibold uppercase tracking-wider text-fg-subtle">{etiqueta}</span>
        <span className="flex-1 h-px bg-subtle" />
    </div>
);

interface Props {
    mensajes: MensajeHilo[];
    onAbrirFoto: (m: MensajeHilo) => void;
    onResponder: (m: MensajeHilo) => void;
    onReaccionar: (m: MensajeHilo, emoji: string) => void;
    onBorrar: (m: MensajeHilo) => void;
}

export const ChatThread: React.FC<Props> = ({ mensajes, onAbrirFoto, onResponder, onReaccionar, onBorrar }) => (
    <>
        {mensajes.map((m, i) => {
            const anterior = i > 0 ? mensajes[i - 1] : null;
            const diaNuevo =
                !anterior || new Date(anterior.created_at).toDateString() !== new Date(m.created_at).toDateString();
            // Se pega al anterior solo si es el mismo autor, el mismo día y
            // dentro de unos minutos: dos mensajes del mismo cliente con dos
            // horas de diferencia son dos momentos distintos.
            const pegado =
                !diaNuevo &&
                !!anterior &&
                anterior.direction === m.direction &&
                new Date(m.created_at).getTime() - new Date(anterior.created_at).getTime() < 5 * 60 * 1000;

            return (
                <React.Fragment key={m.id}>
                    {diaNuevo && <SeparadorDia etiqueta={etiquetaDeDia(m.created_at)} />}
                    <Burbuja
                        m={m}
                        pegadoAlAnterior={pegado}
                        onAbrirFoto={onAbrirFoto}
                        onResponder={onResponder}
                        onReaccionar={onReaccionar}
                        onBorrar={onBorrar}
                    />
                </React.Fragment>
            );
        })}
    </>
);

export default ChatThread;
