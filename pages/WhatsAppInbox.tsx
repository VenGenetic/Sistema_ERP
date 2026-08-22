import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { cn, page, card, badge, button, input } from '../components/ui/styles';
import { CheckCheck, Clock, Headset, Inbox, RefreshCw, User } from 'lucide-react';

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

type Tab = 'pending' | 'resolved';

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

    const fetchEscalations = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('agent_escalations')
            .select(
                'id, conversation_id, reason, message_snapshot, status, claimed_by, claimed_at, resolved_at, created_at, agent_conversations ( phone_number, customer_name, status )',
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
        const channel = supabase
            .channel('agent_escalations_inbox')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_escalations' }, () => fetchEscalations())
            .subscribe();
        return () => {
            channel.unsubscribe();
        };
    }, [fetchEscalations]);

    const filtered = useMemo(
        () => escalations.filter((e) => (tab === 'pending' ? e.status !== 'resolved' : e.status === 'resolved')),
        [escalations, tab],
    );

    const pendingCount = useMemo(() => escalations.filter((e) => e.status !== 'resolved').length, [escalations]);

    const selected = escalations.find((e) => e.id === selectedId) ?? null;

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
            .eq('conversation_id', selected.conversation_id)
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
    }, [selected?.conversation_id]);

    const handleClaim = async (escalation: Escalation) => {
        if (!userId) return;
        setActionLoading(true);
        await supabase
            .from('agent_escalations')
            .update({ status: 'claimed', claimed_by: userId, claimed_at: new Date().toISOString() })
            .eq('id', escalation.id);
        await supabase.from('agent_conversations').update({ status: 'human_active' }).eq('id', escalation.conversation_id);
        setActionLoading(false);
        fetchEscalations();
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
        fetchEscalations();
    };

    return (
        <div className={page.root}>
            <div className={page.header}>
                <div>
                    <h1 className={page.title}>Bandeja de WhatsApp</h1>
                    <p className={page.subtitle}>
                        Conversaciones que el agente escaló a un humano. Contestale al cliente desde tu propio WhatsApp
                        (vinculado como dispositivo del número del bot) -- acá solo se hace seguimiento.
                    </p>
                </div>
                <button
                    onClick={fetchEscalations}
                    className={cn(button.base, button.variant.secondary, button.size.sm)}
                >
                    <RefreshCw size={14} aria-hidden="true" /> Actualizar
                </button>
            </div>

            <div className="flex gap-2">
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
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 items-start">
                {/* Lista */}
                <div className={cn(card.base, 'divide-y divide-subtle overflow-hidden')}>
                    {loading ? (
                        <div className="p-8 text-center text-sm text-fg-muted">Cargando…</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-10 text-center text-sm text-fg-muted flex flex-col items-center gap-2">
                            <Inbox size={22} className="text-fg-subtle" aria-hidden="true" />
                            {tab === 'pending' ? 'No hay nada pendiente. Todo tranquilo.' : 'Todavía no hay conversaciones resueltas.'}
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
                                        {selected.agent_conversations?.customer_name || selected.agent_conversations?.phone_number}
                                    </h2>
                                    <p className="text-xs text-fg-muted">{selected.agent_conversations?.phone_number}</p>
                                </div>
                                <span className={cn(badge.base, badge.size.md, badge.tone[REASON_TONE[selected.reason]])}>
                                    {REASON_LABEL[selected.reason]}
                                </span>
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
                                {selected.status === 'open' && (
                                    <button
                                        onClick={() => handleClaim(selected)}
                                        disabled={actionLoading}
                                        className={cn(button.base, button.variant.primary, button.size.md)}
                                    >
                                        <User size={15} aria-hidden="true" /> Reclamar
                                    </button>
                                )}
                                {selected.status === 'claimed' && (
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
                                            onClick={() => handleResolve(selected)}
                                            disabled={actionLoading}
                                            className={cn(button.base, button.variant.success, button.size.md)}
                                        >
                                            <CheckCheck size={15} aria-hidden="true" /> Marcar resuelta
                                        </button>
                                    </>
                                )}
                                {selected.status === 'resolved' && (
                                    <p className="text-xs text-fg-muted">
                                        Resuelta {selected.resolved_at ? timeAgo(selected.resolved_at) : ''}
                                        {selected.agent_conversations?.status === 'closed' && ' -- conversación cerrada, el bot no retoma sola'}
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
