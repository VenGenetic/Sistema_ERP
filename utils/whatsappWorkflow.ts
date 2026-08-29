import { supabase } from '../supabaseClient';
import type { ChatProformaItem } from '../store/useChatProformaStore';

export type WorkStatus = 'new' | 'reviewing' | 'waiting_customer' | 'quoting' | 'quote_sent' | 'sale_confirmed' | 'resolved';

export interface ConversationWork {
    conversation_id: number;
    work_status: WorkStatus;
    internal_summary: string | null;
    requested_part: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    vehicle_year: number | null;
    assigned_to: string | null;
    reminder_at: string | null;
    reminder_note: string | null;
    quote_sent_at: string | null;
    resolved_at: string | null;
    updated_at?: string;
}

export const EMPTY_WORK = (conversationId: number): ConversationWork => ({
    conversation_id: conversationId,
    work_status: 'new',
    internal_summary: null,
    requested_part: null,
    vehicle_make: null,
    vehicle_model: null,
    vehicle_year: null,
    assigned_to: null,
    reminder_at: null,
    reminder_note: null,
    quote_sent_at: null,
    resolved_at: null,
});

export const workflowUnavailable = (error: { code?: string } | null | undefined) =>
    error?.code === '42P01' || error?.code === 'PGRST205' || error?.code === 'PGRST202';

export async function getConversationWork(conversationId: number): Promise<ConversationWork> {
    const { data, error } = await supabase.from('whatsapp_conversation_work').select('*').eq('conversation_id', conversationId).maybeSingle();
    if (error) {
        if (workflowUnavailable(error)) return EMPTY_WORK(conversationId);
        throw error;
    }
    return data ? data as ConversationWork : EMPTY_WORK(conversationId);
}

export async function saveConversationWork(work: ConversationWork): Promise<ConversationWork> {
    const payload = {
        ...work,
        vehicle_year: work.vehicle_year || null,
        resolved_at: work.work_status === 'resolved' ? work.resolved_at || new Date().toISOString() : null,
        quote_sent_at: work.work_status === 'quote_sent' ? work.quote_sent_at || new Date().toISOString() : work.quote_sent_at,
    };
    const { data, error } = await supabase.from('whatsapp_conversation_work').upsert(payload, { onConflict: 'conversation_id' }).select().single();
    if (error) throw error;
    return data as ConversationWork;
}

export async function getDueWorkIds(): Promise<number[]> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from('whatsapp_conversation_work')
        .select('conversation_id')
        .neq('work_status', 'resolved')
        .or(`reminder_at.lte.${now},work_status.in.(new,reviewing,quoting,quote_sent)`);
    if (error) return workflowUnavailable(error) ? [] : Promise.reject(error);
    return (data ?? []).map((row) => Number(row.conversation_id));
}

export async function registerProformaAnalytics(conversationId: number, items: ChatProformaItem[]): Promise<void> {
    await Promise.all(items.map(async (item) => {
        const { error } = await supabase.rpc('register_whatsapp_product_request', {
            p_conversation_id: conversationId,
            p_product_id: item.productId,
            p_requested_text: item.name,
            p_source: 'proforma',
            p_quantity: item.quantity,
            p_quoted_price: item.unitPrice,
        });
        if (error && !workflowUnavailable(error)) console.error('No se pudo registrar la solicitud analítica:', error.message);
    }));

    const { error } = await supabase.from('whatsapp_commercial_events').insert({
        conversation_id: conversationId,
        event_type: 'quote_sent',
        amount: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        details: { items: items.length },
    });
    if (error && !workflowUnavailable(error)) console.error('No se pudo registrar el evento de proforma:', error.message);
}

export const toLocalDateTimeValue = (iso: string | null) => {
    if (!iso) return '';
    const date = new Date(iso);
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
