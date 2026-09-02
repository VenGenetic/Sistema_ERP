/**
 * Enviar mensajes de WhatsApp al cliente DESDE el ERP.
 *
 * El navegador no tiene la sesión de WhatsApp -- la tiene el proceso del
 * agente (repo `agente/`). Acá se ENCOLA en `agent_outbox` y ese proceso
 * despacha cada 3 segundos (`agente/src/agent/outboxJob.ts`).
 *
 * Se responde desde el ERP y no desde el teléfono porque lo que se escribe
 * en el teléfono le llega cifrado al agente y nunca queda registrado: esta
 * es la única vía por la que la conversación del cliente queda completa.
 *
 * Ver `agente/supabase/migrations/0026_agent_outbox_media.sql` para el
 * esquema de la cola con fotos y archivos.
 */

import { supabase } from '../supabaseClient';
import { precioParaCliente, formatearPrecio } from './precioCliente';

// La regla de precio al cliente vive en `utils/precioCliente.ts`; se reexporta
// para no romper a quien ya la importaba desde acá.
export { precioParaCliente, formatearPrecio };

/** Bucket público con la media del chat (migración 0026). */
export const CHAT_MEDIA_BUCKET = 'agent_chat_media';

/**
 * Campos de la lista de conversaciones, en dos variantes.
 *
 * `last_message_preview` llegó con la migración 0032. Si esa no se aplicó,
 * pedirla hace fallar la consulta ENTERA con 42703 -- o sea, la bandeja se
 * queda sin lista, no sin vista previa. Una migración pendiente no puede
 * romper lo que ya funcionaba, así que se pide la versión completa y se
 * cae a la básica cuando falta la columna. Mismo criterio que usa el
 * agente con la cola de salida.
 */
export const CAMPOS_CONV_BASE =
    'id, phone_number, customer_name, status, bot_enabled, selected_agent, last_message_at, unread_count, lid';
export const CAMPOS_CONV_PREVIEW = `${CAMPOS_CONV_BASE}, last_message_preview, last_message_direction, etapa`;

/** true cuando el error de PostgREST es "esa columna no existe". */
export function faltaColumna(error: { code?: string } | null | undefined): boolean {
    return error?.code === '42703';
}

export type OutboxKind = 'text' | 'image' | 'video' | 'document' | 'audio';
export type OutboxStatus = 'pending' | 'sent' | 'failed' | 'canceled';

/**
 * Los tipos de fila que son un MENSAJE para el cliente.
 *
 * La misma cola lleva además ACCIONES (`delete`, `reaction`, `edit`,
 * `read`, `unread`): cosas que el proceso del agente ejecuta contra
 * WhatsApp y que no le muestran ningún mensaje al cliente. Comparten la
 * cola a propósito -- así comparten los reintentos, el freno de salida y
 * el registro de fallos -- pero el hilo tiene que poder distinguirlas.
 *
 * Sin este filtro, cada vez que se abre un chat sin leer aparecería al
 * final del hilo una burbuja verde VACÍA que dice "En cola" con un botón
 * de cancelar al lado: la fila de "marcar leído" dibujada como si fuera un
 * mensaje que le va a llegar al cliente.
 */
export const KINDS_MENSAJE: OutboxKind[] = ['text', 'image', 'video', 'document', 'audio'];

/** Lo máximo que WhatsApp acepta por archivo sin partirlo. */
export const MAX_ADJUNTO_MB = 16;

export interface AdjuntoSubido {
    url: string;
    mime: string;
    filename: string;
    kind: OutboxKind;
    /** Tamaño real, para poder mostrarlo antes de enviar. */
    bytes: number;
}

/** Fila de `agent_outbox` tal como la muestra el hilo del chat. */
export interface MensajeEnCola {
    id: number;
    conversation_id: number;
    body: string | null;
    kind: OutboxKind;
    media_url: string | null;
    media_filename: string | null;
    product_id: number | null;
    status: OutboxStatus;
    error: string | null;
    intentos: number;
    created_at: string;
    sent_at: string | null;
    sent_message_id: number | null;
}

export const CAMPOS_COLA =
    'id, conversation_id, body, kind, media_url, media_filename, product_id, status, error, intentos, created_at, sent_at, sent_message_id';

/**
 * Qué tipo de mensaje de WhatsApp corresponde a un archivo.
 *
 * Todo lo que no sea imagen o video va como documento: mandar un PDF como
 * si fuera imagen lo deja ilegible del lado del cliente.
 */
export function tipoDeArchivo(mime: string): OutboxKind {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    // El audio va como audio y no como documento: así WhatsApp lo
    // reproduce en el chat en vez de mostrarlo como un archivo a descargar.
    if (mime.startsWith('audio/')) return 'audio';
    return 'document';
}

/** Nombre de archivo seguro para una ruta de Storage. */
function nombreSeguro(nombre: string): string {
    return nombre
        .normalize('NFD')
        // ̀-ͯ: las tildes que quedan sueltas al descomponer con NFD.
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(-60);
}

/**
 * Sube el archivo al bucket del chat y devuelve su URL pública.
 *
 * Pública y no firmada a propósito: el que descarga la foto para mandarla
 * es WhatsApp, no el ERP, y una URL firmada que vence rompe el envío si el
 * mensaje se queda un rato en la cola.
 */
export async function subirAdjunto(file: File): Promise<AdjuntoSubido> {
    if (file.size > MAX_ADJUNTO_MB * 1024 * 1024) {
        throw new Error(`El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. WhatsApp acepta hasta ${MAX_ADJUNTO_MB} MB.`);
    }

    const mime = file.type || 'application/octet-stream';
    // Una foto pegada del portapapeles llega sin nombre ("image.png" a
    // secas o vacío); se le pone uno para que el cliente no reciba un
    // archivo llamado "blob".
    const nombre = nombreSeguro(file.name || `foto.${mime.split('/')[1] || 'jpg'}`);
    const ruta = `erp/${new Date().toISOString().slice(0, 7)}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${nombre}`;

    const { error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(ruta, file, {
        contentType: mime,
        cacheControl: '31536000',
        upsert: false,
    });
    if (error) throw error;

    const { data } = supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(ruta);
    return { url: data.publicUrl, mime, filename: nombre, kind: tipoDeArchivo(mime), bytes: file.size };
}

/**
 * Borra un adjunto que se subió pero no se llegó a enviar. Sin esto, cada
 * adjunto descartado queda ocupando el bucket para siempre.
 *
 * No lanza: que no se pueda limpiar un archivo temporal no debe romperle
 * el envío a nadie.
 */
export async function borrarAdjunto(url: string): Promise<void> {
    try {
        const marca = `/${CHAT_MEDIA_BUCKET}/`;
        const i = url.indexOf(marca);
        if (i === -1) return;
        const ruta = decodeURIComponent(url.slice(i + marca.length));
        await supabase.storage.from(CHAT_MEDIA_BUCKET).remove([ruta]);
    } catch (err) {
        console.warn('No se pudo borrar el adjunto sin enviar:', err);
    }
}

export interface NuevoMensaje {
    conversationId: number;
    body?: string | null;
    kind?: OutboxKind;
    mediaUrl?: string | null;
    mediaMime?: string | null;
    mediaFilename?: string | null;
    productId?: number | null;
    /**
     * Nota de voz grabada, no un archivo de audio adjunto. WhatsApp las
     * muestra distinto: la nota sale con la onda y se escucha de una.
     */
    isVoiceNote?: boolean;
    /**
     * Mensaje que se está citando. WhatsApp dibuja la tarjetita arriba de
     * la respuesta -- necesario cuando el cliente mandó cinco mensajes
     * seguidos y hay que contestar el tercero.
     */
    replyToWaId?: string | null;
}

/**
 * Encola uno o varios mensajes. Van en un solo insert para que lleguen al
 * cliente en el orden en que se armaron: tres fotos y después el precio no
 * pueden llegar al revés.
 */
export async function encolarMensajes(mensajes: NuevoMensaje[], userId: string | null): Promise<void> {
    if (mensajes.length === 0) return;

    const filas = mensajes.map((m) => ({
        conversation_id: m.conversationId,
        body: m.body?.trim() ? m.body.trim() : null,
        kind: m.kind ?? 'text',
        media_url: m.mediaUrl ?? null,
        media_mime: m.mediaMime ?? null,
        media_filename: m.mediaFilename ?? null,
        product_id: m.productId ?? null,
        created_by: userId,
        // Las columnas nuevas solo se mandan cuando hacen falta. Llegaron
        // con las migraciones 0030 y 0031, y si esas no se aplicaron,
        // incluirlas siempre haría fallar TODO envío -- también el texto,
        // que funcionaba desde antes. Una migración pendiente no puede
        // romper lo que ya andaba.
        ...(m.isVoiceNote ? { is_voice_note: true } : {}),
        ...(m.replyToWaId ? { reply_to_wa_id: m.replyToWaId } : {}),
    }));

    const { error } = await supabase.from('agent_outbox').insert(filas);
    if (error) {
        // 42703 = falta la columna; solo puede pasar mandando una nota de voz.
        if (error.code === '42703') {
            throw new Error(
                'Para mandar notas de voz falta aplicar la migración 0030 del agente ' +
                    '(supabase/migrations/0030_agent_outbox_audio.sql).',
            );
        }
        throw error;
    }
}

/**
 * Cancela un mensaje que todavía no salió. Solo funciona mientras siga en
 * `pending`: el filtro por estado es lo que evita "cancelar" algo que el
 * agente acaba de despachar y ya está en el teléfono del cliente.
 */
export async function cancelarMensaje(id: number): Promise<boolean> {
    const { data, error } = await supabase
        .from('agent_outbox')
        .update({ status: 'canceled' })
        .eq('id', id)
        .eq('status', 'pending')
        .select('id');
    if (error) throw error;
    return (data?.length ?? 0) > 0;
}

/** Retira de la cola un mensaje fallido que la persona decide no reintentar. */
export async function descartarMensaje(id: number): Promise<boolean> {
    const { data, error } = await supabase
        .from('agent_outbox')
        .update({ status: 'canceled' })
        .eq('id', id)
        .eq('status', 'failed')
        .select('id');
    if (error) throw error;
    return (data?.length ?? 0) > 0;
}

/* -------------------------------------------------------------------------- */
/*  ACCIONES SOBRE UN MENSAJE YA ENVIADO (migración 0031)                      */
/* -------------------------------------------------------------------------- */

/**
 * Todas van por la MISMA cola que un envío: son cosas que el proceso del
 * agente tiene que ejecutar contra WhatsApp, y compartir la cola significa
 * compartir los reintentos, el freno de salida y el registro de fallos que
 * ya funcionan.
 */
async function encolarAccion(fila: Record<string, unknown>, userId: string | null): Promise<void> {
    const { error } = await supabase.from('agent_outbox').insert({ ...fila, created_by: userId });
    if (error) {
        if (error.code === '42703') {
            throw new Error(
                'Falta aplicar la migración 0031 del agente ' +
                    '(supabase/migrations/0031_agent_outbox_acciones.sql).',
            );
        }
        // 23514 = lo rechazó un CHECK. En esta tabla eso solo puede ser el
        // de `kind`: la acción existe en el código pero la migración que la
        // permite todavía no se aplicó. Sin este mensaje el error que se ve
        // es "new row violates check constraint", que no le dice a nadie
        // qué archivo hay que correr.
        if (error.code === '23514') {
            throw new Error(
                `La base todavía no acepta la acción "${String(fila.kind)}". ` +
                    'Falta aplicar la migración 0033 del agente ' +
                    '(supabase/migrations/0033_realtime_hilo_y_no_leido.sql).',
            );
        }
        throw error;
    }
}

/**
 * Borra un mensaje para todos ("eliminar para todos").
 *
 * Es la función que más importa de este grupo: se cotiza un precio
 * equivocado y el cliente ya lo tiene en el teléfono. Sin esto, lo único
 * que se puede hacer es escribir "perdón, es otro precio" y confiar en que
 * lea el segundo mensaje.
 *
 * WhatsApp solo deja borrar mensajes PROPIOS y dentro de un plazo; pasado
 * ese tiempo la acción falla y queda registrada como fallida en la cola.
 */
export async function borrarMensaje(
    conversationId: number,
    whatsappMessageId: string,
    userId: string | null,
): Promise<void> {
    await encolarAccion(
        { conversation_id: conversationId, kind: 'delete', target_wa_id: whatsappMessageId },
        userId,
    );
}

/** Corrige un mensaje de texto propio ya enviado. */
export async function editarMensaje(
    conversationId: number,
    whatsappMessageId: string,
    body: string,
    userId: string | null,
): Promise<void> {
    const texto = body.trim();
    if (!texto) throw new Error('El mensaje corregido no puede quedar vacio.');
    await encolarAccion(
        { conversation_id: conversationId, kind: 'edit', target_wa_id: whatsappMessageId, body: texto },
        userId,
    );
}

/** Pone (o quita, con emoji vacío) una reacción sobre un mensaje. */
export async function reaccionarMensaje(
    conversationId: number,
    whatsappMessageId: string,
    emoji: string,
    userId: string | null,
): Promise<void> {
    await encolarAccion(
        {
            conversation_id: conversationId,
            kind: 'reaction',
            target_wa_id: whatsappMessageId,
            reaction_emoji: emoji,
        },
        userId,
    );
}

/**
 * Marca como leídos los mensajes del cliente -- el doble tilde azul.
 *
 * Se llama al ABRIR el chat, igual que WhatsApp Web.
 *
 * Antes se hacía solo al RESPONDER, para no decirle al cliente "te leí y
 * te dejé esperando". El problema es que el conteo de no leídos NO lo
 * decide el ERP: lo espeja WhatsApp (`syncChatUnreadCounts` en el
 * agente). Apagar el contador acá sin avisarle a WhatsApp dejaba el chat
 * sin leer en el teléfono, y el siguiente `chats.update` lo devolvía a
 * pendiente -- chats atendidos que reaparecían solos en la lista.
 *
 * Leído es una sola cosa en los dos lados o no es nada.
 */
export async function marcarLeidoEnWhatsApp(conversationId: number, userId: string | null): Promise<void> {
    await encolarAccion({ conversation_id: conversationId, kind: 'read' }, userId);
}

/**
 * Deja el chat pendiente -- en el ERP y en el teléfono.
 *
 * Sirve para cuando se abre un chat sin poder atenderlo: sin esto,
 * mirarlo para saber de qué se trataba lo apagaba de la lista de
 * pendientes y quedaba enterrado entre miles.
 *
 * Va por la cola, no con un UPDATE local, por el mismo motivo que el
 * tilde azul: el contador lo devuelve WhatsApp. Escribir `unread_count`
 * a mano duraba hasta el siguiente `chats.update`, que lo volvía a poner
 * en cero -- el botón parecía no hacer nada.
 *
 * El espejo local sigue estando, pero como adelanto: la lista tiene que
 * responder al toque y no dos segundos después, cuando el agente
 * despacha la acción y WhatsApp contesta.
 */
export async function marcarNoLeido(conversationId: number, userId: string | null): Promise<void> {
    await encolarAccion({ conversation_id: conversationId, kind: 'unread' }, userId);

    // Si esto falla no se cancela nada: la orden ya está encolada y es la
    // que manda. Lo único que se pierde es el adelanto en pantalla.
    const { error } = await supabase
        .from('agent_conversations')
        .update({ unread_count: 1 })
        .eq('id', conversationId);
    if (error) console.warn('No se pudo adelantar el "sin leer" en la lista:', error.message);
}

/** Vuelve a poner en cola un mensaje que falló, con los intentos en cero. */
export async function reintentarMensaje(id: number): Promise<void> {
    const { error } = await supabase
        .from('agent_outbox')
        .update({ status: 'pending', intentos: 0, error: null })
        .eq('id', id)
        .eq('status', 'failed');
    if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/*  CATÁLOGO                                                                   */
/* -------------------------------------------------------------------------- */

/** Lo que devuelve el RPC `agent_search_products` (mismo que usa el bot). */
export interface ProductoCatalogo {
    product_id: number;
    name: string;
    sku: string;
    price: number | null;
    image_url: string | null;
    local_stock: number | null;
    importer_stock: number | null;
    importer_unavailable_override: boolean | null;
    match_confidence?: number;
    /** Fotos extra del producto (columna `gallery` de products). */
    gallery?: Array<{ url: string; type: 'image' | 'video' }> | null;
}


/**
 * Stock que de verdad se puede vender.
 *
 * `importer_unavailable_override` es la marca manual del ERP ("Agotado en
 * Importadora"): cuando está puesta, el número del proveedor ya se sabe
 * que no es confiable y no cuenta como stock. Misma regla que usa el bot
 * (`agente/src/agent/handleMessage.ts`).
 */
export function stockUtil(
    p: Pick<ProductoCatalogo, 'local_stock' | 'importer_stock' | 'importer_unavailable_override'>,
): { local: number; importador: number; hay: boolean } {
    const local = p.local_stock ?? 0;
    const importador = p.importer_unavailable_override ? 0 : (p.importer_stock ?? 0);
    return { local, importador, hay: local > 0 || importador > 0 };
}

export interface OpcionesTextoProducto {
    incluirPrecio: boolean;
    incluirDisponibilidad: boolean;
    /**
     * Precio a cotizar. Si no viene, el del catálogo redondeado.
     *
     * Se puede ajustar porque el de lista no siempre es el que se cierra:
     * un cliente que lleva varias piezas, uno que vuelve seguido, o un
     * repuesto con un detalle. Antes eso obligaba a apagar el precio y
     * escribirlo a mano dentro del texto, con lo que no quedaba registrado
     * qué se cotizó de verdad.
     */
    precio?: number;
}

/**
 * Arma el mensaje que acompaña a la foto del repuesto.
 *
 * Tuteo y sin jerga interna (nada de SKU ni de "importadora"), igual que
 * habla el agente -- ver `agente/docs/system-prompts.md`. Es solo el punto
 * de partida: quien atiende lo edita antes de enviarlo, y lo que se manda
 * es exactamente lo que quedó en pantalla.
 */
export function textoDeProducto(p: ProductoCatalogo, opciones: OpcionesTextoProducto): string {
    const lineas: string[] = [p.name];

    const precio = opciones.precio ?? (p.price != null ? precioParaCliente(p.price) : null);
    /*
        Un precio de cero NO se escribe. Un repuesto sin precio en el
        catálogo llegaba acá como 0 y el mensaje salía diciendo
        "Precio: $0.00" -- que en un chat con un cliente no es un dato
        faltante, es una oferta. Sin precio se manda el repuesto y la
        disponibilidad, y el precio lo dice quien atiende.
    */
    if (opciones.incluirPrecio && precio != null && precio > 0) {
        lineas.push(`Precio: ${formatearPrecio(precio)}`);
    }

    if (opciones.incluirDisponibilidad) {
        const { local, hay } = stockUtil(p);
        if (local > 0) lineas.push('Sí lo tenemos disponible.');
        else if (hay) lineas.push('Lo tenemos disponible, nos llega del importador.');
        else lineas.push('En este momento no lo tenemos en stock, pero te lo podemos conseguir.');
    }

    return lineas.join('\n');
}

/**
 * El catálogo abrevia siempre la posición de la pieza ("ARO DEL ..." /
 * "ARO POST ..."), pero nadie la escribe abreviada al buscar. Es la misma
 * traducción que hace el agente antes de consultar
 * (`agente/src/matching/searchProducts.ts`): sin ella, buscar "aro
 * delantero" no encuentra el aro delantero.
 */
const ABREVIATURAS: Array<[RegExp, string]> = [
    [/\bDELANTER[OA]S?\b/gi, 'DEL'],
    [/\bTRASER[OA]S?\b/gi, 'POST'],
    [/\bPOSTERIORES?\b/gi, 'POST'],
];

/**
 * Palabras que no distinguen nada: "daytona" es la marca de todo el
 * catálogo, y ningún producto se llama literalmente "repuesto". Dejarlas
 * en la consulta hace que el bonus por "contiene todas las palabras" nunca
 * se dispare y hunde el puntaje de un match real.
 */
const RUIDO = /\b(DAYTONA|REPUESTOS?|PIEZAS?|PRODUCTOS?)\b/gi;

function consultaParaCatalogo(texto: string): string {
    let salida = texto;
    for (const [patron, abreviatura] of ABREVIATURAS) salida = salida.replace(patron, abreviatura);
    salida = salida.replace(RUIDO, ' ').replace(/\s+/g, ' ').trim();
    // Si de la consulta no quedó nada (alguien buscó solo "daytona"), se
    // usa el texto original antes que mandar una búsqueda vacía.
    return salida || texto;
}

/**
 * Busca en el catálogo con el MISMO motor que usa el bot para entender al
 * cliente (RPC `agent_search_products`: alias aprendidos + pg_trgm con
 * tolerancia a errores de tipeo). Así, lo que encuentra quien atiende y lo
 * que encuentra el agente es lo mismo.
 *
 * El RPC ordena por confianza y ya filtra descontinuados e inactivos.
 */
export async function buscarEnCatalogo(termino: string, limite = 24): Promise<ProductoCatalogo[]> {
    const texto = termino.trim();
    if (texto.length < 2) return [];

    const fuzzy = consultaParaCatalogo(texto);
    const { data, error } = await supabase.rpc('agent_search_products', {
        p_query: texto,
        p_limit: limite,
        p_fuzzy_query: fuzzy,
        p_fuzzy_query_no_color: fuzzy,
    });
    if (error) throw error;

    const filas = (data ?? []) as ProductoCatalogo[];
    if (filas.length === 0) return [];

    // El RPC no devuelve la galería (el bot solo manda una foto). Acá sí
    // hace falta: quien atiende suele querer mandar dos o tres ángulos de
    // la pieza para que el cliente confirme que es la correcta.
    const ids = filas.map((f) => f.product_id);
    const { data: galerias } = await supabase.from('products').select('id, gallery').in('id', ids);
    const porId = new Map<number, ProductoCatalogo['gallery']>();
    (galerias ?? []).forEach((g: any) => porId.set(g.id, Array.isArray(g.gallery) ? g.gallery : []));

    return filas.map((f) => ({ ...f, gallery: porId.get(f.product_id) ?? [] }));
}

/**
 * Mimetype a partir de la extensión de la URL. Las fotos del catálogo son
 * URLs de Storage, no archivos que tengamos en la mano, así que el tipo
 * hay que deducirlo -- y guardar uno equivocado en la cola haría que un
 * .webp le llegue al cliente anunciado como .jpg.
 */
export function mimeDeUrl(url: string, fallback = 'image/jpeg'): string {
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
    const tipos: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        gif: 'image/gif',
        avif: 'image/avif',
        svg: 'image/svg+xml',
        mp4: 'video/mp4',
        webm: 'video/webm',
        mov: 'video/quicktime',
        mp3: 'audio/mpeg',
        m4a: 'audio/mp4',
        aac: 'audio/aac',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        opus: 'audio/ogg; codecs=opus',
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        csv: 'text/csv',
        txt: 'text/plain',
        zip: 'application/zip',
    };
    return tipos[ext] ?? fallback;
}

/**
 * Fotos disponibles de un producto, sin repetidas: la principal primero y
 * después la galería (los videos quedan afuera -- mandar un video de 20 MB
 * por WhatsApp no es lo que se está haciendo acá).
 */
export function fotosDe(p: ProductoCatalogo): string[] {
    const urls = [p.image_url, ...(p.gallery ?? []).filter((g) => g?.type !== 'video').map((g) => g?.url)];
    return [...new Set(urls.filter((u): u is string => typeof u === 'string' && u.length > 0))];
}
