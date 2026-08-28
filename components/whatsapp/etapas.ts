import { supabase } from '../../supabaseClient';

/**
 * En qué punto del flujo está una conversación de WhatsApp.
 *
 * Es una pregunta DISTINTA de la que contesta `status`:
 *
 *   status -> ¿quién manda este chat? (bot / humano / escalado / cerrado)
 *   etapa  -> ¿en qué punto del flujo está?
 *
 * Hasta la migración 0035 del agente, `status` intentaba ser las dos
 * cosas, y por eso en la bandeja no se podía distinguir una recepción
 * terminada bien de una falla técnica: las dos quedaban en `escalated`.
 *
 * La columna puede NO EXISTIR todavía (la migración se corre a mano). Por
 * eso `etapa` es opcional en todos lados y la bandeja tiene que verse
 * igual de bien sin ella.
 */

export type Etapa =
    | 'new'
    | 'intake_in_progress'
    | 'waiting_customer_info'
    | 'ready_for_sales'
    | 'sales_in_progress'
    | 'human_assigned'
    | 'resolved';

/** Cómo se llama cada etapa para alguien que atiende, no para el código. */
export const NOMBRE_DE_ETAPA: Record<Etapa, string> = {
    new: 'Nueva',
    intake_in_progress: 'Precalificando',
    waiting_customer_info: 'Esperando al cliente',
    ready_for_sales: 'Lista para vendedor',
    sales_in_progress: 'Con el agente vendedor',
    human_assigned: 'Con un vendedor',
    resolved: 'Resuelta',
};

/**
 * Solo se marcan en la lista las etapas que piden ALGO de alguien. Poner
 * una pastilla en cada fila convierte la lista en un semáforo ilegible:
 * "precalificando" es el estado normal de casi todas y no dice nada.
 */
export const ETAPAS_QUE_SE_MARCAN: ReadonlySet<Etapa> = new Set<Etapa>([
    'ready_for_sales',
    'waiting_customer_info',
    'human_assigned',
]);

/**
 * Clases de la pastilla. "Lista para vendedor" es la única con color
 * fuerte: es la que hay que poder encontrar de un vistazo entre doscientas
 * conversaciones, y si todas gritan no grita ninguna.
 */
export const CLASE_DE_ETAPA: Partial<Record<Etapa, string>> = {
    ready_for_sales: 'bg-wa-accent-strong/[0.16] text-wa-accent-strong',
    waiting_customer_info: 'bg-wa-inset/[0.10] text-wa-meta',
    human_assigned: 'bg-wa-inset/[0.10] text-wa-meta',
};

/** Los filtros de la lista, en el orden del flujo. */
export const FILTROS_DE_ETAPA: ReadonlyArray<{ id: string; texto: string; etapas: Etapa[] | null }> = [
    { id: 'todas', texto: 'Todas', etapas: null },
    { id: 'precalificar', texto: 'Por precalificar', etapas: ['new', 'intake_in_progress'] },
    { id: 'esperando', texto: 'Esperando cliente', etapas: ['waiting_customer_info'] },
    { id: 'listas', texto: 'Listas para vendedor', etapas: ['ready_for_sales'] },
    { id: 'vendedor', texto: 'Con vendedor', etapas: ['sales_in_progress', 'human_assigned'] },
    { id: 'resueltas', texto: 'Resueltas', etapas: ['resolved'] },
];

/** true cuando el error de PostgREST es "esa columna no existe". */
function faltaLaColumna(error: { code?: string } | null | undefined): boolean {
    // PostgREST usa un código distinto según la operación: 42703 al leer,
    // PGRST204 al escribir. Comprobado contra la base sin la migración.
    return error?.code === '42703' || error?.code === 'PGRST204';
}

/**
 * Cuántas conversaciones están esperando a un vendedor.
 *
 * Se cuenta contra la base y no sobre las filas cargadas: la lista trae
 * las 200 más recientes, y una ficha lista de hace tres días quedaría
 * afuera justo cuando es la que más importa.
 *
 * Devuelve null si la migración todavía no corrió -- distinto de 0, que
 * significa "no hay ninguna".
 */
export async function contarListasParaVendedor(): Promise<number | null> {
    const { count, error } = await supabase
        .from('agent_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('etapa', 'ready_for_sales');

    if (error) {
        if (!faltaLaColumna(error)) {
            console.error('No se pudo contar las conversaciones listas para vendedor:', error.message);
        }
        return null;
    }
    return count ?? 0;
}

/**
 * Deja anotado que una persona tomó el chat (o que se cerró).
 *
 * Se llama DESPUÉS de cambiar `status`, y nunca lanza: la etapa es para
 * que la bandeja se pueda filtrar; que falle no puede impedir que el
 * vendedor se quede con la conversación, que es la acción real.
 */
export async function marcarEtapa(
    conversationId: number,
    etapa: Etapa,
    motivo: string,
): Promise<void> {
    const { error } = await supabase
        .from('agent_conversations')
        .update({ etapa, updated_at: new Date().toISOString() })
        .eq('id', conversationId);

    if (error) {
        if (!faltaLaColumna(error)) console.error('No se pudo cambiar la etapa:', error.message);
        return;
    }

    // El registro de por qué cambió. Si la tabla no existe todavía, la
    // etapa igual quedó guardada, que es lo que se ve en pantalla.
    const { error: errorEvento } = await supabase.from('agent_conversation_events').insert({
        conversation_id: conversationId,
        etapa_nueva: etapa,
        actor: 'human',
        motivo,
    });
    // PGRST205: la tabla no está en el cache de esquema de PostgREST,
    // que es lo que devuelve cuando la migración 0035 no corrió.
    if (errorEvento && errorEvento.code !== '42P01' && errorEvento.code !== 'PGRST205') {
        console.error('No se pudo registrar el cambio de etapa:', errorEvento.message);
    }
}
