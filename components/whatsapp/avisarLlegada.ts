import { supabase } from '../../supabaseClient';
import { normalizePhoneEC } from '../../utils/phone';
import {
    colaTelefono,
    crearConversacion,
    pareceLid,
    telefonoUtilizable,
} from '../../utils/conversacionesWhatsapp';
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
    /** Cuándo se le pidió abono para traerlo. `null` = nunca. */
    deposit_requested_at: string | null;
    /** Cuándo lo pagó. `null` = todavía no. */
    deposit_paid_at: string | null;
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
const CAMPOS_DEMANDA = `id, status, phone_number, customer_name, notes, created_at, stock_detected_at, deposit_requested_at, deposit_paid_at, product:products!inner(${CAMPOS_PRODUCTO})`;

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

/**
 * Y el otro caso: el repuesto NO está acá, pero la importadora lo tiene.
 *
 * A esa persona no se le puede decir "ya llegó" -- no llegó -- pero sí se
 * le puede ofrecer traerlo, que es la otra mitad del negocio. Se le pide
 * un abono para pedirlo, porque traer una pieza que después nadie retira
 * es plata inmovilizada en el mostrador.
 *
 * `local_stock` se compara contra null Y contra 0: un producto que nunca
 * pasó por la bodega tiene la columna en null, y `not.gt.0` lo dejaría
 * afuera (en SQL, `NOT (NULL > 0)` no es verdadero).
 */
const FILTRO_SOLO_IMPORTADORA =
    'and(importer_stock.gt.0,importer_unavailable_override.not.is.true,or(local_stock.is.null,local_stock.eq.0))';

/**
 * Los dos avisos que salen de una lista de espera.
 *
 *  * `llego` -- está en la bodega. Se le avisa y el pedido se archiva.
 *  * `abono` -- está en la importadora. Se le ofrece traerlo y se le pide
 *    un abono. El pedido NO se archiva: el cliente sigue esperando, y el
 *    día que el repuesto entre de verdad hay que poder avisarle.
 */
export type ModoAviso = 'llego' | 'abono';

/**
 * Cada cuánto se le puede volver a pedir el abono a quien no contestó.
 *
 * Sin esto, quien ya recibió el pedido reaparecería en la lista al día
 * siguiente y le llegaría lo mismo otra vez. Una semana es el
 * seguimiento razonable: insistir antes es hostigar, no insistir nunca es
 * perder la venta.
 */
export const DIAS_PARA_REINSISTIR = 7;

const ESTADOS_AVISABLES: EstadoAvisable[] = ['stock_available', 'pending_stock'];

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
    const faltantes = unicos.filter((t) => !salida.has(t) && colaTelefono(t).length >= 7);
    if (faltantes.length === 0) return salida;

    const porCola = new Map<string, string[]>();
    for (const tel of faltantes) {
        const c = colaTelefono(tel);
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

            const c = colaTelefono(fila.phone_number);
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
    /**
     * Cuál de los dos avisos. Cambia a quién se lista: `llego` trae lo que
     * está en la bodega; `abono`, lo que solo está en la importadora.
     * Por defecto `llego`.
     */
    modo?: ModoAviso;
}

export async function cargarPorAvisar(alcance: AlcanceAviso = {}): Promise<ListaPorAvisar> {
    const { soloTelefono, soloDemandaId, modo = 'llego' } = alcance;

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
        consulta = consulta.or(modo === 'abono' ? FILTRO_SOLO_IMPORTADORA : FILTRO_EN_BODEGA, {
            referencedTable: 'product',
        });
        if (modo === 'abono') {
            // Fuera los que YA abonaron: ese repuesto ya está encargado y
            // no hay nada más que pedirle a esa persona.
            //
            // Los que ya recibieron el pedido y todavía no pagaron SÍ se
            // quedan, aunque haya sido ayer: son los que hay que seguir. La
            // fila decide qué ofrecer -- "Pedir abono" a quien no se le
            // pidió, "Abonó" a quien está esperando pago -- y el pedido no
            // se le repite antes de la semana.
            consulta = consulta.is('deposit_paid_at', null);
        }
    }

    if (soloTelefono) {
        const c = colaTelefono(soloTelefono);
        // Igual que la ficha del cliente: `product_demands` guarda el
        // teléfono como lo escribió quien creó el pedido, así que se
        // compara por los últimos dígitos y no por igualdad.
        if (c.length >= 7) consulta = consulta.ilike('phone_number', `%${c}%`);
    }

    const { data, error } = await consulta;
    if (error) {
        // 42703 = falta la columna. Solo puede pasar con el pedido de
        // abono, que la estrena. Sin este mensaje el error que se ve es
        // "column does not exist", que no le dice a nadie qué correr.
        if (error.code === '42703') {
            throw new Error(
                'Falta aplicar la migración del pedido de abono ' +
                    '(supabase/migrations/20260827200000_product_demands_abono.sql).',
            );
        }
        throw error;
    }

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
export async function contarPorAvisar(modo: ModoAviso = 'llego'): Promise<number> {
    let consulta = supabase
        .from('product_demands')
        .select('id, product:products!inner(id)', { count: 'exact', head: true })
        .in('status', ESTADOS_AVISABLES)
        .or(modo === 'abono' ? FILTRO_SOLO_IMPORTADORA : FILTRO_EN_BODEGA, {
            referencedTable: 'product',
        });

    if (modo === 'abono') consulta = consulta.is('deposit_paid_at', null);

    const { count, error } = await consulta;
    // El contador corre al abrir la bandeja: si falta la migración del
    // abono, eso no puede romper la pantalla entera. Se devuelve 0 y el
    // modal explica qué falta cuando alguien toca el botón.
    if (error) {
        if (error.code === '42703') return 0;
        throw error;
    }
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
/**
 * Qué parte del precio se pide de abono por defecto.
 *
 * La mitad es un criterio, no una regla del negocio: cubre buena parte de
 * lo inmovilizado si el cliente después no viene, sin pedirle todo por
 * adelantado a alguien que todavía no vio la pieza. Se puede cambiar
 * antes de mandar, y lo que se manda es lo que quedó en pantalla.
 */
export const PARTE_DE_ABONO = 0.5;

/** El abono sugerido: la mitad del precio, redondeada al dólar. */
export function abonoSugerido(precio: number): number {
    return Math.ceil(precio * PARTE_DE_ABONO);
}

/**
 * El mensaje para traerlo de la importadora.
 *
 * Dice explícitamente que NO está acá y que hay que pedirlo. Prometer que
 * "ya llegó" algo que todavía viene en camino es lo que después obliga a
 * salir a dar explicaciones en el mostrador.
 *
 * No promete fecha: la del proveedor no la controlamos, y una fecha
 * inventada es peor que no dar ninguna. Quien atiende puede agregarla si
 * la sabe -- el texto se edita antes de mandar.
 */
export function textoDeAbono(
    demanda: DemandaPorAvisar,
    opciones: { incluirPrecio: boolean; precio?: number; abono?: number },
): string {
    const nombre = nombreParaSaludar(demanda.customer_name);
    const saludo = nombre ? `¡Hola ${nombre}!` : '¡Hola!';
    const lineas = [
        `${saludo} Te tenemos novedades del repuesto que estabas buscando:`,
        '',
        demanda.product?.name ?? 'el repuesto que nos pediste',
    ];

    const precio =
        opciones.precio ??
        (demanda.product?.price != null ? precioParaCliente(demanda.product.price) : null);
    if (opciones.incluirPrecio && precio != null) lineas.push(`Precio: ${formatearPrecio(precio)}`);

    lineas.push('', 'No lo tenemos en tienda, pero lo podemos pedir para vos.');

    const abono = opciones.abono ?? (precio != null ? abonoSugerido(precio) : null);
    if (abono != null) {
        lineas.push(`Para encargarlo necesitamos un abono de ${formatearPrecio(abono)}.`);
    } else {
        lineas.push('Para encargarlo necesitamos un abono.');
    }

    lineas.push('', '¿Lo pedimos?');
    return lineas.join('\n');
}

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

    // El mensaje de error se arma acá y no en el utilitario porque solo
    // desde esta pantalla tiene sentido decir dónde se corrige.
    if (!telefonoUtilizable(demanda.phone_number)) {
        throw new Error(
            `El teléfono de este pedido no parece válido ("${demanda.phone_number}"). ` +
                'Corregilo en Solicitudes antes de avisar.',
        );
    }

    return crearConversacion(demanda.phone_number, demanda.customer_name);
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
    const contar = (columna: 'notified_at' | 'deposit_requested_at') =>
        supabase
            .from('product_demands')
            .select('id', { count: 'exact', head: true })
            .gte(columna, desde);

    const [llegadas, abonos] = await Promise.all([contar('notified_at'), contar('deposit_requested_at')]);
    if (llegadas.error) throw llegadas.error;
    // Compatibilidad mientras se aplica la migracion del pedido de abono:
    // el limite anterior sigue protegiendo los avisos de llegada.
    if (abonos.error?.code === '42703') return llegadas.count ?? 0;
    if (abonos.error) throw abonos.error;
    return (llegadas.count ?? 0) + (abonos.count ?? 0);
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
 * Le pide al cliente un abono para traer el repuesto de la importadora.
 *
 * Se parece a `avisarLlegada` pero difiere en lo esencial: NO archiva el
 * pedido. El cliente sigue esperando el repuesto, y el día que entre de
 * verdad a la bodega hay que poder avisarle. Archivarlo acá lo sacaría de
 * la lista de espera y ese aviso no llegaría nunca -- justo el agujero
 * que esta pantalla vino a tapar.
 *
 * Lo que se anota es `deposit_requested_at`, que solo sirve para no
 * repetirle el pedido todos los días.
 *
 * El orden es el mismo y por el mismo motivo: primero se RESERVA con un
 * UPDATE condicional, después se encola. Si dos vendedores tocan a la vez,
 * el segundo recibe cero filas y se entera, en vez de mandar el mensaje
 * repetido.
 */
export async function solicitarAbono(params: {
    demanda: DemandaPorAvisar;
    texto: string;
    conFoto: boolean;
    userId: string | null;
}): Promise<ResultadoAviso> {
    const { demanda, texto, conFoto, userId } = params;
    if (!texto.trim()) throw new Error('No hay nada que mandar: el mensaje quedó vacío.');

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
    const desde = new Date(Date.now() - DIAS_PARA_REINSISTIR * 86400000).toISOString();

    // La reserva: solo si no se le pidió nunca, o si ya pasó la semana.
    // Es la misma condición con la que se arma la lista, así que lo que se
    // ve en pantalla y lo que la base acepta no se pueden separar.
    const { data: reservada, error: errorReserva } = await supabase
        .from('product_demands')
        .update({ deposit_requested_at: ahora, deposit_requested_by: userId, updated_at: ahora })
        .eq('id', demanda.id)
        .in('status', ['stock_available', 'pending_stock'])
        .or(`deposit_requested_at.is.null,deposit_requested_at.lt.${desde}`)
        .select('id');
    if (errorReserva) throw errorReserva;

    if (!reservada || reservada.length === 0) {
        return {
            ok: false,
            motivo: 'ya-avisado',
            detalle:
                'A este cliente ya se le pidió el abono hace poco (o el pedido dejó de estar activo). No se mandó nada.',
        };
    }

    try {
        const conversationId = await asegurarConversacion(demanda);
        const mensajes = mensajesDeAviso(demanda, conversationId, texto, conFoto);
        if (mensajes.length === 0) throw new Error('No hay nada que mandar: el mensaje quedó vacío.');
        await encolarMensajes(mensajes, userId);
    } catch (err) {
        // No salió: se borra la marca para que vuelva a la lista. Acá la
        // vuelta atrás es más simple que en `avisarLlegada` -- se limpia
        // una fecha, no se restaura un estado.
        const { error: errorVuelta } = await supabase
            .from('product_demands')
            .update({
                deposit_requested_at: demanda.deposit_requested_at,
                deposit_requested_by: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', demanda.id);
        if (errorVuelta) {
            throw new Error(
                'No se pudo encolar el pedido de abono y TAMPOCO deshacer la marca. ' +
                    `Ese cliente no va a volver a aparecer en la lista por una semana (pedido #${demanda.id}).`,
            );
        }
        throw err;
    }

    return { ok: true };
}

/**
 * A qué conversación va el requerimiento de compra.
 *
 * El grupo se guarda por su JID en `agent_settings` (migración 0034 del
 * agente) y el agente lo descubre solo con `runGroupsJob`. Devuelve
 * `null` cuando todavía no hay grupo elegido o el agente no lo
 * sincronizó: eso NO es un error, es que el aviso al grupo no va a salir.
 */
async function conversacionDelGrupo(): Promise<{ id: number; nombre: string | null } | null> {
    const { data: ajustes, error } = await supabase
        .from('agent_settings')
        .select('requirements_group_jid, requirements_group_name')
        .eq('id', 1)
        .maybeSingle();
    if (error || !ajustes?.requirements_group_jid) return null;

    const { data: conv } = await supabase
        .from('agent_conversations')
        .select('id')
        .eq('chat_jid', ajustes.requirements_group_jid)
        .maybeSingle();
    if (!conv?.id) return null;
    return { id: conv.id, nombre: ajustes.requirements_group_name ?? null };
}

/**
 * El requerimiento que se manda al grupo de compras.
 *
 * Va al equipo, no al cliente, así que acá SÍ corresponde la jerga
 * interna: el SKU es lo que se usa para pedirle al proveedor, y el número
 * de solicitud es por dónde se sigue el caso en el ERP.
 */
function textoDeRequerimiento(demanda: DemandaPorAvisar, monto: number): string {
    const p = demanda.product;
    const precio = p?.price != null ? precioParaCliente(p.price) : null;
    const lineas = [
        '*PEDIDO PARA ENCARGAR*',
        '',
        p?.name ?? 'Repuesto sin vincular',
    ];
    if (p?.sku) lineas.push(`Código: ${p.sku}`);
    lineas.push(
        `Cliente: ${demanda.customer_name?.trim() || 'sin nombre'} (${demanda.phone_number})`,
        `Abonó: ${formatearPrecio(monto)}${precio != null ? ` de ${formatearPrecio(precio)}` : ''}`,
        '',
        `Solicitud #${demanda.id}`,
    );
    return lineas.join('\n');
}

/**
 * Registra que el cliente ABONÓ y avisa al grupo de compras.
 *
 * El aviso al grupo es lo que convierte esto en un flujo cerrado: alguien
 * paga en el mostrador o manda el comprobante, y quien compra se entera en
 * el momento, sin que nadie tenga que acordarse de contarlo.
 *
 * Una diferencia importante con el resto de este módulo: si el aviso al
 * grupo falla, el pago NO se deshace. En todos los otros casos la vuelta
 * atrás es correcta porque lo único que se perdía era una fila; acá lo que
 * está registrado es que un cliente entregó plata, y eso pasó de verdad.
 * Borrarlo porque no salió un mensaje sería falsear la caja. Se devuelve
 * `ok` con el problema anotado, para que quien atiende avise a mano.
 */
export async function registrarAbonoPagado(params: {
    demanda: DemandaPorAvisar;
    monto: number;
    userId: string | null;
}): Promise<ResultadoAviso> {
    const { demanda, monto, userId } = params;
    if (!(monto > 0)) throw new Error('El monto del abono tiene que ser mayor que cero.');

    const ahora = new Date().toISOString();
    const { data: reservada, error } = await supabase
        .from('product_demands')
        .update({
            deposit_paid_at: ahora,
            deposit_paid_amount: monto,
            deposit_paid_by: userId,
            updated_at: ahora,
        })
        .eq('id', demanda.id)
        // Solo si no estaba ya cobrado: si dos personas lo marcan a la vez,
        // el segundo se entera en vez de mandar el requerimiento repetido y
        // que el repuesto se encargue dos veces.
        .is('deposit_paid_at', null)
        .select('id');
    if (error) {
        if (error.code === '42703') {
            throw new Error(
                'Falta aplicar la migración del abono pagado ' +
                    '(supabase/migrations/20260827210000_abono_pagado.sql).',
            );
        }
        throw error;
    }
    if (!reservada || reservada.length === 0) {
        return {
            ok: false,
            motivo: 'ya-avisado',
            detalle: 'Ese abono ya estaba registrado por otra persona. No se mandó el pedido de nuevo.',
        };
    }

    // El aviso al grupo, que es el punto de todo esto.
    try {
        const grupo = await conversacionDelGrupo();
        if (!grupo) {
            return {
                ok: true,
                detalle:
                    'Abono registrado, pero NO se avisó a ningún grupo: todavía no hay un grupo de ' +
                    'requerimientos configurado (o el agente no lo sincronizó). Avisá a compras a mano.',
            };
        }
        await encolarMensajes(
            [{ conversationId: grupo.id, body: textoDeRequerimiento(demanda, monto), kind: 'text' }],
            userId,
        );
        return { ok: true, detalle: `Abono registrado y pedido enviado a "${grupo.nombre ?? 'el grupo'}".` };
    } catch (err) {
        const detalle = err instanceof Error ? err.message : String(err);
        return {
            ok: true,
            detalle:
                `Abono registrado, pero NO se pudo avisar al grupo (${detalle}). ` +
                'Avisá a compras a mano para que el repuesto se encargue.',
        };
    }
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
