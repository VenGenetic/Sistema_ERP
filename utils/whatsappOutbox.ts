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

/** Bucket público con la media del chat (migración 0026). */
export const CHAT_MEDIA_BUCKET = 'agent_chat_media';

export type OutboxKind = 'text' | 'image' | 'video' | 'document';
export type OutboxStatus = 'pending' | 'sent' | 'failed' | 'canceled';

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
    }));

    const { error } = await supabase.from('agent_outbox').insert(filas);
    if (error) throw error;
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
 * El precio que se le dice al cliente: redondeado hacia ARRIBA al dólar
 * entero. Es la misma regla que aplica el bot (`agente/src/utils/pricing.ts`)
 * -- si acá se mostrara el precio crudo, el mismo repuesto tendría dos
 * precios distintos según quién conteste.
 */
export function precioParaCliente(price: number): number {
    return Math.ceil(price);
}

export function formatearPrecio(valor: number): string {
    return `$${valor.toFixed(2)}`;
}

/**
 * Stock que de verdad se puede vender.
 *
 * `importer_unavailable_override` es la marca manual del ERP ("Agotado en
 * Importadora"): cuando está puesta, el número del proveedor ya se sabe
 * que no es confiable y no cuenta como stock. Misma regla que usa el bot
 * (`agente/src/agent/handleMessage.ts`).
 */
export function stockUtil(p: ProductoCatalogo): { local: number; importador: number; hay: boolean } {
    const local = p.local_stock ?? 0;
    const importador = p.importer_unavailable_override ? 0 : (p.importer_stock ?? 0);
    return { local, importador, hay: local > 0 || importador > 0 };
}

export interface OpcionesTextoProducto {
    incluirPrecio: boolean;
    incluirDisponibilidad: boolean;
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

    if (opciones.incluirPrecio && p.price != null) {
        lineas.push(`Precio: ${formatearPrecio(precioParaCliente(p.price))}`);
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
export function mimeDeUrl(url: string): string {
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
    const tipos: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        gif: 'image/gif',
    };
    return tipos[ext] ?? 'image/jpeg';
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
