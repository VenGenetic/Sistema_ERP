import { supabase } from '../supabaseClient';
import {
    compararConCliente,
    datosDelCliente,
    elegirDestinatario,
    esGuia,
    normalizar,
    parsearGuia,
    UMBRAL_COINCIDENCIAS,
    type CampoDeEnvio,
    type Decision,
    type GuiaServientrega,
} from './guiasServientrega';

/**
 * Reenviarle a cada cliente la guía de su envío.
 *
 * El transportista manda las guías a un solo chat (hoy, el del despacho:
 * alguien las reenvía ahí). Este módulo las lee, averigua de quién es cada
 * una cruzando los datos que el propio cliente escribió en su chat, y deja
 * listo el reenvío.
 *
 * SOLO MIRA LO DE HOY, a propósito. Un historial entero de guías viejas
 * dispararía decenas de mensajes a clientes que ya recibieron su paquete
 * hace semanas -- el peor estreno posible para una función que manda
 * mensajes sola.
 */

/** Desde cuándo se leen las guías: el arranque del día local. */
export function inicioDeHoy(): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}

/** Cuánto se mira hacia atrás para encontrar al dueño de una guía. */
const DIAS_DE_CLIENTES = 45;

export interface CandidatoConNombre {
    conversationId: number;
    nombre: string | null;
    telefono: string;
    puntos: number;
    campos: CampoDeEnvio[];
}

export interface YaEnviada {
    /** Cómo se supo: el registro propio, el chat del cliente, o la cola. */
    via: 'registro' | 'chat' | 'cola';
    conversationId: number | null;
    cuando: string | null;
}

export interface GuiaPendiente {
    mensajeId: number;
    createdAt: string;
    guia: GuiaServientrega;
    /** La foto de la guía. Es lo que hay que reenviar. */
    mediaUrl: string | null;
    mediaMime: string | null;
    texto: string;
    /** Distinto de null cuando ya se mandó: entonces no se vuelve a mandar. */
    yaEnviada: YaEnviada | null;
    decision: Decision;
    candidatos: CandidatoConNombre[];
}

/* -------------------------------------------------------------------------- */
/*  ¿YA SE MANDÓ?                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Tres capas, y hacen falta las tres.
 *
 *  1. EL REGISTRO propio (`whatsapp_guias_reenviadas`). Es el más rápido y
 *     el más confiable, pero solo sabe de lo que mandó esta función.
 *  2. EL CHAT: se busca el número de guía en los mensajes SALIENTES de
 *     cualquier conversación. Es lo que atrapa las guías que el equipo ya
 *     reenvió A MANO -- que hoy son todas, porque esto recién empieza. Sin
 *     esta capa, el estreno de la función le mandaría de nuevo la guía a
 *     todo cliente que ya la tenía.
 *  3. LA COLA (`agent_outbox`): lo que está esperando salir todavía no
 *     figura en el chat. Sin esto, dos clics seguidos mandan dos veces.
 *
 * El número de guía es la llave porque es lo único irrepetible del envío:
 * el mismo cliente puede tener dos guías el mismo día, y una guía nunca es
 * de dos clientes.
 */
export async function buscarEnvioPrevio(
    numeroGuia: string,
    /**
     * El chat por donde ENTRAN las guías. Se excluye del rastreo: una guía
     * que está ahí no es una guía entregada a su dueño.
     */
    conversacionDeOrigen?: number | null,
): Promise<YaEnviada | null> {
    if (!numeroGuia) return null;

    // 1. El registro propio.
    const registro = await supabase
        .from('whatsapp_guias_reenviadas')
        .select('conversation_id, created_at')
        .eq('numero_guia', numeroGuia)
        .maybeSingle();
    if (registro.data) {
        return {
            via: 'registro',
            conversationId: registro.data.conversation_id,
            cuando: registro.data.created_at,
        };
    }
    /* Si la tabla todavía no existe (migración sin aplicar) NO se sigue de
       largo: sin registro, la única barrera dura contra el doble envío es
       la capa 2, y conviene que quien mira la pantalla lo sepa. Se deja
       constancia en consola y se continúa con las otras dos capas. */
    if (registro.error && registro.error.code === '42P01') {
        console.warn(
            'Falta la migración whatsapp_guias_reenviadas: el control de doble envío ' +
                'queda apoyado solo en el historial del chat.',
        );
    }

    /* 2. ¿Alguien ya la mandó a mano? El número de guía viaja en el texto.
       Se piden varias filas y no una: hay salientes que MENCIONAN el número
       sin ser un envío al cliente, y hay que poder saltearlas. */
    const enChat = await supabase
        .from('agent_messages')
        .select('conversation_id, created_at, body')
        .eq('direction', 'outbound')
        .ilike('body', `%${numeroGuia}%`)
        .order('created_at', { ascending: true })
        .limit(20);
    const entrega = (enChat.data as any[] | null)?.find(
        (m) => !esMencionInterna(m.body, m.conversation_id, conversacionDeOrigen),
    );
    if (entrega) {
        return { via: 'chat', conversationId: entrega.conversation_id, cuando: entrega.created_at };
    }

    // 3. Lo que está en la cola sin despachar.
    const enCola = await supabase
        .from('agent_outbox')
        .select('conversation_id, created_at, body')
        .in('status', ['pending', 'sent'])
        .ilike('body', `%${numeroGuia}%`)
        .limit(20);
    const encolada = (enCola.data as any[] | null)?.find(
        (m) => !esMencionInterna(m.body, m.conversation_id, conversacionDeOrigen),
    );
    if (encolada) {
        return { via: 'cola', conversationId: encolada.conversation_id, cuando: encolada.created_at };
    }

    return null;
}

/**
 * Un saliente que NOMBRA la guía sin ser la entrega al cliente.
 *
 * Son dos casos, y los dos se dan de verdad en esta base:
 *
 *   - EL AVISO DE ESCALAMIENTO. El agente publica «Se escaló una
 *     conversación de WhatsApp… Último mensaje: "…"» citando entero el
 *     mensaje del cliente, número de guía incluido. Medido: la guía
 *     9035740886 aparece en uno de estos y en ningún otro saliente. Sin
 *     este filtro, esa guía quedaba marcada como enviada y NUNCA se le
 *     habría reenviado a su dueño.
 *   - EL CHAT DE ORIGEN. Contestar «recibido» en el chat por donde entran
 *     las guías no es habérsela mandado al cliente.
 */
function esMencionInterna(
    body: string | null,
    conversationId: number,
    conversacionDeOrigen?: number | null,
): boolean {
    if (conversacionDeOrigen != null && conversationId === conversacionDeOrigen) return true;
    if (!body) return false;
    return /se escal[oó] una conversaci[oó]n/i.test(body);
}

/* -------------------------------------------------------------------------- */
/*  BUSCAR AL DUEÑO DE LA GUÍA                                                 */
/* -------------------------------------------------------------------------- */

/** Palabras de la guía que sirven para ir a buscar candidatos a la base. */
function pistasDeBusqueda(guia: GuiaServientrega): string[] {
    const pistas = new Set<string>();
    if (guia.cedula) pistas.add(guia.cedula);
    if (guia.telefono) pistas.add(guia.telefono);
    // El nombre de pila: la guía abrevia el apellido, así que buscar el
    // nombre completo no encontraría nada.
    if (guia.nombre) {
        const pila = normalizar(guia.nombre).split(' ')[0];
        if (pila.length >= 4) pistas.add(pila);
    }
    /* Las dos palabras más largas de la dirección. Son las que distinguen
       («ANTEPARAN», «ROSENDO») frente a «calle» o «entre», y con dos
       alcanza para traer un puñado de candidatos sin barrer la tabla. */
    if (guia.direccion) {
        normalizar(guia.direccion)
            .split(' ')
            .filter((p) => p.length >= 6)
            .sort((a, b) => b.length - a.length)
            .slice(0, 2)
            .forEach((p) => pistas.add(p));
    }
    return [...pistas];
}

/**
 * Los chats donde alguien pudo haber escrito los datos de esta guía.
 *
 * No se recorre la base entera: se le pide a Postgres los mensajes
 * entrantes que contengan alguna de las pistas y se trabaja solo sobre esas
 * conversaciones. Con dos mil chats, la diferencia es entre una consulta y
 * dos mil.
 */
async function conversacionesCandidatas(guia: GuiaServientrega): Promise<number[]> {
    const pistas = pistasDeBusqueda(guia);
    if (pistas.length === 0) return [];

    const desde = new Date(Date.now() - DIAS_DE_CLIENTES * 864e5).toISOString();
    // PostgREST escupe la coma y el punto dentro de un `or`, así que las
    // pistas se limpian antes de armarlo.
    const condiciones = pistas
        .map((p) => p.replace(/[,().*"\\]/g, ' ').trim())
        .filter((p) => p.length >= 4)
        .map((p) => `body.ilike.*${p}*`);
    if (condiciones.length === 0) return [];

    const { data, error } = await supabase
        .from('agent_messages')
        .select('conversation_id')
        .eq('direction', 'inbound')
        .gte('created_at', desde)
        .or(condiciones.join(','))
        .limit(500);
    if (error || !data) return [];
    return [...new Set(data.map((m: any) => m.conversation_id as number))];
}

/** Puntúa cada candidato contra la guía. */
async function evaluarCandidatos(
    guia: GuiaServientrega,
    ids: number[],
    excluir: number,
): Promise<CandidatoConNombre[]> {
    const utiles = ids.filter((id) => id !== excluir);
    if (utiles.length === 0) return [];

    const [{ data: convs }, { data: mensajes }] = await Promise.all([
        supabase
            .from('agent_conversations')
            .select('id, customer_name, phone_number')
            .in('id', utiles),
        supabase
            .from('agent_messages')
            .select('conversation_id, body')
            .in('conversation_id', utiles)
            .eq('direction', 'inbound')
            .not('body', 'is', null)
            .limit(4000),
    ]);

    const porConversacion = new Map<number, Array<{ body: string | null }>>();
    for (const m of (mensajes ?? []) as any[]) {
        const lista = porConversacion.get(m.conversation_id) ?? [];
        lista.push({ body: m.body });
        porConversacion.set(m.conversation_id, lista);
    }

    const salida: CandidatoConNombre[] = [];
    for (const c of (convs ?? []) as any[]) {
        const datos = datosDelCliente(porConversacion.get(c.id) ?? []);
        const co = compararConCliente(guia, datos);
        if (co.puntos === 0) continue;
        salida.push({
            conversationId: c.id,
            nombre: c.customer_name,
            telefono: c.phone_number,
            puntos: co.puntos,
            campos: co.campos,
        });
    }
    return salida.sort((a, b) => b.puntos - a.puntos);
}

/* -------------------------------------------------------------------------- */
/*  EL BARRIDO                                                                 */
/* -------------------------------------------------------------------------- */

/** La conversación por la que entran las guías, buscada por su teléfono. */
export async function conversacionDeGuias(telefono: string): Promise<number | null> {
    const digitos = telefono.replace(/\D/g, '');
    const cola = digitos.slice(-9);
    const { data } = await supabase
        .from('agent_conversations')
        .select('id, phone_number')
        .ilike('phone_number', `%${cola}%`)
        .limit(5);
    return (data as any[])?.[0]?.id ?? null;
}

/**
 * Las guías de hoy y qué hacer con cada una.
 *
 * Devuelve TODAS las de hoy, incluidas las ya enviadas y las que no se
 * pudieron emparejar: la pantalla tiene que poder mostrar por qué una guía
 * no salió. Callarlas dejaría a alguien esperando un mensaje que nunca se
 * mandó.
 */
export async function guiasDeHoy(telefonoOrigen: string): Promise<{
    conversationId: number | null;
    guias: GuiaPendiente[];
}> {
    const origen = await conversacionDeGuias(telefonoOrigen);
    if (!origen) return { conversationId: null, guias: [] };

    const { data, error } = await supabase
        .from('agent_messages')
        .select('id, body, media_url, created_at, content_type')
        .eq('conversation_id', origen)
        .eq('direction', 'inbound')
        .gte('created_at', inicioDeHoy())
        .order('created_at', { ascending: true });
    if (error || !data) return { conversationId: origen, guias: [] };

    const guias: GuiaPendiente[] = [];
    for (const m of data as any[]) {
        if (!esGuia(m.body)) continue;
        const guia = parsearGuia(m.body);

        const yaEnviada = guia.numero ? await buscarEnvioPrevio(guia.numero, origen) : null;
        // Una guía ya enviada no se vuelve a cruzar: el trabajo de buscarle
        // dueño no cambia nada y son varias consultas por guía.
        if (yaEnviada) {
            guias.push({
                mensajeId: m.id,
                createdAt: m.created_at,
                guia,
                mediaUrl: m.media_url ?? null,
                mediaMime: null,
                texto: m.body ?? '',
                yaEnviada,
                decision: { tipo: 'sin_candidato' },
                candidatos: [],
            });
            continue;
        }

        const candidatos = await evaluarCandidatos(guia, await conversacionesCandidatas(guia), origen);
        const decision = elegirDestinatario(
            candidatos.map((c) => ({
                conversationId: c.conversationId,
                coincidencia: { puntos: c.puntos, campos: c.campos },
            })),
        );

        guias.push({
            mensajeId: m.id,
            createdAt: m.created_at,
            guia,
            mediaUrl: m.media_url ?? null,
            mediaMime: null,
            texto: m.body ?? '',
            yaEnviada: null,
            decision,
            candidatos,
        });
    }

    return { conversationId: origen, guias };
}

/* -------------------------------------------------------------------------- */
/*  MANDARLA                                                                   */
/* -------------------------------------------------------------------------- */

/** El texto que acompaña a la foto de la guía. */
export function mensajeDeGuia(guia: GuiaServientrega): string {
    const lineas = ['¡Tu pedido ya está en camino! 📦'];
    if (guia.numero) lineas.push(`Guía de Servientrega: *${guia.numero}*`);
    if (guia.ciudad) lineas.push(`Destino: ${guia.ciudad}`);
    lineas.push('Con ese número podés seguir el envío en servientrega.com.');
    return lineas.join('\n');
}

/**
 * Reenvía la guía y la deja anotada.
 *
 * SE ANOTA PRIMERO y se encola después. Es al revés de lo intuitivo, y es
 * a propósito: el índice único de `numero_guia` es lo que hace imposible el
 * doble envío. Si dos personas aprietan a la vez, una de las dos
 * inserciones falla y esa no encola nada. Al revés -- encolar y después
 * anotar -- las dos encolarían y el cliente recibiría la guía dos veces,
 * que es exactamente lo que hay que evitar.
 *
 * Si el encolado falla después de anotar, se borra la anotación para que se
 * pueda reintentar.
 */
export async function reenviarGuia(opciones: {
    guia: GuiaServientrega;
    mediaUrl: string | null;
    conversationId: number;
    mensajeOrigenId: number;
    campos: CampoDeEnvio[];
    userId: string | null;
}): Promise<void> {
    const { guia, mediaUrl, conversationId, mensajeOrigenId, campos, userId } = opciones;
    if (!guia.numero) throw new Error('Esa guía no tiene número: no se puede controlar el doble envío.');

    const anotacion = await supabase
        .from('whatsapp_guias_reenviadas')
        .insert({
            numero_guia: guia.numero,
            conversation_id: conversationId,
            mensaje_origen_id: mensajeOrigenId,
            campos_coincidentes: campos.join(','),
            enviada_por: userId,
        })
        .select('id')
        .maybeSingle();

    if (anotacion.error) {
        // 23505 = el índice único. Alguien se adelantó por milisegundos.
        if (anotacion.error.code === '23505') {
            throw new Error(`La guía ${guia.numero} ya fue reenviada.`);
        }
        if (anotacion.error.code === '42P01') {
            throw new Error(
                'Falta aplicar la migración de guías reenviadas ' +
                    '(supabase/migrations/20260903210000_whatsapp_guias_reenviadas.sql).',
            );
        }
        throw new Error(`No se pudo anotar la guía: ${anotacion.error.message}`);
    }

    const { encolarMensajes } = await import('./whatsappOutbox');
    try {
        await encolarMensajes(
            [
                {
                    conversationId,
                    body: mensajeDeGuia(guia),
                    kind: mediaUrl ? 'image' : 'text',
                    mediaUrl,
                    mediaMime: mediaUrl ? 'image/jpeg' : null,
                    mediaFilename: mediaUrl ? `guia-${guia.numero}.jpg` : null,
                },
            ],
            userId,
        );
    } catch (err) {
        // Se deshace la anotación: si no, la guía quedaría marcada como
        // enviada sin que nadie la haya recibido, y no habría forma de
        // reintentarla desde la pantalla.
        if (anotacion.data?.id) {
            await supabase.from('whatsapp_guias_reenviadas').delete().eq('id', anotacion.data.id);
        }
        throw err;
    }
}

export { UMBRAL_COINCIDENCIAS };
