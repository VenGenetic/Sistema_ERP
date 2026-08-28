/**
 * Encontrar (o abrir) la conversación de WhatsApp de un teléfono.
 *
 * Vive acá y no dentro de una pantalla porque hay tres lugares que
 * necesitan exactamente lo mismo y no pueden contestar distinto:
 *
 *   - tocar un teléfono escrito dentro de un mensaje;
 *   - el botón de «chat nuevo» de la bandeja y del modo móvil;
 *   - avisar que llegó un repuesto (components/whatsapp/avisarLlegada.ts),
 *     que le escribe a gente que quizá nunca escribió al negocio.
 *
 * Buscar tiene su vuelta porque los números están guardados de dos
 * maneras. `agent_conversations.phone_number` guarda los dígitos tal como
 * los entrega WhatsApp, pero eso NO siempre es un teléfono: en los chats
 * nuevos WhatsApp entrega un LID (un identificador interno de 14-15
 * dígitos) y esa columna termina con el LID adentro. Por eso la búsqueda
 * por los últimos 9 dígitos descarta los LID: sin ese filtro, un LID podía
 * «coincidir» con el teléfono de otra persona y el mensaje salía al chat
 * equivocado.
 */

import { supabase } from '../supabaseClient';
import { normalizePhoneEC } from './phone';

/** Los últimos 9 dígitos: el número local, sin el 0 ni el código de país. */
export function colaTelefono(numero: string): string {
    return numero.replace(/\D/g, '').slice(-9);
}

/**
 * Un LID de WhatsApp es un identificador interno, no un teléfono. Se
 * distingue por el largo, mismo criterio que usa el agente
 * (`agente/src/utils/phone.ts`): los teléfonos con código de país llegan a
 * 13 dígitos como mucho, los LID son de 14-15.
 */
export function pareceLid(numero: string): boolean {
    return numero.replace(/\D/g, '').length > 13;
}

/**
 * ¿Se le puede abrir un chat a este número?
 *
 * Un ecuatoriano normalizado son 12 dígitos (593 + celular) u 11 (593 +
 * fijo). Se pide un mínimo para no abrir un chat contra un número
 * recortado, y un máximo porque más de 13 dígitos ya no es un teléfono
 * sino un LID.
 */
export function telefonoUtilizable(telefono: string | null | undefined): boolean {
    const n = normalizePhoneEC(telefono);
    return n.length >= 10 && n.length <= 13;
}

interface FilaConversacion {
    id: number;
    phone_number: string;
    last_message_at: string | null;
}

/**
 * A qué conversación pertenece este teléfono, o `null` si todavía no hay
 * ninguna.
 *
 * Dos pasadas: primero la coincidencia exacta contra el número
 * normalizado (cubre casi todo y es una sola consulta) y después, para lo
 * que no apareció, por los últimos 9 dígitos.
 */
export async function buscarConversacionPorTelefono(
    telefono: string | null | undefined,
): Promise<number | null> {
    const numero = normalizePhoneEC(telefono);
    if (!numero) return null;

    const { data: exacta, error } = await supabase
        .from('agent_conversations')
        .select('id')
        .eq('phone_number', numero)
        .maybeSingle();
    if (error) throw error;
    if (exacta?.id) return exacta.id;

    const cola = colaTelefono(numero);
    if (cola.length < 7) return null;

    const { data, error: errorCola } = await supabase
        .from('agent_conversations')
        .select('id, phone_number, last_message_at')
        .like('phone_number', `%${cola}`);
    if (errorCola) throw errorCola;

    // Puede haber más de una fila terminada en los mismos 9 dígitos (el
    // mismo número guardado de dos formas). Se queda la que tuvo actividad
    // más reciente: es el chat vivo, y escribir en el muerto es escribir
    // al vacío.
    let elegida: number | null = null;
    let masReciente = -1;
    for (const fila of (data ?? []) as FilaConversacion[]) {
        if (pareceLid(fila.phone_number)) continue;
        const cuando = new Date(fila.last_message_at ?? 0).getTime();
        if (cuando > masReciente) {
            masReciente = cuando;
            elegida = fila.id;
        }
    }
    return elegida;
}

/**
 * Abre una conversación nueva para este teléfono y devuelve su id.
 *
 * Se puede escribir primero sin que el cliente haya escrito nunca:
 * WhatsApp no impone ninguna ventana de tiempo por esta vía -- eso es de
 * la API Business de Meta, que no es la que usa el agente.
 *
 * Lo que NO se comprueba acá es que el número TENGA WhatsApp: el navegador
 * no tiene la sesión. Eso lo hace el agente al despachar y, si el número
 * no existe, marca la fila de la cola como fallida con el motivo en vez de
 * dar por enviado algo que nunca salió.
 */
export async function crearConversacion(
    telefono: string,
    nombre?: string | null,
): Promise<number> {
    const numero = normalizePhoneEC(telefono);
    if (!telefonoUtilizable(numero)) {
        throw new Error(`El número "${telefono}" no parece un teléfono válido.`);
    }

    const { data, error } = await supabase
        .from('agent_conversations')
        .insert({
            phone_number: numero,
            customer_name: nombre?.trim() || null,
            // La abre una persona para escribir, no el bot. `bot_enabled`
            // ya viene en false por defecto; el estado se pone acorde para
            // que la bandeja no lo muestre como un chat que el agente está
            // atendiendo solo.
            status: 'human_active',
        })
        .select('id')
        .maybeSingle();

    if (!error && data?.id) return data.id;

    // 23505 = ya existía (`phone_number` es UNIQUE). Pasa si dos personas
    // lo abren a la vez, o si el cliente escribió justo en el medio. No es
    // un fallo: hay que usar la que está.
    if (error && error.code !== '23505') throw error;

    const { data: existente, error: errorBusqueda } = await supabase
        .from('agent_conversations')
        .select('id')
        .eq('phone_number', numero)
        .maybeSingle();
    if (errorBusqueda) throw errorBusqueda;
    if (!existente?.id) throw new Error('No se pudo abrir la conversación para este número.');
    return existente.id;
}

/**
 * La que usan los botones: devuelve el chat de este número, abriéndolo si
 * no existe. `creada` sirve para avisar en pantalla que el chat es nuevo
 * -- si no, parece que la persona ya había escrito antes.
 */
export async function abrirOCrearConversacion(
    telefono: string,
    nombre?: string | null,
): Promise<{ id: number; creada: boolean }> {
    const existente = await buscarConversacionPorTelefono(telefono);
    if (existente !== null) return { id: existente, creada: false };
    return { id: await crearConversacion(telefono, nombre), creada: true };
}
