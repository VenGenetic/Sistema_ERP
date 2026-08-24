import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { cn, page, card, badge, button, input } from '../components/ui/styles';
import { CheckCheck, Clock, Headset, Inbox, RefreshCw, Search, User, X } from 'lucide-react';

/**
 * Bandeja de conversaciones de WhatsApp escaladas por el agente
 * (agente/src/agent/handleMessage.ts -> tabla agent_escalations).
 *
 * El humano NO contesta desde acá -- eso se hace desde el WhatsApp personal
 * vinculado como dispositivo del número del bot (decisión de diseño: evitar
 * duplicar el envío de mensajes en dos sistemas). Esta pantalla es solo para
 * triage: ver qué se escaló y por qué, marcar quién lo está atendiendo, y
 * avisarle al bot que puede retomar la conversación una vez resuelta.
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

interface AgentMessage {
    id: number;
    direction: 'inbound' | 'outbound';
    content_type: 'text' | 'image' | 'audio' | 'system';
    body: string | null;
    created_at: string;
}

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

const bodyPreview = (m: Pick<AgentMessage, 'body' | 'content_type'>): string =>
    m.body || (m.content_type === 'image' ? '(foto)' : m.content_type === 'audio' ? '(nota de voz)' : '(sin texto)');

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

    const fetchConversations = useCallback(async () => {
        const { data, error } = await supabase
            .from('agent_conversations')
            .select('id, phone_number, customer_name, status, bot_enabled, last_message_at, unread_count, lid')
            .order('last_message_at', { ascending: false, nullsFirst: false })
            .limit(200);
        if (error) {
            console.error('Error cargando conversaciones:', error.message);
            return;
        }
        setConversations((data ?? []) as unknown as Conversation[]);
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
        fetchConversations();
        fetchSettings();
        const channel = supabase
            .channel('agent_escalations_inbox')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_escalations' }, () => fetchEscalations())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_conversations' }, () => fetchConversations())
            .subscribe();
        return () => {
            channel.unsubscribe();
        };
    }, [fetchEscalations, fetchConversations, fetchSettings]);

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

    const filteredConversations = useMemo(
        () => conversations.filter(matchesSearch),
        [conversations, matchesSearch],
    );

    const pendingCount = useMemo(() => escalations.filter((e) => e.status !== 'resolved').length, [escalations]);

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
            escalation: selectedEscalation,
        };
    }, [tab, conversations, selectedConversationId, selectedEscalation]);

    useEffect(() => {
        if (!selected) {
            setMessages([]);
            return;
        }
        let cancelled = false;
        setMessagesLoading(true);
        supabase
            .from('agent_messages')
            .select('id, direction, content_type, body, created_at')
            .eq('conversation_id', selected.conversationId)
            .order('created_at', { ascending: true })
            .then(({ data, error }) => {
                if (cancelled) return;
                if (!error && data) setMessages(data as AgentMessage[]);
                setMessagesLoading(false);
            });
        return () => {
            cancelled = true;
        };
        // Solo re-consultamos cuando cambia LA CONVERSACIÓN seleccionada, no en
        // cada re-render de `selected` (cambia de referencia en cada fetch).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.conversationId]);

    const handleClaim = async (escalation: Escalation) => {
        if (!userId) return;
        setActionLoading(true);
        await supabase
            .from('agent_escalations')
            .update({ status: 'claimed', claimed_by: userId, claimed_at: new Date().toISOString() })
            .eq('id', escalation.id);
        await supabase.from('agent_conversations').update({ status: 'human_active' }).eq('id', escalation.conversation_id);
        setActionLoading(false);
        await Promise.all([fetchEscalations(), fetchConversations()]);
    };

    // El agente NO le contesta a nadie por su cuenta: solo responde en las
    // conversaciones habilitadas explícitamente acá (ver migración 0017 del
    // repo del agente). Arranca apagado para cada cliente nuevo.
    const handleToggleBot = async (ctx: SelectedContext) => {
        setActionLoading(true);
        await supabase.from('agent_conversations').update({ bot_enabled: !ctx.botEnabled }).eq('id', ctx.conversationId);
        setActionLoading(false);
        await Promise.all([fetchConversations(), fetchEscalations()]);
    };

    /**
     * Interruptor MAESTRO (agent_settings, migración 0018). Apagado acá, el
     * agente no le contesta a nadie aunque una conversación esté habilitada.
     */
    const handleToggleGlobalBot = async () => {
        if (globalBotEnabled === null) return;
        setActionLoading(true);
        await supabase
            .from('agent_settings')
            .update({ bot_auto_reply_enabled: !globalBotEnabled, updated_at: new Date().toISOString(), updated_by: userId })
            .eq('id', 1);
        setActionLoading(false);
        fetchSettings();
    };

    const handleResolve = async (escalation: Escalation) => {
        setActionLoading(true);
        await supabase
            .from('agent_escalations')
            .update({ status: 'resolved', resolved_at: new Date().toISOString() })
            .eq('id', escalation.id);
        await supabase
            .from('agent_conversations')
            .update({ status: closeInsteadOfReopen ? 'closed' : 'bot_active' })
            .eq('id', escalation.conversation_id);
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
                        Conversaciones de WhatsApp del agente. Contestale al cliente desde tu propio WhatsApp
                        (vinculado como dispositivo del número del bot) -- acá se hace seguimiento y se decide
                        a quién le responde el agente.
                    </p>
                </div>
                <button
                    onClick={() => {
                        fetchEscalations();
                        fetchConversations();
                        fetchSettings();
                    }}
                    className={cn(button.base, button.variant.secondary, button.size.sm)}
                >
                    <RefreshCw size={14} aria-hidden="true" /> Actualizar
                </button>
            </div>

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
                    Todas ({conversations.length})
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
                    {loading ? (
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
                    ) : filtered.length === 0 ? (
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
                    )}
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

                            <div className="p-5 max-h-[52vh] overflow-y-auto space-y-3">
                                {messagesLoading ? (
                                    <p className="text-sm text-fg-muted">Cargando conversación…</p>
                                ) : messages.length === 0 ? (
                                    <p className="text-sm text-fg-muted">Sin mensajes registrados todavía.</p>
                                ) : (
                                    messages.map((m) => (
                                        <div key={m.id} className={cn('flex', m.direction === 'inbound' ? 'justify-start' : 'justify-end')}>
                                            <div
                                                className={cn(
                                                    'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm',
                                                    m.direction === 'inbound' ? 'bg-surface-2 text-fg' : 'bg-primary-soft text-primary-soft-fg',
                                                )}
                                            >
                                                {bodyPreview(m)}
                                                <div className="text-2xs text-fg-subtle mt-1">
                                                    {new Date(m.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className={cn(card.footer, 'flex items-center gap-3 flex-wrap')}>
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
        </div>
    );
};

export default WhatsAppInbox;
