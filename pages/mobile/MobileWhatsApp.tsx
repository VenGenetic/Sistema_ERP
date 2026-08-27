import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    Bot,
    BotOff,
    ClipboardList,
    ContactRound,
    FileText,
    ImageIcon,
    Images,
    Loader2,
    MailQuestion,
    Headset,
    MessageCircle,
    MoreVertical,
    Package,
    Plus,
    RefreshCw,
    RotateCw,
    Search,
    Send,
    X,
    Zap,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import VoiceRecorder from '../../components/whatsapp/VoiceRecorder';
import { CitaEnComposer } from '../../components/whatsapp/MessageActions';
import { MediaLightbox, type MediaItem } from '../../components/MediaLightbox';
import MediaGallery from '../../components/whatsapp/MediaGallery';
import CustomerPanel from '../../components/whatsapp/CustomerPanel';
import { BurbujasEnCola, useColaDeSalida } from '../../components/whatsapp/ColaDeSalida';
import { avisoDeEnvio, haceCuanto, useAgente } from '../../components/whatsapp/agente';
import { useChatProformaStore } from '../../store/useChatProformaStore';
import ChatThread, {
    horaLista,
    PildoraChat,
    textoDe,
    useHiloPegadoAbajo,
    type MensajeHilo,
} from '../../components/whatsapp/ChatThread';
import { cn } from '../../components/ui/styles';
import CatalogSendModal from '../../components/whatsapp/CatalogSendModal';
import ProformaBuilder from '../../components/whatsapp/ProformaBuilder';
import RegistrarPedidoModal from '../../components/whatsapp/RegistrarPedidoModal';
import {
    borrarMensaje,
    CAMPOS_CONV_BASE,
    CAMPOS_CONV_PREVIEW,
    encolarMensajes,
    faltaColumna,
    marcarLeidoEnWhatsApp,
    marcarNoLeido,
    reaccionarMensaje,
    subirAdjunto,
    type NuevoMensaje,
} from '../../utils/whatsappOutbox';

/**
 * WhatsApp en el teléfono: leer la conversación y contestarle al cliente.
 *
 * Tiene LO MISMO que la bandeja de escritorio: leer el hilo con sus fotos,
 * audios y archivos, contestar con texto, adjuntos o una nota de voz
 * grabada, mandar repuestos del catálogo, armar una proforma, anotar un
 * pedido, y citar, reaccionar o borrar un mensaje.
 *
 * Y lo tiene sin duplicar NADA. Las reglas de qué se manda viven en
 * `utils/whatsappOutbox.ts`; los reproductores, el grabador, las acciones
 * sobre un mensaje y los tres modales (catálogo, proforma, pedido) son los
 * mismos componentes que usa el escritorio. Así una regla no puede quedar
 * corregida en una pantalla y rota en la otra -- que es exactamente lo que
 * pasa cuando el modo móvil se reescribe aparte (ver la nota de CLAUDE.md
 * sobre inventario y catálogo, que sí son implementaciones separadas).
 *
 * Lo único propio de acá es la disposición: lista y chat en vez de tres
 * columnas, zonas táctiles de 44px y hojas que entran por abajo, según
 * `design-system/modo-movil-industrial/MASTER.md`.
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
    /** De qué habla el chat, sin abrirlo (migración 0032). */
    last_message_preview: string | null;
    last_message_direction: string | null;
    /** El agente contesta solo en las conversaciones que lo tengan activado. */
    bot_enabled: boolean;
    /** `escalated` = el agente se rindió y pidió que conteste una persona. */
    status: string;
}

/**
 * El mensaje es EL MISMO tipo que usa la bandeja de escritorio, no una copia:
 * las burbujas las dibuja `ChatThread`, que es el mismo componente. Si acá se
 * declarara un tipo propio, la primera columna que se agregue al hilo quedaría
 * puesta en una pantalla y faltando en la otra.
 */
type Mensaje = MensajeHilo;

/** Cuántas conversaciones se traen. Bajo a propósito: es un teléfono. */
const POR_PAGINA = 40;
const MENSAJES_VISIBLES = 40;

const CAMPOS_MSG =
    'id, direction, content_type, body, media_url, created_at, delivery_status, action_taken, whatsapp_message_id, deleted_at, reaction';

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

/**
 * Inicial del cliente sobre un color estable, como en la bandeja: el color
 * sale del propio teléfono, así que el mismo cliente tiene siempre la misma
 * mancha y se lo reconoce antes de leer el nombre.
 */
const COLORES_AVATAR = [
    'bg-emerald-500/25 text-emerald-200',
    'bg-sky-500/25 text-sky-200',
    'bg-amber-500/25 text-amber-200',
    'bg-rose-500/25 text-rose-200',
    'bg-violet-500/25 text-violet-200',
];

const Avatar: React.FC<{ nombre: string | null; telefono: string; tam?: 'sm' | 'md' }> = ({
    nombre,
    telefono,
    tam = 'md',
}) => {
    const inicial = (nombre?.trim()?.[0] ?? telefono.slice(-2, -1) ?? '?').toUpperCase();
    let suma = 0;
    for (const ch of telefono) suma += ch.charCodeAt(0);
    return (
        <span
            aria-hidden="true"
            className={cn(
                'shrink-0 rounded-full flex items-center justify-center font-bold select-none',
                tam === 'md' ? 'h-12 w-12 text-lg' : 'h-10 w-10 text-base',
                COLORES_AVATAR[suma % COLORES_AVATAR.length],
            )}
        >
            {inicial}
        </span>
    );
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
    /** Mensaje que se está citando en la próxima respuesta. */
    const [citando, setCitando] = useState<Mensaje | null>(null);
    const [catalogoAbierto, setCatalogoAbierto] = useState(false);
    const [proformaAbierta, setProformaAbierta] = useState(false);
    const [pedidoAbierto, setPedidoAbierto] = useState(false);
    /** Textos que el equipo repite todo el dia (tabla agent_quick_replies). */
    const [rapidas, setRapidas] = useState<Array<{ id: number; label: string; body: string }>>([]);
    const [menuRapidas, setMenuRapidas] = useState(false);
    /** El "+" de WhatsApp: archivo, catálogo, proforma, pedido y rápidas. */
    const [menuHerramientas, setMenuHerramientas] = useState(false);
    /** Hay una nota de voz grabándose o grabada sin mandar. */
    const [grabadorOcupado, setGrabadorOcupado] = useState(false);
    /** Foto abierta a pantalla completa, con las demás del hilo al costado. */
    const [visor, setVisor] = useState<{ media: MediaItem[]; index: number } | null>(null);
    /** La galería de fotos recibidas (buscar un comprobante). */
    const [galeria, setGaleria] = useState(false);
    /** La ficha del cliente, en una hoja que sube desde abajo. */
    const [ficha, setFicha] = useState(false);
    /** El menú "⋮" de la cabecera del chat. */
    const [menuChat, setMenuChat] = useState(false);
    /**
     * Ver solo lo que el agente escaló.
     *
     * En el escritorio eso es una pestaña entera con su triage; acá alcanza
     * con poder ENCONTRARLOS: si el agente se rinde con un cliente mientras
     * el vendedor está en el mostrador, desde el teléfono no había forma de
     * enterarse.
     */
    const [soloEscalados, setSoloEscalados] = useState(false);
    const [cuantosEscalados, setCuantosEscalados] = useState(0);
    const [cambiandoBot, setCambiandoBot] = useState(false);

    /**
     * Estado del proceso del agente y el interruptor maestro. El MISMO
     * módulo que usa la bandeja: la regla de cuándo avisar que un mensaje no
     * va a salir no puede estar escrita dos veces.
     */
    const { estado: estadoAgente, globalEncendido, alternarGlobal } = useAgente(userId);
    const aviso = useMemo(() => avisoDeEnvio(estadoAgente, haceCuanto), [estadoAgente]);

    /** Cuántos repuestos tiene a medio armar la proforma de este chat. */
    const itemsEnProforma = useChatProformaStore(
        (st) => (abierta ? st.porConversacion[abierta.id]?.items.length ?? 0 : 0),
    );
    const agregarAProforma = useChatProformaStore((st) => st.agregar);

    /**
     * Lo que se mandó y todavía no salió. Mismo hook y mismas burbujas que
     * la bandeja: desde el teléfono se enviaba a ciegas -- se tocaba enviar y
     * no pasaba nada visible hasta que el agente despachaba.
     */
    const {
        enCola,
        recargar: recargarCola,
        cancelar: cancelarDeLaCola,
        reintentar: reintentarDeLaCola,
    } = useColaDeSalida(abierta?.id ?? null, {
        onError: setError,
        onYaHabiaSalido: () => abierta && cargarMensajes(abierta.id),
    });

    const hiloRef = useRef<HTMLDivElement | null>(null);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const composerRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    /* ------------------------------------------------------------------ */
    /*  Lista                                                              */
    /* ------------------------------------------------------------------ */

    const cargarLista = useCallback(async () => {
        setCargando(true);

        const consulta = (campos: string) => {
            let q = supabase
                .from('agent_conversations')
                .select(campos)
                .order('last_message_at', { ascending: false, nullsFirst: false })
                .limit(POR_PAGINA);
            if (soloEscalados) q = q.eq('status', 'escalated');
            const texto = busqueda.trim();
            if (texto) {
                const digitos = texto.replace(/\D/g, '');
                const condiciones = [`customer_name.ilike.*${texto.replace(/[,()*\\"]/g, ' ')}*`];
                if (digitos) condiciones.push(`phone_number.ilike.*${digitos}*`);
                q = q.or(condiciones.join(','));
            }
            return q;
        };

        // Con la vista previa si está la migración 0032, sin ella si no.
        // Pedirla a secas dejaría la pantalla SIN LISTA, no sin vista previa.
        let { data, error: err } = await consulta(CAMPOS_CONV_PREVIEW);
        if (faltaColumna(err)) ({ data, error: err } = await consulta(CAMPOS_CONV_BASE));

        setCargando(false);
        if (err) {
            setError(`No se pudieron cargar los chats: ${err.message}`);
            return;
        }
        setError(null);
        setConversaciones((data ?? []) as unknown as Conversacion[]);
    }, [busqueda, soloEscalados]);

    // Cuántos hay escalados. Es un `count` sin filas: no trae datos, solo el
    // número, así que se puede repasar sin gastar cuota.
    useEffect(() => {
        supabase
            .from('agent_conversations')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'escalated')
            .then(({ count }) => setCuantosEscalados(count ?? 0));
    }, [conversaciones]);

    // Las respuestas rapidas se cargan una vez: son pocas y no cambian
    // mientras se atiende.
    useEffect(() => {
        supabase
            .from('agent_quick_replies')
            .select('id, label, body')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .then(({ data }) => setRapidas(data ?? []));
    }, []);

    // Cerrar los menús al tocar fuera o con Escape. Sin esto quedaban
    // abiertos tapando el hilo hasta volver a tocar el "+".
    useEffect(() => {
        if (!menuHerramientas && !menuRapidas) return;
        const cerrar = () => {
            setMenuHerramientas(false);
            setMenuRapidas(false);
        };
        const fuera = (e: Event) => {
            if (!composerRef.current?.contains(e.target as Node)) cerrar();
        };
        const escape = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
        document.addEventListener('pointerdown', fuera);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('pointerdown', fuera);
            document.removeEventListener('keydown', escape);
        };
    }, [menuHerramientas, menuRapidas]);

    // La caja crece con lo que se escribe y frena a los 128px.
    useEffect(() => {
        const t = textareaRef.current;
        if (!t) return;
        t.style.height = 'auto';
        t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
    }, [borrador]);

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
        // Abrirlo cuenta como leído, igual que en el escritorio: se apaga el
        // contador de acá y además se le mandan los tildes azules al cliente,
        // que es lo que él ve en su teléfono. Que falle el tilde no puede
        // romper la apertura del chat, así que no se espera.
        if (c.unread_count > 0) {
            await supabase.from('agent_conversations').update({ unread_count: 0 }).eq('id', c.id);
            setConversaciones((prev) => prev.map((x) => (x.id === c.id ? { ...x, unread_count: 0 } : x)));
        }
        marcarLeidoEnWhatsApp(c.id, userId).catch(() => {});
    };

    /**
     * Deja el chat como pendiente en la lista y vuelve atrás.
     *
     * Lo segundo no es un capricho: si el chat quedara abierto, abrirlo lo
     * marca leído otra vez y el botón parecería no hacer nada.
     */
    const marcarComoNoLeido = async (c: Conversacion) => {
        try {
            await marcarNoLeido(c.id);
            setConversaciones((prev) => prev.map((x) => (x.id === c.id ? { ...x, unread_count: 1 } : x)));
            setAbierta(null);
        } catch (err: any) {
            setError(err?.message ?? 'No se pudo marcar sin leer.');
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
            // Y los cambios sobre un mensaje que ya está en el hilo: el tilde
            // que se pone azul cuando el cliente lo lee, el tachado de un
            // borrado, la reacción que pone el cliente. Lo mismo que en la
            // bandeja de escritorio.
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'agent_messages', filter: `conversation_id=eq.${abierta.id}` },
                (payload) => {
                    const fila = payload.new as Mensaje;
                    setMensajes((prev) => prev.map((m) => (m.id === fila.id ? { ...m, ...fila } : m)));
                },
            )
            .subscribe();
        return () => {
            canal.unsubscribe();
        };
    }, [abierta]);

    // El hilo arranca abajo del todo, donde está lo último que se dijo.
    useHiloPegadoAbajo(hiloRef, abierta?.id ?? null);

    // Lo mismo para la galería: «atrás» la cierra y deja la lista, en vez de
    // salirse del modo móvil de un saque.
    useEffect(() => {
        if (!galeria) return;
        window.history.pushState({ galeria: true }, '');
        const volver = () => setGaleria(false);
        window.addEventListener('popstate', volver);
        return () => window.removeEventListener('popstate', volver);
    }, [galeria]);

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
        // Si hay un mensaje citado, la cita viaja con el primero: es el que
        // WhatsApp muestra con la tarjetita arriba. Antes acá se dibujaba la
        // tarjeta de "respondiendo a" pero la cita NO se mandaba, así que el
        // cliente recibía una respuesta suelta sin saber a cuál de sus cinco
        // mensajes contestaba.
        const conCita = citando?.whatsapp_message_id
            ? mensajes.map((m, i) => (i === 0 ? { ...m, replyToWaId: citando.whatsapp_message_id } : m))
            : mensajes;

        await encolarMensajes(conCita, userId);
        setCitando(null);
        // Aparece de inmediato al final del hilo como "en cola"; el realtime
        // de agent_outbox lo va actualizando hasta que sale.
        await recargarCola();
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

    const reaccionar = async (m: Mensaje, emoji: string) => {
        if (!abierta || !m.whatsapp_message_id) return;
        const previo = m.reaction;
        setMensajes((prev) => prev.map((x) => (x.id === m.id ? { ...x, reaction: emoji } : x)));
        try {
            await reaccionarMensaje(abierta.id, m.whatsapp_message_id, emoji, userId);
        } catch (err: any) {
            setMensajes((prev) => prev.map((x) => (x.id === m.id ? { ...x, reaction: previo } : x)));
            setError(err?.message ?? 'No se pudo reaccionar.');
        }
    };

    /**
     * Borra para todos. NO se tacha al instante: hasta que WhatsApp lo
     * acepte, el cliente lo sigue teniendo en el telefono.
     */
    const borrar = async (m: Mensaje) => {
        if (!abierta || !m.whatsapp_message_id) return;
        if (!window.confirm('¿Borrar este mensaje para el cliente tambien?')) return;
        try {
            await borrarMensaje(abierta.id, m.whatsapp_message_id, userId);
        } catch (err: any) {
            setError(err?.message ?? 'No se pudo borrar.');
        }
    };

    /**
     * Abre el chat de una foto de la galería. La lista trae 40 chats, así
     * que el de una foto vieja puede no estar cargado: si falta, se trae
     * ese solo.
     */
    const irAlChatDeLaFoto = async (id: number) => {
        setGaleria(false);
        const cargado = conversaciones.find((c) => c.id === id);
        if (cargado) {
            abrirChat(cargado);
            return;
        }
        const traer = (campos: string) =>
            supabase.from('agent_conversations').select(campos).eq('id', id).maybeSingle();
        let { data, error: err } = await traer(CAMPOS_CONV_PREVIEW);
        if (faltaColumna(err)) ({ data, error: err } = await traer(CAMPOS_CONV_BASE));
        if (err || !data) {
            setError('No se pudo abrir esa conversación.');
            return;
        }
        abrirChat(data as unknown as Conversacion);
    };

    /**
     * Enciende o apaga el agente en ESTA conversación.
     *
     * Importante que el fallo se vea: si esto falla en silencio, uno cree
     * que apagó el agente para un cliente y el agente le sigue contestando.
     */
    const alternarBotDelChat = async () => {
        if (!abierta || cambiandoBot) return;
        setCambiandoBot(true);
        const nuevo = !abierta.bot_enabled;
        const { error: err } = await supabase
            .from('agent_conversations')
            .update({ bot_enabled: nuevo })
            .eq('id', abierta.id);
        setCambiandoBot(false);
        if (err) {
            setError(`No se pudo cambiar el agente de esta conversación: ${err.message}`);
            return;
        }
        setAbierta((prev) => (prev ? { ...prev, bot_enabled: nuevo } : prev));
        setConversaciones((prev) => prev.map((c) => (c.id === abierta.id ? { ...c, bot_enabled: nuevo } : c)));
    };

    const sinLeer = useMemo(
        () => conversaciones.reduce((n, c) => n + (c.unread_count > 0 ? 1 : 0), 0),
        [conversaciones],
    );

    /* ------------------------------------------------------------------ */

    /**
     * Abre la foto a pantalla completa con TODAS las del hilo cargadas, para
     * poder pasar de una a otra: el cliente casi nunca manda una sola foto de
     * la pieza, manda tres desde ángulos distintos.
     */
    const abrirVisor = (m: Mensaje) => {
        const fotos = mensajes.filter((x) => !!x.media_url && x.content_type === 'image');
        setVisor({
            media: fotos.map((x) => ({ type: 'image', url: x.media_url!, title: x.body ?? undefined })),
            index: Math.max(0, fotos.findIndex((x) => x.id === m.id)),
        });
    };

    /* Con algo escrito manda el botón verde; sin nada, el micrófono. Mientras
       se graba manda el grabador: el botón verde taparía sus controles. */
    const mostrarEnviar = borrador.trim().length > 0 && !grabadorOcupado;

    /** Una opción del menú "+". */
    const opcionMenu = (icono: React.ReactNode, texto: string, cuenta: number, accion: () => void) => (
        <button
            onClick={() => {
                setMenuHerramientas(false);
                accion();
            }}
            role="menuitem"
            className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left text-[15px] text-wa-text active:bg-wa-hover"
        >
            <span className="text-wa-meta">{icono}</span>
            <span className="flex-1">{texto}</span>
            {cuenta > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-wa-accent px-1.5 text-[11px] font-bold text-wa-accent-fg">
                    {cuenta}
                </span>
            )}
        </button>
    );

    /* ------------------------------------------------------------------ */

    if (abierta) {
        return (
            /* `wa-dark` fija la paleta oscura de WhatsApp pase lo que pase con el
                tema del ERP: el resto del modo móvil es oscuro y fijo, y un chat
                claro adentro se veía como un recorte de otra aplicación. */
            <div className="wa-dark flex h-full flex-col bg-wa-bg">
                {/* --------------------------- Cabecera --------------------------- */}
                <div className="flex shrink-0 items-center gap-1.5 bg-wa-header px-1.5 py-1.5">
                    <button
                        onClick={() => setAbierta(null)}
                        aria-label="Volver a los chats"
                        className={'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-wa-meta active:bg-wa-inset/10'}
                    >
                        <ArrowLeft size={22} aria-hidden="true" />
                    </button>

                    <Avatar nombre={abierta.customer_name} telefono={abierta.phone_number} tam="sm" />

                    <div className="min-w-0 flex-1 pl-1">
                        <p className="truncate text-[16px] font-medium leading-[21px] text-wa-text">
                            {abierta.customer_name || formatearTelefono(abierta)}
                        </p>
                        <p className="truncate text-[12.5px] leading-[16px] text-wa-meta">
                            {abierta.customer_name ? formatearTelefono(abierta) : "contestá desde acá"}
                        </p>
                    </div>

                    {/* El agente de ESTE chat. Es botón y a la vez semáforo: si
                        está encendido, el agente puede contestar encima del
                        vendedor y hay que poder apagarlo desde el mostrador. */}
                    <button
                        onClick={alternarBotDelChat}
                        disabled={cambiandoBot}
                        aria-label={abierta.bot_enabled ? 'Desactivar el agente en este chat' : 'Activar el agente en este chat'}
                        className={cn(
                            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-wa-inset/10',
                            abierta.bot_enabled ? 'text-wa-accent' : 'text-wa-meta',
                        )}
                    >
                        {abierta.bot_enabled ? <Bot size={20} aria-hidden="true" /> : <BotOff size={20} aria-hidden="true" />}
                    </button>

                    {/* El resto, en un menú: cinco iconos en la cabecera de un
                        teléfono no entran, y los tres de acá se usan una vez
                        cada tanto. */}
                    <div className="relative shrink-0">
                        <button
                            onClick={() => setMenuChat((v) => !v)}
                            aria-label="Más opciones del chat"
                            aria-expanded={menuChat}
                            className="flex h-11 w-11 items-center justify-center rounded-full text-wa-meta active:bg-wa-inset/10"
                        >
                            <MoreVertical size={20} aria-hidden="true" />
                        </button>

                        {menuChat && (
                            <>
                                {/* Capa para cerrarlo tocando fuera. */}
                                <button
                                    aria-hidden="true"
                                    tabIndex={-1}
                                    onClick={() => setMenuChat(false)}
                                    className="fixed inset-0 z-30 cursor-default"
                                />
                                <div
                                    role="menu"
                                    className="absolute right-0 top-full z-40 mt-1 w-60 overflow-hidden rounded-xl border border-wa-divider bg-wa-panel py-1 shadow-2xl"
                                >
                                    <button
                                        role="menuitem"
                                        onClick={() => {
                                            setMenuChat(false);
                                            setFicha(true);
                                        }}
                                        className="flex min-h-[48px] w-full items-center gap-3 px-4 text-left text-[15px] text-wa-text active:bg-wa-hover"
                                    >
                                        <ContactRound size={19} className="text-wa-meta" aria-hidden="true" />
                                        Ficha del cliente
                                    </button>
                                    <button
                                        role="menuitem"
                                        onClick={() => {
                                            setMenuChat(false);
                                            marcarComoNoLeido(abierta);
                                        }}
                                        className="flex min-h-[48px] w-full items-center gap-3 px-4 text-left text-[15px] text-wa-text active:bg-wa-hover"
                                    >
                                        <MailQuestion size={19} className="text-wa-meta" aria-hidden="true" />
                                        Marcar sin leer
                                    </button>
                                    <button
                                        role="menuitem"
                                        onClick={() => {
                                            setMenuChat(false);
                                            cargarMensajes(abierta.id);
                                        }}
                                        className="flex min-h-[48px] w-full items-center gap-3 px-4 text-left text-[15px] text-wa-text active:bg-wa-hover"
                                    >
                                        {cargandoChat ? (
                                            <Loader2 size={19} className="animate-spin text-wa-meta" aria-hidden="true" />
                                        ) : (
                                            <RefreshCw size={19} className="text-wa-meta" aria-hidden="true" />
                                        )}
                                        Actualizar el chat
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Lo que se encole ahora NO va a salir. Se avisa arriba de todo
                    y no en la caja de escribir: hay que verlo ANTES de escribir. */}
                {aviso && (
                    <div className="flex shrink-0 items-start gap-2 border-b border-wa-divider bg-wa-notice px-3 py-2">
                        <RotateCw size={15} className="mt-0.5 shrink-0 text-wa-notice-text" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-wa-notice-text">{aviso.titulo}</p>
                            <p className="text-[12px] text-wa-notice-text/90">{aviso.detalle}</p>
                        </div>
                    </div>
                )}

                {/* El agente sigue habilitado acá: puede contestar encima del
                    vendedor. No se apaga solo -- eso dejaría al bot mudo sin que
                    nadie lo decidiera -- pero se avisa y se apaga de un toque. */}
                {abierta.bot_enabled && globalEncendido && (
                    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-wa-divider bg-warning-soft px-3 py-2">
                        <p className="text-[12px] text-warning-soft-fg">
                            El agente también contesta en este chat.
                        </p>
                        <button
                            onClick={alternarBotDelChat}
                            disabled={cambiandoBot}
                            className="shrink-0 rounded-lg bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-fg"
                        >
                            Apagarlo acá
                        </button>
                    </div>
                )}

                {/* ----------------------------- Hilo ----------------------------- */}
                <div ref={hiloRef} className="wa-wallpaper wa-scroll flex min-h-0 flex-1 flex-col overflow-y-auto [overflow-anchor:none] py-2">
                    {/* Los mensajes se apoyan ABAJO cuando son pocos, como en el
                        teléfono. El `mt-auto` va en un envoltorio y no como
                        `justify-end` en el contenedor con scroll: con eso el
                        contenido que desborda se sale por arriba y no se alcanza. */}
                    <div className="mt-auto">
                    <PildoraChat tono="aviso">
                        Lo que mandes desde acá sale por WhatsApp y queda guardado en esta
                        conversación. Lo que escribas desde el teléfono, no.
                    </PildoraChat>

                    {cargandoChat && mensajes.length === 0 && <PildoraChat>Cargando…</PildoraChat>}
                    {!cargandoChat && mensajes.length === 0 && (
                        <PildoraChat>Sin mensajes todavía.</PildoraChat>
                    )}

                    {/* El MISMO hilo que la bandeja de escritorio, con las zonas
                        táctiles agrandadas. Antes acá vivía una copia de las
                        burbujas y se desincronizaba sola. */}
                    <ChatThread
                        mensajes={mensajes}
                        tactil
                        onAbrirFoto={abrirVisor}
                        onResponder={setCitando}
                        onReaccionar={reaccionar}
                        onBorrar={borrar}
                    />

                    {/* Lo que se mandó y todavía no salió. Las mismas burbujas
                        que en la bandeja: ver components/whatsapp/ColaDeSalida. */}
                    <BurbujasEnCola
                        items={enCola}
                        onCancelar={cancelarDeLaCola}
                        onReintentar={reintentarDeLaCola}
                        tactil
                    />
                    </div>
                </div>

                {/* ------------------------ Caja de escribir ----------------------- */}
                {/* El botón central de la barra inferior sobresale por encima de
                    ella (84px de barra, 104px de pico), y `pb-nav-safe` del layout
                    solo reserva los 84: sin este hueco extra el botón flotante
                    queda justo encima de la caja de escribir. */}
                <div
                    ref={composerRef}
                    className="relative shrink-0 bg-wa-header px-1.5 py-1.5"
                    style={{ paddingBottom: 'calc(var(--mobile-nav-peak) - var(--mobile-nav-h) + 12px)' }}
                >
                    {/* Menú del "+" */}
                    {menuHerramientas && (
                        <div
                            role="menu"
                            className="absolute bottom-full left-2 right-2 z-20 mb-2 overflow-hidden rounded-2xl border border-wa-divider bg-wa-panel py-1 shadow-2xl"
                        >
                            {opcionMenu(<ImageIcon size={20} aria-hidden="true" />, 'Foto, video o archivo', 0, () =>
                                fileRef.current?.click(),
                            )}
                            {opcionMenu(<Package size={20} aria-hidden="true" />, 'Repuesto del catálogo', 0, () =>
                                setCatalogoAbierto(true),
                            )}
                            {opcionMenu(<FileText size={20} aria-hidden="true" />, 'Proforma', itemsEnProforma, () =>
                                setProformaAbierta(true),
                            )}
                            {opcionMenu(<ClipboardList size={20} aria-hidden="true" />, 'Anotar un pedido', 0, () =>
                                setPedidoAbierto(true),
                            )}
                            {rapidas.length > 0 &&
                                opcionMenu(<Zap size={20} aria-hidden="true" />, 'Respuestas rápidas', rapidas.length, () =>
                                    setMenuRapidas(true),
                                )}
                        </div>
                    )}

                    {/* Respuestas rápidas */}
                    {menuRapidas && rapidas.length > 0 && (
                        <div className="absolute bottom-full left-2 right-2 z-20 mb-2 max-h-64 divide-y divide-wa-divider overflow-y-auto rounded-2xl border border-wa-divider bg-wa-panel shadow-2xl">
                            {rapidas.map((r) => (
                                <button
                                    key={r.id}
                                    onClick={() => {
                                        // Se agrega a lo ya escrito en vez de pisarlo: muchas
                                        // veces la respuesta rápida completa algo que ya se
                                        // estaba escribiendo.
                                        setBorrador((prev) => (prev.trim() ? `${prev.trim()}\n${r.body}` : r.body));
                                        setMenuRapidas(false);
                                    }}
                                    className="min-h-[52px] w-full px-4 py-2.5 text-left active:bg-wa-hover"
                                >
                                    <p className="text-[14px] font-semibold text-wa-text">{r.label}</p>
                                    <p className="line-clamp-2 text-[12.5px] text-wa-meta">{r.body}</p>
                                </button>
                            ))}
                        </div>
                    )}

                    {citando && (
                        <div className="mb-1.5">
                            <CitaEnComposer texto={textoDe(citando)} onQuitar={() => setCitando(null)} />
                        </div>
                    )}

                    {error && <p className="mb-1.5 px-2 text-xs text-wa-danger">{error}</p>}

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

                    <div className="flex flex-wrap items-end gap-1.5">
                        {/* Adjuntar, catálogo, proforma, pedido y rápidas viven acá
                            adentro. Antes eran seis botones en dos renglones sobre la
                            caja de escribir: comían media pantalla de hilo en un
                            teléfono y no se parecían a WhatsApp. */}
                        <button
                            onClick={() => {
                                setMenuHerramientas((v) => !v);
                                setMenuRapidas(false);
                            }}
                            aria-label="Adjuntar y herramientas"
                            aria-expanded={menuHerramientas}
                            className={cn(
                                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-wa-meta transition-transform active:bg-wa-inset/10',
                                menuHerramientas && 'rotate-45',
                            )}
                        >
                            <Plus size={26} aria-hidden="true" />
                        </button>

                        <textarea
                            ref={textareaRef}
                            value={borrador}
                            onChange={(e) => setBorrador(e.target.value)}
                            rows={1}
                            placeholder="Escribí un mensaje…"
                            aria-label="Mensaje para el cliente"
                            /* 16px mínimo: por debajo, iOS hace zoom al enfocar y
                               descoloca la pantalla entera (ver MASTER.md). */
                            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border-none bg-wa-input px-4 py-3 text-base leading-[20px] text-wa-text outline-none placeholder:text-wa-meta focus:ring-0"
                        />

                        {mostrarEnviar && (
                            <button
                                onClick={enviarTexto}
                                disabled={enviando}
                                aria-label="Enviar"
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-wa-accent text-wa-accent-fg active:brightness-90 disabled:opacity-40"
                            >
                                {enviando ? (
                                    <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                                ) : (
                                    <Send size={20} aria-hidden="true" />
                                )}
                            </button>
                        )}

                        {/* Se ESCONDE en vez de desmontarse cuando aparece el botón de
                            enviar: desmontarlo tira a la basura una nota ya grabada sin
                            avisar, y para eso basta con tocar la caja de texto. */}
                        <div className={cn('shrink-0', mostrarEnviar && 'hidden')}>
                            <VoiceRecorder
                                onEnviar={enviarNotaDeVoz}
                                disabled={enviando}
                                soloIcono
                                onOcupado={setGrabadorOcupado}
                                claseBoton="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-wa-meta active:bg-wa-inset/10 disabled:opacity-40"
                            />
                        </div>
                    </div>
                </div>

                {/* Los tres modales del vendedor. Antes estaban importados pero sin
                    dibujar: los botones de catálogo, proforma y pedido prendían un
                    estado que no abría nada. */}
                <CatalogSendModal
                    isOpen={catalogoAbierto}
                    onClose={() => setCatalogoAbierto(false)}
                    conversationId={abierta.id}
                    clienteLabel={abierta.customer_name || formatearTelefono(abierta)}
                    onEnviar={enviar}
                />

                <ProformaBuilder
                    isOpen={proformaAbierta}
                    onClose={() => setProformaAbierta(false)}
                    conversationId={abierta.id}
                    clienteLabel={abierta.customer_name || formatearTelefono(abierta)}
                    clienteNombre={abierta.customer_name}
                    onEnviar={enviar}
                />

                <RegistrarPedidoModal
                    isOpen={pedidoAbierto}
                    onClose={() => setPedidoAbierto(false)}
                    phoneNumber={abierta.phone_number}
                    customerName={abierta.customer_name}
                    userId={userId}
                    onRegistrado={() => {}}
                />

                <MediaLightbox
                    isOpen={!!visor}
                    media={visor?.media ?? []}
                    initialIndex={visor?.index ?? 0}
                    onClose={() => setVisor(null)}
                />

                {/* La ficha del cliente, en una hoja que sube desde abajo.
                    Lo que dice -- si tiene descuento, qué repuestos dejó
                    pedidos, cuáles ya llegaron -- hay que tenerlo MIENTRAS se
                    cotiza. En el escritorio va en una columna al costado; acá
                    no hay costado, así que va en una hoja. */}
                {ficha && (
                    <div
                        className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60"
                        onClick={() => setFicha(false)}
                        role="presentation"
                    >
                        <div
                            /* Centrada y con el ancho de la columna: en un teléfono
                               ocupa todo, pero el modo móvil también se abre en un
                               monitor y ahí una hoja de 1500px de ancho no es una
                               hoja, es otra pantalla. */
                            className="mx-auto max-h-[82dvh] w-full max-w-[520px] overflow-y-auto rounded-t-2xl bg-bg p-3"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Sin título propio: la ficha ya trae el suyo. Va el
                                asa de arrastre y el botón de cerrar, nada más. */}
                            <div className="mb-1 flex items-center justify-end">
                                <span className="absolute left-1/2 -translate-x-1/2 h-1 w-10 rounded-full bg-fg-subtle/40" aria-hidden="true" />
                                <button
                                    onClick={() => setFicha(false)}
                                    aria-label="Cerrar la ficha del cliente"
                                    className="flex h-11 w-11 items-center justify-center rounded-full text-fg-muted"
                                >
                                    <X size={20} aria-hidden="true" />
                                </button>
                            </div>
                            <CustomerPanel
                                conversationId={abierta.id}
                                phoneNumber={abierta.phone_number}
                                customerName={abierta.customer_name}
                                onCotizar={(producto) => {
                                    agregarAProforma(abierta.id, producto);
                                    setFicha(false);
                                    setProformaAbierta(true);
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (galeria) {
        return (
            <div className="wa-dark flex h-full flex-col bg-wa-panel">
                <MediaGallery
                    onIrAlChat={irAlChatDeLaFoto}
                    onCerrar={() => setGaleria(false)}
                    formatearTelefono={formatearTelefono}
                    tactil
                />
            </div>
        );
    }

    /* ---------------------------- Lista de chats ---------------------------- */

    return (
        <div className="wa-dark flex h-full flex-col bg-wa-panel">
            <div className="shrink-0 bg-wa-header px-4 pb-2 pt-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <h1 className="flex items-center gap-2 text-xl font-bold text-wa-text">
                        <MessageCircle size={20} className="text-wa-accent" aria-hidden="true" />
                        WhatsApp
                    </h1>
                    <div className="flex items-center gap-2">
                        {sinLeer > 0 && (
                            <span className="rounded-full bg-wa-accent-strong px-2 py-0.5 text-xs font-bold text-wa-accent-fg">
                                {sinLeer} sin leer
                            </span>
                        )}
                        {/* Buscar un comprobante entre las fotos que mandaron
                            los clientes, sin abrir chats de a uno. */}
                        <button
                            onClick={() => setGaleria(true)}
                            aria-label="Ver las fotos que mandaron los clientes"
                            className="flex h-11 w-11 items-center justify-center rounded-full text-wa-meta active:bg-wa-inset/10"
                        >
                            <Images size={22} aria-hidden="true" />
                        </button>
                    </div>
                </div>

                <div className="relative">
                    <Search
                        size={16}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-wa-meta"
                        aria-hidden="true"
                    />
                    <input
                        type="search"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar por nombre o teléfono…"
                        aria-label="Buscar chat"
                        className="min-h-[44px] w-full rounded-full border-none bg-wa-input pl-11 pr-12 text-base text-wa-text outline-none placeholder:text-wa-meta focus:ring-0"
                    />
                    {busqueda && (
                        <button
                            onClick={() => setBusqueda('')}
                            aria-label="Limpiar la búsqueda"
                            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-wa-meta"
                        >
                            <X size={18} aria-hidden="true" />
                        </button>
                    )}
                </div>
            </div>

            {(cuantosEscalados > 0 || soloEscalados) && (
                <div className="shrink-0 bg-wa-header px-4 pb-2">
                    <button
                        onClick={() => setSoloEscalados((v) => !v)}
                        aria-pressed={soloEscalados}
                        className={cn(
                            'inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-[13px] font-medium',
                            soloEscalados ? 'bg-wa-accent text-wa-accent-fg' : 'bg-wa-inset/10 text-wa-text',
                        )}
                    >
                        <Headset size={15} aria-hidden="true" />
                        {soloEscalados ? 'Viendo los escalados' : `El agente escaló ${cuantosEscalados}`}
                    </button>
                </div>
            )}

            {/* El interruptor MAESTRO: apagado acá el agente no le contesta a
                nadie, aunque una conversación lo tenga activado. Estaba solo en
                el escritorio, así que desde el mostrador no había forma de
                frenarlo. */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-wa-divider bg-wa-panel px-4 py-2">
                <span className="text-[13px] text-wa-meta">
                    Agente automático{' '}
                    <span className={cn('font-semibold', globalEncendido ? 'text-wa-accent' : 'text-wa-text')}>
                        {globalEncendido === null ? '…' : globalEncendido ? 'encendido' : 'apagado'}
                    </span>
                </span>
                <button
                    onClick={async () => {
                        const err = await alternarGlobal();
                        if (err) setError(err);
                    }}
                    disabled={globalEncendido === null}
                    role="switch"
                    aria-checked={!!globalEncendido}
                    aria-label="Agente automático"
                    className="relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50"
                    style={{ background: globalEncendido ? 'rgb(var(--wa-accent))' : 'rgb(var(--wa-inset) / .2)' }}
                >
                    <span
                        aria-hidden="true"
                        className={cn(
                            'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all',
                            globalEncendido ? 'left-6' : 'left-1',
                        )}
                    />
                </button>
            </div>

            {aviso && (
                <div className="flex shrink-0 items-start gap-2 border-b border-wa-divider bg-wa-notice px-4 py-2">
                    <RotateCw size={15} className="mt-0.5 shrink-0 text-wa-notice-text" aria-hidden="true" />
                    <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-wa-notice-text">{aviso.titulo}</p>
                        <p className="text-[12px] text-wa-notice-text/90">{aviso.detalle}</p>
                    </div>
                </div>
            )}

            {error && <p className="px-4 py-2 text-xs text-wa-danger">{error}</p>}

            {/* Hueco para que el último chat no quede bajo el botón central. */}
            <div
                className="wa-scroll flex-1 overflow-y-auto"
                style={{ paddingBottom: 'calc(var(--mobile-nav-peak) - var(--mobile-nav-h) + 16px)' }}
            >
                {cargando && conversaciones.length === 0 && (
                    <p className="py-10 text-center text-sm text-wa-meta">Cargando chats…</p>
                )}
                {!cargando && conversaciones.length === 0 && (
                    <p className="py-10 text-center text-sm text-wa-meta">
                        {busqueda.trim() ? 'Ningún chat coincide.' : 'Todavía no hay conversaciones.'}
                    </p>
                )}

                {conversaciones.map((c) => (
                    <button
                        key={c.id}
                        onClick={() => abrirChat(c)}
                        className="flex w-full items-center gap-3 pl-3 text-left active:bg-wa-hover"
                    >
                        <Avatar nombre={c.customer_name} telefono={c.phone_number} />

                        {/* La línea divisoria arranca DESPUÉS del avatar, como en
                            WhatsApp: la columna de avatares se lee como una tira. */}
                        <div className="min-w-0 flex-1 border-b border-wa-divider py-3 pr-3">
                            <div className="flex items-baseline justify-between gap-2">
                                <span
                                    className={cn(
                                        'truncate text-[16px] leading-[21px] text-wa-text',
                                        c.unread_count > 0 ? 'font-semibold' : 'font-normal',
                                    )}
                                >
                                    {c.customer_name || formatearTelefono(c)}
                                </span>
                                <span
                                    className={cn(
                                        'shrink-0 text-[12px] leading-[16px]',
                                        c.unread_count > 0 ? 'font-semibold text-wa-accent' : 'text-wa-meta',
                                    )}
                                >
                                    {c.last_message_at ? horaLista(c.last_message_at) : ''}
                                </span>
                            </div>

                            {/* De qué habla el chat, sin abrirlo. En un teléfono importa
                                más que en el escritorio: no hay lugar para tener la lista
                                y el chat a la vez, así que cada apertura equivocada cuesta
                                dos toques. */}
                            <div className="mt-0.5 flex items-center gap-1.5">
                                <span
                                    className={cn(
                                        'min-w-0 flex-1 truncate text-[13.5px] leading-[19px]',
                                        c.unread_count > 0 ? 'text-wa-text' : 'text-wa-meta',
                                    )}
                                >
                                    {c.last_message_preview ? (
                                        <>
                                            {c.last_message_direction === 'outbound' && (
                                                <span className="text-wa-meta">Vos: </span>
                                            )}
                                            {c.last_message_preview}
                                        </>
                                    ) : (
                                        formatearTelefono(c)
                                    )}
                                </span>
                                {c.status === 'escalated' && (
                                    <Headset
                                        size={15}
                                        className="shrink-0 text-warning"
                                        aria-label="El agente escaló esta conversación"
                                    />
                                )}
                                {c.unread_count > 0 && (
                                    <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-wa-accent-strong px-1.5 text-[12px] font-bold leading-none text-wa-accent-fg">
                                        {c.unread_count}
                                    </span>
                                )}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default MobileWhatsApp;
