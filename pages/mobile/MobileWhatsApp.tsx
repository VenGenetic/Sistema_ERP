import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ImageIcon, Loader2, MessageCircle, Paperclip, RefreshCw, Search, Send, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import MessageMedia from '../../components/whatsapp/MessageMedia';
import VoiceRecorder from '../../components/whatsapp/VoiceRecorder';
import { encolarMensajes, subirAdjunto, type NuevoMensaje } from '../../utils/whatsappOutbox';

/**
 * WhatsApp en el teléfono: leer la conversación y contestarle al cliente.
 *
 * Deliberadamente MÁS CHICA que la bandeja de escritorio. Acá no están el
 * buscador del catálogo, el armador de proformas ni la ficha del cliente:
 * son pantallas de trabajo sentado, y meterlas en 360px las volvería
 * incómodas para todos sin que nadie las use así. En el teléfono lo que se
 * necesita es lo urgente -- ver qué mandó el cliente (foto de la pieza,
 * nota de voz) y contestarle rápido.
 *
 * Todo lo que decide QUÉ se manda vive en `utils/whatsappOutbox.ts`,
 * compartido con el escritorio: acá no se repite ninguna regla de negocio.
 * Los reproductores y el grabador también son los mismos componentes.
 *
 * Dos vistas en una sola ruta (lista <-> chat) en vez de dos rutas: el
 * botón «atrás» del teléfono tiene que volver a la lista, no salirse del
 * modo móvil, y con una sola ruta eso es un cambio de estado en vez de
 * historial que hay que administrar.
 */

interface Conversacion {
    id: number;
    phone_number: string;
    customer_name: string | null;
    last_message_at: string | null;
    unread_count: number;
    lid: string | null;
}

interface Mensaje {
    id: number;
    direction: 'inbound' | 'outbound';
    content_type: string;
    body: string | null;
    media_url: string | null;
    created_at: string;
    action_taken: string | null;
}

/** Cuántas conversaciones se traen. Bajo a propósito: es un teléfono. */
const POR_PAGINA = 40;
const MENSAJES_VISIBLES = 40;

const CAMPOS_MSG = 'id, direction, content_type, body, media_url, created_at, action_taken';

/** Los números se guardan como solo dígitos (migración 0021). */
function formatearTelefono(c: Pick<Conversacion, 'phone_number' | 'lid'>): string {
    const d = c.phone_number ?? '';
    if (c.lid === d || d.length > 13) return `ID ${d.slice(-6)}`;
    if (d.startsWith('593') && d.length >= 11) {
        const local = d.slice(3);
        return `+593 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
    }
    return `+${d}`;
}

function hace(iso: string): string {
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'ahora';
    if (min < 60) return `${min}m`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h}h`;
    return `${Math.round(h / 24)}d`;
}

const SIN_TEXTO: Record<string, string> = {
    image: 'Foto',
    audio: 'Nota de voz',
    video: 'Video',
    document: 'Archivo',
    sticker: 'Sticker',
    location: 'Ubicación',
    contact: 'Contacto',
};

const MobileWhatsApp: React.FC = () => {
    const { session } = useAuth();
    const userId = session?.user?.id ?? null;

    const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
    const [cargando, setCargando] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [abierta, setAbierta] = useState<Conversacion | null>(null);
    const [mensajes, setMensajes] = useState<Mensaje[]>([]);
    const [cargandoChat, setCargandoChat] = useState(false);
    const [borrador, setBorrador] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const hiloRef = useRef<HTMLDivElement | null>(null);
    const fileRef = useRef<HTMLInputElement | null>(null);

    /* ------------------------------------------------------------------ */
    /*  Lista                                                              */
    /* ------------------------------------------------------------------ */

    const cargarLista = useCallback(async () => {
        setCargando(true);
        let q = supabase
            .from('agent_conversations')
            .select('id, phone_number, customer_name, last_message_at, unread_count, lid')
            .order('last_message_at', { ascending: false, nullsFirst: false })
            .limit(POR_PAGINA);

        const texto = busqueda.trim();
        if (texto) {
            const digitos = texto.replace(/\D/g, '');
            const condiciones = [`customer_name.ilike.*${texto.replace(/[,()*\\"]/g, ' ')}*`];
            if (digitos) condiciones.push(`phone_number.ilike.*${digitos}*`);
            q = q.or(condiciones.join(','));
        }

        const { data, error: err } = await q;
        setCargando(false);
        if (err) {
            setError(`No se pudieron cargar los chats: ${err.message}`);
            return;
        }
        setError(null);
        setConversaciones((data ?? []) as Conversacion[]);
    }, [busqueda]);

    // La búsqueda va contra la base: se espera a que termine de tipear.
    useEffect(() => {
        const t = setTimeout(() => cargarLista(), 350);
        return () => clearTimeout(t);
    }, [cargarLista]);

    /* ------------------------------------------------------------------ */
    /*  Chat                                                               */
    /* ------------------------------------------------------------------ */

    const cargarMensajes = useCallback(async (conversationId: number) => {
        setCargandoChat(true);
        const { data, error: err } = await supabase
            .from('agent_messages')
            .select(CAMPOS_MSG)
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(MENSAJES_VISIBLES);
        setCargandoChat(false);
        if (err) {
            setError(`No se pudo abrir el chat: ${err.message}`);
            return;
        }
        setMensajes((data as Mensaje[]).slice().reverse());
    }, []);

    const abrirChat = async (c: Conversacion) => {
        setAbierta(c);
        setMensajes([]);
        setBorrador('');
        setError(null);
        await cargarMensajes(c.id);
        // Abrirlo cuenta como leído, igual que en el escritorio.
        if (c.unread_count > 0) {
            await supabase.from('agent_conversations').update({ unread_count: 0 }).eq('id', c.id);
            setConversaciones((prev) => prev.map((x) => (x.id === c.id ? { ...x, unread_count: 0 } : x)));
        }
    };

    /**
     * Mensajes en vivo del chat abierto. Solo INSERT y filtrado por
     * conversación: en un teléfono no hay para qué escuchar la tabla
     * entera, y menos con datos móviles.
     */
    useEffect(() => {
        if (!abierta) return;
        const canal = supabase
            .channel(`mobile_msgs_${abierta.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'agent_messages', filter: `conversation_id=eq.${abierta.id}` },
                (payload) => {
                    const nuevo = payload.new as Mensaje;
                    setMensajes((prev) => (prev.some((m) => m.id === nuevo.id) ? prev : [...prev, nuevo]));
                },
            )
            .subscribe();
        return () => {
            canal.unsubscribe();
        };
    }, [abierta]);

    // El hilo arranca abajo del todo, donde está lo último que se dijo.
    useEffect(() => {
        const c = hiloRef.current;
        if (c) c.scrollTop = c.scrollHeight;
    }, [mensajes]);

    // El botón «atrás» del teléfono vuelve a la lista en vez de salirse.
    useEffect(() => {
        if (!abierta) return;
        window.history.pushState({ chat: abierta.id }, '');
        const volver = () => setAbierta(null);
        window.addEventListener('popstate', volver);
        return () => window.removeEventListener('popstate', volver);
    }, [abierta]);

    /* ------------------------------------------------------------------ */
    /*  Envío                                                              */
    /* ------------------------------------------------------------------ */

    const enviar = async (mensajes: NuevoMensaje[]) => {
        await encolarMensajes(mensajes, userId);
        // El mensaje aparece en el hilo cuando el agente lo despacha (llega
        // por realtime). No se pinta antes: mostrarlo como enviado sin que
        // haya salido es justo lo que el acuse de recibo vino a evitar.
    };

    const enviarTexto = async () => {
        const texto = borrador.trim();
        if (!texto || !abierta || enviando) return;
        setEnviando(true);
        setError(null);
        try {
            await enviar([{ conversationId: abierta.id, body: texto, kind: 'text' }]);
            setBorrador('');
        } catch (err: any) {
            setError(err?.message ?? 'No se pudo enviar.');
        } finally {
            setEnviando(false);
        }
    };

    const enviarArchivos = async (files: File[]) => {
        if (files.length === 0 || !abierta) return;
        setEnviando(true);
        setError(null);
        try {
            const subidos = await Promise.all(files.map((f) => subirAdjunto(f)));
            const texto = borrador.trim();
            await enviar(
                subidos.map((s, i) => ({
                    conversationId: abierta.id,
                    // El texto va como pie de la primera, como en WhatsApp.
                    body: i === 0 && texto ? texto : null,
                    kind: s.kind,
                    mediaUrl: s.url,
                    mediaMime: s.mime,
                    mediaFilename: s.filename,
                })),
            );
            setBorrador('');
        } catch (err: any) {
            setError(err?.message ?? 'No se pudo enviar el archivo.');
        } finally {
            setEnviando(false);
        }
    };

    const enviarNotaDeVoz = async (archivo: File) => {
        if (!abierta) return;
        const subido = await subirAdjunto(archivo);
        await enviar([
            {
                conversationId: abierta.id,
                kind: 'audio',
                mediaUrl: subido.url,
                mediaMime: subido.mime,
                mediaFilename: subido.filename,
                isVoiceNote: true,
            },
        ]);
    };

    const sinLeer = useMemo(
        () => conversaciones.reduce((n, c) => n + (c.unread_count > 0 ? 1 : 0), 0),
        [conversaciones],
    );

    /* ------------------------------------------------------------------ */

    if (abierta) {
        return (
            <div className="flex flex-col h-full bg-slate-950">
                {/* Cabecera del chat */}
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
                    <button
                        onClick={() => setAbierta(null)}
                        aria-label="Volver a los chats"
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-300 active:bg-slate-800"
                    >
                        <ArrowLeft size={20} aria-hidden="true" />
                    </button>
                    <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold text-white truncate">
                            {abierta.customer_name || formatearTelefono(abierta)}
                        </p>
                        {abierta.customer_name && (
                            <p className="text-xs text-slate-500 truncate">{formatearTelefono(abierta)}</p>
                        )}
                    </div>
                    <button
                        onClick={() => cargarMensajes(abierta.id)}
                        aria-label="Actualizar el chat"
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 active:bg-slate-800"
                    >
                        {cargandoChat ? (
                            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                        ) : (
                            <RefreshCw size={18} aria-hidden="true" />
                        )}
                    </button>
                </div>

                {/* Hilo */}
                <div ref={hiloRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                    {cargandoChat && mensajes.length === 0 && (
                        <p className="text-center text-sm text-slate-500 py-8">Cargando…</p>
                    )}
                    {!cargandoChat && mensajes.length === 0 && (
                        <p className="text-center text-sm text-slate-500 py-8">Sin mensajes todavía.</p>
                    )}
                    {mensajes.map((m) => (
                        <div key={m.id} className={`flex ${m.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}>
                            <div
                                className={`max-w-[85%] rounded-2xl px-3 py-2 text-[15px] whitespace-pre-wrap break-words ${
                                    m.direction === 'inbound'
                                        ? 'bg-slate-800 text-slate-100'
                                        : 'bg-amber-500/15 text-amber-50 border border-amber-500/25'
                                }`}
                            >
                                {m.media_url && (
                                    <div className="mb-1.5">
                                        <MessageMedia url={m.media_url} contentType={m.content_type} body={m.body} />
                                    </div>
                                )}
                                {(m.body || !m.media_url) && (m.body || SIN_TEXTO[m.content_type] || '(sin texto)')}
                                <div className="text-xs text-slate-500 mt-1">
                                    {new Date(m.created_at).toLocaleTimeString('es-EC', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                    {m.action_taken === 'human_reply' && ' · vendedor'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Caja de escribir */}
                {/* El boton central de la barra inferior sobresale por encima
                    de ella (84px de barra, 104px de pico), y `pb-nav-safe` del
                    layout solo reserva los 84: sin este hueco extra el boton
                    flotante queda justo encima de la caja de escribir. */}
                <div
                    className="shrink-0 border-t border-slate-800 bg-slate-900 px-3 py-2 space-y-2"
                    style={{ paddingBottom: 'calc(var(--mobile-nav-peak) - var(--mobile-nav-h) + 12px)' }}
                >
                    {error && <p className="text-xs text-rose-300">{error}</p>}

                    <div className="flex items-center gap-2 flex-wrap">
                        <input
                            ref={fileRef}
                            type="file"
                            multiple
                            accept="image/*,video/*,audio/*,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                                enviarArchivos(Array.from(e.target.files ?? []));
                                e.target.value = '';
                            }}
                        />
                        <button
                            onClick={() => fileRef.current?.click()}
                            disabled={enviando}
                            className="min-h-[44px] px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-sm active:bg-slate-700 flex items-center gap-1.5"
                        >
                            <Paperclip size={15} aria-hidden="true" /> Archivo
                        </button>
                        {/* 44px mínimo: los botones del escritorio son de 32 y
                            en una pantalla táctil por debajo de 44 se falla el
                            toque (design-system/modo-movil-industrial/MASTER.md). */}
                        <VoiceRecorder
                            onEnviar={enviarNotaDeVoz}
                            disabled={enviando}
                            claseBoton="min-h-[44px] px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-sm active:bg-slate-700 flex items-center gap-1.5 disabled:opacity-40"
                        />
                    </div>

                    <div className="flex items-end gap-2">
                        <textarea
                            value={borrador}
                            onChange={(e) => setBorrador(e.target.value)}
                            rows={1}
                            placeholder="Escribí tu respuesta…"
                            aria-label="Mensaje para el cliente"
                            /* 16px mínimo: por debajo, iOS hace zoom al enfocar
                               y descoloca la pantalla entera (ver MASTER.md). */
                            className="flex-1 min-h-[48px] max-h-32 px-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-base focus:border-amber-500 outline-none resize-none"
                        />
                        <button
                            onClick={enviarTexto}
                            disabled={enviando || !borrador.trim()}
                            aria-label="Enviar"
                            className="min-w-[48px] min-h-[48px] rounded-xl bg-amber-500 text-slate-950 font-bold flex items-center justify-center active:bg-amber-600 disabled:opacity-40"
                        >
                            {enviando ? (
                                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                            ) : (
                                <Send size={18} aria-hidden="true" />
                            )}
                        </button>
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                        <ImageIcon size={11} aria-hidden="true" />
                        Sale por WhatsApp en unos segundos.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-950">
            <div className="px-4 pt-3 pb-2 shrink-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <h1 className="text-lg font-bold text-white flex items-center gap-2">
                        <MessageCircle size={18} className="text-amber-400" aria-hidden="true" />
                        WhatsApp
                    </h1>
                    {sinLeer > 0 && (
                        <span className="text-xs font-bold text-slate-950 bg-amber-500 rounded-full px-2 py-0.5">
                            {sinLeer} sin leer
                        </span>
                    )}
                </div>

                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                    <input
                        type="search"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar por nombre o teléfono…"
                        aria-label="Buscar chat"
                        className="w-full min-h-[48px] pl-10 pr-10 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-base focus:border-amber-500 outline-none"
                    />
                    {busqueda && (
                        <button
                            onClick={() => setBusqueda('')}
                            aria-label="Limpiar la búsqueda"
                            className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500"
                        >
                            <X size={16} aria-hidden="true" />
                        </button>
                    )}
                </div>
            </div>

            {error && <p className="px-4 pb-2 text-xs text-rose-300">{error}</p>}

            {/* Hueco para que el ultimo chat no quede bajo el boton central. */}
            <div
                className="flex-1 overflow-y-auto px-4 space-y-2"
                style={{ paddingBottom: 'calc(var(--mobile-nav-peak) - var(--mobile-nav-h) + 16px)' }}
            >
                {cargando && conversaciones.length === 0 && (
                    <p className="text-center text-sm text-slate-500 py-10">Cargando chats…</p>
                )}
                {!cargando && conversaciones.length === 0 && (
                    <p className="text-center text-sm text-slate-500 py-10">
                        {busqueda.trim() ? 'Ningún chat coincide.' : 'Todavía no hay conversaciones.'}
                    </p>
                )}

                {conversaciones.map((c) => (
                    <button
                        key={c.id}
                        onClick={() => abrirChat(c)}
                        className="w-full text-left bg-slate-900 rounded-2xl border border-slate-800 px-3.5 py-3 active:bg-slate-800 min-h-[64px]"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span
                                className={`text-[15px] truncate ${
                                    c.unread_count > 0 ? 'font-bold text-white' : 'font-semibold text-slate-200'
                                }`}
                            >
                                {c.customer_name || formatearTelefono(c)}
                            </span>
                            <span className="text-xs text-slate-500 shrink-0">
                                {c.last_message_at ? hace(c.last_message_at) : ''}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            {c.customer_name && (
                                <span className="text-xs text-slate-500 truncate">{formatearTelefono(c)}</span>
                            )}
                            {c.unread_count > 0 && (
                                <span className="ml-auto shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-amber-500 text-slate-950 text-xs font-black rounded-full">
                                    {c.unread_count}
                                </span>
                            )}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default MobileWhatsApp;
