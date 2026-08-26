import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { cn, page, card, badge, button, input } from '../components/ui/styles';
import { Ban, CheckCheck, Clock, FileText, Headset, Inbox, RefreshCw, RotateCw, Search, User, X } from 'lucide-react';
import { MediaLightbox, type MediaItem } from '../components/MediaLightbox';
import ChatComposer from '../components/whatsapp/ChatComposer';
import {
    CAMPOS_COLA,
    cancelarMensaje,
    encolarMensajes,
    reintentarMensaje,
    type MensajeEnCola,
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
}

/** Campos del mensaje que necesita el hilo. */
const CAMPOS_MENSAJE =
    'id, direction, content_type, body, created_at, delivery_status, action_taken, media_url, product_id';

/** Tipos que se muestran como imagen dentro de la burbuja. */
const ES_IMAGEN = (m: AgentMessage): boolean =>
    !!m.media_url && (m.content_type === 'image' || m.content_type === 'sticker');

/**
 * Lo que WhatsApp confirmó de cada mensaje que mandó el agente. Es
 * deliberadamente explícito: antes el ERP mostraba el mensaje y uno
 * asumía que había llegado, cuando WhatsApp podía haberlo descartado
 * sin avisar.
 */
const ENTREGA: Record<DeliveryStatus, { texto: string; tono: keyof typeof badge.tone }> = {
    pending: { texto: 'Sin confirmar', tono: 'warning' },
    sent: { texto: 'Enviado', tono: 'info' },
    delivered: { texto: 'Entregado', tono: 'success' },
    read: { texto: 'Leído', tono: 'success' },
    failed: { texto: 'No se entregó', tono: 'danger' },
};

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

function timeAgo(iso: string): string {
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return 'recién';
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `hace ${hours} h`;
    return `hace ${Math.round(hours / 24)} d`;
}

/** Cómo se nombra un mensaje sin texto, según lo que traiga. */
const SIN_TEXTO: Partial<Record<ContentType, string>> = {
    image: '(foto)',
    audio: '(nota de voz)',
    video: '(video)',
    document: '(archivo)',
    sticker: '(sticker)',
    location: '(ubicación)',
    contact: '(contacto)',
};

const bodyPreview = (m: Pick<AgentMessage, 'body' | 'content_type'>): string =>
    m.body || SIN_TEXTO[m.content_type] || '(sin texto)';

/**
 * Estado que reporta el proceso del agente (migración 0027). Es lo que
 * permite avisar que un mensaje encolado NO va a salir -- antes de que
 * alguien escriba tres veces al vacío.
 */
interface EstadoAgente {
    agent_last_seen_at: string | null;
    agent_connection: 'connected' | 'connecting' | 'disconnected' | null;
    agent_outbound_mode: 'blocked' | 'erp_only' | 'full' | null;
}

/**
 * Cuánto puede tardar el latido antes de dar el proceso por caído. El
 * agente late cada 30s, así que 2 minutos tolera un par de fallos seguidos
 * sin dar una falsa alarma.
 */
const LATIDO_MAXIMO_MS = 2 * 60 * 1000;

/** Fila de agent_conversations -- la pestaña "Todas" no depende de escalamientos. */
interface Conversation {
    id: number;
    phone_number: string;
    customer_name: string | null;
    status: ConversationStatus;
    bot_enabled: boolean;
    last_message_at: string | null;
    unread_count: number;
    lid: string | null;
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

type Tab = 'pending' | 'resolved' | 'all';

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
    lid: string | null;
    unreadCount: number;
    escalation: Escalation | null;
}

const WhatsAppInbox: React.FC = () => {
    const { session } = useAuth();
    const userId = session?.user?.id ?? null;

    const [escalations, setEscalations] = useState<Escalation[]>([]);
    const [profileNames, setProfileNames] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('pending');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [closeInsteadOfReopen, setCloseInsteadOfReopen] = useState(false);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
    const [globalBotEnabled, setGlobalBotEnabled] = useState<boolean | null>(null);
    const [search, setSearch] = useState('');
    /** Se incrementa para forzar una relectura del chat abierto. */
    const [recargarMensajes, setRecargarMensajes] = useState(0);
    /**
     * Lo que se encoló y todavía no salió (o falló). Se muestra al final
     * del hilo: sin esto, entre que alguien manda un mensaje y el agente lo
     * despacha, la pantalla se ve como si no hubiera pasado nada y la gente
     * lo manda de nuevo.
     */
    const [enCola, setEnCola] = useState<MensajeEnCola[]>([]);
    /** Foto abierta a pantalla completa. */
    const [visor, setVisor] = useState<{ media: MediaItem[]; index: number } | null>(null);
    /** Estado del proceso del agente (migración 0027). null = no se sabe. */
    const [estadoAgente, setEstadoAgente] = useState<EstadoAgente | null>(null);
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

    /**
     * La búsqueda vigente, legible desde los callbacks sin recrearlos. Los
     * eventos de realtime llaman a `fetchConversations` sin argumentos y
     * tienen que respetar el filtro que el usuario tenga puesto.
     */
    const searchRef = useRef(search);
    searchRef.current = search;

    /** Contenedor del hilo, para dejarlo scrolleado en el último mensaje. */
    const hiloRef = useRef<HTMLDivElement | null>(null);

    /**
     * La conversación abierta, legible desde los callbacks estables (misma
     * razón que `searchRef`: los eventos de realtime los llaman sin
     * argumentos y tienen que trabajar sobre el chat que está a la vista).
     */
    const selectedConversationIdRef = useRef<number | null>(null);

    /**
     * Lo que está esperando salir en esta conversación.
     *
     * Solo `pending` y `failed`: lo que ya salió aparece en el hilo real
     * (`agent_messages`), y mostrarlo dos veces haría dudar de si se mandó
     * una vez o dos.
     */
    const cargarCola = useCallback(async () => {
        const conversationId = selectedConversationIdRef.current;
        if (!conversationId) {
            setEnCola([]);
            return;
        }
        const { data, error } = await supabase
            .from('agent_outbox')
            .select(CAMPOS_COLA)
            .eq('conversation_id', conversationId)
            .in('status', ['pending', 'failed'])
            .order('created_at', { ascending: true });
        if (error) {
            console.error('No se pudo leer la cola de salida:', error.message);
            return;
        }
        setEnCola((data ?? []) as unknown as MensajeEnCola[]);
    }, []);

    const fetchConversations = useCallback(async () => {
        setConversationsLoading(true);
        let query = supabase
            .from('agent_conversations')
            // `count: 'exact'` da el total REAL de la tabla (o de la
            // búsqueda), no el de las filas traídas: sin esto la tarjeta
            // "Conversaciones" se quedaba clavada en 200 apenas entró el
            // historial.
            .select('id, phone_number, customer_name, status, bot_enabled, last_message_at, unread_count, lid', {
                count: 'exact',
            })
            .order('last_message_at', { ascending: false, nullsFirst: false })
            .limit(CONVERSACIONES_POR_PAGINA);

        const filtro = filtroBusqueda(searchRef.current);
        if (filtro) query = query.or(filtro);

        const { data, error, count } = await query;
        setConversationsLoading(false);
        if (error) {
            console.error('Error cargando conversaciones:', error.message);
            setErrorCarga(`No se pudieron cargar las conversaciones: ${error.message}`);
            return;
        }
        setErrorCarga(null);
        setConversations((data ?? []) as unknown as Conversation[]);
        setTotalConversaciones(count ?? null);
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
            .select('bot_auto_reply_enabled')
            .eq('id', 1)
            .maybeSingle();
        if (error) {
            console.error('Error cargando agent_settings:', error.message);
            return;
        }
        setGlobalBotEnabled(Boolean(data?.bot_auto_reply_enabled));
    }, []);

    const fetchEscalations = useCallback(async () => {
        setLoading(true);
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

        const channel = supabase
            .channel('agent_escalations_inbox')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_escalations' }, () => {
                clearTimeout(escalationsTimer);
                escalationsTimer = setTimeout(() => fetchEscalations(), AGRUPAR_MS);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_conversations' }, () => {
                clearTimeout(conversationsTimer);
                conversationsTimer = setTimeout(() => fetchConversations(), AGRUPAR_MS);
            })
            .subscribe();

        return () => {
            clearTimeout(escalationsTimer);
            clearTimeout(conversationsTimer);
            clearInterval(latido);
            channel.unsubscribe();
        };
    }, [fetchEscalations, fetchConversations, fetchSettings, fetchEstadoAgente]);

    /**
     * La búsqueda de conversaciones va contra la base, así que se espera a
     * que la persona termine de tipear en vez de consultar por tecla.
     */
    useEffect(() => {
        const t = setTimeout(() => fetchConversations(), 350);
        return () => clearTimeout(t);
    }, [search, fetchConversations]);

    /**
     * Deja el hilo abajo del todo: al abrir un chat con historial se
     * entraba viendo los mensajes MÁS VIEJOS y había que scrollear a mano
     * hasta el final para ver de qué se estaba hablando.
     */
    useEffect(() => {
        const cont = hiloRef.current;
        if (cont) cont.scrollTop = cont.scrollHeight;
    }, [messages]);

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
    const filteredConversations = conversations;

    const pendingCount = useMemo(() => escalations.filter((e) => e.status !== 'resolved').length, [escalations]);

    /**
     * Métricas del día, calculadas sobre lo ya cargado (sin consultas
     * extra a Supabase). Sirven para ver de un vistazo si el agente está
     * ayudando: cuántos chats atiende y cuántos terminaron necesitando a
     * una persona.
     */
    const metricas = useMemo(() => {
        const activos = conversations.filter((c) => c.bot_enabled).length;
        const sinLeer = conversations.filter((c) => c.unread_count > 0).length;
        const hoy = new Date().toISOString().slice(0, 10);
        const escaladosHoy = escalations.filter((e) => e.created_at.slice(0, 10) === hoy).length;
        // El total sale del `count` de la consulta; el resto se calcula
        // sobre lo cargado y por eso se aclara en pantalla que es "de las
        // recientes" cuando hay más de las que entran en una página.
        return { activos, sinLeer, escaladosHoy, total: totalConversaciones ?? conversations.length };
    }, [conversations, escalations, totalConversaciones]);

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
    const avisoDeEnvio = useMemo(() => {
        if (!estadoAgente) return null;

        const ultimo = estadoAgente.agent_last_seen_at ? new Date(estadoAgente.agent_last_seen_at).getTime() : 0;
        if (!ultimo || Date.now() - ultimo > LATIDO_MAXIMO_MS) {
            return {
                titulo: 'El agente está caído',
                detalle: ultimo
                    ? `No da señales desde ${timeAgo(estadoAgente.agent_last_seen_at!)}. Lo que escribas queda en cola y sale cuando vuelva.`
                    : 'Nunca reportó estar activo. Lo que escribas queda en cola y sale cuando arranque.',
            };
        }
        if (estadoAgente.agent_connection !== 'connected') {
            return {
                titulo: 'El agente no está conectado a WhatsApp',
                detalle: 'Está intentando reconectar. Los mensajes quedan en cola y salen cuando la sesión vuelva.',
            };
        }
        if (estadoAgente.agent_outbound_mode === 'blocked') {
            return {
                titulo: 'La salida a clientes está bloqueada en el servidor',
                detalle: 'Con OUTBOUND_MODE=blocked no sale nada, ni siquiera lo que escribas vos. Hay que cambiarlo en el .env del agente.',
            };
        }
        return null;
    }, [estadoAgente]);

    const selectedEscalation = escalations.find((e) => e.id === selectedId) ?? null;

    // Un solo "seleccionado" para las tres pestañas: en Pendientes/Resueltas
    // viene de un escalamiento, en Todas de la conversación suelta. El
    // `bot_enabled` se lee siempre de `conversations` cuando está cargada,
    // así el botón refleja el estado real aunque el escalamiento se haya
    // traído antes del último cambio.
    const selected: SelectedContext | null = useMemo(() => {
        if (tab === 'all') {
            const conv = conversations.find((c) => c.id === selectedConversationId);
            if (!conv) return null;
            return {
                conversationId: conv.id,
                phoneNumber: conv.phone_number,
                customerName: conv.customer_name,
                conversationStatus: conv.status,
                botEnabled: conv.bot_enabled,
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
            lid: conv?.lid ?? null,
            unreadCount: conv?.unread_count ?? 0,
            escalation: selectedEscalation,
        };
    }, [tab, conversations, selectedConversationId, selectedEscalation]);

    selectedConversationIdRef.current = selected?.conversationId ?? null;

    useEffect(() => {
        if (!selected) {
            setMessages([]);
            return;
        }
        let cancelled = false;
        setMessagesLoading(true);
        // Solo los últimos N: una conversación larga puede tener cientos de
        // mensajes y traerlos todos es lento y caro (se piden en orden
        // descendente y se revierte, para quedarse con los MÁS RECIENTES).
        supabase
            .from('agent_messages')
            .select(CAMPOS_MENSAJE)
            .eq('conversation_id', selected.conversationId)
            .order('created_at', { ascending: false })
            .limit(MENSAJES_VISIBLES)
            .then(({ data, error }) => {
                if (cancelled) return;
                if (!error && data) setMessages((data as AgentMessage[]).slice().reverse());
                setMessagesLoading(false);
            });
        // Mensajes en vivo del chat abierto: sin esto había que refrescar la
        // página para ver lo que iba llegando (el filtro es por conversación,
        // así que no llegan eventos de otros chats).
        const conversationId = selected.conversationId;
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
                    setMessages((prev) => (prev.some((m) => m.id === nuevo.id) ? prev : [...prev, nuevo]));
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

    // Abrir un chat con mensajes sin leer lo marca como leído en el ERP.
    useEffect(() => {
        if (selected && selected.unreadCount > 0) {
            marcarLeida(selected.conversationId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.conversationId]);

    /**
     * Cola de salida del chat abierto, en vivo.
     *
     * Es lo que hace visible el tramo entre "le di a enviar" y "el cliente
     * lo recibió": mientras el agente no lo despache, el mensaje se ve al
     * final del hilo marcado como en cola, y se puede cancelar. Sin esto,
     * ese hueco de unos segundos parece que el envío no funcionó.
     */
    useEffect(() => {
        const conversationId = selected?.conversationId;
        if (!conversationId) {
            setEnCola([]);
            return;
        }
        cargarCola();

        const channel = supabase
            .channel(`agent_outbox_conversation_${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'agent_outbox',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                () => cargarCola(),
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.conversationId, cargarCola]);

    /**
     * Deja el hilo abajo del todo también cuando aparece o se despacha algo
     * de la cola -- si no, el mensaje recién enviado queda fuera de vista.
     */
    // Se mira la CANTIDAD y no el arreglo: la cola se relee cada pocos
    // segundos, y saltar al final en cada relectura le arrancaría el scroll
    // de las manos a quien está leyendo mensajes viejos.
    useEffect(() => {
        const cont = hiloRef.current;
        if (cont) cont.scrollTop = cont.scrollHeight;
    }, [enCola.length]);

    const hayPendientes = enCola.some((q) => q.status === 'pending');

    /**
     * Mientras haya algo esperando salir, se relee la cola cada pocos
     * segundos.
     *
     * Es a propósito además del realtime: `agent_outbox` tiene que estar
     * agregada a la publicación `supabase_realtime` para que lleguen
     * eventos (migración 0028), y si esa migración no se aplicó el mensaje
     * se quedaría marcado como "En cola" para siempre aunque el cliente ya
     * lo tenga. Solo corre mientras hay pendientes, así que en un chat
     * quieto no consulta nada.
     */
    useEffect(() => {
        if (!hayPendientes) return;
        const t = setInterval(() => cargarCola(), 4000);
        return () => clearInterval(t);
    }, [hayPendientes, cargarCola]);

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
        setActionLoading(false);
        await Promise.all([fetchEscalations(), fetchConversations()]);
    };

    // El agente NO le contesta a nadie por su cuenta: solo responde en las
    // conversaciones habilitadas explícitamente acá (ver migración 0017 del
    // repo del agente). Arranca apagado para cada cliente nuevo.
    const handleToggleBot = async (ctx: SelectedContext) => {
        setActionLoading(true);
        setErrorAccion(null);
        const { error } = await supabase
            .from('agent_conversations')
            .update({ bot_enabled: !ctx.botEnabled })
            .eq('id', ctx.conversationId);
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
     * Marca la conversación como leída al abrirla. Es un espejo LOCAL: no
     * marca leído en el teléfono (WhatsApp no lo permite desde acá), pero
     * evita que el contador quede encendido para siempre en el ERP una vez
     * que alguien del equipo ya miró el chat.
     */
    const marcarLeida = useCallback(async (conversationId: number) => {
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
    }, []);


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
            await encolarMensajes(mensajes, userId);
            // Aparece de inmediato en el hilo como "en cola"; el realtime de
            // agent_outbox lo va actualizando hasta que sale.
            await cargarCola();
        },
        // `cargarCola` se define abajo con useCallback estable.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [userId, selected?.conversationId],
    );

    /** Cancela un mensaje que todavía no salió. */
    const handleCancelar = async (item: MensajeEnCola) => {
        try {
            const cancelado = await cancelarMensaje(item.id);
            if (!cancelado) {
                // Se despachó entre el clic y el update: decirle a la persona
                // que se canceló sería mentirle sobre algo que el cliente ya
                // tiene en el teléfono.
                setErrorAccion('Ese mensaje ya había salido, no se pudo cancelar.');
                setRecargarMensajes((n) => n + 1);
            }
            await cargarCola();
        } catch (err: any) {
            setErrorAccion(`No se pudo cancelar: ${err?.message ?? err}`);
        }
    };

    /** Vuelve a intentar un mensaje que falló. */
    const handleReintentar = async (item: MensajeEnCola) => {
        try {
            await reintentarMensaje(item.id);
            await cargarCola();
        } catch (err: any) {
            setErrorAccion(`No se pudo reintentar: ${err?.message ?? err}`);
        }
    };

    /** Abre la foto a pantalla completa, con las demás del hilo al lado. */
    const abrirVisor = (mensaje: AgentMessage) => {
        const fotos = messages.filter(ES_IMAGEN);
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
        setActionLoading(false);
        setCloseInsteadOfReopen(false);
        await Promise.all([fetchEscalations(), fetchConversations()]);
    };

    return (
        <div className={page.root}>
            <div className={page.header}>
                <div>
                    <h1 className={page.title}>Bandeja de WhatsApp</h1>
                    <p className={page.subtitle}>
                        Contestale al cliente desde acá: texto, fotos y repuestos del catálogo con su precio.
                        Todo lo que se manda queda guardado en la conversación -- lo que se escribe desde el
                        teléfono, no.
                    </p>
                </div>
                <button
                    onClick={() => {
                        fetchEscalations();
                        fetchConversations();
                        fetchSettings();
                        fetchEstadoAgente();
                    }}
                    className={cn(button.base, button.variant.secondary, button.size.sm)}
                >
                    <RefreshCw size={14} aria-hidden="true" /> Actualizar
                </button>
            </div>

            {/* Fallos de Supabase (RLS, red): antes solo iban a la consola y
                en pantalla parecía que todo había salido bien. */}
            {(errorCarga || errorAccion) && (
                <div className={cn(card.base, 'px-4 py-3 border-danger/40 flex items-start justify-between gap-3')}>
                    <p className="text-sm text-danger">{errorCarga ?? errorAccion}</p>
                    <button
                        onClick={() => {
                            setErrorCarga(null);
                            setErrorAccion(null);
                        }}
                        aria-label="Cerrar aviso de error"
                        className="p-1 rounded text-fg-subtle hover:text-fg hover:bg-surface-hover shrink-0"
                    >
                        <X size={14} aria-hidden="true" />
                    </button>
                </div>
            )}

            {/* Lo que se encole ahora no va a salir. Se avisa arriba de todo
                y no en la caja de escribir: hay que verlo ANTES de escribir. */}
            {avisoDeEnvio && (
                <div className={cn(card.base, 'px-4 py-3 border-warning/40 bg-warning-soft flex items-start gap-3')}>
                    <RotateCw size={16} className="text-warning-soft-fg shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                        <p className="text-sm font-semibold text-warning-soft-fg">{avisoDeEnvio.titulo}</p>
                        <p className="text-xs text-warning-soft-fg/90 mt-0.5">{avisoDeEnvio.detalle}</p>
                    </div>
                </div>
            )}

            {/* Interruptor maestro: apagado acá, el agente no le contesta a
                nadie aunque haya conversaciones habilitadas. */}
            <div
                className={cn(
                    card.base,
                    'px-4 py-3 flex items-center justify-between gap-4 flex-wrap',
                    globalBotEnabled ? 'border-success/30' : 'border-strong',
                )}
            >
                <div>
                    <p className="text-sm font-medium text-fg">
                        Agente automático:{' '}
                        {globalBotEnabled === null ? (
                            <span className="text-fg-muted">cargando…</span>
                        ) : globalBotEnabled ? (
                            <span className="text-success">encendido</span>
                        ) : (
                            <span className="text-fg-muted">apagado</span>
                        )}
                    </p>
                    <p className="text-xs text-fg-muted mt-0.5">
                        {globalBotEnabled
                            ? 'Responde solo en las conversaciones que tengan el agente activado.'
                            : 'No le responde a nadie. Los mensajes igual quedan registrados acá.'}
                    </p>
                </div>
                <button
                    onClick={handleToggleGlobalBot}
                    disabled={actionLoading || globalBotEnabled === null}
                    className={cn(
                        button.base,
                        button.size.sm,
                        globalBotEnabled ? button.variant.secondary : button.variant.success,
                    )}
                >
                    {globalBotEnabled ? 'Apagar agente' : 'Encender agente'}
                </button>
            </div>

            {/* Resumen rápido: se calcula sobre lo ya cargado, sin consultas extra. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Conversaciones', valor: metricas.total },
                    { label: 'Con agente activo', valor: metricas.activos },
                    { label: 'Sin leer', valor: metricas.sinLeer },
                    { label: 'Escaladas hoy', valor: metricas.escaladosHoy },
                ].map((m) => (
                    <div key={m.label} className={cn(card.base, 'px-4 py-3')}>
                        <p className="text-2xl font-semibold text-fg tabular-nums">{m.valor}</p>
                        <p className="text-xs text-fg-muted mt-0.5">{m.label}</p>
                    </div>
                ))}
            </div>

            <div className="flex gap-2 items-center flex-wrap">
                <button
                    onClick={() => setTab('pending')}
                    className={cn(button.base, button.size.sm, tab === 'pending' ? button.variant.primary : button.variant.secondary)}
                >
                    Pendientes ({pendingCount})
                </button>
                <button
                    onClick={() => setTab('resolved')}
                    className={cn(button.base, button.size.sm, tab === 'resolved' ? button.variant.primary : button.variant.secondary)}
                >
                    Resueltas
                </button>
                <button
                    onClick={() => setTab('all')}
                    className={cn(button.base, button.size.sm, tab === 'all' ? button.variant.primary : button.variant.secondary)}
                >
                    Todas ({totalConversaciones ?? conversations.length})
                </button>

                <div className="relative ml-auto w-full sm:w-72">
                    <Search
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none"
                        aria-hidden="true"
                    />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por teléfono o nombre…"
                        aria-label="Buscar cliente por teléfono o nombre"
                        className={cn(input.base, input.size.sm, 'pl-9', search && 'pr-9')}
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            aria-label="Limpiar búsqueda"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-fg-subtle hover:text-fg hover:bg-surface-hover"
                        >
                            <X size={14} aria-hidden="true" />
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 items-start">
                {/* Lista */}
                <div className={cn(card.base, 'divide-y divide-subtle overflow-hidden')}>
                    {/* Cada pestaña espera SU propia carga: la de "Todas" usaba
                        el loading de escalamientos y por eso mostraba "no hay
                        conversaciones" mientras la consulta seguía en vuelo. */}
                    {(tab === 'all' ? conversationsLoading : loading) ? (
                        <div className="p-8 text-center text-sm text-fg-muted">Cargando…</div>
                    ) : tab === 'all' ? (
                        filteredConversations.length === 0 ? (
                            <div className="p-10 text-center text-sm text-fg-muted flex flex-col items-center gap-2">
                                <Inbox size={22} className="text-fg-subtle" aria-hidden="true" />
                                {search.trim()
                                    ? `Ningún cliente coincide con "${search.trim()}".`
                                    : 'Todavía no hay conversaciones de WhatsApp.'}
                            </div>
                        ) : (
                            filteredConversations.map((c) => (
                                <button
                                    key={c.id}
                                    onClick={() => setSelectedConversationId(c.id)}
                                    className={cn(
                                        'w-full text-left px-4 py-3 transition-colors',
                                        selectedConversationId === c.id ? 'bg-primary-soft/60' : 'hover:bg-surface-hover',
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={cn('text-sm truncate', c.unread_count > 0 ? 'font-bold text-fg' : 'font-medium text-fg')}>
                                            {formatPhone(c)}
                                        </span>
                                        {c.last_message_at && (
                                            <span className="text-2xs text-fg-subtle shrink-0 flex items-center gap-1">
                                                <Clock size={11} aria-hidden="true" />
                                                {timeAgo(c.last_message_at)}
                                            </span>
                                        )}
                                    </div>
                                    {c.customer_name && (
                                        <p className="text-2xs text-fg-muted truncate mt-0.5">{c.customer_name}</p>
                                    )}
                                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                        {c.unread_count > 0 && (
                                            <span className={cn(badge.base, badge.size.sm, badge.tone.danger)}>
                                                {c.unread_count} sin leer
                                            </span>
                                        )}
                                        <span
                                            className={cn(
                                                badge.base,
                                                badge.size.sm,
                                                c.bot_enabled ? badge.tone.success : badge.tone.neutral,
                                            )}
                                        >
                                            {c.bot_enabled ? 'Agente activado' : 'Agente apagado'}
                                        </span>
                                    </div>
                                </button>
                            ))
                        )
                    ) : null}
                    {tab === 'all' && !conversationsLoading && hayMas && (
                        <p className="px-4 py-3 text-2xs text-fg-subtle text-center">
                            Mostrando las {conversations.length} más recientes de {totalConversaciones}.
                            {' '}Usá el buscador para encontrar una conversación puntual.
                        </p>
                    )}
                    {tab !== 'all' && (loading ? null : filtered.length === 0 ? (
                        <div className="p-10 text-center text-sm text-fg-muted flex flex-col items-center gap-2">
                            <Inbox size={22} className="text-fg-subtle" aria-hidden="true" />
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
                                    'w-full text-left px-4 py-3 transition-colors',
                                    selectedId === e.id ? 'bg-primary-soft/60' : 'hover:bg-surface-hover',
                                )}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-fg text-sm truncate">
                                        {e.agent_conversations?.customer_name || e.agent_conversations?.phone_number || 'Cliente'}
                                    </span>
                                    <span className="text-2xs text-fg-subtle shrink-0 flex items-center gap-1">
                                        <Clock size={11} aria-hidden="true" />
                                        {timeAgo(e.created_at)}
                                    </span>
                                </div>
                                <div className="mt-1.5">
                                    <span className={cn(badge.base, badge.size.sm, badge.tone[REASON_TONE[e.reason]])}>
                                        {REASON_LABEL[e.reason]}
                                    </span>
                                </div>
                                {e.message_snapshot && (
                                    <p className="mt-1.5 text-xs text-fg-muted line-clamp-2">{e.message_snapshot}</p>
                                )}
                                {e.status === 'claimed' && (
                                    <p className="mt-1 text-2xs text-fg-subtle flex items-center gap-1">
                                        <User size={11} aria-hidden="true" />
                                        {e.claimed_by === userId ? 'Vos la estás atendiendo' : `Atendiendo: ${profileNames.get(e.claimed_by ?? '') ?? 'alguien del equipo'}`}
                                    </p>
                                )}
                            </button>
                        ))
                    ))}
                </div>

                {/* Detalle */}
                <div className={cn(card.base, 'flex flex-col')}>
                    {!selected ? (
                        <div className="p-14 text-center text-sm text-fg-muted flex flex-col items-center gap-2">
                            <Headset size={22} className="text-fg-subtle" aria-hidden="true" />
                            Elegí una conversación de la lista para ver el detalle.
                        </div>
                    ) : (
                        <>
                            <div className={card.header}>
                                <div>
                                    <h2 className="text-base font-semibold text-fg">
                                        {formatPhone({ phone_number: selected.phoneNumber, lid: selected.lid })}
                                    </h2>
                                    {selected.customerName && (
                                        <p className="text-xs text-fg-muted">{selected.customerName}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={cn(
                                            badge.base,
                                            badge.size.md,
                                            selected.botEnabled ? badge.tone.success : badge.tone.neutral,
                                        )}
                                    >
                                        {selected.botEnabled ? 'Agente activado' : 'Agente apagado'}
                                    </span>
                                    {selected.escalation && (
                                        <span className={cn(badge.base, badge.size.md, badge.tone[REASON_TONE[selected.escalation.reason]])}>
                                            {REASON_LABEL[selected.escalation.reason]}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div ref={hiloRef} className="p-5 max-h-[52vh] overflow-y-auto space-y-3">
                                {messages.length >= MENSAJES_VISIBLES && (
                                    <p className="text-2xs text-fg-subtle text-center pb-1">
                                        Mostrando los últimos {MENSAJES_VISIBLES} mensajes de esta conversación.
                                    </p>
                                )}
                                {messagesLoading ? (
                                    <p className="text-sm text-fg-muted">Cargando conversación…</p>
                                ) : messages.length === 0 ? (
                                    <p className="text-sm text-fg-muted">Sin mensajes registrados todavía.</p>
                                ) : (
                                    messages.map((m) => (
                                        <div key={m.id} className={cn('flex', m.direction === 'inbound' ? 'justify-start' : 'justify-end')}>
                                            <div
                                                className={cn(
                                                    'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words',
                                                    m.direction === 'inbound' ? 'bg-surface-2 text-fg' : 'bg-primary-soft text-primary-soft-fg',
                                                )}
                                            >
                                                {/* La foto, adentro de la burbuja. Antes acá solo decía
                                                    "(foto)" y para verla había que abrir el WhatsApp del
                                                    teléfono -- justo cuando hay que decidir qué contestar. */}
                                                {ES_IMAGEN(m) && (
                                                    <button
                                                        onClick={() => abrirVisor(m)}
                                                        className="block mb-1.5 rounded-xl overflow-hidden focus-visible:ring-2 focus-visible:ring-primary"
                                                        title="Ver la foto en grande"
                                                    >
                                                        <img
                                                            src={m.media_url!}
                                                            alt={m.body ?? 'Foto del chat'}
                                                            loading="lazy"
                                                            className="max-h-64 w-auto object-cover"
                                                        />
                                                    </button>
                                                )}
                                                {m.media_url && !ES_IMAGEN(m) && (
                                                    <a
                                                        href={m.media_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="mb-1.5 flex items-center gap-2 rounded-lg border border-subtle bg-surface px-2.5 py-1.5 text-xs text-fg hover:bg-surface-hover"
                                                    >
                                                        <FileText size={14} aria-hidden="true" />
                                                        {m.content_type === 'audio'
                                                            ? 'Escuchar la nota de voz'
                                                            : m.content_type === 'video'
                                                              ? 'Ver el video'
                                                              : 'Abrir el archivo'}
                                                    </a>
                                                )}
                                                {/* Con foto, el texto de relleno "(foto)" sobra: la foto ya está a la vista. */}
                                                {(m.body || !m.media_url) && bodyPreview(m)}
                                                <div className="text-2xs text-fg-subtle mt-1 flex items-center gap-1.5 flex-wrap">
                                                    <span>
                                                        {new Date(m.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {m.action_taken === 'human_reply' && <span>· vendedor</span>}
                                                    {/* El acuse existe para todo lo que salió por el agente:
                                                        sus respuestas automáticas y lo que se manda desde el
                                                        ERP. Lo escrito desde el teléfono del vendedor no lo
                                                        tiene -- no pasó por acá y no hay nada que confirmar. */}
                                                    {m.direction === 'outbound' && m.delivery_status && (
                                                        <span
                                                            className={cn(
                                                                badge.base,
                                                                badge.size.sm,
                                                                badge.tone[ENTREGA[m.delivery_status].tono],
                                                            )}
                                                        >
                                                            {ENTREGA[m.delivery_status].texto}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}

                                {/* Lo que todavía no salió. Va al final del hilo, con el
                                    mismo aspecto que un mensaje enviado pero atenuado: se
                                    ve dónde va a quedar sin fingir que el cliente ya lo
                                    recibió. */}
                                {enCola.map((q) => (
                                    <div key={`cola-${q.id}`} className="flex justify-end">
                                        <div
                                            className={cn(
                                                'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words border border-dashed',
                                                q.status === 'failed'
                                                    ? 'border-danger/50 bg-danger-soft text-danger-soft-fg'
                                                    : 'border-strong bg-surface-2 text-fg-muted',
                                            )}
                                        >
                                            {q.media_url && q.kind === 'image' && (
                                                <img
                                                    src={q.media_url}
                                                    alt={q.body ?? 'Foto por enviar'}
                                                    className="mb-1.5 max-h-48 w-auto rounded-xl object-cover opacity-80"
                                                />
                                            )}
                                            {q.media_url && q.kind !== 'image' && (
                                                <p className="mb-1 flex items-center gap-1.5 text-xs">
                                                    <FileText size={13} aria-hidden="true" />
                                                    {q.media_filename ?? 'archivo'}
                                                </p>
                                            )}
                                            {q.body}

                                            <div className="text-2xs mt-1 flex items-center gap-2 flex-wrap">
                                                {q.status === 'failed' ? (
                                                    <>
                                                        <span className={cn(badge.base, badge.size.sm, badge.tone.danger)}>
                                                            No se pudo enviar
                                                        </span>
                                                        <button
                                                            onClick={() => handleReintentar(q)}
                                                            className="inline-flex items-center gap-1 underline underline-offset-2 hover:no-underline"
                                                        >
                                                            <RotateCw size={11} aria-hidden="true" /> Reintentar
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className={cn(badge.base, badge.size.sm, badge.tone.warning)}>
                                                            En cola
                                                        </span>
                                                        <button
                                                            onClick={() => handleCancelar(q)}
                                                            className="inline-flex items-center gap-1 text-fg-subtle underline underline-offset-2 hover:no-underline"
                                                        >
                                                            <Ban size={11} aria-hidden="true" /> Cancelar
                                                        </button>
                                                    </>
                                                )}
                                            </div>

                                            {/* El motivo exacto del fallo: sin esto, "no se pudo
                                                enviar" no le dice a nadie qué hacer al respecto. */}
                                            {q.error && <p className="text-2xs mt-1 opacity-80">{q.error}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Si el agente sigue habilitado en este chat, puede
                                contestar encima de la persona que está atendiendo.
                                No se apaga solo -- eso dejaría al bot mudo para
                                siempre sin que nadie lo haya decidido -- pero se
                                avisa y se apaga de un clic. */}
                            {selected.botEnabled && globalBotEnabled && (
                                <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-warning-soft border border-warning/30 flex items-center justify-between gap-3 flex-wrap">
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

                            {/* Responder desde acá y no desde el teléfono: lo que se
                                escribe en el teléfono llega cifrado al agente y no
                                queda registrado en la conversación. */}
                            <ChatComposer
                                key={selected.conversationId}
                                conversationId={selected.conversationId}
                                clienteLabel={
                                    selected.customerName ||
                                    formatPhone({ phone_number: selected.phoneNumber, lid: selected.lid })
                                }
                                userId={userId}
                                onEnviar={enviarMensajes}
                            />

                            <div className={cn(card.footer, 'flex items-center gap-3 flex-wrap')}>
                                <button
                                    onClick={() => setRecargarMensajes((n) => n + 1)}
                                    disabled={messagesLoading}
                                    className={cn(button.base, button.variant.secondary, button.size.md)}
                                    title="Vuelve a leer la conversación y el estado de entrega de cada mensaje"
                                >
                                    <RefreshCw size={15} aria-hidden="true" /> Actualizar chat
                                </button>
                                <button
                                    onClick={() => handleToggleBot(selected)}
                                    disabled={actionLoading}
                                    className={cn(
                                        button.base,
                                        selected.botEnabled ? button.variant.secondary : button.variant.success,
                                        button.size.md,
                                    )}
                                    title="El agente solo responde en las conversaciones que habilites acá"
                                >
                                    {selected.botEnabled ? 'Desactivar agente' : 'Activar agente'}
                                </button>
                                {selected.botEnabled && globalBotEnabled === false && (
                                    <p className="text-2xs text-fg-muted">
                                        Ojo: el agente está apagado en general, así que igual no va a responder.
                                    </p>
                                )}
                                {selected.escalation?.status === 'open' && (
                                    <button
                                        onClick={() => handleClaim(selected.escalation!)}
                                        disabled={actionLoading}
                                        className={cn(button.base, button.variant.primary, button.size.md)}
                                    >
                                        <User size={15} aria-hidden="true" /> Reclamar
                                    </button>
                                )}
                                {selected.escalation?.status === 'claimed' && (
                                    <>
                                        <label className="flex items-center gap-1.5 text-xs text-fg-muted mr-auto">
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
                                            className={cn(button.base, button.variant.success, button.size.md)}
                                        >
                                            <CheckCheck size={15} aria-hidden="true" /> Marcar resuelta
                                        </button>
                                    </>
                                )}
                                {selected.escalation?.status === 'resolved' && (
                                    <p className="text-xs text-fg-muted">
                                        Resuelta {selected.escalation.resolved_at ? timeAgo(selected.escalation.resolved_at) : ''}
                                        {selected.conversationStatus === 'closed' && ' -- conversación cerrada, el bot no retoma sola'}
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Visor de fotos del hilo: la foto del repuesto se mira en
                grande sin salir de la conversación. */}
            <MediaLightbox
                isOpen={!!visor}
                media={visor?.media ?? []}
                initialIndex={visor?.index ?? 0}
                onClose={() => setVisor(null)}
            />
        </div>
    );
};

export default WhatsAppInbox;
