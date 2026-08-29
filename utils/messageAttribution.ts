import { supabase } from '../supabaseClient';

export type SenderKind = 'customer' | 'human' | 'agent' | 'unknown';

export interface MessageAttribution {
    sender_kind?: SenderKind;
    sender_label?: string;
    sender_email?: string | null;
    sender_account_id?: string | null;
}

interface AttributableMessage {
    id: number;
    direction: 'inbound' | 'outbound';
    action_taken: string | null;
}

/**
 * Añade la autoría interna sin modificar la tabla de mensajes. La relación
 * fiable es agent_outbox.sent_message_id -> agent_messages.id; ahí vive la
 * cuenta que puso el mensaje en cola.
 */
export async function attributeMessages<T extends AttributableMessage>(messages: T[]): Promise<Array<T & MessageAttribution>> {
    const outboundIds = messages.filter((message) => message.direction === 'outbound').map((message) => message.id);
    const authorByMessage = new Map<number, string>();

    if (outboundIds.length) {
        const { data: outbox } = await supabase
            .from('agent_outbox')
            .select('sent_message_id, created_by')
            .in('sent_message_id', outboundIds)
            .not('created_by', 'is', null);
        (outbox ?? []).forEach((row: any) => {
            if (row.sent_message_id && row.created_by) authorByMessage.set(Number(row.sent_message_id), row.created_by);
        });
    }

    const accountIds = [...new Set(authorByMessage.values())];
    const profiles = new Map<string, { label: string; email: string | null }>();
    if (accountIds.length) {
        const { data } = await supabase.from('profiles').select('id, full_name, nickname, email').in('id', accountIds);
        (data ?? []).forEach((profile: any) => profiles.set(profile.id, {
            label: profile.nickname || profile.full_name || profile.email || 'Vendedor',
            email: profile.email || null,
        }));
    }

    return messages.map((message) => {
        if (message.direction === 'inbound') return { ...message, sender_kind: 'customer' as const, sender_label: 'Cliente · WhatsApp', sender_email: null, sender_account_id: null };
        const accountId = authorByMessage.get(message.id);
        if (accountId) {
            const profile = profiles.get(accountId);
            return { ...message, sender_kind: 'human' as const, sender_label: profile?.label || 'Vendedor', sender_email: profile?.email || null, sender_account_id: accountId };
        }
        if (message.action_taken === 'human_reply') return { ...message, sender_kind: 'human' as const, sender_label: 'Vendedor · cuenta no registrada', sender_email: null, sender_account_id: null };
        const action = (message.action_taken || '').toLowerCase();
        const label = action.includes('sales') || action.includes('product') || action.includes('quote') ? 'Agente vendedor IA' : 'Agente IA';
        return { ...message, sender_kind: 'agent' as const, sender_label: label, sender_email: null, sender_account_id: null };
    });
}
