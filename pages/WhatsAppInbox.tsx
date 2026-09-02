import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { badge, button, cn, focusRing, input } from '../components/ui/styles';
import {
    Archive, ArrowLeft, ArrowRight, Bell, BellOff, BellRing, Bot, BotOff, CheckCheck, ChevronLeft, Clock, Copy, FileText, HandCoins,
    Headset, Images, Inbox, MailQuestion, Maximize2, MessageSquarePlus, Minimize2, Pin, RefreshCw, RotateCw, Search,
    User, X,
} from 'lucide-react';
import { MediaLightbox, type MediaItem } from '../components/MediaLightbox';
import ChatComposer from '../components/whatsapp/ChatComposer';
import BuscarEnHilo from '../components/whatsapp/BuscarEnHilo';
import MediaGallery from '../components/whatsapp/MediaGallery';
import { AvisosAccionesFallidas, BurbujasEnCola, useColaDeSalida } from '../components/whatsapp/ColaDeSalida';
import {
    avisoDeEnvio as avisoDelAgente,
    haceCuanto as timeAgo,
    type EstadoAgente,
} from '../components/whatsapp/agente';
import CustomerPanel from '../components/whatsapp/CustomerPanel';
import ProformaBuilder from '../components/whatsapp/ProformaBuilder';
import ProductMessagePanel from '../components/whatsapp/ProductMessagePanel';
import ConversationWorkCard from '../components/whatsapp/ConversationWorkCard';
import { CONSULTA_MOSTRADOR, CONSULTA_PANTALLA_ANCHA, useMediaQuery } from '../hooks/useMediaQuery';
import MenuTelefono from '../components/whatsapp/MenuTelefono';
import NuevoChatModal from '../components/whatsapp/NuevoChatModal';
import AvisarLlegadaModal from '../components/whatsapp/AvisarLlegadaModal';
import { contarPorAvisar, type ModoAviso } from '../components/whatsapp/avisarLlegada';
import {
    BANDEJAS,
    bandejaDe,
    contarPorBandeja,
    type Bandeja,
} from '../components/whatsapp/bandejas';
import {
    CLASE_DE_ETAPA,
    contarListasParaVendedor,
    ETAPAS_QUE_SE_MARCAN,
    marcarEtapa,
    NOMBRE_DE_ETAPA,
    type Etapa,
} from '../components/whatsapp/etapas';
import { fusionarMensajes, useRepasoDelHilo } from '../components/whatsapp/hiloEnVivo';
import { CitaEnComposer } from '../components/whatsapp/MessageActions';
import ChatThread, {
    horaLista,
    PildoraChat,
    textoDe,
    useHiloPegadoAbajo,
    type MensajeHilo,
} from '../components/whatsapp/ChatThread';
import { useChatProformaStore } from '../store/useChatProformaStore';
import { getDueWorkIds } from '../utils/whatsappWorkflow';
import { buscarConversacionesPorTexto } from '../utils/whatsappConversationSearch';
import { attributeMessage, attributeMessages } from '../utils/messageAttribution';
import { textoPlano } from '../utils/formatoWhatsApp';
import ReenviarModal, { type MensajeAReenviar } from '../components/whatsapp/ReenviarModal';
import { useNotificacionesEscritorio } from '../hooks/useNotificacionesEscritorio';
import { hayOverlayAbierto } from '../hooks/useBackDismiss';
import {
    borrarMensaje,
    editarMensaje,
    CAMPOS_CONV_BASE,
    CAMPOS_CONV_PREVIEW,
    encolarMensajes,
    faltaColumna,
    marcarLeidoEnWhatsApp,
    marcarNoLeido,
    reaccionarMensaje,
    type NuevoMensaje,
} from '../utils/whatsappOutbox';

/**
 * Bandeja de WhatsApp: la conversación completa con cada cliente, y el
 * lugar desde donde se le contesta.
 *
 * Se contesta desde acá y no desde el teléfono por una razón concreta: lo
 * que se escribe en el teléfono le llega CIFRADO al proceso del agente y
 * nunca se puede abrir (se comprobó en vivo: 6 de 6 mensajes llegaron
 * vacíos), así que por esa vía el ERP jamás tendría la conversación
 * entera. Escribiendo desde acá, el sistema conoce el mensaje antes de
 * cifrarlo y queda registrado sí o sí.
 *
 * El navegador no tiene la sesión de WhatsApp -- la tiene el proceso del
 * agente. Por eso todo lo que se manda se ENCOLA en `agent_outbox` y ese
 * proceso lo despacha (ver utils/whatsappOutbox.ts).
 *
 * Además del chat, la pantalla hace triage de lo que el agente escaló:
 * quién lo atiende y cuándo el bot puede retomar.
 */

type EscalationReason = 'discount_request' | 'complaint_or_return' | 'ambiguous_after_retries' | 'angry_or_urgent' | 'other';
type EscalationStatus = 'open' | 'claimed' | 'resolved';
type ConversationStatus = 'bot_active' | 'escalated' | 'human_active' | 'closed';

interface Escalation {
    id: number;
    conversation_id: number;
    reason: EscalationReason;
    message_snapshot: string | null;
    status: EscalationStatus;
    claimed_by: string | null;
    claimed_at: string | null;
    resolved_at: string | null;
    created_at: string;
    agent_conversations: {
        phone_number: string;
        customer_name: string | null;
        status: ConversationStatus;
        bot_enabled: boolean;
    } | null;
}

type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

type ContentType = 'text' | 'image' | 'audio' | 'system' | 'video' | 'document' | 'sticker' | 'location' | 'contact' | 'other';

interface AgentMessage {
    id: number;
    direction: 'inbound' | 'outbound';
    content_type: ContentType;
    body: string | null;
    created_at: string;
    /** Acuse real de WhatsApp. NULL en entrantes y en mensajes viejos. */
    delivery_status: DeliveryStatus | null;
    action_taken: string | null;
    /**
     * Copia en Storage de la foto/audio/archivo del mensaje (migración
     * 0026). NULL en los mensajes de solo texto y en todo lo importado del
     * historial: WhatsApp no reentrega la media vieja, así que de esos
     * mensajes solo queda el texto.
     */
    media_url: string | null;
    product_id: number | null;
    /** Identifica el mensaje en WhatsApp: hace falta para citar, reaccionar o borrar. */
    whatsapp_message_id: string | null;
    /** Borrado para todos (migración 0031). El mensaje se conserva, tachado. */
    deleted_at: string | null;
    reaction: string | null;
    reply_to_wa_id: string | null;
}

/** Campos del mensaje que necesita el hilo. */
const CAMPOS_MENSAJE =
    'id, direction, content_type, body, created_at, delivery_status, action_taken, media_url, product_id, whatsapp_message_id, deleted_at, reaction, reply_to_wa_id';

/** Tipos que DEBERÍAN traer un archivo. Si no lo traen, se aclara. */
const CON_ARCHIVO = new Set<ContentType>(['image', 'audio', 'video', 'document', 'sticker']);
const REASON_LABEL: Record<EscalationReason, string> = {
    discount_request: 'Pidió descuento',
    complaint_or_return: 'Reclamo / devolución',
    ambiguous_after_retries: 'No se entendió el pedido',
    angry_or_urgent: 'Cliente molesto / urgente',
    other: 'Otro',
};

const REASON_TONE: Record<EscalationReason, keyof typeof badge.tone> = {
    discount_request: 'warning',
    complaint_or_return: 'danger',
    ambiguous_after_retries: 'info',
    angry_or_urgent: 'danger',
    other: 'neutral',
};

/** Fila de agent_conversations -- la pestaña "Todas" no depende de escalamientos. */
interface Conversation {
    id: number;
    phone_number: string;
    customer_name: string | null;
    status: ConversationStatus;
    bot_enabled: boolean;
    selected_agent: 'intake' | 'sales' | null;
    last_message_at: string | null;
    unread_count: number;
    lid: string | null;
    /**
     * En qué punto del flujo está. Opcional porque la migración 0035 se
     * corre a mano: mientras no exista la columna, la fila llega sin esto
     * y la bandeja se ve igual que antes.
     */
    etapa?: Etapa;
    /**
     * Último mensaje, para saber de qué habla el chat sin abrirlo
     * (migración 0032). Es una vista previa para triar: la fuente de
     * verdad del hilo sigue siendo `agent_messages`.
     */
    last_message_preview: string | null;
    last_message_direction: string | null;
}

/**
 * Los números se guardan como solo dígitos (ver migración 0021). Acá se
 * les da formato para leerlos: "+593 99 327 9707".
 *
 * Un chat identificado por LID (id interno de WhatsApp, cuando no expone
 * el teléfono) se muestra como tal en vez de fingir que es un número --
 * son 14-15 dígitos y no arrancan con código de país.
 */
function formatPhone(conv: Pick<Conversation, 'phone_number' | 'lid'>): string {
    const digits = conv.phone_number ?? '';
    const looksLikeLid = conv.lid === digits || digits.length > 13;
    if (looksLikeLid) return `ID interno ${digits}`;
    if (digits.startsWith('593') && digits.length >= 11) {
        const local = digits.slice(3);
        return `+593 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`.trim();
    }
    return `+${digits}`;
}

/**
 * Inicial del cliente sobre un color estable.
 *
 * El color sale del propio teléfono, no de un azar: el mismo cliente tiene
 * siempre el mismo, así que al recorrer la lista se lo reconoce por la
 * mancha de color antes de leer el nombre. Son tonos del sistema, para que
 * no aparezcan colores fuera de la paleta.
 */
const COLORES_AVATAR = [
    'bg-primary-soft text-primary-soft-fg',
    'bg-success-soft text-success-soft-fg',
    'bg-warning-soft text-warning-soft-fg',
    'bg-danger-soft text-danger-soft-fg',
    'bg-surface-3 text-fg-muted',
];

const Avatar: React.FC<{ nombre: string | null; telefono: string; tam?: 'sm' | 'md' }> = ({
    nombre,
    telefono,
    tam = 'md',
}) => {
    /* `?? '?'` no alcanza: una cadena vacía NO es nullish, así que un chat
       sin nombre y sin teléfono dibujaba un círculo de color en blanco. */
    const inicial = (nombre?.trim()?.[0] || telefono.slice(-2, -1) || '?').toUpperCase();
    let suma = 0;
    for (const ch of telefono) suma += ch.charCodeAt(0);
    return (
        <span
            aria-hidden="true"
            className={cn(
                'shrink-0 rounded-full flex items-center justify-center font-bold select-none',
                // 48px es el tamaño del avatar de WhatsApp en la lista.
                tam === 'md' ? 'h-12 w-12 text-lg' : 'h-10 w-10 text-base',
                COLORES_AVATAR[suma % COLORES_AVATAR.length],
            )}
        >
            {inicial}
        </span>
    );
};

/**
 * De dónde sale la lista. Es OTRA pregunta que la bandeja: acá se elige la
 * fuente de datos (conversaciones o escalamientos), y la bandeja filtra la
 * de conversaciones.
 *
 * Antes esta unión tenía nueve miembros porque hacía las dos cosas a la vez,
 * y por eso no se podían combinar: elegir "no leídos" obligaba a soltar
 * "IA atiende".
 */
type Tab = 'all' | 'archived' | 'pending' | 'resolved';

/** Las conversaciones se leen de `agent_conversations`; las otras dos, de escalamientos. */
const TABS_DE_CONVERSACION: ReadonlySet<Tab> = new Set<Tab>(['all', 'archived']);

interface ConversationPreferences {
    pinned: number[];
    archived: number[];
    muted: number[];
}

const EMPTY_PREFERENCES: ConversationPreferences = { pinned: [], archived: [], muted: [] };

function readConversationPreferences(userId: string | null): ConversationPreferences {
    try {
        const raw = localStorage.getItem(`wa-conversation-preferences:${userId ?? 'anonymous'}`);
        if (!raw) return EMPTY_PREFERENCES;
        const parsed = JSON.parse(raw) as Partial<ConversationPreferences>;
        return {
            pinned: Array.isArray(parsed.pinned) ? parsed.pinned : [],
            archived: Array.isArray(parsed.archived) ? parsed.archived : [],
            muted: Array.isArray(parsed.muted) ? parsed.muted : [],
        };
    } catch {
        return EMPTY_PREFERENCES;
    }
}

/** Tope de mensajes que se traen de una conversación (los más recientes). */
const MENSAJES_VISIBLES = 100;

/**
 * Cuántas conversaciones se traen por vuelta. Vienen ordenadas por
 * actividad, así que son las más recientes.
 */
const CONVERSACIONES_POR_PAGINA = 200;

/**
 * Filtro de búsqueda para PostgREST.
 *
 * Antes la búsqueda solo miraba las conversaciones YA cargadas (las 200
 * más recientes): con el historial de WhatsApp importado son miles, así
 * que buscar un cliente que no hablara hace poco no devolvía nada aunque
 * estuviera en la base. Ahora se busca contra la tabla entera.
 *
 * El término se limpia de los caracteres que PostgREST usa como sintaxis
 * (comas, paréntesis) para que un nombre con coma no rompa la consulta.
 */
function filtroBusqueda(termino: string): string | null {
    const limpio = termino.trim().replace(/[,()*\\"]/g, ' ').trim();
    if (!limpio) return null;

    const condiciones = [`customer_name.ilike.*${limpio}*`];
    const digitos = limpio.replace(/\D/g, '');
    if (digitos) {
        condiciones.push(`phone_number.ilike.*${digitos}*`, `lid.ilike.*${digitos}*`);
        // "0993279707" -> "993279707" (como queda guardado tras el 593)
        if (digitos.startsWith('0')) condiciones.push(`phone_number.ilike.*${digitos.slice(1)}*`);
    }
    return condiciones.join(',');
}

/**
 * Lo que el panel de detalle necesita, venga de un escalamiento o de una
 * conversación suelta -- así el detalle es uno solo para las tres pestañas.
 */
interface SelectedContext {
    conversationId: number;
    phoneNumber: string;
    customerName: string | null;
    conversationStatus: ConversationStatus;
    botEnabled: boolean;
    selectedAgent: 'intake' | 'sales' | null;
    lid: string | null;
    unreadCount: number;
    escalation: Escalation | null;
}

const WhatsAppInbox: React.FC = () => {
    const { session } = useAuth();
    const userId = session?.user?.id ?? null;
    // Por referencia para las funciones estables (`marcarLeida`), que no
    // pueden reconstruirse cuando cambia la sesión sin reiniciar de paso
    // los efectos que dependen de ellas.
    const userIdRef = useRef<string | null>(userId);
    userIdRef.current = userId;

    /**
     * "Ya llegó lo que pediste": clientes esperando un repuesto que hoy
     * está. `avisarTelefono` limita el modal a un cliente -- es el botón
     * de la ficha, dentro del chat --; sin él salen todos.
     */
    const [avisarAbierto, setAvisarAbierto] = useState(false);
    const [avisarTelefono, setAvisarTelefono] = useState<string | undefined>(undefined);
    const [porAvisar, setPorAvisar] = useState(0);
    /**
     * El otro caso: el repuesto no está en la bodega pero la importadora
     * lo tiene. A esa gente no se le avisa que llegó -- no llegó -- se le
     * ofrece traerlo pidiéndole un abono.
     */
    const [modoAviso, setModoAviso] = useState<ModoAviso>('llego');
    const [porPedirAbono, setPorPedirAbono] = useState(0);

    // Solo el número, sin traer las filas: el botón vive en una pantalla
    // que queda abierta todo el día.
    /**
     * Cuántos clientes están esperando a un vendedor. Se cuenta contra la
     * base y no sobre las filas cargadas: la lista trae las 200 más
     * recientes, y una ficha lista de hace tres días quedaría afuera justo
     * cuando es la que más importa.
     */
    const contarListas = useCallback(async () => {
        setListasParaVendedor(await contarListasParaVendedor());
    }, []);

    const contarAvisos = useCallback(async () => {
        try {
            const [enBodega, enImportadora] = await Promise.all([
                contarPorAvisar('llego'),
                contarPorAvisar('abono'),
            ]);
            setPorAvisar(enBodega);
            setPorPedirAbono(enImportadora);
        } catch (err) {
            // Que no se pueda contar no puede romper la bandeja: el botón
            // se muestra sin número y el modal dirá qué pasó.
            console.error('No se pudo contar los pedidos por avisar:', err);
        }
    }, []);

    const [escalations, setEscalations] = useState<Escalation[]>([]);
    const [profileNames, setProfileNames] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(true);
    /**
     * Se abre en "Todas", no en "Pendientes".
     *
     * Pendientes son solo los chats que el agente ESCALÓ -- casi siempre uno o
     * ninguno -- así que la bandeja arrancaba con la lista prácticamente vacía
     * y había que hacer un clic antes de poder trabajar. Lo que se busca al
     * entrar es la conversación de un cliente, y esa está en "Todas".
     */
    const [tab, setTab] = useState<Tab>('all');
    const [conversationPreferences, setConversationPreferences] = useState<ConversationPreferences>(() =>
        readConversationPreferences(userId),
    );
    const [conversationMenu, setConversationMenu] = useState<{
        conversation: Conversation;
        x: number;
        y: number;
    } | null>(null);
    const [messagePreview, setMessagePreview] = useState<{
        name: string;
        phone: string;
        text: string;
        outbound: boolean;
        time: string | null;
        x: number;
        y: number;
    } | null>(null);

    useEffect(() => {
        setConversationPreferences(readConversationPreferences(userId));
    }, [userId]);

    useEffect(() => {
        try {
            localStorage.setItem(
                `wa-conversation-preferences:${userId ?? 'anonymous'}`,
                JSON.stringify(conversationPreferences),
            );
        } catch { /* El almacenamiento puede estar deshabilitado. */ }
    }, [conversationPreferences, userId]);

    /* La tarjeta flotante está anclada a una posición calculada una sola
       vez: si la lista se desplaza debajo, queda señalando la fila
       equivocada. Se cierra al desplazar, como el menú contextual. */
    useEffect(() => {
        if (!messagePreview) return;
        const cerrar = () => setMessagePreview(null);
        window.addEventListener('scroll', cerrar, true);
        window.addEventListener('resize', cerrar);
        return () => {
            window.removeEventListener('scroll', cerrar, true);
            window.removeEventListener('resize', cerrar);
        };
    }, [messagePreview]);

    useEffect(() => {
        if (!conversationMenu) return;
        const close = () => setConversationMenu(null);
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
        window.addEventListener('click', close);
        window.addEventListener('scroll', close, true);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('click', close);
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('keydown', onKey);
        };
    }, [conversationMenu]);
    /**
     * Filtro por etapa del flujo. Es OTRA cosa que las pestañas de arriba:
     * esas eligen qué lista se mira (conversaciones o escalamientos), esto
     * filtra la lista de conversaciones por en qué punto están.
     */
    /**
     * La bandeja de trabajo elegida. `null` = todas.
     *
     * Reemplaza a los quince filtros sueltos que había antes. La regla de
     * qué cae en cada una vive en components/whatsapp/bandejas.ts.
     */
    const [bandeja, setBandeja] = useState<Bandeja | null>(null);
    /** null = la migración 0035 todavía no corrió; distinto de 0. */
    const [listasParaVendedor, setListasParaVendedor] = useState<number | null>(null);
    /**
     * La galería de fotos recibidas, en la columna de la conversación.
     *
     * El caso es el comprobante de pago: el cliente manda la foto, media
     * hora después hay que confirmarla y lo único que se recuerda es la
     * foto. Con 3.500 conversaciones, abrirlas de a una es imposible.
     */
    const [galeria, setGaleria] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [messagesConversationId, setMessagesConversationId] = useState<number | null>(null);
    const cacheMensajesRef = useRef(new Map<number, AgentMessage[]>());
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [eligiendoAgente, setEligiendoAgente] = useState<SelectedContext | null>(null);
    const [closeInsteadOfReopen, setCloseInsteadOfReopen] = useState(false);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    /**
     * El teléfono que se tocó DENTRO de un mensaje y dónde estaba en
     * pantalla, para colgarle el menú al lado. El menú lo dibuja la página
     * y no la burbuja porque el hilo tiene scroll propio: colgado adentro
     * quedaba recortado por el borde de la burbuja.
     */
    const [menuTelefono, setMenuTelefono] = useState<{ numero: string; ancla: DOMRect } | null>(null);
    const [nuevoChat, setNuevoChat] = useState(false);
    const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
    // El chat abierto no depende de que siga dentro del filtro visible.
    const [selectedConversationCache, setSelectedConversationCache] = useState<Conversation | null>(null);
    const [globalBotEnabled, setGlobalBotEnabled] = useState<boolean | null>(null);
    /**
     * Los dos agentes, por separado. `null` mientras no se sabe, y también
     * cuando la migración 0035 no corrió -- ahí no se muestran, en vez de
     * mostrarlos apagados y hacer creer que el agente está frenado.
     */
    const [agentes, setAgentes] = useState<{ recepcion: boolean; ventas: boolean } | null>(null);
    const [search, setSearch] = useState('');
    /** Se incrementa para forzar una relectura del chat abierto. */
    const [recargarMensajes, setRecargarMensajes] = useState(0);
    /**
     * Lo que se encoló y todavía no salió (o falló). Se muestra al final
     * del hilo: sin esto, entre que alguien manda un mensaje y el agente lo
     * despacha, la pantalla se ve como si no hubiera pasado nada y la gente
     * lo manda de nuevo.
     */
    /** Foto abierta a pantalla completa. */
    const [visor, setVisor] = useState<{ media: MediaItem[]; index: number } | null>(null);
    /** Estado del proceso del agente (migración 0027). null = no se sabe. */
    const [estadoAgente, setEstadoAgente] = useState<EstadoAgente | null>(null);
    /** Se incrementa para releer la ficha del cliente (tras anotar un pedido). */
    const [recargarFicha, setRecargarFicha] = useState(0);
    /** Mensaje que se está citando en la próxima respuesta. */
    const [citando, setCitando] = useState<MensajeHilo | null>(null);
    const [buscandoEnHilo, setBuscandoEnHilo] = useState(false);
    /** Mensaje que se está por pasar a otro chat. */
    const [reenviando, setReenviando] = useState<MensajeAReenviar | null>(null);

    /**
     * Pone una reacción. Se pinta al instante y se corrige si falla: es
     * una acción trivial y esperar el ida y vuelta la haría sentir rota.
     */
    const reaccionar = async (m: AgentMessage, emoji: string) => {
        if (!selected || !m.whatsapp_message_id) return;
        const previo = m.reaction;
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, reaction: emoji } : x)));
        try {
            await reaccionarMensaje(selected.conversationId, m.whatsapp_message_id, emoji, userId);
        } catch (err: any) {
            setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, reaction: previo } : x)));
            setErrorAccion(`No se pudo reaccionar: ${err?.message ?? err}`);
        }
    };

    /**
     * Borra para todos. Se confirma porque no tiene vuelta atrás, y
     * NO se pinta al instante: hasta que WhatsApp lo acepte, el cliente lo
     * sigue teniendo en el teléfono, y tacharlo antes sería mentir sobre
     * algo que todavía está a la vista del otro lado.
     */
    const borrar = async (m: AgentMessage) => {
        if (!selected || !m.whatsapp_message_id) return;
        if (!window.confirm('¿Borrar este mensaje para el cliente también?')) return;
        try {
            await borrarMensaje(selected.conversationId, m.whatsapp_message_id, userId);
        } catch (err: any) {
            setErrorAccion(`No se pudo borrar: ${err?.message ?? err}`);
        }
    };

    const editar = async (m: AgentMessage) => {
        if (!selected || !m.whatsapp_message_id || !m.body) return;
        const nuevo = window.prompt('Corregir mensaje:', m.body);
        if (nuevo === null || nuevo.trim() === m.body.trim()) return;
        if (!nuevo.trim()) {
            setErrorAccion('El mensaje corregido no puede quedar vacio.');
            return;
        }
        try {
            await editarMensaje(selected.conversationId, m.whatsapp_message_id, nuevo, userId);
        } catch (err: any) {
            setErrorAccion(`No se pudo editar: ${err?.message ?? err}`);
        }
    };

    /**
     * Mete un repuesto en la proforma de esa conversación. Lo usa la ficha
     * del cliente para el botón "Cotizar" de un pedido que ya llegó: ese es
     * el caso donde más rápido hay que reaccionar -- el repuesto está en
     * bodega y el cliente está escribiendo justo ahora.
     */
    const agregarAProforma = useChatProformaStore((s) => s.agregar);
    const proformasPorConversacion = useChatProformaStore((s) => s.porConversacion);

    /**
     * La proforma se arma en la tercera columna, al lado del hilo, para
     * poder ir releyendo lo que el cliente pidió mientras se la arma --
     * que es exactamente el trabajo: el cliente manda cuatro mensajes con
     * cuatro repuestos y hay que ir sacándolos de ahí.
     *
     * Antes era un modal centrado que tapaba la conversación: para
     * releer un mensaje había que cerrarlo, leer y volver a abrirlo.
     *
     * Solo cuando hay ancho para una tercera columna. Más angosto que eso
     * no se dockea nada: se sigue usando el modal del compositor, que en
     * esa pantalla es lo correcto.
     */
    const hayAnchoParaPanel = useMediaQuery(CONSULTA_PANTALLA_ANCHA);
    /**
     * MODO MOSTRADOR: la bandeja ocupa la ventana entera, por encima de la
     * navegación del ERP.
     *
     * Existe porque esta pantalla no se visita, se HABITA: quien atiende
     * pasa el día acá y el resto del ERP es una interrupción. Recuperando
     * la barra lateral y el encabezado se ganan unos 300px de ancho y 56 de
     * alto, que es exactamente lo que hacía falta para que la ficha del
     * cliente y la proforma dejen de turnarse y se vean las dos.
     *
     * Se recuerda entre sesiones: si alguien trabaja así, no tiene que
     * volver a pedirlo cada mañana.
     */
    const [modoAmplio, setModoAmplio] = useState<boolean>(() => {
        try {
            return localStorage.getItem('wa-modo-mostrador') === 'on';
        } catch {
            return false;
        }
    });
    const hayAnchoParaCuatro = useMediaQuery(CONSULTA_MOSTRADOR);
    /** La cuarta columna se puede plegar sin salir del modo mostrador. */
    const [panelCotizacion, setPanelCotizacion] = useState(true);
    const [proformaAbierta, setProformaAbierta] = useState(false);
    const [productoDelMensaje, setProductoDelMensaje] = useState<number | null>(null);
    /* Con las cuatro columnas la proforma vive SIEMPRE acoplada: es el
       sentido del modo mostrador -- nada se turna, todo está a la vista. */
    const cuatroColumnas = modoAmplio && hayAnchoParaCuatro;
    const proformaEnPanel = hayAnchoParaPanel && (proformaAbierta || (cuatroColumnas && panelCotizacion));
    const [conversationsLoading, setConversationsLoading] = useState(true);
    /** Total real en la base (o de la búsqueda), no el de las filas traídas. */
    const [totalConversaciones, setTotalConversaciones] = useState<number | null>(null);
    /**
     * Antes, si Supabase rechazaba una lectura o una acción (RLS, red), el
     * error solo iba a la consola: en pantalla parecía que todo había
     * funcionado. Ahora se muestra.
     */
    const [errorCarga, setErrorCarga] = useState<string | null>(null);
    const [errorAccion, setErrorAccion] = useState<string | null>(null);
    /** Confirmaciones. Van aparte de los errores: la franja roja no puede
     *  usarse para decir que algo salió bien. Se apaga sola. */
    const [avisoAccion, setAvisoAccion] = useState<string | null>(null);
    const [attentionIds, setAttentionIds] = useState<number[]>([]);
    /**
     * Abrir un chat manda el acuse de lectura a WhatsApp, pero no lo saca de
     * la lista de pendientes en mitad del trabajo. Se limpia al actualizar la
     * bandeja o al recargar la página, que es cuando se vuelve a leer el
     * estado real del teléfono.
     */
    const noLeidosConservadosRef = useRef<Set<number>>(new Set());
    const [noLeidosConservados, setNoLeidosConservados] = useState<Set<number>>(() => new Set());
    const actualizarNoLeidoConservado = useCallback((conversationId: number, conservar: boolean) => {
        const siguiente = new Set(noLeidosConservadosRef.current);
        if (conservar) siguiente.add(conversationId);
        else siguiente.delete(conversationId);
        noLeidosConservadosRef.current = siguiente;
        setNoLeidosConservados(siguiente);
    }, []);
    const limpiarNoLeidosConservados = useCallback(() => {
        const siguiente = new Set<number>();
        noLeidosConservadosRef.current = siguiente;
        setNoLeidosConservados(siguiente);
    }, []);

    // Una ficha abierta pertenece al chat donde se tocó. Al cambiar de
    // cliente se cierra para no mostrar por accidente el repuesto anterior.
    useEffect(() => setProductoDelMensaje(null), [selectedConversationId]);
    useEffect(() => {
        try {
            localStorage.setItem('wa-modo-mostrador', modoAmplio ? 'on' : 'off');
        } catch { /* el navegador puede tener el almacenamiento bloqueado */ }
    }, [modoAmplio]);

    /*
        Salir con Escape. Solo si no hay nada más abierto encima: con un
        modal a la vista, Escape es del modal, y cerrar la pantalla entera
        por debajo sería perder de vista lo que se estaba haciendo.
    */
    useEffect(() => {
        if (!modoAmplio) return;
        const alTeclear = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            /*
                Se pregunta por la PILA de overlays y no por el DOM. La
                consulta `[role="dialog"]` no veía el visor de fotos, que no
                lleva ese atributo, así que abrir una foto en modo mostrador y
                apretar Escape cerraba la foto y encima salía del modo -- el
                mismo fallo que el «atrás» del teléfono.
            */
            if (hayOverlayAbierto()) return;
            if (document.fullscreenElement) return;
            setModoAmplio(false);
        };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, [modoAmplio]);

    /**
     * Pantalla completa DE VERDAD (la del navegador), un paso más allá del
     * modo mostrador: esconde también las pestañas y la barra de
     * direcciones. Es lo que sirve en la máquina del mostrador, que no se
     * usa para navegar.
     */
    const [pantallaCompleta, setPantallaCompleta] = useState(false);
    useEffect(() => {
        const alCambiar = () => setPantallaCompleta(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', alCambiar);
        return () => document.removeEventListener('fullscreenchange', alCambiar);
    }, []);
    const alternarPantallaCompleta = useCallback(async () => {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.documentElement.requestFullscreen();
        } catch (err: any) {
            // Algunos navegadores la niegan sin gesto directo o en un iframe.
            setErrorAccion(`El navegador no permitió la pantalla completa: ${err?.message ?? err}`);
        }
    }, []);

    useEffect(() => {
        if (!avisoAccion) return;
        const t = setTimeout(() => setAvisoAccion(null), 4000);
        return () => clearTimeout(t);
    }, [avisoAccion]);
    useEffect(() => {
        let active = true;
        const refresh = () => getDueWorkIds().then((ids) => active && setAttentionIds(ids)).catch(() => {});
        void refresh();
        const timer = window.setInterval(refresh, 60_000);
        return () => { active = false; window.clearInterval(timer); };
    }, []);

    /**
     * La búsqueda vigente, legible desde los callbacks sin recrearlos. Los
     * eventos de realtime llaman a `fetchConversations` sin argumentos y
     * tienen que respetar el filtro que el usuario tenga puesto.
     */
    const searchRef = useRef(search);
    searchRef.current = search;
    /** El filtro vigente también debe respetarse en recargas de realtime. */
    const tabRef = useRef(tab);
    tabRef.current = tab;
    /** Ídem para la bandeja: la consulta se arma desde callbacks estables. */
    const bandejaRef = useRef(bandeja);
    bandejaRef.current = bandeja;

    /** Contenedor del hilo, para dejarlo scrolleado en el último mensaje. */
    const hiloRef = useRef<HTMLDivElement | null>(null);

    /**
     * Últimos mensajes ya avisados, por conversación.
     *
     * El evento de realtime no trae la fila anterior de forma confiable, así
     * que se recuerda acá cuál era el último mensaje de cada chat: sin esto,
     * cualquier UPDATE de la conversación -- también apagar el bot o marcar
     * leído -- dispararía una notificación de un mensaje que ya se avisó.
     */
    const ultimoAvisadoRef = useRef(new Map<number, string>());
    /** Los silenciados, legibles desde la suscripción, que se arma una vez. */
    const silenciadosRef = useRef<number[]>([]);
    silenciadosRef.current = conversationPreferences.muted;

    /**
     * La conversación abierta, legible desde los callbacks estables (misma
     * razón que `searchRef`: los eventos de realtime los llaman sin
     * argumentos y tienen que trabajar sobre el chat que está a la vista).
     */

    const notificaciones = useNotificacionesEscritorio({
        conversacionAbierta: selectedConversationId,
        onAbrir: (id) => {
            setGaleria(false);
            setSelectedId(null);
            setSelectedConversationId(id);
        },
    });
    // Por referencia por el mismo motivo que `silenciadosRef`: la
    // suscripción de realtime se arma una sola vez, en el montaje.
    const notificarRef = useRef(notificaciones.notificar);
    notificarRef.current = notificaciones.notificar;

    /**
     * `silencioso` = repaso de fondo, sin tocar el indicador de carga.
     *
     * Sin eso, cada repaso automático dibujaría el esqueleto de carga sobre
     * una lista que ya está bien: la pantalla parpadearía sola cada minuto
     * mientras alguien está leyendo un chat.
     */
    const fetchConversations = useCallback(async (silencioso = false) => {
        if (!silencioso) setConversationsLoading(true);

        const termino = searchRef.current.trim();
        let resultadosDeTexto: Awaited<ReturnType<typeof buscarConversacionesPorTexto>> = null;
        let errorDeBusqueda: string | null = null;

        if (termino.length >= 2) {
            try {
                resultadosDeTexto = await buscarConversacionesPorTexto(termino, CONVERSACIONES_POR_PAGINA);
            } catch (err: any) {
                console.error('Error buscando mensajes de WhatsApp:', err?.message ?? err);
                errorDeBusqueda = 'No se pudo buscar dentro de los mensajes; se buscará por nombre y número.';
            }
        }

        if (resultadosDeTexto && resultadosDeTexto.conversationIds.length === 0) {
            if (!silencioso) setConversationsLoading(false);
            setConversations([]);
            setTotalConversaciones(0);
            setErrorCarga(null);
            return;
        }

        const consulta = (campos: string, incluirEtapa = true) => {
            let q = supabase
                .from('agent_conversations')
                // `count: 'exact'` da el total REAL de la tabla (o de la
                // búsqueda), no el de las filas traídas: sin esto la tarjeta
                // "Conversaciones" se quedaba clavada en 200 apenas entró el
                // historial.
                .select(campos, { count: 'exact' })
                .order('last_message_at', { ascending: false, nullsFirst: false })
                .limit(CONVERSACIONES_POR_PAGINA);
            if (resultadosDeTexto) {
                q = q.in('id', resultadosDeTexto.conversationIds);
            } else {
                const filtro = filtroBusqueda(searchRef.current);
                if (filtro) q = q.or(filtro);
            }
            /*
                La bandeja elegida se lleva al servidor como un
                SUPERCONJUNTO. Es lo que permite que "Necesitan respuesta"
                encuentre un chat viejo que el cliente acaba de revivir,
                aunque no entre en las 200 más recientes.

                Superconjunto y no la bandeja exacta: la regla de prioridad
                (ver bandejas.ts) se vuelve a aplicar en el cliente, así que
                traer de más no molesta -- y escribir las exclusiones en
                PostgREST las volvería ilegibles.
            */
            const def = BANDEJAS.find((b) => b.id === bandejaRef.current);
            if (def?.sql && (incluirEtapa || !def.usaEtapa)) {
                const condiciones = [def.sql];
                // Los que alguien marcó sin leer a mano todavía no se
                // reflejan en la columna: sin esto desaparecían justo de la
                // bandeja donde se los acaba de poner.
                if (def.id === 'responder') {
                    const conservados = [...noLeidosConservadosRef.current];
                    if (conservados.length > 0) condiciones.push(`id.in.(${conservados.join(',')})`);
                }
                q = q.or(condiciones.join(','));
            }
            return q;
        };

        // Con la vista previa si la migración 0032 está aplicada; sin ella
        // si no. Pedirla a secas dejaría la bandeja SIN LISTA, no sin vista
        // previa (ver CAMPOS_CONV_PREVIEW).
        let { data, error, count } = await consulta(CAMPOS_CONV_PREVIEW);
        if (bandejaRef.current === 'cotizar' && faltaColumna(error)) {
            if (!silencioso) setConversationsLoading(false);
            setConversations([]);
            setTotalConversaciones(0);
            setErrorCarga('Para usar «IA lista, por cotizar» falta aplicar la migración de etapas del agente (0035).');
            return;
        }
        if (faltaColumna(error)) ({ data, error, count } = await consulta(CAMPOS_CONV_BASE, false));

        if (!silencioso) setConversationsLoading(false);
        if (error) {
            console.error('Error cargando conversaciones:', error.message);
            setErrorCarga(`No se pudieron cargar las conversaciones: ${error.message}`);
            return;
        }
        setErrorCarga(errorDeBusqueda);
        const filas = (data ?? []) as unknown as Conversation[];
        /* Se siembra la marca de "último visto" sin notificar: al abrir la
           pantalla no puede aparecer una tanda de avisos de mensajes viejos. */
        filas.forEach((f) => {
            if (!ultimoAvisadoRef.current.has(f.id) && f.last_message_at) {
                ultimoAvisadoRef.current.set(f.id, f.last_message_at);
            }
        });
        setConversations(filas);
        // En "Todas" el RPC conoce el total real de coincidencias. Los otros
        // filtros agregan reglas propias, así que su conteo sigue saliendo de
        // la consulta final para no mostrar una cifra engañosa.
        setTotalConversaciones(
            tabRef.current === 'all' && resultadosDeTexto ? resultadosDeTexto.total : count ?? null,
        );
    }, []);

    /**
     * Estado del proceso del agente (migración 0027).
     *
     * Va en su propia consulta y se traga los errores a propósito: si esa
     * migración todavía no se aplicó, la columna no existe y la consulta
     * falla -- pero eso no puede dejar sin funcionar al interruptor
     * maestro, que se lee de la misma tabla.
     */
    const fetchEstadoAgente = useCallback(async () => {
        const { data, error } = await supabase
            .from('agent_settings')
            .select('agent_last_seen_at, agent_connection, agent_outbound_mode')
            .eq('id', 1)
            .maybeSingle();
        if (error) {
            setEstadoAgente(null);
            return;
        }
        setEstadoAgente((data ?? null) as EstadoAgente | null);
    }, []);

    const fetchSettings = useCallback(async () => {
        const { data, error } = await supabase
            .from('agent_settings')
            .select('bot_auto_reply_enabled, intake_agent_enabled, sales_agent_enabled')
            .eq('id', 1)
            .maybeSingle();
        if (error) {
            console.error('Error cargando agent_settings:', error.message);
            return;
        }
        setGlobalBotEnabled(Boolean(data?.bot_auto_reply_enabled));
        const fila = data as { intake_agent_enabled?: boolean; sales_agent_enabled?: boolean } | null;
        setAgentes(
            fila?.intake_agent_enabled === undefined
                ? null
                : { recepcion: Boolean(fila.intake_agent_enabled), ventas: Boolean(fila.sales_agent_enabled) },
        );
    }, []);

    const fetchEscalations = useCallback(async (silencioso = false) => {
        if (!silencioso) setLoading(true);
        const { data, error } = await supabase
            .from('agent_escalations')
            .select(
                'id, conversation_id, reason, message_snapshot, status, claimed_by, claimed_at, resolved_at, created_at, agent_conversations ( phone_number, customer_name, status, bot_enabled )',
            )
            .order('created_at', { ascending: false })
            .limit(150);

        if (error) {
            console.error('Error cargando escalamientos:', error.message);
            setLoading(false);
            return;
        }

        const rows = (data ?? []) as unknown as Escalation[];
        setEscalations(rows);

        // PostgREST no puede unir agent_escalations -> profiles directo (el FK
        // real es contra auth.users), así que resolvemos los nombres aparte.
        const claimerIds = [...new Set(rows.map((r) => r.claimed_by).filter((id): id is string => !!id))];
        if (claimerIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('id, full_name, nickname').in('id', claimerIds);
            const map = new Map<string, string>();
            (profiles ?? []).forEach((p: any) => map.set(p.id, p.full_name || p.nickname || 'Alguien del equipo'));
            setProfileNames(map);
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        fetchEscalations();
        // `fetchConversations` no se llama acá: ya lo dispara el efecto de
        // búsqueda de más abajo, que corre también en el montaje. Llamarlo
        // en los dos lados duplicaba la consulta en cada carga.
        fetchSettings();
        fetchEstadoAgente();
        contarAvisos();
        contarListas();

        // El latido se relee solo: si el agente se cae con la pantalla
        // abierta, el aviso tiene que aparecer sin que nadie recargue.
        const latido = setInterval(() => fetchEstadoAgente(), 30000);

        /**
         * Los eventos de realtime llegan en ráfaga: una importación de
         * historial puede insertar miles de conversaciones y disparar un
         * evento por cada una. Sin agrupar, cada evento re-consultaba la
         * lista entera -- miles de consultas para mostrar lo mismo, y
         * factura de Supabase al pepe. Se agrupan en una sola recarga.
         */
        let escalationsTimer: ReturnType<typeof setTimeout> | undefined;
        let conversationsTimer: ReturnType<typeof setTimeout> | undefined;
        const AGRUPAR_MS = 3000;

        /** Si ya estuvo conectada una vez, el próximo SUBSCRIBED es una reconexión. */
        let huboConexion = false;

        const channel = supabase
            .channel('agent_escalations_inbox')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_escalations' }, () => {
                clearTimeout(escalationsTimer);
                escalationsTimer = setTimeout(() => fetchEscalations(), AGRUPAR_MS);
            })
            /**
             * Un UPDATE trae la fila nueva completa, así que se parchea en
             * memoria en vez de volver a pedir la lista.
             *
             * Antes cualquier cambio disparaba una relectura de 200
             * conversaciones. Como `last_message_at` se actualiza en CADA
             * mensaje, con la pantalla abierta y el chat activo eso era ~40 KB
             * cada 3 segundos -- más de 1 GB por día de una sola pestaña
             * abierta, contra los 5 GB mensuales de la cuota. Parcheando,
             * el evento ya trae lo que hace falta y no cuesta nada.
             *
             * Un INSERT sí necesita relectura: la conversación nueva puede
             * entrar en cualquier posición del orden por actividad.
             */
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'agent_conversations' }, (payload) => {
                const fila = payload.new as Conversation;

                /*
                    Aviso de escritorio. Se cuelga de este evento y no de una
                    suscripción nueva a `agent_messages` a propósito: escuchar
                    la tabla de mensajes ENTERA para poder avisar de cualquier
                    chat costaría un evento por mensaje de toda la operación,
                    y esta fila ya cambia con cada mensaje que entra.

                    Solo entrantes, y solo si el último mensaje es distinto del
                    que ya se avisó: un UPDATE también lo dispara apagar el
                    bot o marcar leído, y eso no es un mensaje nuevo.
                */
                const marca = fila.last_message_at ?? '';
                const yaAvisado = ultimoAvisadoRef.current.get(fila.id);
                if (marca) ultimoAvisadoRef.current.set(fila.id, marca);
                if (
                    fila.last_message_direction === 'inbound' &&
                    marca &&
                    yaAvisado !== undefined &&
                    yaAvisado !== marca
                ) {
                    notificarRef.current({
                        conversationId: fila.id,
                        titulo: fila.customer_name || formatPhone(fila),
                        cuerpo: textoPlano(fila.last_message_preview) || 'Te escribió por WhatsApp',
                        silenciado: silenciadosRef.current.includes(fila.id),
                    });
                }

                // Con una bandeja puesta, este UPDATE puede sacar o meter la
                // conversación: se vuelve a pedir la lista en vez de parchear
                // una fila que quizá ya no pertenece acá.
                if (bandejaRef.current !== null) {
                    clearTimeout(conversationsTimer);
                    conversationsTimer = setTimeout(() => fetchConversations(true), AGRUPAR_MS);
                    return;
                }
                setConversations((prev) => {
                    if (!prev.some((c) => c.id === fila.id)) return prev;
                    const parcheadas = prev.map((c) => (c.id === fila.id ? { ...c, ...fila } : c));
                    // Se reordena por actividad, igual que la consulta.
                    return parcheadas.sort(
                        (a, b) =>
                            new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime(),
                    );
                });
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_conversations' }, () => {
                clearTimeout(conversationsTimer);
                conversationsTimer = setTimeout(() => fetchConversations(), AGRUPAR_MS);
            })
            /**
             * Ponerse al día al RECONECTAR.
             *
             * Una suscripción se cae sola: se corta el wifi, se duerme la
             * laptop, cambia la red del local. El cliente de Supabase vuelve
             * a conectarse solo, pero los eventos de ese rato NO se
             * reenvían nunca -- se perdieron. Sin esto, la bandeja se
             * reconecta y sigue mostrando la lista congelada en el momento
             * del corte, sin que nada indique que está vieja.
             *
             * La primera conexión no cuenta: ahí la lista se acaba de
             * cargar y volver a pedirla sería duplicar la consulta de
             * arranque.
             */
            .subscribe((estado) => {
                if (estado !== 'SUBSCRIBED') return;
                if (huboConexion) {
                    fetchConversations(true);
                    fetchEscalations(true);
                }
                huboConexion = true;
            });

        return () => {
            clearTimeout(escalationsTimer);
            clearTimeout(conversationsTimer);
            clearInterval(latido);
            channel.unsubscribe();
        };
    }, [fetchEscalations, fetchConversations, fetchSettings, fetchEstadoAgente, contarAvisos, contarListas]);

    /**
     * La búsqueda de conversaciones va contra la base, así que se espera a
     * que la persona termine de tipear en vez de consultar por tecla.
     */
    useEffect(() => {
        const t = setTimeout(() => fetchConversations(), 350);
        return () => clearTimeout(t);
    }, [search, tab, fetchConversations]);

    /**
     * Deja el hilo abajo del todo: al abrir un chat con historial se
     * entraba viendo los mensajes MÁS VIEJOS y había que scrollear a mano
     * hasta el final para ver de qué se estaba hablando.
     */
    useHiloPegadoAbajo(hiloRef, selectedConversationId ?? selectedId);

    /**
     * El teléfono se guarda como solo dígitos, pero la gente lo escribe de
     * cualquier forma ("+593 99...", "0993..."). Se comparan solo los
     * dígitos de los dos lados, y además se acepta buscar sin el código de
     * país o con el 0 inicial que se usa acá.
     */
    const matchesSearch = useCallback(
        (conv: { phone_number: string; customer_name: string | null; lid?: string | null }) => {
            const term = search.trim();
            if (!term) return true;

            const digits = term.replace(/\D/g, '');
            if (digits) {
                const phone = conv.phone_number ?? '';
                if (phone.includes(digits)) return true;
                if (conv.lid?.includes(digits)) return true;
                // "0993279707" -> "993279707" (como queda tras el 593)
                if (digits.startsWith('0') && phone.includes(digits.slice(1))) return true;
            }

            const name = conv.customer_name?.toLowerCase() ?? '';
            return name.includes(term.toLowerCase());
        },
        [search],
    );

    const filtered = useMemo(() => {
        const byTab = escalations.filter((e) => (tab === 'pending' ? e.status !== 'resolved' : e.status === 'resolved'));
        if (!search.trim()) return byTab;
        // En las pestañas de escalamientos el dato del cliente puede venir
        // del embed o de `conversations` (que está más fresco).
        return byTab.filter((e) => {
            const conv = conversations.find((c) => c.id === e.conversation_id);
            return matchesSearch({
                phone_number: conv?.phone_number ?? e.agent_conversations?.phone_number ?? '',
                customer_name: conv?.customer_name ?? e.agent_conversations?.customer_name ?? null,
                lid: conv?.lid,
            });
        });
    }, [escalations, tab, search, conversations, matchesSearch]);

    // La pestaña "Todas" ya viene filtrada por la base (ver
    // `filtroBusqueda`), así que no se vuelve a filtrar acá: hacerlo
    // descartaría resultados legítimos que la consulta sí encontró.
    /**
     * "No leído" en la bandeja significa "todavía requiere seguimiento":
     * incluye el contador real, los datos que la IA ya dejó listos para el
     * vendedor y los chats recién abiertos que se conservan hasta refrescar.
     */
    const tienePendienteVisual = useCallback(
        (conversation: Pick<Conversation, 'id' | 'unread_count' | 'etapa'>) =>
            conversation.unread_count > 0 ||
            conversation.etapa === 'ready_for_sales' ||
            noLeidosConservados.has(conversation.id),
        [noLeidosConservados],
    );

    /**
     * Las conversaciones que se ven, ya sin las archivadas.
     *
     * Archivar es una decisión personal de organización, no una bandeja: se
     * saca de en medio antes de clasificar para que no ensucie los
     * contadores de trabajo pendiente.
     */
    const sinArchivar = useMemo(
        () => conversations.filter((c) => !conversationPreferences.archived.includes(c.id)),
        [conversations, conversationPreferences.archived],
    );

    /** Cuántas hay en cada bandeja. Una sola pasada por la lista cargada. */
    const cuentasDeBandeja = useMemo(
        () => contarPorBandeja(sinArchivar, tienePendienteVisual),
        [sinArchivar, tienePendienteVisual],
    );

    const filteredConversations = useMemo(() => {
        let rows = tab === 'archived'
            ? conversations.filter((c) => conversationPreferences.archived.includes(c.id))
            : sinArchivar;
        /* La misma regla de prioridad que usan los contadores: cada
           conversación cae en UNA bandeja, así que lo que se ve acá y el
           número de la pastilla no pueden discrepar. */
        if (bandeja) rows = rows.filter((c) => bandejaDe(c, tienePendienteVisual(c)) === bandeja);
        return [...rows].sort((a, b) => {
            const aPinned = conversationPreferences.pinned.includes(a.id) ? 1 : 0;
            const bPinned = conversationPreferences.pinned.includes(b.id) ? 1 : 0;
            return bPinned - aPinned;
        });
    }, [conversations, sinArchivar, bandeja, tab, conversationPreferences, tienePendienteVisual]);

    const pendingCount = useMemo(() => escalations.filter((e) => e.status !== 'resolved').length, [escalations]);


    /**
     * Métricas del día, calculadas sobre lo ya cargado (sin consultas
     * extra a Supabase). Sirven para ver de un vistazo si el agente está
     * ayudando: cuántos chats atiende y cuántos terminaron necesitando a
     * una persona.
     */
    const metricas = useMemo(() => {
        const activos = conversations.filter((c) => c.bot_enabled).length;
        const sinLeer = conversations.filter(tienePendienteVisual).length;
        const hoy = new Date().toISOString().slice(0, 10);
        const escaladosHoy = escalations.filter((e) => e.created_at.slice(0, 10) === hoy).length;
        // El total sale del `count` de la consulta; el resto se calcula
        // sobre lo cargado y por eso se aclara en pantalla que es "de las
        // recientes" cuando hay más de las que entran en una página.
        return { activos, sinLeer, escaladosHoy, total: totalConversaciones ?? conversations.length };
    }, [conversations, escalations, totalConversaciones, tienePendienteVisual]);

    /** Hay más conversaciones que las traídas en esta página. */
    const hayMas = totalConversaciones !== null && totalConversaciones > conversations.length;

    /**
     * Por qué lo que se mande ahora NO le va a llegar al cliente, si es que
     * hay un motivo. Null = todo en orden.
     *
     * Se muestra ANTES de escribir, no después: descubrir que el mensaje
     * quedó trabado recién cuando el cliente reclama es el peor final
     * posible para esta pantalla.
     */
    // La regla de qué avisar vive en components/whatsapp/agente.ts: es la
    // misma para la bandeja y para el modo móvil, y escrita dos veces
    // significaba que un día una avisa y la otra no.
    const avisoDeEnvio = useMemo(() => avisoDelAgente(estadoAgente, timeAgo), [estadoAgente]);

    const selectedEscalation = escalations.find((e) => e.id === selectedId) ?? null;

    useEffect(() => {
        if (selectedConversationId === null) {
            setSelectedConversationCache(null);
            return;
        }
        const current = conversations.find((conversation) => conversation.id === selectedConversationId);
        if (current) setSelectedConversationCache(current);
    }, [conversations, selectedConversationId]);

    // Un solo "seleccionado" para las tres pestañas: en Pendientes/Resueltas
    // viene de un escalamiento, en Todas de la conversación suelta. El
    // `bot_enabled` se lee siempre de `conversations` cuando está cargada,
    // así el botón refleja el estado real aunque el escalamiento se haya
    // traído antes del último cambio.
    const selected: SelectedContext | null = useMemo(() => {
        if (TABS_DE_CONVERSACION.has(tab)) {
            // Al marcarlo leído puede salir de la lista filtrada; el hilo sigue abierto.
            const conv = conversations.find((c) => c.id === selectedConversationId)
                ?? (selectedConversationCache?.id === selectedConversationId ? selectedConversationCache : null);
            if (!conv) return null;
            return {
                conversationId: conv.id,
                phoneNumber: conv.phone_number,
                customerName: conv.customer_name,
                conversationStatus: conv.status,
                botEnabled: conv.bot_enabled,
                selectedAgent: conv.selected_agent,
                lid: conv.lid,
                unreadCount: conv.unread_count,
                escalation: null,
            };
        }
        if (!selectedEscalation) return null;
        const conv = conversations.find((c) => c.id === selectedEscalation.conversation_id);
        return {
            conversationId: selectedEscalation.conversation_id,
            phoneNumber: conv?.phone_number ?? selectedEscalation.agent_conversations?.phone_number ?? '',
            customerName: conv?.customer_name ?? selectedEscalation.agent_conversations?.customer_name ?? null,
            conversationStatus: conv?.status ?? selectedEscalation.agent_conversations?.status ?? 'bot_active',
            botEnabled: conv?.bot_enabled ?? selectedEscalation.agent_conversations?.bot_enabled ?? false,
            selectedAgent: conv?.selected_agent ?? null,
            lid: conv?.lid ?? null,
            unreadCount: conv?.unread_count ?? 0,
            escalation: selectedEscalation,
        };
    }, [tab, conversations, selectedConversationId, selectedConversationCache, selectedEscalation]);

    const colaDeAtencion = useMemo(() => conversations.filter((conversation) =>
        !conversationPreferences.archived.includes(conversation.id) &&
        (tienePendienteVisual(conversation) || attentionIds.includes(conversation.id)),
    ), [conversations, conversationPreferences.archived, attentionIds, tienePendienteVisual]);

    const abrirSiguientePendiente = useCallback(() => {
        if (colaDeAtencion.length === 0) return;
        const actual = colaDeAtencion.findIndex((conversation) => conversation.id === selectedConversationId);
        const siguiente = colaDeAtencion[(actual + 1 + colaDeAtencion.length) % colaDeAtencion.length];
        setSelectedId(null);
        setSelectedConversationId(siguiente.id);
        // Ir al siguiente pendiente lleva a su bandeja: si no, el chat se
        // abre y la lista de al lado sigue mostrando otra cosa.
        setTab('all');
        setBandeja('responder');
    }, [colaDeAtencion, selectedConversationId]);

    useEffect(() => {
        const onShortcut = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const editing = target?.matches('input, textarea, select, [contenteditable="true"]');
            if (editing || event.ctrlKey || event.metaKey || event.altKey) return;
            /*
                Con un modal abierto los atajos NO corren. El catálogo, la
                proforma y el aviso de llegada se manejan con el mouse: al
                tocar una tarjeta el foco queda en un `div role="button"`,
                que no es un campo de texto, así que la siguiente letra que
                se escribía saltaba de conversación o abría un panel DETRÁS
                del modal -- sin que nada en pantalla lo explicara.
            */
            if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
            if (event.key.toLowerCase() === 'n') { event.preventDefault(); abrirSiguientePendiente(); }
            if (event.key.toLowerCase() === 'r' && selected) {
                event.preventDefault();
                document.querySelector<HTMLTextAreaElement>('[aria-label="Mensaje para el cliente"]')?.focus();
            }
            if (event.key.toLowerCase() === 'p' && selected && hayAnchoParaPanel) {
                event.preventDefault();
                setProductoDelMensaje(null);
                // Con las cuatro columnas la proforma ya esta acoplada: lo
                // unico que puede hacer el atajo es desplegarla si la
                // plegaron.
                if (cuatroColumnas) setPanelCotizacion(true);
                else setProformaAbierta(true);
            }
        };
        window.addEventListener('keydown', onShortcut);
        return () => window.removeEventListener('keydown', onShortcut);
    }, [abrirSiguientePendiente, selected, hayAnchoParaPanel, cuatroColumnas]);

    // La cola de salida vive en components/whatsapp/ColaDeSalida.tsx: el modo
    // móvil usa el MISMO hook y las mismas burbujas. Va acá y no más arriba
    // porque en las pestañas de escalamientos el id de la conversación no es
    // `selectedConversationId`: sale del escalamiento.
    const {
        enCola,
        accionesFallidas,
        recargar: cargarCola,
        cancelar: handleCancelar,
        reintentar: handleReintentar,
        descartar: handleDescartar,
        resolverAccion,
    } = useColaDeSalida(selected?.conversationId ?? null, {
        onError: setErrorAccion,
        onYaHabiaSalido: () => setRecargarMensajes((n) => n + 1),
    });

    const mensajesVisibles = useMemo(
        () => selected && messagesConversationId === selected.conversationId ? messages : [],
        [selected, messagesConversationId, messages],
    );

    useEffect(() => {
        if (messagesConversationId) cacheMensajesRef.current.set(messagesConversationId, messages);
    }, [messagesConversationId, messages]);

    /**
     * Vuelve a traer los últimos mensajes y los funde con los que ya están
     * en pantalla.
     *
     * Es la red de abajo del realtime, y hace falta de verdad: los eventos
     * de `agent_messages` solo llegan si esa tabla está en la publicación
     * `supabase_realtime` (migración 0033 del agente). Sin eso, la
     * suscripción se conecta perfecto y no llega NADA -- que es como se
     * veía: escribías un mensaje, aparecía "En cola", el agente lo
     * despachaba y la burbuja DESAPARECÍA de la pantalla hasta recargar,
     * porque el mensaje ya vivía en `agent_messages` y de ahí no llegaba
     * ningún aviso. También cubre la suscripción que se cae sola (wifi,
     * laptop dormida) y la pestaña en segundo plano.
     *
     * Solo con un chat abierto y solo con la pestaña a la vista: eso lo
     * decide `useRepasoDelHilo`.
     */
    const conversacionAbiertaRef = useRef<number | null>(null);
    conversacionAbiertaRef.current = selected?.conversationId ?? null;

    const repasarHilo = useCallback(async () => {
        const id = conversacionAbiertaRef.current;
        if (!id) return;
        const { data, error } = await supabase
            .from('agent_messages')
            .select(CAMPOS_MENSAJE)
            .eq('conversation_id', id)
            .order('created_at', { ascending: false })
            .limit(MENSAJES_VISIBLES);
        // Un repaso que falla no se muestra: el hilo que ya está en
        // pantalla sigue siendo válido y el siguiente turno reintenta.
        if (error || !data) return;
        // Pudieron cambiar de chat mientras viajaba la consulta.
        if (conversacionAbiertaRef.current !== id) return;
        const recientes = await attributeMessages((data as AgentMessage[]).slice().reverse());
        setMessages((prev) => fusionarMensajes(prev, recientes));
    }, []);

    useRepasoDelHilo(!!selected, repasarHilo);

    /**
     * Y la red de abajo de la LISTA, que no tenía ninguna.
     *
     * El hilo abierto ya se repasa (arriba) y la cola de salida también,
     * pero la lista de chats dependía enteramente del realtime: si la
     * suscripción se caía, la lista quedaba congelada para siempre -- sin
     * contadores de no leídos nuevos, sin la vista previa del último
     * mensaje y sin reordenarse por actividad -- y nada en la pantalla
     * decía que lo que se estaba viendo era viejo.
     *
     * Un minuto y no ocho segundos como el hilo: la lista son 200 filas
     * contra las 100 del hilo, y la conversación abierta es la que se está
     * mirando. Solo con la pestaña A LA VISTA, y se pone al día de una al
     * volver a ella -- que es cuando importa, después de un rato en otra
     * cosa. En un ERP que queda abierto todo el día, repasar contra una
     * pestaña que nadie mira es factura de Supabase al pepe.
     */
    const repasarLista = useCallback(() => {
        fetchConversations(true);
    }, [fetchConversations]);

    useRepasoDelHilo(true, repasarLista, 60000);

    useEffect(() => {
        if (!selected) {
            setMessages([]);
            setMessagesConversationId(null);
            return;
        }
        let cancelled = false;
        const conversationId = selected.conversationId;
        const cache = cacheMensajesRef.current.get(conversationId);
        setMessages(cache ?? []);
        setMessagesConversationId(conversationId);
        setMessagesLoading(!cache);
        // Solo los últimos N: una conversación larga puede tener cientos de
        // mensajes y traerlos todos es lento y caro (se piden en orden
        // descendente y se revierte, para quedarse con los MÁS RECIENTES).
        supabase
            .from('agent_messages')
            .select(CAMPOS_MENSAJE)
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(MENSAJES_VISIBLES)
            .then(async ({ data, error }) => {
                if (cancelled) return;
                // Un fallo acá (RLS, red) dejaba la pantalla diciendo "Sin
                // mensajes registrados todavía", que es una conversación vacía
                // -- exactamente lo contrario de lo que pasó.
                if (error) setErrorCarga(`No se pudo abrir la conversación: ${error.message}`);
                else if (data) {
                    const filas = await attributeMessages((data as AgentMessage[]).slice().reverse());
                    cacheMensajesRef.current.set(conversationId, filas);
                    setMessages(filas);
                    setMessagesConversationId(conversationId);
                }
                setMessagesLoading(false);
            });
        // Mensajes en vivo del chat abierto: sin esto había que refrescar la
        // página para ver lo que iba llegando (el filtro es por conversación,
        // así que no llegan eventos de otros chats).
        const channel = supabase
            .channel(`agent_messages_conversation_${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'agent_messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    if (cancelled) return;
                    const nuevo = payload.new as AgentMessage;
                    /* Se resuelve la autoría antes de meterlo al hilo: sin
                       esto, el clic derecho sobre la burbuja recién llegada
                       decía "Agente IA" aunque la hubiera escrito una
                       persona, hasta que pasara el repaso de los 8 segundos.
                       Con la caché puesta cuesta a lo sumo una consulta. */
                    void attributeMessage(nuevo).then((conAutoria) => {
                        if (cancelled) return;
                        setMessages((prev) =>
                            prev.some((m) => m.id === conAutoria.id) ? prev : [...prev, conAutoria],
                        );
                    });
                },
            )
            /**
             * Y los cambios sobre un mensaje que ya está en el hilo.
             *
             * Es lo que hace que el tilde pase de gris a azul cuando el cliente
             * lo lee, sin tocar "Actualizar chat" -- que es el gesto que uno
             * espera de WhatsApp. También trae el tachado de un mensaje borrado
             * en el momento en que WhatsApp lo acepta (antes había que refrescar
             * para saber si el borrado había salido) y las reacciones que pone
             * el cliente.
             *
             * Solo del chat ABIERTO: son tres o cuatro eventos por mensaje y
             * mientras la conversación está a la vista, así que no mueve la
             * aguja de la cuota.
             */
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'agent_messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    if (cancelled) return;
                    const fila = payload.new as AgentMessage;
                    setMessages((prev) => prev.map((m) => (m.id === fila.id ? { ...m, ...fila } : m)));
                },
            )
            .subscribe();

        return () => {
            cancelled = true;
            channel.unsubscribe();
        };
        // Solo re-consultamos cuando cambia LA CONVERSACIÓN seleccionada, no en
        // cada re-render de `selected` (cambia de referencia en cada fetch).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.conversationId, recargarMensajes]);

    /**
     * Tener el chat a la vista manda el acuse de lectura a WhatsApp, pero lo
     * conserva en "No leídos" durante esta sesión para que no desaparezca
     * debajo de quien lo está atendiendo.
     *
     * Depende del CONTEO y no solo de qué chat está abierto: si el cliente
     * escribe mientras la conversación está en pantalla, esa vuelta también
     * tiene que apagarse. Mirando solo el id, el mensaje que llegaba con el
     * chat abierto quedaba sin leer en el teléfono para siempre.
     *
     * No hay riesgo de repetición: `marcarLeida` deja el contador en cero en
     * la lista, así que el efecto no se vuelve a disparar hasta que entre
     * algo nuevo.
     */
    useEffect(() => {
        if (selected && selected.unreadCount > 0) {
            marcarLeida(selected.conversationId, true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.conversationId, selected?.unreadCount]);

    const handleClaim = async (escalation: Escalation) => {
        if (!userId) return;
        setActionLoading(true);
        setErrorAccion(null);
        const { error } = await supabase
            .from('agent_escalations')
            .update({ status: 'claimed', claimed_by: userId, claimed_at: new Date().toISOString() })
            .eq('id', escalation.id);
        if (error) {
            setActionLoading(false);
            setErrorAccion(`No se pudo reclamar: ${error.message}`);
            return;
        }
        const { error: errorConv } = await supabase
            .from('agent_conversations')
            .update({ status: 'human_active' })
            .eq('id', escalation.conversation_id);
        if (errorConv) setErrorAccion(`Se reclamó, pero la conversación no quedó marcada: ${errorConv.message}`);
        // La etapa va aparte de `status`: es la que hace que el chat
        // desaparezca de "listas para vendedor" ahora que alguien lo tomó.
        await marcarEtapa(escalation.conversation_id, 'human_assigned', 'Un vendedor reclamó el escalamiento');
        setActionLoading(false);
        await Promise.all([fetchEscalations(), fetchConversations(), contarListas()]);
    };

    // El agente NO le contesta a nadie por su cuenta: solo responde en las
    // conversaciones habilitadas explícitamente acá (ver migración 0017 del
    // repo del agente). Arranca apagado para cada cliente nuevo.
    const handleToggleBot = async (ctx: SelectedContext) => {
        if (!ctx.botEnabled || ctx.conversationStatus !== 'bot_active') {
            setEligiendoAgente(ctx);
            return;
        }
        setActionLoading(true);
        setErrorAccion(null);
        const { error } = await supabase.rpc('set_conversation_agent', {
            p_conversation_id: ctx.conversationId,
            p_enabled: false,
            p_selected_agent: null,
        });
        setActionLoading(false);
        if (error) {
            // Importante que se vea: si esto falla en silencio, el equipo
            // cree que apagó el agente para un cliente y el agente sigue
            // contestándole.
            setErrorAccion(`No se pudo cambiar el agente de esta conversación: ${error.message}`);
            return;
        }
        await Promise.all([fetchConversations(), fetchEscalations()]);
    };

    const activarAgenteDelChat = async (agente: 'intake' | 'sales') => {
        if (!eligiendoAgente) return;
        const conversationId = eligiendoAgente.conversationId;
        setActionLoading(true);
        setErrorAccion(null);
        const { error } = await supabase.rpc('set_conversation_agent', {
            p_conversation_id: eligiendoAgente.conversationId,
            p_enabled: true,
            p_selected_agent: agente,
        });
        setActionLoading(false);
        if (error) {
            setErrorAccion(`No se pudo activar el agente: ${error.message}`);
            return;
        }
        setEligiendoAgente(null);
        // Activar resuelve cualquier escalamiento abierto. Si estábamos en
        // "Pendientes", esa fila desaparece de la pestaña; se mantiene el
        // mismo chat abierto cambiando a la lista general.
        setSelectedId(null);
        setSelectedConversationId(conversationId);
        setTab('all');
        await Promise.all([fetchConversations(), fetchEscalations()]);
    };

    /**
     * Prende o apaga uno de los dos agentes (migración 0035).
     *
     * Son dos y no un modo porque el punto de partida real es "recepción
     * automática + vendedor humano": la recepción junta los datos del
     * repuesto y deja la ficha lista, y ahí se detiene. El vendedor es el
     * que dice precios y confirma stock, y por eso arranca apagado.
     */
    const handleToggleAgente = async (cual: 'recepcion' | 'ventas') => {
        if (!agentes) return;
        setActionLoading(true);
        const columna = cual === 'recepcion' ? 'intake_agent_enabled' : 'sales_agent_enabled';
        const { error } = await supabase
            .from('agent_settings')
            .update({ [columna]: !agentes[cual], updated_at: new Date().toISOString(), updated_by: userId })
            .eq('id', 1);
        setActionLoading(false);
        if (error) {
            // Que se vea: creer que quedó apagado cuando sigue contestando
            // es exactamente el error que no se puede permitir.
            setErrorAccion(`No se pudo cambiar el agente: ${error.message}`);
            return;
        }
        await fetchSettings();
    };

    /**
     * Interruptor MAESTRO (agent_settings, migración 0018). Apagado acá, el
     * agente no le contesta a nadie aunque una conversación esté habilitada.
     */
    const handleToggleGlobalBot = async () => {
        if (globalBotEnabled === null) return;
        setActionLoading(true);
        setErrorAccion(null);
        const { error } = await supabase
            .from('agent_settings')
            .update({ bot_auto_reply_enabled: !globalBotEnabled, updated_at: new Date().toISOString(), updated_by: userId })
            .eq('id', 1);
        setActionLoading(false);
        // Es el interruptor maestro: creer que quedó apagado cuando sigue
        // encendido es exactamente el error que no se puede permitir.
        if (error) setErrorAccion(`No se pudo cambiar el interruptor general: ${error.message}`);
        fetchSettings();
    };

    /**
     * Abre una conversación por su id, venga de donde venga: la galería de
     * fotos y la cola de "por avisar".
     *
     * La lista carga las 200 más recientes, así que la conversación de una
     * foto vieja puede no estar cargada: seleccionar su id a secas dejaría
     * la pantalla en blanco. Si falta, se trae esa sola y se mete al
     * principio de la lista.
     */
    const abrirConversacionPorId = useCallback(
        async (id: number) => {
            setGaleria(false);
            setTab('all');
            setSelectedId(null);
            setSelectedConversationId(id);

            if (conversations.some((c) => c.id === id)) return;

            const traer = (campos: string) =>
                supabase.from('agent_conversations').select(campos).eq('id', id).maybeSingle();
            let { data, error } = await traer(CAMPOS_CONV_PREVIEW);
            if (faltaColumna(error)) ({ data, error } = await traer(CAMPOS_CONV_BASE));

            if (error || !data) {
                setErrorCarga('No se pudo abrir esa conversación.');
                return;
            }
            const fila = data as unknown as Conversation;
            setConversations((prev) => (prev.some((c) => c.id === fila.id) ? prev : [fila, ...prev]));
        },
        [conversations],
    );

    /**
     * Marca la conversación como leída en los DOS lados.
     *
     * El UPDATE local es solo el adelanto para que la lista responda al
     * toque; el que manda es el acuse que se encola para WhatsApp, porque
     * el contador de no leídos lo espeja WhatsApp y no lo decide el ERP
     * (ver `marcarLeidoEnWhatsApp`). Sin la parte encolada, el chat seguía
     * pendiente en el teléfono y el siguiente `chats.update` lo devolvía a
     * la lista como si nadie lo hubiera abierto.
     */
    const marcarLeida = useCallback(async (conversationId: number, conservarEnLista = false) => {
        actualizarNoLeidoConservado(conversationId, conservarEnLista);
        // No se espera ni rompe la apertura del chat: es un acuse, y que
        // el agente esté caído no puede impedir abrir una conversación.
        marcarLeidoEnWhatsApp(conversationId, userIdRef.current).catch((err) =>
            console.error('No se pudo encolar el acuse de lectura:', err?.message ?? err),
        );

        const { error } = await supabase.from('agent_conversations').update({ unread_count: 0 }).eq('id', conversationId);
        // Si la base lo rechazó, no se apaga el contador en pantalla: dejarlo
        // en cero mentiría hasta el próximo refresco, que lo traería
        // encendido de nuevo.
        if (error) {
            console.error('No se pudo marcar como leída:', error.message);
            return;
        }
        setConversations((prev) =>
            prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c)),
        );
    }, [actualizarNoLeidoConservado]);


    /**
     * Encola lo que se escribió (texto, fotos, archivos o fichas del
     * catálogo) para que el proceso del agente lo envíe.
     *
     * Lanza si Supabase lo rechaza: la caja de escribir muestra el error y
     * NO limpia el borrador -- perder lo que alguien acaba de escribir
     * porque falló la red es inaceptable.
     */
    const enviarMensajes = useCallback(
        async (mensajes: NuevoMensaje[]) => {
            // Si hay un mensaje citado, la cita viaja con el primero: es el
            // que WhatsApp muestra con la tarjetita arriba.
            const conCita = citando?.whatsapp_message_id
                ? mensajes.map((m, i) => (i === 0 ? { ...m, replyToWaId: citando.whatsapp_message_id } : m))
                : mensajes;

            await encolarMensajes(conCita, userId);

            // El tilde azul también al responder, además de al abrir el
            // chat: si el cliente escribió mientras se le contestaba, ese
            // último mensaje queda leído sin esperar la vuelta del contador.
            // El id sale del propio mensaje y no de `selected`, que pudo
            // cambiar mientras tanto. No se espera: que falle el tilde no
            // puede romper el envío.
            const conversationId = mensajes[0]?.conversationId;
            if (conversationId && conversacionAbiertaRef.current === conversationId) setCitando(null);
            if (conversationId) marcarLeidoEnWhatsApp(conversationId, userId).catch(() => {});

            // Aparece de inmediato en el hilo como "en cola"; el realtime de
            // agent_outbox lo va actualizando hasta que sale.
            await cargarCola();
        },
        [userId, citando?.whatsapp_message_id, cargarCola],
    );

    // Una cita pertenece al chat donde se eligio. Nunca se arrastra al
    // siguiente cliente al cambiar de conversacion.
    useEffect(() => {
        setCitando(null);
        setBuscandoEnHilo(false);
    }, [selected?.conversationId]);

    /** Cancela un mensaje que todavía no salió. */
    /**
     * Deja el chat como pendiente -- acá y en el teléfono -- y CIERRA el
     * detalle.
     *
     * Lo segundo no es un capricho: si el chat quedara abierto, el efecto
     * que marca leído al tenerlo a la vista lo apagaría de nuevo en el
     * siguiente render y el botón parecería no hacer nada.
     */
    const marcarComoNoLeido = async (conversationId: number) => {
        setActionLoading(true);
        setErrorAccion(null);
        try {
            await marcarNoLeido(conversationId, userId);
            actualizarNoLeidoConservado(conversationId, true);
            setConversations((prev) =>
                prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 1 } : c)),
            );
            if (selectedConversationId === conversationId) setSelectedConversationId(null);
            if (selected?.conversationId === conversationId) setSelectedId(null);
        } catch (err: any) {
            setErrorAccion(`No se pudo marcar sin leer: ${err?.message ?? err}`);
        } finally {
            setActionLoading(false);
        }
    };

    const toggleConversationPreference = (key: keyof ConversationPreferences, conversationId: number) => {
        setConversationPreferences((current) => ({
            ...current,
            [key]: current[key].includes(conversationId)
                ? current[key].filter((id) => id !== conversationId)
                : [...current[key], conversationId],
        }));
    };

    /**
     * Abre la foto a pantalla completa, con las demás del hilo al lado.
     *
     * Solo FOTOS: los stickers también son imágenes, pero pasar de la foto
     * de un repuesto a un pulgar arriba de 96px mientras se amplía una
     * pieza no es lo que nadie está buscando.
     */
    const abrirVisor = (mensaje: AgentMessage) => {
        const fotos = mensajesVisibles.filter((m) => !!m.media_url && m.content_type === 'image');
        const media: MediaItem[] = fotos.map((m) => ({ type: 'image', url: m.media_url!, title: m.body ?? undefined }));
        const index = Math.max(0, fotos.findIndex((m) => m.id === mensaje.id));
        setVisor({ media, index });
    };

    const handleResolve = async (escalation: Escalation) => {
        setActionLoading(true);
        setErrorAccion(null);
        const { error } = await supabase
            .from('agent_escalations')
            .update({ status: 'resolved', resolved_at: new Date().toISOString() })
            .eq('id', escalation.id);
        if (error) {
            setActionLoading(false);
            setErrorAccion(`No se pudo marcar como resuelta: ${error.message}`);
            return;
        }
        const { error: errorConv } = await supabase
            .from('agent_conversations')
            .update({ status: closeInsteadOfReopen ? 'closed' : 'bot_active' })
            .eq('id', escalation.conversation_id);
        if (errorConv) setErrorAccion(`Quedó resuelta, pero la conversación no cambió de estado: ${errorConv.message}`);
        // Devolverla al bot la manda al principio del flujo, no a "lista
        // para vendedor": si el cliente vuelve a escribir, la recepción
        // arranca de nuevo con todo el historial a la vista.
        await marcarEtapa(
            escalation.conversation_id,
            closeInsteadOfReopen ? 'resolved' : 'intake_in_progress',
            closeInsteadOfReopen ? 'Se marcó resuelta y cerrada' : 'Se resolvió y volvió al agente',
        );
        setActionLoading(false);
        setCloseInsteadOfReopen(false);
        await Promise.all([fetchEscalations(), fetchConversations(), contarListas()]);
    };

    return (
        /* Un espacio de trabajo de alto completo, como WhatsApp Web: la PÁGINA
           no se desplaza, se desplazan la lista y el hilo cada uno por su
           cuenta. Antes el encabezado ocupaba 380px -- título largo, tarjeta
           del agente, cuatro tarjetas de métricas, pestañas y buscador -- y el
           chat quedaba comprimido debajo, así que para leer el último mensaje
           había que bajar la página entera. */
        <div
            className={cn(
                'flex flex-col overflow-hidden',
                modoAmplio
                    /* `fixed inset-0` para pasar POR ENCIMA de la navegación del
                       ERP. Lleva fondo propio: sin él se transparentaría el menú
                       lateral por debajo. */
                    ? 'fixed inset-0 z-40 h-[100dvh] gap-2 bg-surface-2 p-2'
                    : 'h-[calc(100dvh-3.5rem)] gap-3 p-4 md:p-5',
            )}
        >
            {/* --------------------------- Barra superior --------------------------- */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {/* En modo mostrador el título se encoge a una línea: esos
                    40px de alto valen más como conversación. */}
                <div className="min-w-0">
                    <h1
                        className={cn(
                            'font-bold tracking-tight text-fg',
                            modoAmplio ? 'text-base leading-tight' : 'text-xl',
                        )}
                    >
                        Bandeja de WhatsApp
                    </h1>
                    {!modoAmplio && (
                        <p className="text-xs text-fg-muted">
                            Lo que mandes desde acá queda guardado en la conversación. Lo que escribas
                            desde el teléfono, no.
                        </p>
                    )}
                </div>

                {/* Entrar y salir del modo mostrador. Va primero entre las
                    acciones porque es la que cambia la pantalla entera. */}
                <button
                    onClick={() => setModoAmplio((v) => !v)}
                    role="switch"
                    aria-checked={modoAmplio}
                    aria-label={modoAmplio ? 'Salir del modo mostrador' : 'Abrir la bandeja en la ventana completa'}
                    title={
                        modoAmplio
                            ? 'Volver al ERP con su menú (Escape)'
                            : 'Usar la ventana entera: se gana ancho para ver la ficha del cliente y la proforma a la vez'
                    }
                    className={cn(
                        button.base,
                        modoAmplio ? button.variant.primary : button.variant.secondary,
                        button.size.md,
                        'order-first shrink-0 lg:order-none',
                    )}
                >
                    {modoAmplio ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
                    <span className="hidden sm:inline">{modoAmplio ? 'Salir' : 'Mostrador'}</span>
                </button>

                {/* Un paso más: la pantalla completa del navegador. Solo se
                    ofrece dentro del modo mostrador, que es donde tiene
                    sentido -- en la máquina del mostrador no se navega. */}
                {modoAmplio && (
                    <button
                        onClick={alternarPantallaCompleta}
                        aria-label={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa del navegador'}
                        title={
                            pantallaCompleta
                                ? 'Volver a mostrar las pestañas y la barra de direcciones'
                                : 'Esconder también las pestañas y la barra de direcciones del navegador'
                        }
                        className={cn(button.base, button.variant.secondary, button.icon.md)}
                    >
                        {pantallaCompleta ? (
                            <Minimize2 size={15} aria-hidden="true" />
                        ) : (
                            <Maximize2 size={15} aria-hidden="true" />
                        )}
                    </button>
                )}

                {/* Los cuatro números en una tira. Eran cuatro tarjetas de 60px de
                    alto para cuatro cifras que casi siempre tienen un dígito. */}
                <div
                    className={cn(
                        'ml-auto hidden items-stretch divide-x divide-subtle overflow-hidden rounded-lg border border-subtle bg-surface lg:flex',
                        modoAmplio && 'md:flex',
                    )}
                >
                    {[
                        { label: 'Chats', valor: metricas.total },
                        { label: 'Sin leer', valor: metricas.sinLeer },
                        { label: 'Con agente', valor: metricas.activos },
                        { label: 'Escaladas hoy', valor: metricas.escaladosHoy },
                    ].map((m) => (
                        <div key={m.label} className="px-3 py-1 text-center">
                            <p className="text-sm font-semibold leading-tight tabular-nums text-fg">{m.valor}</p>
                            <p className="text-2xs leading-tight text-fg-muted">{m.label}</p>
                        </div>
                    ))}
                </div>

                {/* Interruptor maestro: apagado acá, el agente no le contesta a nadie
                    aunque haya conversaciones habilitadas. Es un interruptor de
                    verdad (role="switch") y no un botón que dice el estado: "Agente
                    encendido" en un botón no deja claro si es lo que pasa o lo que va
                    a pasar al tocarlo. */}
                <button
                    onClick={handleToggleGlobalBot}
                    disabled={actionLoading || globalBotEnabled === null}
                    role="switch"
                    aria-checked={!!globalBotEnabled}
                    title={
                        globalBotEnabled
                            ? 'El agente responde solo en las conversaciones que tengan el agente activado.'
                            : 'El agente no le responde a nadie. Los mensajes igual quedan registrados acá.'
                    }
                    className={cn(
                        /* `ml-auto` solo mientras las métricas están ocultas:
                           con las dos puestas, los dos separadores se peleaban
                           por el mismo hueco y el interruptor saltaba de lugar
                           al cruzar el punto de quiebre. */
                        'ml-auto inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 lg:ml-2',
                        'text-xs font-semibold text-fg transition-colors disabled:opacity-50',
                        focusRing,
                        globalBotEnabled ? 'border-success/40 bg-success-soft' : 'border-subtle bg-surface hover:bg-surface-hover',
                    )}
                >
                    <span
                        aria-hidden="true"
                        className={cn(
                            'relative h-4 w-7 shrink-0 rounded-full transition-colors',
                            globalBotEnabled ? 'bg-success' : 'bg-surface-3',
                        )}
                    >
                        <span
                            className={cn(
                                'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow ring-1 ring-black/10 transition-all',
                                globalBotEnabled ? 'left-3.5' : 'left-0.5',
                            )}
                        />
                    </span>
                    <span className="hidden 2xl:inline">Todos los agentes · </span>
                    <span className="2xl:hidden">Agentes · </span>
                    {globalBotEnabled ? 'Activados' : 'Desactivados'}
                </button>


                {/* Los dos agentes por separado. Solo aparecen si la migración
                    0035 corrió: sin ella no hay nada que prender.

                    Cuelgan del maestro a propósito -- con el maestro apagado se
                    ven atenuados, porque no contesta ninguno aunque estén los
                    dos encendidos. */}
                {agentes && (
                    <div
                        className={cn(
                            'flex shrink-0 items-center gap-1.5 rounded-lg border border-subtle bg-surface px-2 py-1',
                            !globalBotEnabled && 'opacity-60',
                        )}
                        title={
                            globalBotEnabled
                                ? 'Qué agente contesta. La recepción junta los datos del repuesto; el vendedor cotiza contra el catálogo.'
                                : 'El interruptor general está apagado: no contesta ninguno de los dos.'
                        }
                    >
                        {([
                            { id: 'recepcion' as const, texto: 'Recepción', activo: agentes.recepcion },
                            { id: 'ventas' as const, texto: 'Vendedor', activo: agentes.ventas },
                        ]).map((a) => (
                            <button
                                key={a.id}
                                onClick={() => handleToggleAgente(a.id)}
                                disabled={actionLoading}
                                role="switch"
                                aria-checked={a.activo}
                                aria-label={`Agente ${a.texto}`}
                                className={cn(
                                    'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] font-semibold transition-colors disabled:opacity-50',
                                    focusRing,
                                    a.activo ? 'bg-success-soft text-success-soft-fg' : 'text-fg-muted hover:bg-surface-hover',
                                )}
                            >
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'h-1.5 w-1.5 shrink-0 rounded-full',
                                        a.activo ? 'bg-success' : 'bg-surface-3 ring-1 ring-strong',
                                    )}
                                />
                                {a.texto}
                            </button>
                        ))}
                    </div>
                )}

                {/* La cola de "ya llegó lo que pediste".
                    Va en la barra de arriba y con el número a la vista porque
                    es trabajo que se pierde en silencio: el repuesto entra,
                    nadie se entera de quién lo estaba esperando y el cliente
                    lo termina comprando en otro lado. */}
                <button
                    onClick={() => {
                        setAvisarTelefono(undefined);
                        setModoAviso('llego');
                        setAvisarAbierto(true);
                    }}
                    title="Clientes que dejaron un pedido anotado y cuyo repuesto ya está en la bodega"
                    className={cn(
                        button.base,
                        porAvisar > 0 ? button.variant.success : button.variant.secondary,
                        button.size.md,
                    )}
                >
                    <Bell size={15} aria-hidden="true" />
                    {/* La etiqueta se va antes que el botón: el icono y el
                        número siguen diciendo lo mismo, y son 110px que la
                        barra necesita para no partirse en dos renglones. */}
                    <span className="hidden xl:inline">Por avisar</span>
                    {porAvisar > 0 && (
                        <span className="ml-0.5 rounded-full bg-black/15 px-1.5 text-2xs font-semibold tnum">
                            {porAvisar}
                        </span>
                    )}
                </button>

                {/* El otro caso, y por eso es otro botón y no una pestaña
                    adentro del primero: no es la misma cola trabajada de otra
                    forma, es otra conversación. Al de arriba se le dice "vení
                    a buscarlo"; a este, "lo podemos pedir, dejanos un abono".
                    Confundirlos es prometer una entrega que no existe. */}
                <button
                    onClick={() => {
                        setAvisarTelefono(undefined);
                        setModoAviso('abono');
                        setAvisarAbierto(true);
                    }}
                    title="Clientes cuyo repuesto no está en la bodega pero la importadora sí lo tiene: se les puede pedir un abono para encargarlo"
                    className={cn(
                        button.base,
                        porPedirAbono > 0 ? button.variant.primary : button.variant.secondary,
                        button.size.md,
                    )}
                >
                    <HandCoins size={15} aria-hidden="true" />
                    <span className="hidden xl:inline">Piden abono</span>
                    {porPedirAbono > 0 && (
                        <span className="ml-0.5 rounded-full bg-black/15 px-1.5 text-2xs font-semibold tnum">
                            {porPedirAbono}
                        </span>
                    )}
                </button>

                {/* Avisar cuando entra un mensaje y esta pestaña no está a la
                    vista. El permiso se pide con este toque y nunca solo: los
                    navegadores bloquean para siempre el pedido automático, y
                    una vez bloqueado no hay forma de volver a pedirlo. */}
                <button
                    onClick={async () => {
                        if (notificaciones.permiso === 'granted') {
                            notificaciones.alternar();
                            return;
                        }
                        const r = await notificaciones.pedirPermiso();
                        if (r === 'denied') {
                            setErrorAccion(
                                'El navegador tiene bloqueadas las notificaciones de esta página. Hay que habilitarlas desde el candado de la barra de direcciones.',
                            );
                        } else if (r === 'no-soportado') {
                            setErrorAccion('Este navegador no puede mostrar notificaciones de escritorio.');
                        }
                    }}
                    role="switch"
                    aria-checked={notificaciones.listo}
                    aria-label="Avisos de escritorio para los mensajes que entran"
                    title={
                        notificaciones.permiso === 'denied'
                            ? 'Las notificaciones están bloqueadas en el navegador para esta página.'
                            : notificaciones.listo
                              ? 'Avisos encendidos. Solo si la pestaña no está a la vista, y nunca en los chats silenciados.'
                              : 'Encender los avisos de escritorio: hoy entra un mensaje y nadie se entera hasta mirar la bandeja.'
                    }
                    className={cn(
                        button.base,
                        button.variant.secondary,
                        button.icon.md,
                        notificaciones.listo && 'text-success',
                    )}
                >
                    {notificaciones.listo ? (
                        <BellRing size={15} aria-hidden="true" />
                    ) : (
                        <BellOff size={15} aria-hidden="true" />
                    )}
                </button>

                <button
                    onClick={() => {
                        limpiarNoLeidosConservados();
                        fetchEscalations();
                        fetchConversations();
                        fetchSettings();
                        fetchEstadoAgente();
                        contarAvisos();
                    }}
                    aria-label="Actualizar la bandeja"
                    title="Vuelve a leer la lista, los escalamientos y el estado del agente"
                    className={cn(button.base, button.variant.secondary, button.icon.md)}
                >
                    <RefreshCw size={15} aria-hidden="true" />
                </button>
            </div>

            {/* Fallos de Supabase (RLS, red): antes solo iban a la consola y en
                pantalla parecía que todo había salido bien. */}
            {(errorCarga || errorAccion) && (
                <div className="flex shrink-0 items-start justify-between gap-3 rounded-lg border border-danger/40 bg-danger-soft px-3 py-2">
                    <p className="text-sm text-danger-soft-fg">{errorCarga ?? errorAccion}</p>
                    <button
                        onClick={() => {
                            setErrorCarga(null);
                            setErrorAccion(null);
                        }}
                        aria-label="Cerrar aviso de error"
                        className="shrink-0 rounded p-1 text-danger-soft-fg/70 hover:bg-danger/10 hover:text-danger-soft-fg"
                    >
                        <X size={14} aria-hidden="true" />
                    </button>
                </div>
            )}

            {avisoAccion && (
                <div
                    role="status"
                    className="flex shrink-0 items-center justify-between gap-3 rounded-lg border border-success/40 bg-success-soft px-3 py-2"
                >
                    <p className="text-sm text-success-soft-fg">{avisoAccion}</p>
                    <button
                        onClick={() => setAvisoAccion(null)}
                        aria-label="Cerrar aviso"
                        className="shrink-0 rounded p-1 text-success-soft-fg/70 hover:bg-success/10 hover:text-success-soft-fg"
                    >
                        <X size={14} aria-hidden="true" />
                    </button>
                </div>
            )}

            {/* Lo que se encole ahora no va a salir. Se avisa arriba de todo y no
                en la caja de escribir: hay que verlo ANTES de escribir. */}
            {avisoDeEnvio && (
                <div className="flex shrink-0 items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2">
                    <RotateCw size={15} className="mt-0.5 shrink-0 text-warning-soft-fg" aria-hidden="true" />
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-warning-soft-fg">{avisoDeEnvio.titulo}</p>
                        <p className="mt-0.5 text-xs text-warning-soft-fg/90">{avisoDeEnvio.detalle}</p>
                    </div>
                </div>
            )}
            {/* WhatsApp Web en una sola lámina: la lista, la conversación y la
                ficha del cliente pegadas, con altura fija y cada columna con su
                propio desplazamiento.

                Antes eran tres tarjetas sueltas que crecían hacia abajo, así que
                para ver el último mensaje había que bajar la PÁGINA entera y la
                caja de escribir quedaba fuera de pantalla. Con altura fija el
                hilo termina siempre justo encima de donde se escribe, que es la
                única disposición en la que se puede contestar rápido.

                La ficha del cliente va al costado y no en un modal a propósito:
                lo que dice (si tiene descuento, qué repuestos dejó pedidos,
                cuáles ya llegaron) hay que tenerlo a la vista MIENTRAS se
                cotiza, no detrás de un clic. */}
            <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-subtle bg-wa-panel shadow-sm">
                {/* ============================ LISTA ============================ */}
                {/* En pantalla angosta se ve una columna por vez: al abrir un chat
                    la lista se aparta, igual que en el teléfono. */}
                <div
                    className={cn(
                        'w-full shrink-0 flex-col border-r border-wa-divider bg-wa-panel lg:flex lg:w-[360px]',
                        selected || galeria ? 'hidden' : 'flex',
                    )}
                >
                    {/* El buscador y los filtros viven DENTRO de la columna, como en
                        WhatsApp Web. Estaban sueltos arriba de la página, a lo ancho
                        de todo: el buscador de chats quedaba a un metro de la lista
                        de chats y encima empujaba el chat hacia abajo. */}
                    <div className="shrink-0 border-b border-wa-divider px-3 py-2.5">
                        <div className="flex items-center gap-2">
                        <div className="relative min-w-0 flex-1">
                            <Search
                                size={15}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-wa-meta"
                                aria-hidden="true"
                            />
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por nombre, número o mensaje"
                                aria-label="Buscar chat por nombre, teléfono o palabras del mensaje"
                                className="h-9 w-full rounded-lg border-none bg-wa-input pl-9 pr-9 text-[13.5px] text-wa-text outline-none placeholder:text-wa-meta focus:ring-0"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    aria-label="Limpiar la búsqueda"
                                    className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-wa-meta hover:bg-wa-inset/10 hover:text-wa-text"
                                >
                                    <X size={14} aria-hidden="true" />
                                </button>
                            )}
                        </div>

                        {/* Escribirle a alguien que todavía no escribió. Va al lado
                            del buscador porque es el mismo gesto cuando el
                            cliente no aparece: uno lo busca, no está, y le
                            abre el chat sin cambiar de pantalla. */}
                        <button
                            onClick={() => setNuevoChat(true)}
                            aria-label="Empezar un chat nuevo"
                            title="Escribirle a un número que todavía no está en la lista"
                            className={cn(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-wa-meta transition-colors hover:bg-wa-inset/10',
                                focusRing,
                            )}
                        >
                            <MessageSquarePlus size={19} aria-hidden="true" />
                        </button>

                        {/* Buscar por lo que MANDÓ el cliente y no por su nombre:
                            el caso es el comprobante de pago, que se recuerda
                            como foto y no como nombre ni como hora. Va al lado
                            del buscador porque es eso, otra forma de buscar. */}
                        <button
                            onClick={() => setGaleria((v) => !v)}
                            aria-pressed={galeria}
                            aria-label="Fotos que mandaron los clientes"
                            title="Buscar un comprobante o una pieza entre las fotos que mandaron los clientes"
                            className={cn(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                                focusRing,
                                galeria
                                    ? 'bg-wa-accent-strong/[0.14] text-wa-accent-strong'
                                    : 'text-wa-meta hover:bg-wa-inset/10',
                            )}
                        >
                            <Images size={19} aria-hidden="true" />
                        </button>
                        </div>

                        {/*
                            BANDEJAS DE TRABAJO.

                            Antes acá había quince pastillas en dos filas, todas
                            excluyentes y mezclando tres preguntas distintas: quién
                            tiene el chat, si está leído, y cómo lo archivó cada uno.
                            Con noventa conversaciones eso no organiza nada -- y
                            "los no leídos que atiende la IA" ni siquiera se podía
                            pedir, porque había que elegir una sola.

                            Ahora cada conversación cae en UNA bandeja (la regla
                            vive en components/whatsapp/bandejas.ts), así que la
                            suma de los contadores es el total y nadie tiene que
                            preguntarse si algo quedó escondido en otra pestaña.

                            En columna y no en fila: son cinco destinos fijos que se
                            leen de un vistazo, y el número tiene que quedar
                            alineado a la derecha para poder compararlos.
                        */}
                        <div role="tablist" aria-label="Bandejas de trabajo" className="mt-2 flex flex-col gap-px">
                            {[{ id: null, texto: 'Todas', ayuda: 'Todas las conversaciones, sin filtrar.', pideAccion: false }, ...BANDEJAS].map((b) => {
                                /* Estando en Archivados o en Escalados no se mira
                                   ninguna bandeja: sin esto «Todas» quedaba marcada
                                   mostrando otra lista. */
                                const activa = tab === 'all' && bandeja === b.id;
                                const cuenta = b.id === null ? sinArchivar.length : cuentasDeBandeja[b.id];
                                return (
                                    <button
                                        key={b.id ?? 'todas'}
                                        role="tab"
                                        aria-selected={activa}
                                        onClick={() => {
                                            setTab('all');
                                            setBandeja(b.id as Bandeja | null);
                                        }}
                                        title={b.ayuda}
                                        className={cn(
                                            focusRing,
                                            'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors',
                                            activa
                                                ? 'bg-wa-accent-strong/[0.14] font-semibold text-wa-accent-strong'
                                                : 'text-wa-text hover:bg-wa-hover',
                                        )}
                                    >
                                        {/* El punto de color es la señal rápida: lo que
                                            pide acción se ve antes de leer el nombre. */}
                                        <span
                                            aria-hidden="true"
                                            className={cn(
                                                'h-2 w-2 shrink-0 rounded-full',
                                                b.id === null
                                                    ? 'bg-transparent ring-1 ring-wa-meta/40'
                                                    : b.pideAccion
                                                      ? 'bg-wa-accent-strong'
                                                      : 'bg-wa-meta/35',
                                            )}
                                        />
                                        <span className="min-w-0 flex-1 truncate">{b.texto}</span>
                                        {cuenta > 0 && (
                                            <span
                                                className={cn(
                                                    'shrink-0 tabular-nums text-[12px]',
                                                    b.id !== null && b.pideAccion && !activa
                                                        ? 'font-semibold text-wa-accent-strong'
                                                        : 'text-wa-meta',
                                                )}
                                            >
                                                {cuenta}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Lo que no es trabajo del día: organización personal y la
                            cola de escalamientos del agente. Van aparte y en chico
                            porque no se miran todos los días. */}
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-wa-divider pt-2 text-[11.5px]">
                            {([
                                { id: 'archived' as Tab, texto: 'Archivados', cuenta: conversationPreferences.archived.length },
                                { id: 'pending' as Tab, texto: 'Escalados', cuenta: pendingCount },
                                { id: 'resolved' as Tab, texto: 'Resueltos', cuenta: null },
                            ]).map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => {
                                        setTab(t.id);
                                        setBandeja(null);
                                    }}
                                    aria-pressed={tab === t.id}
                                    className={cn(
                                        focusRing,
                                        'rounded px-1 py-0.5 transition-colors',
                                        tab === t.id
                                            ? 'font-semibold text-wa-accent-strong'
                                            : 'text-wa-meta hover:text-wa-text',
                                    )}
                                >
                                    {t.texto}
                                    {t.cuenta !== null && t.cuenta > 0 && (
                                        <span className="ml-1 tabular-nums opacity-70">{t.cuenta}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="wa-scroll min-h-0 flex-1 overflow-y-auto">
                    {/* Cada pestaña espera SU propia carga: la de "Todas" usaba el
                        loading de escalamientos y por eso mostraba "no hay
                        conversaciones" mientras la consulta seguía en vuelo. */}
                    {(TABS_DE_CONVERSACION.has(tab) ? conversationsLoading : loading) ? (
                        <div className="p-8 text-center text-sm text-wa-meta">Cargando…</div>
                    ) : TABS_DE_CONVERSACION.has(tab) ? (
                        filteredConversations.length === 0 ? (
                            <div className="p-10 text-center text-sm text-wa-meta flex flex-col items-center gap-2">
                                <Inbox size={22} aria-hidden="true" />
                                {search.trim()
                                    ? `Ningún cliente coincide con "${search.trim()}".`
                                    : tab === 'archived'
                                      ? 'No tenés conversaciones archivadas.'
                                      : bandeja === 'responder'
                                        ? 'Nadie está esperando respuesta. Todo contestado.'
                                        : bandeja === 'cotizar'
                                          ? 'La IA todavía no dejó ninguna ficha lista para cotizar.'
                                          : bandeja === 'ia'
                                            ? 'La IA no está atendiendo ninguna conversación ahora.'
                                            : bandeja === 'esperando'
                                              ? 'No hay nadie a quien le hayamos escrito último.'
                                              : bandeja === 'cerrados'
                                                ? 'Todavía no hay conversaciones cerradas.'
                                                : 'Todavía no hay conversaciones de WhatsApp.'}
                            </div>
                        ) : (
                            filteredConversations.map((c) => (
                                <button
                                    key={c.id}
                                    onClick={() => setSelectedConversationId(c.id)}
                                    aria-current={selectedConversationId === c.id ? 'page' : undefined}
                                    onMouseEnter={(event) => {
                                        if (!c.last_message_preview) return;
                                        const rect = event.currentTarget.getBoundingClientRect();
                                        setMessagePreview({
                                            name: c.customer_name || formatPhone(c),
                                            phone: formatPhone(c),
                                            text: textoPlano(c.last_message_preview),
                                            outbound: c.last_message_direction === 'outbound',
                                            time: c.last_message_at,
                                            x: Math.max(12, Math.min(rect.right + 10, window.innerWidth - 390)),
                                            y: Math.max(12, Math.min(rect.top, window.innerHeight - 220)),
                                        });
                                    }}
                                    onMouseLeave={() => setMessagePreview(null)}
                                    onContextMenu={(event) => {
                                        event.preventDefault();
                                        setMessagePreview(null);
                                        const menuWidth = 248;
                                        const menuHeight = 320;
                                        setConversationMenu({
                                            conversation: c,
                                            x: Math.min(event.clientX, window.innerWidth - menuWidth - 12),
                                            y: Math.min(event.clientY, window.innerHeight - menuHeight - 12),
                                        });
                                    }}
                                    className={cn(
                                        'relative w-full cursor-pointer text-left flex items-center gap-3 pl-3 transition-colors before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-transparent',
                                        focusRing,
                                        selectedConversationId === c.id
                                            ? 'bg-wa-active before:bg-wa-accent ring-1 ring-inset ring-wa-accent/30'
                                            : 'hover:bg-wa-hover',
                                    )}
                                >
                                    <Avatar nombre={c.customer_name} telefono={c.phone_number} />

                                    {/* La línea divisoria arranca DESPUÉS del avatar,
                                        como en WhatsApp: así la columna de avatares se
                                        lee como una sola tira y la lista respira. */}
                                    <div className="min-w-0 flex-1 border-b border-wa-divider py-3 pr-3">
                                        <div className="flex items-baseline justify-between gap-2">
                                            {/* El NOMBRE manda, no el teléfono: es lo que se
                                                busca al recorrer la lista. */}
                                            <span
                                                className={cn(
                                                    'truncate text-[16px] leading-[21px] text-wa-text',
                                                    tienePendienteVisual(c) ? 'font-semibold' : 'font-normal',
                                                )}
                                            >
                                                {c.customer_name || formatPhone(c)}
                                            </span>
                                            {c.last_message_at && (
                                                <span
                                                    className={cn(
                                                        'shrink-0 text-[12px] leading-[16px]',
                                                        tienePendienteVisual(c) ? 'font-semibold text-wa-accent-strong' : 'text-wa-meta',
                                                    )}
                                                >
                                                    {horaLista(c.last_message_at)}
                                                </span>
                                            )}
                                        </div>

                                        {/* De qué habla el chat, sin abrirlo: antes había que
                                            entrar uno por uno para poder triar. */}
                                        <div className="mt-0.5 flex items-center gap-1.5">
                                            <p
                                                title={textoPlano(c.last_message_preview) || undefined}
                                                className={cn(
                                                    'min-w-0 flex-1 truncate text-[13.5px] leading-[19px]',
                                                    tienePendienteVisual(c) ? 'text-wa-text' : 'text-wa-meta',
                                                )}
                                            >
                                                {c.last_message_preview ? (
                                                    <>
                                                        {c.last_message_direction === 'outbound' && (
                                                            <span className="text-wa-meta">Vos: </span>
                                                        )}
                                                        {textoPlano(c.last_message_preview)}
                                                    </>
                                                ) : (
                                                    formatPhone(c)
                                                )}
                                            </p>

                                            {/* "Agente apagado" es el estado por defecto de casi
                                                todos: repetirlo en cada fila es ruido que tapa lo
                                                que sí distingue una de otra. Solo se marca lo
                                                excepcional, y como icono para no robarle ancho a
                                                la vista previa. */}
                                            {c.bot_enabled && (
                                                <Bot
                                                    size={15}
                                                    className="shrink-0 text-wa-accent-strong"
                                                    aria-label="El agente responde en este chat"
                                                />
                                            )}

                                            {/* Solo las etapas que piden algo de alguien.
                                                Marcar las siete convertiría la lista en un
                                                semáforo ilegible: "precalificando" es el
                                                estado normal de casi todas. */}
                                            {c.etapa && ETAPAS_QUE_SE_MARCAN.has(c.etapa) && (
                                                <span
                                                    className={cn(
                                                        'shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold leading-none',
                                                        CLASE_DE_ETAPA[c.etapa],
                                                    )}
                                                >
                                                    {NOMBRE_DE_ETAPA[c.etapa]}
                                                </span>
                                            )}

                                            {conversationPreferences.muted.includes(c.id) && (
                                                <BellOff size={13} className="shrink-0 text-wa-meta" aria-label="Conversación silenciada" />
                                            )}
                                            {conversationPreferences.pinned.includes(c.id) && (
                                                <Pin size={13} className="shrink-0 text-wa-meta" aria-label="Conversación fijada" />
                                            )}

                                            {c.unread_count > 0 && (
                                                <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-wa-accent-strong px-1.5 text-[12px] font-bold leading-none text-wa-accent-fg">
                                                    {c.unread_count}
                                                </span>
                                            )}
                                            {(proformasPorConversacion[c.id]?.items.length ?? 0) > 0 && (
                                                <span title="Proforma en preparación" className="shrink-0 rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                                    {proformasPorConversacion[c.id].items.length} en proforma
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))
                        )
                    ) : null}

                    {(TABS_DE_CONVERSACION.has(tab)) && !conversationsLoading && hayMas && (
                        <p className="px-4 py-3 text-center text-[12px] text-wa-meta">
                            Mostrando las {conversations.length} más recientes de {totalConversaciones}.
                            {' '}Usá el buscador para encontrar una conversación puntual.
                        </p>
                    )}

                    {!TABS_DE_CONVERSACION.has(tab) && (loading ? null : filtered.length === 0 ? (
                        <div className="p-10 text-center text-sm text-wa-meta flex flex-col items-center gap-2">
                            <Inbox size={22} aria-hidden="true" />
                            {search.trim()
                                ? `Ningún cliente coincide con "${search.trim()}".`
                                : tab === 'pending'
                                  ? 'No hay nada pendiente. Todo tranquilo.'
                                  : 'Todavía no hay conversaciones resueltas.'}
                        </div>
                    ) : (
                        filtered.map((e) => (
                            <button
                                key={e.id}
                                onClick={() => setSelectedId(e.id)}
                                className={cn(
                                    'w-full text-left flex items-center gap-3 pl-3 transition-colors',
                                    selectedId === e.id ? 'bg-wa-active' : 'hover:bg-wa-hover',
                                )}
                            >
                                <Avatar
                                    nombre={e.agent_conversations?.customer_name ?? null}
                                    telefono={e.agent_conversations?.phone_number ?? '?'}
                                />
                                <div className="min-w-0 flex-1 border-b border-wa-divider py-3 pr-3">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="truncate text-[16px] font-semibold leading-[21px] text-wa-text">
                                            {e.agent_conversations?.customer_name || e.agent_conversations?.phone_number || 'Cliente'}
                                        </span>
                                        <span className="shrink-0 text-[12px] text-wa-meta flex items-center gap-1">
                                            <Clock size={11} aria-hidden="true" />
                                            {timeAgo(e.created_at)}
                                        </span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-1.5">
                                        <span className={cn(badge.base, badge.size.sm, badge.tone[REASON_TONE[e.reason]])}>
                                            {REASON_LABEL[e.reason]}
                                        </span>
                                        {e.status === 'claimed' && (
                                            <span className="flex items-center gap-1 text-[11px] text-wa-meta">
                                                <User size={11} aria-hidden="true" />
                                                {e.claimed_by === userId ? 'Vos' : profileNames.get(e.claimed_by ?? '') ?? 'del equipo'}
                                            </span>
                                        )}
                                    </div>
                                    {e.message_snapshot && (
                                        <p className="mt-1 line-clamp-2 text-[13px] leading-[18px] text-wa-meta">
                                            {e.message_snapshot}
                                        </p>
                                    )}
                                </div>
                            </button>
                        ))
                    ))}
                    </div>
                </div>

                {/* ========================= CONVERSACIÓN ========================= */}
                <div
                    className={cn(
                        'min-w-0 flex-1 flex-col bg-wa-bg lg:flex',
                        selected || galeria ? 'flex' : 'hidden',
                    )}
                >
                    {galeria ? (
                        <MediaGallery
                            onIrAlChat={abrirConversacionPorId}
                            onCerrar={() => setGaleria(false)}
                            formatearTelefono={formatPhone}
                        />
                    ) : !selected ? (
                        <div className="m-auto flex max-w-sm flex-col items-center gap-3 p-10 text-center">
                            <Headset size={40} className="text-wa-meta" aria-hidden="true" />
                            <p className="text-lg font-light text-wa-text">Bandeja de WhatsApp</p>
                            <p className="text-[13.5px] text-wa-meta">
                                Elegí una conversación de la lista para leer el hilo completo y contestarle
                                al cliente con texto, fotos, repuestos del catálogo o una proforma.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* ---------------------- Cabecera ---------------------- */}
                            <div className="flex shrink-0 items-center gap-3 border-b border-wa-divider bg-wa-header px-3 py-2">
                                {/* En angosto la lista se apartó: hace falta cómo volver. */}
                                <button
                                    onClick={() => {
                                        setSelectedId(null);
                                        setSelectedConversationId(null);
                                    }}
                                    aria-label="Volver a la lista de chats"
                                    className={cn(focusRing, 'flex h-9 w-9 items-center justify-center rounded-full text-wa-meta hover:bg-wa-inset/10 lg:hidden')}
                                >
                                    <ArrowLeft size={20} aria-hidden="true" />
                                </button>

                                <Avatar
                                    nombre={selected.customerName}
                                    telefono={selected.phoneNumber}
                                    tam="sm"
                                />

                                <div className="min-w-0 flex-1">
                                    <h2 className="truncate text-[16px] font-medium leading-[21px] text-wa-text">
                                        {selected.customerName ||
                                            formatPhone({ phone_number: selected.phoneNumber, lid: selected.lid })}
                                    </h2>
                                    {/* La línea de abajo es la de "en línea" de WhatsApp. Acá
                                        dice lo que de verdad importa saber sin abrir nada: el
                                        número, y si el agente está contestando en este chat. */}
                                    <p className="truncate text-[12.5px] leading-[17px] text-wa-meta">
                                        {selected.customerName &&
                                            formatPhone({ phone_number: selected.phoneNumber, lid: selected.lid })}
                                        {selected.customerName && ' · '}
                                        {selected.botEnabled && selected.conversationStatus === 'bot_active'
                                            ? globalBotEnabled === false
                                                ? 'agente activado acá, pero apagado en general'
                                                : selected.selectedAgent === 'sales'
                                                    ? 'atención completa activa'
                                                    : 'agente de información activo'
                                            : 'contesta el vendedor'}
                                    </p>
                                </div>

                                {selected.escalation && (
                                    <span className={cn(badge.base, badge.size.md, badge.tone[REASON_TONE[selected.escalation.reason]])}>
                                        {REASON_LABEL[selected.escalation.reason]}
                                    </span>
                                )}

                                {/* Las acciones del chat van acá arriba, como los iconos de
                                    WhatsApp: antes vivían en una barra al pie que empujaba la
                                    caja de escribir hacia abajo. */}
                                <button
                                    onClick={() => handleToggleBot(selected)}
                                    disabled={actionLoading}
                                    aria-label={selected.botEnabled && selected.conversationStatus === 'bot_active' ? 'Desactivar el agente en este chat' : 'Activar el agente en este chat'}
                                    title={
                                        selected.botEnabled && selected.conversationStatus === 'bot_active'
                                            ? 'El agente está contestando en este chat. Apagalo para responder vos.'
                                            : 'Activar el agente en este chat'
                                    }
                                    className={cn(
                                        focusRing,
                                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-wa-inset/10',
                                        selected.botEnabled && selected.conversationStatus === 'bot_active' ? 'text-wa-accent' : 'text-wa-meta',
                                    )}
                                >
                                    {selected.botEnabled && selected.conversationStatus === 'bot_active' ? <Bot size={19} aria-hidden="true" /> : <BotOff size={19} aria-hidden="true" />}
                                </button>

                                {eligiendoAgente?.conversationId === selected.conversationId && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="elegir-agente-titulo">
                                        <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl">
                                            <h3 id="elegir-agente-titulo" className="text-lg font-semibold text-fg">¿Qué agente atenderá este chat?</h3>
                                            <p className="mt-1 text-sm text-fg-muted">Elige el alcance antes de activarlo.</p>
                                            <div className="mt-4 grid gap-3">
                                                <button onClick={() => activarAgenteDelChat('intake')} disabled={actionLoading} className="rounded-xl border border-border p-4 text-left hover:bg-surface-2">
                                                    <span className="block font-semibold text-fg">Solo pedir información</span>
                                                    <span className="mt-1 block text-sm text-fg-muted">Recopila repuesto, moto, año y demás datos; no ofrece precios ni stock.</span>
                                                </button>
                                                <button onClick={() => activarAgenteDelChat('sales')} disabled={actionLoading} className="rounded-xl border border-border p-4 text-left hover:bg-surface-2">
                                                    <span className="block font-semibold text-fg">Atención completa</span>
                                                    <span className="mt-1 block text-sm text-fg-muted">Busca catálogo, confirma stock y precio, y atiende la venta completa.</span>
                                                </button>
                                            </div>
                                            <button onClick={() => setEligiendoAgente(null)} disabled={actionLoading} className="mt-4 w-full rounded-lg px-3 py-2 text-sm font-medium text-fg-muted hover:bg-surface-2">Cancelar</button>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={() => marcarComoNoLeido(selected.conversationId)}
                                    disabled={actionLoading}
                                    aria-label="Marcar el chat como no leído"
                                    title="Lo deja como pendiente en la lista (no cambia nada en el teléfono del cliente)"
                                    className={cn(focusRing, 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-wa-meta hover:bg-wa-inset/10')}
                                >
                                    <MailQuestion size={19} aria-hidden="true" />
                                </button>

                                <button
                                    onClick={() => setBuscandoEnHilo((v) => !v)}
                                    aria-label="Buscar dentro de la conversación"
                                    title="Buscar dentro de la conversación"
                                    className={cn(focusRing, 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-wa-meta hover:bg-wa-inset/10')}
                                >
                                    <Search size={18} aria-hidden="true" />
                                </button>

                                <button
                                    onClick={abrirSiguientePendiente}
                                    disabled={colaDeAtencion.length === 0}
                                    aria-label="Abrir el siguiente cliente por atender"
                                    title="Siguiente cliente por atender (N)"
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-wa-meta hover:bg-wa-inset/10 disabled:opacity-30"
                                >
                                    <ArrowRight size={18} aria-hidden="true" />
                                </button>

                                <button
                                    onClick={() => setRecargarMensajes((n) => n + 1)}
                                    disabled={messagesLoading}
                                    aria-label="Actualizar el chat"
                                    title="Vuelve a leer la conversación y el estado de entrega de cada mensaje"
                                    className={cn(focusRing, 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-wa-meta hover:bg-wa-inset/10')}
                                >
                                    <RefreshCw size={18} className={cn(messagesLoading && 'animate-spin')} aria-hidden="true" />
                                </button>
                            </div>

                            {buscandoEnHilo && (
                                <BuscarEnHilo mensajes={mensajesVisibles} onCerrar={() => setBuscandoEnHilo(false)} />
                            )}

                            {/* Si el agente sigue habilitado en este chat, puede contestar
                                encima de la persona que está atendiendo. No se apaga solo
                                -- eso dejaría al bot mudo para siempre sin que nadie lo
                                haya decidido -- pero se avisa y se apaga de un clic. */}
                            {selected.botEnabled && globalBotEnabled && (
                                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-wa-divider bg-warning-soft px-4 py-2">
                                    <p className="text-xs text-warning-soft-fg">
                                        El agente también contesta en este chat: pueden cruzarse las respuestas.
                                    </p>
                                    <button
                                        onClick={() => handleToggleBot(selected)}
                                        disabled={actionLoading}
                                        className={cn(button.base, button.variant.secondary, button.size.sm)}
                                    >
                                        Apagar el agente acá
                                    </button>
                                </div>
                            )}

                            {/* ------------------------ Hilo ------------------------ */}
                            <div ref={hiloRef} className="wa-wallpaper wa-scroll flex min-h-0 flex-1 flex-col overflow-y-auto [overflow-anchor:none] py-3">
                                <div className="mt-auto">
                                <PildoraChat tono="aviso">
                                    Lo que mandes desde acá sale por WhatsApp y queda guardado en esta
                                    conversación. Lo que escribas desde el teléfono, no.
                                </PildoraChat>

                                {mensajesVisibles.length >= MENSAJES_VISIBLES && (
                                    <PildoraChat>
                                        Mostrando los últimos {MENSAJES_VISIBLES} mensajes de esta conversación.
                                    </PildoraChat>
                                )}

                                {messagesLoading ? (
                                    <PildoraChat>Cargando conversación…</PildoraChat>
                                ) : mensajesVisibles.length === 0 ? (
                                    <PildoraChat>Sin mensajes registrados todavía.</PildoraChat>
                                ) : (
                                    <ChatThread
                                        mensajes={mensajesVisibles}
                                        onAbrirFoto={abrirVisor}
                                        onResponder={setCitando}
                                        onReaccionar={reaccionar}
                                        onBorrar={borrar}
                                        onEditar={editar}
                                        onReenviar={(m) =>
                                            setReenviando({
                                                id: m.id,
                                                body: m.body,
                                                media_url: m.media_url,
                                                content_type: m.content_type,
                                            })
                                        }
                                        onProducto={(productId) => {
                                            setProformaAbierta(false);
                                            setProductoDelMensaje(productId);
                                        }}
                                        onTelefono={(numero, ancla) => setMenuTelefono({ numero, ancla })}
                                    />
                                )}

                                {/* Lo que todavía no salió. Las mismas burbujas que en el
                                    modo móvil: ver components/whatsapp/ColaDeSalida.tsx. */}
                                <BurbujasEnCola
                                    items={enCola}
                                    onCancelar={handleCancelar}
                                    onReintentar={handleReintentar}
                                    onDescartar={handleDescartar}
                                />
                                <AvisosAccionesFallidas items={accionesFallidas} onResolver={resolverAccion} />
                                </div>
                            </div>

                            {/* ------------------- Caja de escribir ------------------ */}
                            {/* Responder desde acá y no desde el teléfono: lo que se escribe
                                en el teléfono llega cifrado al agente y no queda registrado
                                en la conversación. */}
                            <div className="shrink-0 bg-wa-header">
                                {citando && (
                                    <div className="px-3 pt-2">
                                        <CitaEnComposer texto={textoPlano(textoDe(citando))} onQuitar={() => setCitando(null)} />
                                    </div>
                                )}
                                <ChatComposer
                                    key={selected.conversationId}
                                    conversationId={selected.conversationId}
                                    clienteLabel={
                                        selected.customerName ||
                                        formatPhone({ phone_number: selected.phoneNumber, lid: selected.lid })
                                    }
                                    clienteNombre={selected.customerName}
                                    phoneNumber={selected.phoneNumber}
                                    userId={userId}
                                    onEnviar={enviarMensajes}
                                    onPedidoRegistrado={() => setRecargarFicha((n) => n + 1)}
                                    // Sin ancho para la columna, el compositor
                                    // sigue abriendo su propio modal.
                                    onAbrirProforma={
                                        hayAnchoParaPanel
                                            ? () => {
                                                  if (cuatroColumnas) setPanelCotizacion(true);
                                                  else setProformaAbierta(true);
                                              }
                                            : undefined
                                    }
                                />
                            </div>

                            {/* Triage del escalamiento. Solo aparece cuando hay uno: el
                                resto del tiempo esa barra era una franja vacía entre el
                                hilo y la caja de escribir. */}
                            {selected.escalation && (
                                <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-wa-divider bg-wa-header px-4 py-2.5">
                                    {selected.escalation.status === 'open' && (
                                        <button
                                            onClick={() => handleClaim(selected.escalation!)}
                                            disabled={actionLoading}
                                            className={cn(button.base, button.variant.primary, button.size.sm)}
                                        >
                                            <User size={14} aria-hidden="true" /> Reclamar
                                        </button>
                                    )}
                                    {selected.escalation.status === 'claimed' && (
                                        <>
                                            <label className="mr-auto flex items-center gap-1.5 text-xs text-wa-meta">
                                                <input
                                                    type="checkbox"
                                                    className={input.checkbox}
                                                    checked={closeInsteadOfReopen}
                                                    onChange={(e) => setCloseInsteadOfReopen(e.target.checked)}
                                                />
                                                No devolver al bot (dejar la conversación cerrada)
                                            </label>
                                            <button
                                                onClick={() => handleResolve(selected.escalation!)}
                                                disabled={actionLoading}
                                                className={cn(button.base, button.variant.success, button.size.sm)}
                                            >
                                                <CheckCheck size={14} aria-hidden="true" /> Marcar resuelta
                                            </button>
                                        </>
                                    )}
                                    {selected.escalation.status === 'resolved' && (
                                        <p className="text-xs text-wa-meta">
                                            Resuelta {selected.escalation.resolved_at ? timeAgo(selected.escalation.resolved_at) : ''}
                                            {selected.conversationStatus === 'closed' && ' -- conversación cerrada, el bot no retoma sola'}
                                        </p>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ============== COLUMNAS DE TRABAJO ============== */}
                {/*
                    En modo mostrador con ancho suficiente NADA SE TURNA: la
                    ficha del cliente y la cotizacion se ven a la vez, que es
                    como se atiende de verdad -- se lee lo que el cliente pidio
                    mientras se le arma el precio, con su descuento a la vista.

                    Por debajo de 1660px se vuelve al comportamiento de
                    siempre, con las tres columnas turnandose: cuatro columnas
                    apretadas se leen peor que tres comodas.
                */}
                {cuatroColumnas && selected ? (
                    <>
                        {/* --- Cliente: siempre visible --- */}
                        <div className="hidden w-[340px] shrink-0 overflow-y-auto wa-scroll border-l border-wa-divider bg-surface p-3 xl:block">
                            <ConversationWorkCard
                                conversationId={selected.conversationId}
                                aiReady={conversations.find((conversation) => conversation.id === selected.conversationId)?.etapa === 'ready_for_sales'}
                            />
                            <CustomerPanel
                                key={`${selected.conversationId}-${recargarFicha}`}
                                conversationId={selected.conversationId}
                                phoneNumber={selected.phoneNumber}
                                customerName={selected.customerName}
                                onCotizar={(producto) => {
                                    agregarAProforma(selected.conversationId, producto);
                                    setPanelCotizacion(true);
                                }}
                                onAvisar={() => {
                                    setAvisarTelefono(selected.phoneNumber);
                                    setAvisarAbierto(true);
                                }}
                            />
                        </div>

                        {/* --- Cotizacion: la proforma, y arriba el repuesto
                              del mensaje cuando se abre uno. Apilados y no
                              turnandose: el repuesto que se esta mirando es
                              justo el que se va a cotizar. --- */}
                        {panelCotizacion ? (
                            <div className="hidden w-[420px] shrink-0 flex-col border-l border-wa-divider bg-surface xl:flex 2xl:w-[460px]">
                                {productoDelMensaje !== null && (
                                    <div className="max-h-[45%] shrink-0 overflow-y-auto wa-scroll border-b border-wa-divider">
                                        <ProductMessagePanel
                                            key={productoDelMensaje}
                                            productId={productoDelMensaje}
                                            onClose={() => setProductoDelMensaje(null)}
                                            onCotizar={(producto) => {
                                                agregarAProforma(selected.conversationId, producto);
                                                setProductoDelMensaje(null);
                                            }}
                                        />
                                    </div>
                                )}
                                <div className="flex min-h-0 flex-1 flex-col">
                                    <ProformaBuilder
                                        key={selected.conversationId}
                                        isOpen
                                        presentacion="panel"
                                        onClose={() => setPanelCotizacion(false)}
                                        conversationId={selected.conversationId}
                                        clienteLabel={
                                            selected.customerName ||
                                            formatPhone({ phone_number: selected.phoneNumber, lid: selected.lid })
                                        }
                                        clienteNombre={selected.customerName}
                                        onEnviar={enviarMensajes}
                                    />
                                </div>
                            </div>
                        ) : (
                            /* Plegada. Queda una pestana vertical con el
                               numero de repuestos: una proforma a medio armar
                               es facil de olvidar, y esconderla del todo es
                               como no tenerla. */
                            <button
                                onClick={() => setPanelCotizacion(true)}
                                aria-label="Mostrar la cotizacion"
                                title="Mostrar la columna de cotizacion"
                                className={cn(
                                    'hidden w-11 shrink-0 flex-col items-center gap-3 border-l border-wa-divider bg-surface py-3 text-wa-meta transition-colors hover:bg-wa-hover xl:flex',
                                    focusRing,
                                )}
                            >
                                <ChevronLeft size={16} aria-hidden="true" />
                                <FileText size={16} aria-hidden="true" />
                                {(proformasPorConversacion[selected.conversationId]?.items.length ?? 0) > 0 && (
                                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold tabular-nums text-primary-fg">
                                        {proformasPorConversacion[selected.conversationId].items.length}
                                    </span>
                                )}
                                <span
                                    className="mt-1 text-[11px] font-semibold uppercase tracking-wider"
                                    style={{ writingMode: 'vertical-rl' }}
                                >
                                    Cotizacion
                                </span>
                            </button>
                        )}
                    </>
                ) : (
                  <>
                {/* ================== TERCERA COLUMNA ================== */}
                {/* La ficha del cliente, o la proforma mientras se la arma.
                    Se turnan: a 1280px no entran las dos, y la proforma es
                    la que necesita el chat al lado. Al cerrarla vuelve la
                    ficha sola. */}
                {selected && productoDelMensaje !== null && (
                    <div className="hidden w-[360px] shrink-0 flex-col border-l border-wa-divider bg-surface xl:flex 2xl:w-[400px]">
                        <ProductMessagePanel
                            key={productoDelMensaje}
                            productId={productoDelMensaje}
                            onClose={() => setProductoDelMensaje(null)}
                            onCotizar={(producto) => {
                                agregarAProforma(selected.conversationId, producto);
                                setProductoDelMensaje(null);
                                setProformaAbierta(true);
                            }}
                        />
                    </div>
                )}

                {selected && productoDelMensaje === null && proformaEnPanel && (
                    <div className="hidden w-[420px] shrink-0 flex-col border-l border-wa-divider bg-surface xl:flex 2xl:w-[460px]">
                        <ProformaBuilder
                            // Al cambiar de chat se remonta: el buscador y la
                            // vista previa son de ESA cotización. El borrador
                            // no se pierde, vive en el store por conversación.
                            key={selected.conversationId}
                            isOpen
                            presentacion="panel"
                            onClose={() => setProformaAbierta(false)}
                            conversationId={selected.conversationId}
                            clienteLabel={
                                selected.customerName ||
                                formatPhone({ phone_number: selected.phoneNumber, lid: selected.lid })
                            }
                            clienteNombre={selected.customerName}
                            onEnviar={enviarMensajes}
                        />
                    </div>
                )}

                {selected && productoDelMensaje === null && !proformaEnPanel && (
                    <div className="hidden w-[320px] shrink-0 overflow-y-auto wa-scroll border-l border-wa-divider bg-surface p-3 xl:block">
                        <ConversationWorkCard
                            conversationId={selected.conversationId}
                            aiReady={conversations.find((conversation) => conversation.id === selected.conversationId)?.etapa === 'ready_for_sales'}
                        />
                        <CustomerPanel
                            key={`${selected.conversationId}-${recargarFicha}`}
                            conversationId={selected.conversationId}
                            phoneNumber={selected.phoneNumber}
                            customerName={selected.customerName}
                            onCotizar={(producto) => {
                                agregarAProforma(selected.conversationId, producto);
                                // Que el repuesto caiga en una proforma que no
                                // se ve es la mitad del trabajo: se abre el
                                // panel para que se vea entrar.
                                if (hayAnchoParaPanel) setProformaAbierta(true);
                            }}
                            onAvisar={() => {
                                setAvisarTelefono(selected.phoneNumber);
                                setAvisarAbierto(true);
                            }}
                        />
                    </div>
                )}
                  </>
                )}
            </div>

            {messagePreview && !conversationMenu && (
                <div
                    role="tooltip"
                    style={{ left: messagePreview.x, top: messagePreview.y }}
                    className="pointer-events-none fixed z-[110] w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-xl border border-wa-divider bg-wa-panel shadow-2xl"
                >
                    <div className="flex items-start justify-between gap-3 border-b border-wa-divider bg-wa-header px-4 py-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-wa-text">{messagePreview.name}</p>
                            <p className="truncate text-xs text-wa-meta">{messagePreview.phone}</p>
                        </div>
                        {messagePreview.time && (
                            <span className="shrink-0 text-[11px] text-wa-meta">{horaLista(messagePreview.time)}</span>
                        )}
                    </div>
                    <div className="wa-wallpaper p-3">
                        <div className={cn('flex', messagePreview.outbound ? 'justify-end' : 'justify-start')}>
                            <div className={cn(
                                'max-w-[92%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-[13.5px] leading-5 text-wa-text shadow-sm',
                                messagePreview.outbound ? 'bg-wa-out' : 'bg-wa-in',
                            )}>
                                {messagePreview.outbound && <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-wa-meta-out">Tú enviaste</span>}
                                {messagePreview.text}
                            </div>
                        </div>
                    </div>
                    <p className="border-t border-wa-divider bg-wa-header px-4 py-2 text-[10px] text-wa-meta">
                        Vista previa · no marca el chat como leído
                    </p>
                </div>
            )}

            {/* Menú contextual de conversación, como WhatsApp Web. Las
                preferencias de organización son personales para este usuario. */}
            {conversationMenu && (() => {
                const c = conversationMenu.conversation;
                const pinned = conversationPreferences.pinned.includes(c.id);
                const archived = conversationPreferences.archived.includes(c.id);
                const muted = conversationPreferences.muted.includes(c.id);
                const noLeidoEnLista = c.unread_count > 0 || noLeidosConservados.has(c.id);
                const itemClass = 'flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-[13.5px] text-wa-text transition-colors hover:bg-wa-hover disabled:cursor-not-allowed disabled:opacity-50';
                return (
                    <div
                        role="menu"
                        aria-label={`Opciones de ${c.customer_name || formatPhone(c)}`}
                        style={{ left: conversationMenu.x, top: conversationMenu.y }}
                        className="fixed z-[120] w-60 overflow-hidden rounded-xl border border-wa-divider bg-wa-panel py-1.5 shadow-2xl"
                        onContextMenu={(event) => event.preventDefault()}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="border-b border-wa-divider px-4 py-2">
                            <p className="truncate text-sm font-semibold text-wa-text">{c.customer_name || formatPhone(c)}</p>
                            <p className="truncate text-xs text-wa-meta">{formatPhone(c)}</p>
                        </div>
                        <button role="menuitem" className={itemClass} onClick={() => { setSelectedConversationId(c.id); setConversationMenu(null); }}>
                            <Inbox size={17} aria-hidden="true" /> Abrir conversación
                        </button>
                        <button
                            role="menuitem"
                            className={itemClass}
                            disabled={actionLoading}
                            onClick={async () => {
                                setConversationMenu(null);
                                if (noLeidoEnLista) await marcarLeida(c.id);
                                else await marcarComoNoLeido(c.id);
                            }}
                        >
                            {noLeidoEnLista ? <CheckCheck size={17} aria-hidden="true" /> : <MailQuestion size={17} aria-hidden="true" />}
                            {noLeidoEnLista ? 'Marcar como leído' : 'Marcar como no leído'}
                        </button>
                        <button role="menuitem" className={itemClass} onClick={() => { toggleConversationPreference('pinned', c.id); setConversationMenu(null); }}>
                            <Pin size={17} aria-hidden="true" /> {pinned ? 'Desfijar conversación' : 'Fijar conversación'}
                        </button>
                        <button role="menuitem" className={itemClass} onClick={() => { toggleConversationPreference('muted', c.id); setConversationMenu(null); }}>
                            {muted ? <Bell size={17} aria-hidden="true" /> : <BellOff size={17} aria-hidden="true" />}
                            {muted ? 'Activar notificaciones' : 'Silenciar notificaciones'}
                        </button>
                        <button role="menuitem" className={itemClass} onClick={() => { toggleConversationPreference('archived', c.id); setConversationMenu(null); }}>
                            <Archive size={17} aria-hidden="true" /> {archived ? 'Desarchivar conversación' : 'Archivar conversación'}
                        </button>
                        <div className="my-1 border-t border-wa-divider" />
                        <button
                            role="menuitem"
                            className={itemClass}
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(formatPhone(c));
                                } catch {
                                    setErrorAccion('No se pudo copiar el número al portapapeles.');
                                }
                                setConversationMenu(null);
                            }}
                        >
                            <Copy size={17} aria-hidden="true" /> Copiar número
                        </button>
                    </div>
                );
            })()}

            {/* Visor de fotos del hilo: la foto del repuesto se mira en
                grande sin salir de la conversación. */}
            <MediaLightbox
                isOpen={!!visor}
                media={visor?.media ?? []}
                initialIndex={visor?.index ?? 0}
                onClose={() => setVisor(null)}
            />

            <AvisarLlegadaModal
                isOpen={avisarAbierto}
                onClose={() => setAvisarAbierto(false)}
                userId={userId}
                soloTelefono={avisarTelefono}
                modo={modoAviso}
                onAvisado={() => {
                    // El aviso ya está en la cola: se refresca el número del
                    // botón y la ficha, que muestra el pedido como avisado.
                    contarAvisos();
                    setRecargarFicha((n) => n + 1);
                }}
                // Por `abrirConversacionPorId` y no seleccionando el id a
                // secas: la lista trae las 200 más recientes, y un cliente
                // que dejó un pedido hace tres meses puede no estar cargado
                // -- seleccionar su id dejaría la pantalla en blanco.
                onAbrirChat={abrirConversacionPorId}
            />

            {/* Pasar un mensaje a otro chat: la foto de la pieza rota al del
                taller, el comprobante a administración. */}
            <ReenviarModal
                mensaje={reenviando}
                conversacionActual={selected?.conversationId ?? null}
                userId={userId}
                onClose={() => setReenviando(null)}
                onEnviado={(destinos) =>
                    setAvisoAccion(
                        `Reenviado a ${destinos} ${destinos === 1 ? 'chat' : 'chats'}. Sale por la cola en unos segundos.`,
                    )
                }
            />

            <NuevoChatModal
                isOpen={nuevoChat}
                onClose={() => setNuevoChat(false)}
                onAbrir={abrirConversacionPorId}
            />

            {/* El menú del teléfono tocado dentro de un mensaje. */}
            {menuTelefono && (
                <MenuTelefono
                    numero={menuTelefono.numero}
                    ancla={menuTelefono.ancla}
                    conversacionActual={selected?.conversationId ?? null}
                    onAbrir={abrirConversacionPorId}
                    onCerrar={() => setMenuTelefono(null)}
                />
            )}
        </div>
    );
};

export default WhatsAppInbox;
