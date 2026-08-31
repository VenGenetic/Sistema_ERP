import { supabase } from '../supabaseClient';

interface ConversationSearchHit {
    conversation_id: number | string;
    total_count: number | string;
}

export interface ConversationSearchResult {
    conversationIds: number[];
    total: number;
}

/**
 * Busca conversaciones por los datos del contacto y por cualquier mensaje
 * guardado en el hilo. La base devuelve IDs para que cada pantalla siga
 * pidiendo solo los campos de conversación que sabe mostrar.
 *
 * `null` significa que la migración todavía no se aplicó: las pantallas
 * conservan entonces su búsqueda previa por nombre y teléfono, en vez de
 * quedarse sin lista.
 */
export async function buscarConversacionesPorTexto(
    termino: string,
    limite: number,
): Promise<ConversationSearchResult | null> {
    const consulta = termino.trim();
    if (consulta.length < 2) return null;

    const { data, error } = await supabase.rpc('search_agent_conversation_ids', {
        p_search: consulta,
        p_limit: limite,
    });

    if (error) {
        // PGRST202 es el error de PostgREST cuando aún no ve el RPC; 42883 es
        // el equivalente que puede devolver PostgreSQL directamente.
        if (error.code === 'PGRST202' || error.code === '42883') return null;
        throw error;
    }

    const hits = (data ?? []) as ConversationSearchHit[];
    const conversationIds = [...new Set(
        hits
            .map((hit) => Number(hit.conversation_id))
            .filter((id) => Number.isSafeInteger(id) && id > 0),
    )];

    return {
        conversationIds,
        total: Number(hits[0]?.total_count ?? conversationIds.length),
    };
}
