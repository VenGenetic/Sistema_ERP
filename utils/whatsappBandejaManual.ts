import { supabase } from '../supabaseClient';
import type { BandejaManual } from '../components/whatsapp/bandejas';

/**
 * Guarda o libera la ubicación manual de un chat.
 *
 * Es una sola escritura atómica. El trigger de base la libera cuando hay
 * actividad nueva, por lo que un cliente que vuelve a escribir nunca queda
 * escondido en la bandeja que una persona eligió horas antes.
 */
export async function guardarBandejaManual(
    conversationId: number,
    destino: BandejaManual | null,
    userId: string | null,
): Promise<void> {
    const ahora = destino ? new Date().toISOString() : null;
    const { error } = await supabase
        .from('agent_conversations')
        .update({
            manual_bandeja: destino,
            manual_bandeja_updated_at: ahora,
            manual_bandeja_updated_by: destino ? userId : null,
        })
        .eq('id', conversationId);

    if (!error) return;
    if (error.code === '42703' || error.code === 'PGRST204') {
        throw new Error('Falta aplicar la migración de bandeja manual en Supabase.');
    }
    throw new Error(`No se pudo mover el chat: ${error.message}`);
}
