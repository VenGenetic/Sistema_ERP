import { supabase } from '../../supabaseClient';
import { normalizePhoneEC } from '../../utils/phone';
import {
    encolarMensajes,
    formatearPrecio,
    mimeDeUrl,
    precioParaCliente,
    type NuevoMensaje,
} from '../../utils/whatsappOutbox';

/**
 * Avisarle al cliente que YA LLEGÓ el repuesto que estaba esperando.
 *
 * Es la otra mitad de "Anotar un pedido" (RegistrarPedidoModal): ahí se
 * apunta a quién hay que avisarle, acá se le avisa. Sin esta mitad la
 * lista de espera es un cementerio -- el repuesto llega, nadie se entera y
 * el cliente ya lo compró en otro lado.
 *
 * Sale por la cola del agente (`agent_outbox`), NO por un link de wa.me
 * como hace la pantalla de Solicitudes. La diferencia no es de comodidad:
 * un wa.me abre WhatsApp Web y el mensaje se escribe desde el teléfono, y
 * lo que se escribe ahí le llega cifrado al agente y nunca queda
 * registrado. El aviso que sale por la cola queda en el hilo, así el que
 * atiende la respuesta del cliente ve qué se le dijo y cuándo.
 *
 * La regla de precio NO se reescribe acá: se reusa `precioParaCliente` de
 * `whatsappOutbox`, que a su vez espeja la del bot. Un aviso que cotice
 * distinto que el bot es un cliente que reclama.
 *
 * La de stock sí es propia y más estricta que la del bot: para AVISAR hace
 * falta tenerlo en la bodega (ver `FILTRO_EN_BODEGA`).
 */

export interface ProductoDeAviso {
    id: number;
    name: string;
    sku: string;
    price: number | null;
    image_url: string | null;
    local_stock: number | null;
    importer_stock: number | null;
    importer_unavailable_override: boolean | null;
}

/** Los estados desde los que tiene sentido avisar. */
export type EstadoAvisable = 'stock_available' | 'pending_stock';

export interface DemandaPorAvisar {
    id: number;
    status: EstadoAvisable;
    phone_number: string;
    customer_name: string | null;
    notes: string | null;
    created_at: string;
    stock_detected_at: string | null;
    product: ProductoDeAviso | null;
    /**
     * El chat por el que sale el aviso. `null` significa que ese número
     * nunca escribió al WhatsApp del negocio: no hay conversación y no
     * hay por dónde encolar nada.
     */
    conversationId: number | null;
    /**
     * `true` cuando el pedido seguía en "esperando stock" pero el
     * repuesto SÍ tiene stock hoy.
     *
     * Pasa de verdad: el disparador que marca `stock_available` solo
     * corre en un UPDATE de `products.local_stock`/`importer_stock`, así
     * que un producto creado ya con stock, o una carga que toque el stock
     * por otro camino, deja al cliente esperando para siempre sin que
     * nadie lo vea. Estos son justamente los que se pierden.
     */
    noMarcada: boolean;
}

/** Cuántos pedidos se traen por lote. */
const TOPE = 400;

const CAMPOS_PRODUCTO =
    'id, name, sku, price, image_url, local_stock, importer_stock, importer_unavailable_override';

/**
 * `!inner` no es decorativo: hace que el filtro de stock de más abajo
 * descarte PEDIDOS y no solo el producto embebido. Sin él, la consulta
 * devolvería todos los pedidos con el producto en `null`.
 */
const CAMPOS_DEMANDA = `id, status, phone_number, customer_name, notes, created_at, stock_detected_at, product:products!inner(${CAMPOS_PRODUCTO})`;

/**
 * QUÉ ES "por avisar", en un solo lugar.
 *
 * Un pedido activo cuyo repuesto está EN LA BODEGA. Nada más.
 *
 * El stock de la importadora no cuenta, aunque el repuesto exista y esté
 * en camino: avisarle a alguien "ya llegó lo que pediste" cuando todavía
 * no lo tenemos en la mano es prometer una fecha que no controlamos. El
 * cliente viene al mostrador y no está. Un aviso que hay que salir a
 * explicar es peor que no haber avisado.
 *
 * Por eso tampoco hace falta mirar `importer_unavailable_override` acá:
 * esa marca solo corrige el número del proveedor, y el número del
 * proveedor ya no entra en esta cuenta.
 *
 * Vive en una constante y no repetida en cada consulta porque el contador
 * del botón y la lista del modal TIENEN que decir lo mismo. Cuando esas
 * dos cosas se escriben por separado se separan: es exactamente lo que
 * pasaba en la pantalla de Solicitudes, donde la tarjeta decía "141 listos
 * para notificar" y al tocarla no salía ni un cliente.
 */
const FILTRO_EN_BODEGA = 'local_stock.gt.0';

const ESTADOS_AVISABLES: EstadoAvisable[] = ['stock_available', 'pending_stock'];

/** Los últimos 9 dígitos: el número local, sin el 0 ni el código de país. */
function cola(numero: string): string {
    return numero.replace(/\D/g, '').slice(-9);
}

/**
 * Un LID de WhatsApp es un identificador interno, no un teléfono. Se
 * distingue por el largo, mismo criterio que usa el agente
 * (`agente/src/utils/phone.ts`): los teléfonos con código de país llegan a
 * 13 dígitos como mucho, los LIDs son de 14-15.
 *
 * Importa acá porque la búsqueda por cola compara los últimos 9 dígitos, y
 * sin este filtro un LID podría "coincidir" con el teléfono de otra
 * persona -- y el aviso saldría al chat equivocado.
 */
function pareceLid(numero: string): boolean {
    return numero.replace(/\D/g, '').length > 13;
}

interface FilaConversacion {
    id: number;
    phone_number: string;
    last_message_at: string | null;
}

/**
 * A qué conversación pertenece cada teléfono.
 *
 * Va en dos pasadas porque los números están guardados de dos maneras
 * distintas: `agent_conversations` guarda solo dígitos tal como los
 * entrega WhatsApp (`593…`, migración 0021), pero `product_demands` guarda
 * el teléfono como lo escribió quien creó el pedido -- con espacios, con
 * `+593`, con el 0 adelante o pelado.
 *
 *  1. Coincidencia exacta contra el número normalizado. Cubre casi todo y
 *     es una sola consulta.
 *  2. Para los que no aparecieron, coincidencia por los últimos 9 dígitos.
 *
 * Devuelve un mapa con la clave TAL CUAL vino en el pedido, para que quien
 * llama no tenga que volver a normalizar.
 */
async function resolverConversaciones(telefonos: string[]): Promise<Map<string, number>> {
    const salida = new Map<string, number>();
    const unicos = [...new Set(telefonos.filter((t) => t && t.trim()))];
    if (unicos.length === 0) return salida;

    // --- 1) Exacta -----------------------------------------------------
    const porNormalizado = new Map<string, string[]>();
    for (const tel of unicos) {
        const norm = normalizePhoneEC(tel);
        if (!norm) continue;
        const lista = porNormalizado.get(norm);
        if (lista) lista.push(tel);
        else porNormalizado.set(norm, [tel]);
    }

    const normalizados = [...porNormalizado.keys()];
    for (let i = 0; i < normalizados.length; i += 200) {
        const lote = normalizados.slice(i, i + 200);
        const { data, error } = await supabase
            .from('agent_conversations')
            .select('id, phone_number, last_message_at')
            .in('phone_number', lote);
        if (error) throw error;
        for (const fila of (data ?? []) as FilaConversacion[]) {
            for (const original of porNormalizado.get(fila.phone_number) ?? []) {
                salida.set(original, fila.id);
            }
        }
    }

    // --- 2) Por los últimos 9 dígitos ----------------------------------
    const faltantes = unicos.filter((t) => !salida.has(t) && cola(t).length >= 7);
    if (faltantes.length === 0) return salida;

    const porCola = new Map<string, string[]>();
    for (const tel of faltantes) {
        const c = cola(tel);
        const lista = porCola.get(c);
        if (lista) lista.push(tel);
        else porCola.set(c, [tel]);
    }

    // Actividad de cada conversación candidata, para desempatar cuando dos
    // filas terminan en los mismos 9 dígitos.
    const actividad = new Map<number, number>();

    const colas = [...porCola.keys()];
    for (let i = 0; i < colas.length; i += 50) {
        const lote = colas.slice(i, i + 50);
        // En un `.or()` el comodín es `*`, no `%`: con `%` el filtro se
        // manda literal y no coincide con nada.
        const filtro = lote.map((c) => `phone_number.like.*${c}`).join(',');
        const { data, error } = await supabase
            .from('agent_conversations')
            .select('id, phone_number, last_message_at')
            .or(filtro);
        if (error) throw error;

        for (const fila of (data ?? []) as FilaConversacion[]) {
            if (pareceLid(fila.phone_number)) continue;
            const cuando = new Date(fila.last_message_at ?? 0).getTime();
            actividad.set(fila.id, cuando);

            const c = cola(fila.phone_number);
            for (const original of porCola.get(c) ?? []) {
                // Puede haber más de una conversación terminada en los
                // mismos 9 dígitos (el mismo número guardado de dos
                // formas). Se queda la que tuvo actividad más reciente:
                // es el chat vivo, y avisar en el muerto es avisar al
                // vacío.
                const previa = salida.get(original);
                if (previa === undefined || cuando > (actividad.get(previa) ?? 0)) {
                    salida.set(original, fila.id);
                }
            }
        }
    }

    return salida;
}

export interface ListaPorAvisar {
    demandas: DemandaPorAvisar[];
    /** `true` si se llegó al tope y quedaron pedidos afuera. */
    hayMas: boolean;
}

/**
 * Los pedidos que hoy se pueden avisar.
 *
 * Van dos grupos, y el segundo es el que importa que exista:
 *
 *  * Los que el sistema ya marcó como llegados (`stock_available`).
 *  * Los que siguen en "esperando stock" pero cuyo repuesto SÍ tiene
 *    stock ahora. El disparador que marca el primero solo corre cuando
 *    se hace UPDATE del stock en `products`; todo lo que entre por otro
 *    camino deja al cliente esperando en silencio. Sin este segundo
 *    grupo, esos pedidos no los ve nadie nunca.
 *
 * `soloTelefono` limita la lista a un cliente: es lo que usa el botón
 * "Avisar" de la ficha, dentro del chat.
 */
export interface AlcanceAviso {
    /** Solo los pedidos de un cliente. */
    soloTelefono?: string;
    /**
     * Un pedido puntual, elegido a mano.
     *
     * Este alcance NO filtra por stock, a diferencia de los otros dos. Es
     * a propósito: viene del boton "Notificar" de Solicitudes, que se
     * muestra en toda solicitud activa -- también en las que no tienen
     * stock. Filtrando, tocar ese botón abriría un modal vacío justo
     * cuando la persona acaba de señalar cuál queria. Que el repuesto no
     * esté se dice en la vista previa, con el aviso en rojo.
     */
    soloDemandaId?: number;
}

export async function cargarPorAvisar(alcance: AlcanceAviso = {}): Promise<ListaPorAvisar> {
    const { soloTelefono, soloDemandaId } = alcance;

    let consulta = supabase
        .from('product_demands')
        .select(CAMPOS_DEMANDA)
        .in('status', ESTADOS_AVISABLES)
        // Primero lo que se detectó llegando hace poco -- es el orden en
        // que se trabaja la cola -- y después, entre los que nunca se
        // marcaron, el que lleva más tiempo esperando: a ese es al que
        // peor le fue.
        .order('stock_detected_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: true })
        .limit(TOPE);

    if (soloDemandaId) {
        consulta = consulta.eq('id', soloDemandaId);
    } else {
        consulta = consulta.or(FILTRO_EN_BODEGA, { referencedTable: 'product' });
    }

    if (soloTelefono) {
        const c = cola(soloTelefono);
        // Igual que la ficha del cliente: `product_demands` guarda el
        // teléfono como lo escribió quien creó el pedido, así que se
        // compara por los últimos dígitos y no por igualdad.
        if (c.length >= 7) consulta = consulta.ilike('phone_number', `%${c}%`);
    }

    const { data, error } = await consulta;
    if (error) throw error;

    const crudas = ((data ?? []) as unknown as DemandaPorAvisar[]).map((d) => ({
        ...d,
        noMarcada: d.status === 'pending_stock',
    }));

    const conversaciones = await resolverConversaciones(crudas.map((d) => d.phone_number));

    return {
        demandas: crudas.map((d) => ({
            ...d,
            conversationId: conversaciones.get(d.phone_number) ?? null,
        })),
        hayMas: crudas.length >= TOPE,
    };
}

/**
 * Cuántos hay por avisar, sin traerlos.
 *
 * Es el número del botón de la bandeja. Va con `head` y `count`, así que
 * la base cuenta y no manda ni una fila: el botón está en una pantalla que
 * queda abierta todo el día y no puede costar una consulta grande.
 *
 * Usa EXACTAMENTE el mismo filtro que `cargarPorAvisar`. Si un día alguien
 * cambia uno solo de los dos, el botón va a prometer clientes que la lista
 * no muestra.
 */
export async function contarPorAvisar(): Promise<number> {
    const { count, error } = await supabase
        .from('product_demands')
        .select('id, product:products!inner(id)', { count: 'exact', head: true })
        .in('status', ESTADOS_AVISABLES)
        .or(FILTRO_EN_BODEGA, { referencedTable: 'product' });
    if (error) throw error;
    return count ?? 0;
}

/**
 * El nombre con el que saludar, o `null` si no hay uno usable.
 *
 * Solo el PRIMER nombre: "¡Hola Juan Carlos Pérez Mendoza!" se lee como
 * una carta del banco. Y se descarta lo que WhatsApp trae como nombre
 * cuando el contacto no tiene ninguno -- el propio número -- porque
 * saludar a alguien por su teléfono es peor que no saludarlo.
 */
export function nombreParaSaludar(nombre: string | null): string | null {
    const limpio = (nombre ?? '').trim();
    if (!limpio) return null;
    const primero = limpio.split(/\s+/)[0];
    if (!primero) return null;
    // Un "nombre" que es casi todo dígitos es el número, o un apodo que no
    // sirve para saludar ("593", "+593 99...").
    const digitos = primero.replace(/\D/g, '').length;
    if (digitos > 0 && digitos >= primero.length - 2) return null;
    return primero;
}

export interface OpcionesTexto {
    /** El precio va salvo que se lo apague: cotizar es la mitad del aviso. */
    incluirPrecio: boolean;
    /** Precio a cotizar. Si no viene, el de lista redondeado. */
    precio?: number;
}

/**
 * El aviso que se le manda al cliente.
 *
 * Tuteo y sin jerga interna -- nada de SKU ni de "importadora" -- igual
 * que habla el agente (`agente/docs/system-prompts.md`). Es solo el punto
 * de partida: quien avisa lo edita antes de mandarlo, y lo que sale es
 * exactamente lo que quedó en pantalla.
 */
export function textoDeAviso(demanda: DemandaPorAvisar, opciones: OpcionesTexto): string {
    const nombre = nombreParaSaludar(demanda.customer_name);
    const saludo = nombre ? `¡Hola ${nombre}!` : '¡Hola!';
    const lineas = [`${saludo} Ya llegó el repuesto que estabas esperando:`, ''];

    lineas.push(demanda.product?.name ?? 'el repuesto que nos pediste');

    const precio =
        opciones.precio ??
        (demanda.product?.price != null ? precioParaCliente(demanda.product.price) : null);
    if (opciones.incluirPrecio && precio != null) lineas.push(`Precio: ${formatearPrecio(precio)}`);

    lineas.push('', '¿Te lo separo?');
    return lineas.join('\n');
}

/**
 * Traduce el aviso a mensajes de WhatsApp.
 *
 * Con foto, el texto va como epígrafe de la foto y no como un mensaje
 * aparte: el cliente ve la pieza y el precio juntos, que es lo que le
 * permite contestar "sí, mándamelo" sin más vueltas.
 */
export function mensajesDeAviso(
    demanda: DemandaPorAvisar,
    conversationId: number,
    texto: string,
    conFoto: boolean,
): NuevoMensaje[] {
    const cuerpo = texto.trim();
    if (!cuerpo) return [];

    const foto = conFoto ? demanda.product?.image_url ?? null : null;
    if (!foto) {
        return [{ conversationId, body: cuerpo, kind: 'text', productId: demanda.product?.id ?? null }];
    }

    const mime = mimeDeUrl(foto);
    return [
        {
            conversationId,
            body: cuerpo,
            kind: 'image',
            mediaUrl: foto,
            mediaMime: mime,
            mediaFilename: `${demanda.product?.sku ?? 'repuesto'}.${mime.split('/')[1]}`,
            productId: demanda.product?.id ?? null,
        },
    ];
}

/**
 * Un objeto con campos opcionales y no una unión discriminada
 * (`{ok:true} | {ok:false, detalle}`), que sería lo natural: este proyecto
 * compila sin `strict`, y sin `strictNullChecks` TypeScript no estrecha
 * uniones por un discriminante booleano -- leer `resultado.detalle` dentro
 * de un `if (!resultado.ok)` no compila.
 */
/**
 * La conversación por la que va a salir el aviso, abriéndola si no existe.
 *
 * La mayoría de los pedidos se cargan a mano desde Solicitudes, con el
 * teléfono de un cliente de mostrador: esa persona puede no haberle
 * escrito nunca al WhatsApp del negocio, y entonces no hay conversación
 * ni, por lo tanto, `conversation_id` con el que encolar. Medido sobre
 * los datos reales: 124 de 134 pedidos listos para avisar. O sea, casi
 * todos.
 *
 * Abrir la conversación acá es lo que destraba esos avisos. WhatsApp no
 * impone ninguna ventana de tiempo para escribir primero -- eso es de la
 * API Business de Meta, no de esta vía -- así que se le puede escribir
 * igual que desde el teléfono.
 *
 * Lo que NO se comprueba acá es que el número tenga WhatsApp: el
 * navegador no tiene la sesión. Eso lo hace el agente al despachar
 * (`confirmarNumeroEnWhatsApp`), y si el número no existe marca la fila
 * como fallida con el motivo en vez de dar por enviado algo que nunca
 * salió.
 */
async function asegurarConversacion(demanda: DemandaPorAvisar): Promise<number> {
    if (demanda.conversationId) return demanda.conversationId;

    const numero = normalizePhoneEC(demanda.phone_number);
    // Un teléfono ecuatoriano normalizado son 12 dígitos (593 + 9). Se
    // exige un mínimo para no abrir un chat contra un número recortado, y
    // un máximo porque más de 13 dígitos ya no es un teléfono sino un LID.
    if (numero.length < 10 || numero.length > 13) {
        throw new Error(
            `El teléfono de este pedido no parece válido ("${demanda.phone_number}"). ` +
                'Corregilo en Solicitudes antes de avisar.',
        );
    }

    const { data, error } = await supabase
        .from('agent_conversations')
        .insert({
            phone_number: numero,
            customer_name: demanda.customer_name?.trim() || null,
            // La abre una persona para escribir, no el bot. `bot_enabled`
            // ya viene en false por defecto (migración 0017); el estado se
            // pone acorde para que la bandeja no lo muestre como un chat
            // que el agente está atendiendo solo.
            status: 'human_active',
        })
        .select('id')
        .maybeSingle();

    if (!error && data?.id) return data.id;

    // 23505 = ya existía (`phone_number` es UNIQUE). Pasa si dos personas
    // avisan a la vez, o si el cliente escribió entre que se cargó la
    // lista y se tocó el botón. No es un fallo: hay que usar la que está.
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
 * Cuántos avisos se pueden mandar por hora.
 *
 * No es un límite de WhatsApp -- para una cuenta que no es Business no
 * hay ninguno publicado. Es una decisión nuestra, y el número es un
 * criterio y no una verdad: 25 por hora permite vaciar una lista de
 * espera de cien en media jornada sin que el patrón se parezca al de un
 * bot.
 *
 * Por qué existe: avisar es escribirle POR PRIMERA VEZ a gente que nunca
 * le escribió al negocio. Cien primeros contactos en dos minutos es justo
 * lo que Meta marca como spam, y lo que se pierde no son los mensajes: es
 * el número del negocio.
 *
 * Del lado del agente hay una segunda defensa independiente de esta: la
 * cola toma ritmo entre envíos (`humanDelay` en outboxJob). Esta frena la
 * tanda; aquella espacia lo que ya salió.
 */
export const AVISOS_POR_HORA = 25;

/**
 * Cuántos avisos se mandaron en la última hora.
 *
 * Cuenta `notified_at`, que escriben tanto el aviso como el "marcar
 * avisado sin mandar". Contar de más en ese segundo caso es a propósito:
 * ante la duda, frenar antes. Es un caso raro y el error cae del lado
 * seguro.
 */
export async function contarAvisosRecientes(): Promise<number> {
    const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
        .from('product_demands')
        .select('id', { count: 'exact', head: true })
        .gte('notified_at', desde);
    if (error) throw error;
    return count ?? 0;
}

export interface ResultadoAviso {
    ok: boolean;
    /** Por qué no se hizo. Solo viene cuando `ok` es false. */
    motivo?: 'ya-avisado' | 'tope-por-hora';
    detalle?: string;
}

/**
 * Manda el aviso y archiva el pedido, en ese orden y sin dejar huecos.
 *
 * El orden es lo delicado de toda esta función:
 *
 *  * Si se encolara primero y se marcara después, un fallo al marcar
 *    dejaría el pedido a la vista de todos como "por avisar" con el aviso
 *    ya en camino -- y el siguiente que abra la pantalla se lo manda de
 *    nuevo. Dos avisos del mismo repuesto al mismo cliente.
 *  * Marcando primero, el UPDATE con `.in('status', …)` es la reserva: la
 *    base decide quién se lo queda. Si dos personas tocan "Avisar" a la
 *    vez -- que en un mostrador con tres vendedores pasa -- la segunda
 *    recibe cero filas y se entera de que ya estaba avisado, en vez de
 *    mandar el mensaje repetido.
 *
 * Lo que sí puede pasar marcando primero es quedar marcado sin haber
 * mandado nada, y por eso el fallo al encolar DEVUELVE el pedido a su
 * estado anterior. Ese es el único caso reversible de los dos: un mensaje
 * enviado no se puede volver atrás, una fila sí.
 *
 * Por lo mismo, la conversación se abre DESPUÉS de la reserva y no antes:
 * si se abriera primero y el pedido resultara ya avisado por otro, habría
 * quedado un chat vacío en la bandeja por nada.
 *
 * Recibe el texto y no los mensajes ya armados porque el `conversation_id`
 * recién se conoce acá dentro, cuando la conversación existe.
 */
export async function avisarLlegada(params: {
    demanda: DemandaPorAvisar;
    texto: string;
    conFoto: boolean;
    userId: string | null;
}): Promise<ResultadoAviso> {
    const { demanda, texto, conFoto, userId } = params;
    if (!texto.trim()) throw new Error('No hay nada que mandar: el mensaje quedó vacío.');

    // El tope se comprueba ANTES de reservar: si se reservara primero
    // habría que devolver el pedido a la lista solo por haber llegado al
    // límite, y una vuelta atrás que se puede evitar es una vuelta atrás
    // que puede fallar.
    const recientes = await contarAvisosRecientes();
    if (recientes >= AVISOS_POR_HORA) {
        return {
            ok: false,
            motivo: 'tope-por-hora',
            detalle:
                `Ya se mandaron ${recientes} avisos en la última hora, que es el tope. ` +
                'Seguí más tarde: mandarle a mucha gente que nunca escribió, toda junta, ' +
                'es lo que hace que WhatsApp bloquee el número del negocio.',
        };
    }

    const ahora = new Date().toISOString();
    const { data: reservada, error: errorReserva } = await supabase
        .from('product_demands')
        .update({ status: 'notified', notified_at: ahora, notified_by: userId, updated_at: ahora })
        .eq('id', demanda.id)
        // Solo desde donde tiene sentido avisar. Es lo que impide pisar un
        // pedido que mientras tanto alguien canceló o ya avisó.
        .in('status', ['stock_available', 'pending_stock'])
        .select('id');
    if (errorReserva) throw errorReserva;

    if (!reservada || reservada.length === 0) {
        return {
            ok: false,
            motivo: 'ya-avisado',
            detalle:
                'Alguien más ya avisó este pedido (o lo canceló) mientras estaba abierto acá. No se mandó nada.',
        };
    }

    try {
        // Abre el chat si este número nunca escribió. El agente confirma
        // que el número exista en WhatsApp antes de mandar nada.
        const conversationId = await asegurarConversacion(demanda);
        const mensajes = mensajesDeAviso(demanda, conversationId, texto, conFoto);
        if (mensajes.length === 0) throw new Error('No hay nada que mandar: el mensaje quedó vacío.');
        await encolarMensajes(mensajes, userId);
    } catch (err) {
        // El aviso no salió, así que el pedido no puede quedar archivado:
        // volvería a caer en el olvido, que es justo lo que esta pantalla
        // viene a arreglar.
        const { error: errorVuelta } = await supabase
            .from('product_demands')
            .update({
                status: demanda.status,
                notified_at: null,
                notified_by: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', demanda.id);
        if (errorVuelta) {
            // Peor caso: no salió el aviso Y quedó marcado como avisado.
            // Tiene que decirse con todas las letras, porque el cliente se
            // queda esperando y nadie lo va a ver en la lista.
            throw new Error(
                `No se pudo encolar el aviso y TAMPOCO devolver el pedido a la lista. ` +
                    `Marcalo a mano como "esperando stock" en Solicitudes (pedido #${demanda.id}).`,
            );
        }
        throw err;
    }

    return { ok: true };
}

/**
 * Archiva el pedido SIN mandar nada por la bandeja.
 *
 * Es para el número que nunca escribió al WhatsApp del negocio: no hay
 * conversación por la que encolar, así que se le avisa por fuera (o ya se
 * le avisó por teléfono) y acá solo queda constancia. Se separa de
 * `avisarLlegada` a propósito: son dos cosas distintas y confundirlas
 * haría creer que salió un mensaje que nunca salió.
 */
export async function marcarAvisadoSinMensaje(
    demanda: DemandaPorAvisar,
    userId: string | null,
): Promise<ResultadoAviso> {
    const ahora = new Date().toISOString();
    const { data, error } = await supabase
        .from('product_demands')
        .update({ status: 'notified', notified_at: ahora, notified_by: userId, updated_at: ahora })
        .eq('id', demanda.id)
        .in('status', ['stock_available', 'pending_stock'])
        .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
        return { ok: false, motivo: 'ya-avisado', detalle: 'Ese pedido ya lo archivó alguien más.' };
    }
    return { ok: true };
}
