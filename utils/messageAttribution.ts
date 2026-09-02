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
    /**
     * Cuándo se registró. Opcional para no romper a quien ya llamaba sin
     * él, pero sin esto la autoría no se puede cachear: ver `ASENTADO_MS`.
     */
    created_at?: string;
}

/**
 * Quién escribió cada mensaje saliente, ya resuelto.
 *
 * La caché es lo que hace que esto sea barato. Sin ella, el repaso del hilo
 * -- que corre cada 8 segundos con un chat abierto -- disparaba DOS
 * consultas extra por vuelta (`agent_outbox` con cien ids, y `profiles`)
 * para recalcular una autoría que ya no puede cambiar. Son unas 1.350
 * consultas por hora y por pestaña abierta, contra los 5 GB mensuales de
 * la cuota; el resto de esta pantalla se esfuerza en evitar exactamente
 * eso (ver el UPDATE parcheado de `fetchConversations`).
 *
 * Vive a nivel de módulo y no en un hook: la comparten la bandeja de
 * escritorio y el modo móvil, y sobrevive a cambiar de conversación y
 * volver -- que es justo lo que más se hace.
 */
const autoriaPorMensaje = new Map<number, MessageAttribution>();
const perfilesPorId = new Map<string, { label: string; email: string | null }>();

/**
 * Cuánto hay que esperar antes de dar una autoría por definitiva.
 *
 * `agent_outbox.sent_message_id` se completa al despachar, un instante
 * DESPUÉS de que la fila exista en `agent_messages`. Un mensaje recién
 * salido puede leerse como "del agente" en esa rendija; cacheando eso, la
 * burbuja diría "Agente IA" para siempre sobre algo que escribió una
 * persona. Medio minuto cubre de sobra ese hueco.
 */
const ASENTADO_MS = 30_000;

/**
 * Tope de la caché. Un ERP abierto todo el día recorriendo miles de
 * conversaciones no puede quedarse con la autoría de todas en memoria.
 * Se descartan las más viejas, que son las que menos se vuelven a mirar.
 */
const TOPE_CACHE = 3000;

function recordar(id: number, autoria: MessageAttribution): void {
    if (autoriaPorMensaje.size >= TOPE_CACHE) {
        // Los `Map` conservan el orden de inserción: las primeras claves son
        // las más viejas.
        const sobran = autoriaPorMensaje.size - TOPE_CACHE + 500;
        let n = 0;
        for (const clave of autoriaPorMensaje.keys()) {
            autoriaPorMensaje.delete(clave);
            if (++n >= sobran) break;
        }
    }
    autoriaPorMensaje.set(id, autoria);
}

/** El cliente. No cuesta una consulta: se sabe por la dirección. */
const DEL_CLIENTE: MessageAttribution = {
    sender_kind: 'customer',
    sender_label: 'Cliente · WhatsApp',
    sender_email: null,
    sender_account_id: null,
};

/** Lo que se dice de un saliente que no salió de una cuenta del ERP. */
function autoriaDeAgente(actionTaken: string | null): MessageAttribution {
    if (actionTaken === 'human_reply') {
        return {
            sender_kind: 'human',
            sender_label: 'Vendedor · cuenta no registrada',
            sender_email: null,
            sender_account_id: null,
        };
    }
    const accion = (actionTaken || '').toLowerCase();
    const esVendedor =
        accion.includes('sales') || accion.includes('product') || accion.includes('quote');
    return {
        sender_kind: 'agent',
        sender_label: esVendedor ? 'Agente vendedor IA' : 'Agente IA',
        sender_email: null,
        sender_account_id: null,
    };
}

/**
 * Añade la autoría interna sin modificar la tabla de mensajes. La relación
 * fiable es `agent_outbox.sent_message_id` -> `agent_messages.id`: ahí vive
 * la cuenta que puso el mensaje en la cola.
 *
 * Solo consulta por lo que todavía no sabe. En un hilo ya visto no hace
 * ninguna consulta.
 */
export async function attributeMessages<T extends AttributableMessage>(
    messages: T[],
): Promise<Array<T & MessageAttribution>> {
    const ahora = Date.now();
    const asentado = (m: AttributableMessage) =>
        !m.created_at || ahora - new Date(m.created_at).getTime() > ASENTADO_MS;

    // Lo que hay que averiguar: salientes sin autoría cacheada, más los
    // recién salidos, cuya fila de la cola pudo no estar completa todavía.
    const porResolver = messages
        .filter((m) => m.direction === 'outbound' && (!autoriaPorMensaje.has(m.id) || !asentado(m)))
        .map((m) => m.id);

    const autorNuevo = new Map<number, string>();

    if (porResolver.length > 0) {
        const { data: outbox } = await supabase
            .from('agent_outbox')
            .select('sent_message_id, created_by')
            .in('sent_message_id', porResolver)
            .not('created_by', 'is', null);
        (outbox ?? []).forEach((row: any) => {
            if (row.sent_message_id && row.created_by) {
                autorNuevo.set(Number(row.sent_message_id), row.created_by);
            }
        });

        // Los perfiles que todavía no se conocen. Un vendedor se resuelve
        // una vez por sesión, no una vez cada ocho segundos.
        const cuentasNuevas = [...new Set(autorNuevo.values())].filter((id) => !perfilesPorId.has(id));
        if (cuentasNuevas.length > 0) {
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, nickname, email')
                .in('id', cuentasNuevas);
            (data ?? []).forEach((perfil: any) =>
                perfilesPorId.set(perfil.id, {
                    label: perfil.nickname || perfil.full_name || perfil.email || 'Vendedor',
                    email: perfil.email || null,
                }),
            );
        }
    }

    return messages.map((message) => {
        if (message.direction === 'inbound') return { ...message, ...DEL_CLIENTE };

        const cuenta = autorNuevo.get(message.id);
        if (cuenta) {
            const perfil = perfilesPorId.get(cuenta);
            const autoria: MessageAttribution = {
                sender_kind: 'human',
                sender_label: perfil?.label || 'Vendedor',
                sender_email: perfil?.email || null,
                sender_account_id: cuenta,
            };
            if (asentado(message)) recordar(message.id, autoria);
            return { ...message, ...autoria };
        }

        // Se consultó y no apareció: es del agente. Solo se recuerda si el
        // mensaje ya se asentó (ver ASENTADO_MS).
        if (porResolver.includes(message.id)) {
            const autoria = autoriaDeAgente(message.action_taken);
            if (asentado(message)) recordar(message.id, autoria);
            return { ...message, ...autoria };
        }

        const cacheada = autoriaPorMensaje.get(message.id);
        return { ...message, ...(cacheada ?? autoriaDeAgente(message.action_taken)) };
    });
}

/**
 * Un solo mensaje, para el que llega por realtime.
 *
 * El hilo lo insertaba crudo, así que hasta el siguiente repaso el clic
 * derecho sobre esa burbuja decía "Agente IA" aunque la hubiera escrito
 * una persona. Con la caché puesta esto cuesta a lo sumo una consulta, y
 * ninguna si el mensaje salió de esta misma pantalla.
 */
export async function attributeMessage<T extends AttributableMessage>(
    message: T,
): Promise<T & MessageAttribution> {
    const [conAutoria] = await attributeMessages([message]);
    return conAutoria;
}

/**
 * Olvida lo aprendido. Hace falta al cambiar de usuario: los perfiles
 * cacheados son de la sesión anterior.
 */
export function olvidarAutorias(): void {
    autoriaPorMensaje.clear();
    perfilesPorId.clear();
}
