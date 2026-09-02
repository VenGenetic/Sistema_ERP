import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Search, Send, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useBackDismiss } from '../../hooks/useBackDismiss';
import { button, cn, focusRing, input, modal } from '../ui/styles';
import { textoPlano } from '../../utils/formatoWhatsApp';
import {
    encolarMensajes,
    mimeDeUrl,
    type NuevoMensaje,
    type OutboxKind,
} from '../../utils/whatsappOutbox';

/**
 * Pasar un mensaje de un chat a otro.
 *
 * Es de las cosas que más obligaban a agarrar el teléfono: el cliente manda
 * la foto de la pieza rota y hay que pasársela al del taller, o llega un
 * comprobante que tiene que ver el de administración. Sin esto había que
 * descargar la imagen, abrir el otro chat y volver a adjuntarla -- y la
 * foto quedaba fuera del hilo del ERP porque se mandaba desde el celular.
 *
 * Cinco destinos como máximo, igual que WhatsApp. No es una limitación
 * técnica: es el freno que evita que esto se convierta en una lista de
 * difusión improvisada, que es exactamente para lo que existen los avisos
 * de llegada (con su vista previa y su tope por hora).
 *
 * El reenvío NO copia la cita ni la reacción del original: se manda el
 * contenido, no el contexto de la otra conversación.
 */

const MAX_DESTINOS = 5;

interface Fila {
    id: number;
    phone_number: string;
    customer_name: string | null;
    last_message_at: string | null;
}

/** Lo mínimo que hace falta saber del mensaje que se reenvía. */
export interface MensajeAReenviar {
    id: number;
    body: string | null;
    media_url: string | null;
    content_type: string;
    /** Conserva el vínculo interno cuando se reenvía una ficha de catálogo. */
    product_id?: number | null;
}

interface Props {
    mensaje: MensajeAReenviar | null;
    /** Para no ofrecer como destino el chat donde ya está. */
    conversacionActual: number | null;
    userId: string | null;
    onClose: () => void;
    /** Se llama al terminar, con cuántos destinos salieron. */
    onEnviado?: (destinos: number) => void;
}

/**
 * Qué tipo de mensaje de la cola corresponde al contenido original.
 *
 * Un sticker se reenvía como imagen: la cola no tiene tipo de sticker y
 * mandarlo como documento le llegaría al cliente como un archivo.
 */
function tipoDeSalida(contentType: string, tieneMedia: boolean): OutboxKind {
    if (!tieneMedia) return 'text';
    if (contentType === 'image' || contentType === 'sticker') return 'image';
    if (contentType === 'video') return 'video';
    if (contentType === 'audio') return 'audio';
    return 'document';
}

/** MIME seguro cuando la URL no conserva una extensión reconocible. */
function mimeFallback(kind: OutboxKind): string {
    if (kind === 'image') return 'image/jpeg';
    if (kind === 'video') return 'video/mp4';
    if (kind === 'audio') return 'audio/ogg; codecs=opus';
    return 'application/octet-stream';
}

/** Recupera un nombre útil de la ruta pública de Storage para documentos. */
function nombreDeMedia(url: string): string {
    try {
        const ultimo = decodeURIComponent(url.split('?')[0].split('/').pop() || 'archivo');
        // Los adjuntos del ERP se guardan como timestamp_azar_nombre-original.
        return ultimo.replace(/^\d+_[a-z0-9]{6}_/i, '') || 'archivo';
    } catch {
        return 'archivo';
    }
}

export const ReenviarModal: React.FC<Props> = ({
    mensaje,
    conversacionActual,
    userId,
    onClose,
    onEnviado,
}) => {
    const abierto = !!mensaje;
    const [termino, setTermino] = useState('');
    const [filas, setFilas] = useState<Fila[]>([]);
    const [buscando, setBuscando] = useState(false);
    const [elegidos, setElegidos] = useState<Fila[]>([]);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const campoRef = useRef<HTMLInputElement>(null);
    const turnoRef = useRef(0);
    const enviandoRef = useRef(false);

    useBackDismiss(abierto, onClose);

    // Cada apertura empieza limpia: dejar elegido el destino de la vez
    // anterior es el camino corto a mandarle la foto al cliente equivocado.
    useEffect(() => {
        if (!abierto) return;
        setTermino('');
        setElegidos([]);
        setError(null);
        setEnviando(false);
        const t = setTimeout(() => campoRef.current?.focus(), 60);
        return () => clearTimeout(t);
    }, [abierto]);

    /* Escape: lo resuelve `useBackDismiss`, con la pila compartida. */

    /**
     * Los chats más recientes de entrada, y el buscador después. Reenviar
     * es casi siempre "al de recién", así que la lista útil ya está puesta
     * antes de escribir nada.
     */
    const buscar = useCallback(async (texto: string) => {
        const turno = ++turnoRef.current;
        setBuscando(true);
        try {
            let q = supabase
                .from('agent_conversations')
                .select('id, phone_number, customer_name, last_message_at')
                .order('last_message_at', { ascending: false, nullsFirst: false })
                .limit(30);

            const limpio = texto.trim().replace(/[,()*\\"]/g, ' ').trim();
            if (limpio.length >= 2) {
                const digitos = limpio.replace(/\D/g, '');
                const condiciones = [`customer_name.ilike.*${limpio}*`];
                if (digitos) condiciones.push(`phone_number.ilike.*${digitos}*`);
                q = q.or(condiciones.join(','));
            }

            const { data, error: err } = await q;
            if (turno !== turnoRef.current) return;
            if (err) throw err;
            setFilas((data ?? []) as Fila[]);
        } catch (err: any) {
            if (turno !== turnoRef.current) return;
            setError(err?.message ?? 'No se pudo buscar.');
        } finally {
            if (turno === turnoRef.current) setBuscando(false);
        }
    }, []);

    useEffect(() => {
        if (!abierto) return;
        const t = setTimeout(() => buscar(termino), 280);
        return () => clearTimeout(t);
    }, [termino, abierto, buscar]);

    const alternar = (fila: Fila) => {
        setError(null);
        setElegidos((prev) => {
            if (prev.some((e) => e.id === fila.id)) return prev.filter((e) => e.id !== fila.id);
            if (prev.length >= MAX_DESTINOS) {
                setError(`Se puede reenviar a ${MAX_DESTINOS} chats por vez.`);
                return prev;
            }
            return [...prev, fila];
        });
    };

    const visibles = useMemo(
        () => filas.filter((f) => f.id !== conversacionActual),
        [filas, conversacionActual],
    );

    const enviar = async () => {
        if (!mensaje || elegidos.length === 0 || enviandoRef.current) return;
        enviandoRef.current = true;
        setEnviando(true);
        setError(null);
        try {
            const kind = tipoDeSalida(mensaje.content_type, !!mensaje.media_url);
            const cuerpo = mensaje.body?.trim() || null;
            if (!cuerpo && !mensaje.media_url) {
                throw new Error('Este mensaje ya no conserva contenido que se pueda reenviar.');
            }

            const mensajes: NuevoMensaje[] = elegidos.map((destino) => ({
                conversationId: destino.id,
                body: cuerpo,
                kind,
                mediaUrl: mensaje.media_url,
                mediaMime: mensaje.media_url ? mimeDeUrl(mensaje.media_url, mimeFallback(kind)) : null,
                mediaFilename:
                    mensaje.media_url && kind === 'document'
                        ? nombreDeMedia(mensaje.media_url)
                        : null,
                productId: mensaje.product_id ?? null,
            }));

            // Todo en un solo insert: si son cinco destinos, o entran los
            // cinco o no entra ninguno. Media docena de mensajes a medio
            // mandar es peor que ninguno.
            await encolarMensajes(mensajes, userId);
            onEnviado?.(elegidos.length);
            onClose();
        } catch (err: any) {
            setError(err?.message ?? 'No se pudo reenviar.');
        } finally {
            enviandoRef.current = false;
            setEnviando(false);
        }
    };

    if (!abierto || !mensaje) return null;

    const vistaPrevia = textoPlano(mensaje.body) || (mensaje.media_url ? 'Archivo adjunto' : '');
    const etiquetaMedia =
        mensaje.content_type === 'image' ? 'Foto'
        : mensaje.content_type === 'video' ? 'Video'
        : mensaje.content_type === 'audio' ? 'Nota de voz'
        : mensaje.content_type === 'sticker' ? 'Sticker'
        : mensaje.media_url ? 'Archivo' : null;

    return (
        <div className={modal.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div
                /* `lg` y no `md`: adentro va un buscador y una lista de chats con
                   nombre y número, y en 448px el número se cortaba.
                   El alto lo pone `modal.panel`; repetir un `max-h` acá era
                   pelearse con esa clase por cuál gana en la hoja. */
                className={cn(modal.panel, modal.width.lg)}
                role="dialog"
                aria-modal="true"
                aria-label="Reenviar mensaje"
            >
                <div className={modal.header}>
                    <div className="min-w-0">
                        <h2 className={modal.title}>Reenviar</h2>
                        <p className={modal.subtitle}>
                            Elegí hasta {MAX_DESTINOS} chats. Se manda el contenido, no la conversación.
                        </p>
                    </div>
                    <button onClick={onClose} className={modal.close} aria-label="Cerrar">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                {/* Qué se está por reenviar. Va arriba y siempre visible: es lo
                    único que evita mandar el mensaje equivocado cuando se
                    abrió el menú sobre la burbuja de al lado. */}
                <div className="shrink-0 border-b border-subtle bg-surface-2/60 px-5 py-3">
                    <p className="text-2xs font-semibold uppercase tracking-wider text-fg-subtle">
                        Mensaje
                    </p>
                    <div className="mt-1 flex items-start gap-2">
                        {mensaje.media_url && mensaje.content_type === 'image' && (
                            <img
                                src={mensaje.media_url}
                                alt=""
                                className="h-11 w-11 shrink-0 rounded-md object-cover"
                            />
                        )}
                        <p className="line-clamp-2 min-w-0 flex-1 text-sm text-fg">
                            {etiquetaMedia && !vistaPrevia && (
                                <span className="text-fg-muted">{etiquetaMedia}</span>
                            )}
                            {vistaPrevia}
                        </p>
                    </div>
                </div>

                <div className="shrink-0 border-b border-subtle px-5 py-3">
                    <div className="relative">
                        <Search size={16} className={input.leadingIcon} aria-hidden="true" />
                        <input
                            ref={campoRef}
                            value={termino}
                            onChange={(e) => setTermino(e.target.value)}
                            placeholder="Buscar un chat por nombre o número…"
                            aria-label="Buscar el chat de destino"
                            className={cn(input.base, input.size.md, input.withLeadingIcon)}
                        />
                        {buscando && (
                            <Loader2
                                size={16}
                                className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-fg-subtle"
                                aria-hidden="true"
                            />
                        )}
                    </div>

                    {elegidos.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {elegidos.map((e) => (
                                <button
                                    key={e.id}
                                    onClick={() => alternar(e)}
                                    className={cn(
                                        focusRing,
                                        'inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-2xs font-semibold text-primary-soft-fg hover:bg-primary/20',
                                    )}
                                >
                                    {e.customer_name || `+${e.phone_number}`}
                                    <X size={11} aria-hidden="true" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="min-h-0 flex-1 divide-y divide-subtle overflow-y-auto">
                    {visibles.length === 0 && !buscando && (
                        <p className="px-5 py-10 text-center text-sm text-fg-muted">
                            {termino.trim() ? 'Ningún chat coincide.' : 'No hay otros chats.'}
                        </p>
                    )}
                    {visibles.map((f) => {
                        const puesto = elegidos.some((e) => e.id === f.id);
                        return (
                            <button
                                key={f.id}
                                onClick={() => alternar(f)}
                                aria-pressed={puesto}
                                className={cn(
                                    focusRing,
                                    'flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors',
                                    puesto ? 'bg-primary-soft/40' : 'hover:bg-surface-hover',
                                )}
                            >
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                                        puesto
                                            ? 'border-primary bg-primary text-primary-fg'
                                            : 'border-strong',
                                    )}
                                >
                                    {puesto && <Check size={12} />}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-fg">
                                        {f.customer_name || `+${f.phone_number}`}
                                    </span>
                                    {f.customer_name && (
                                        <span className="block truncate text-xs tabular-nums text-fg-muted">
                                            +{f.phone_number}
                                        </span>
                                    )}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className={modal.footer}>
                    {error && <p className="mr-auto text-xs text-danger">{error}</p>}
                    {!error && elegidos.length > 0 && (
                        <p className="mr-auto text-xs text-fg-muted">
                            Se va a mandar a {elegidos.length}{' '}
                            {elegidos.length === 1 ? 'chat' : 'chats'}.
                        </p>
                    )}
                    <button
                        onClick={onClose}
                        className={cn(button.base, button.variant.secondary, button.size.md)}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={enviar}
                        disabled={elegidos.length === 0 || enviando}
                        className={cn(button.base, button.variant.primary, button.size.md)}
                    >
                        {enviando ? (
                            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                        ) : (
                            <Send size={15} aria-hidden="true" />
                        )}
                        {enviando ? 'Enviando…' : 'Reenviar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReenviarModal;
