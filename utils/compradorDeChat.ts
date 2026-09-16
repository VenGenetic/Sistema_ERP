/**
 * El comprador que viene de un chat de WhatsApp, atado a la venta del POS.
 *
 * EL PROBLEMA QUE RESUELVE
 * ------------------------
 * Las 312 ventas del ERP están todas contra "CONSUMIDOR FINAL", que no tiene
 * teléfono. Eso deja al negocio sin poder responder la pregunta más cara que
 * tiene: ¿esta venta salió de un anuncio?
 *
 * No es un problema de los anuncios. Aunque el agente capture perfecto el id de
 * clic de Google y de Meta, la venta no se puede emparejar con nadie: no hay con
 * qué. El identificador se ata a un teléfono, y el teléfono no llega a la orden.
 *
 * Donde más barato se arregla es acá: cuando la venta nace de una conversación,
 * el número YA se conoce. Sólo hay que no perderlo al pasar al POS.
 *
 * Busca al cliente por teléfono y, si no existe, lo crea. Nunca pisa un cliente
 * que el vendedor haya elegido a mano, y nunca falla la venta: si algo sale mal
 * se sigue con CONSUMIDOR FINAL, igual que antes. Cobrar siempre importa más que
 * atribuir.
 */
import { supabase } from '../supabaseClient';
import { Customer, defaultConsumidorFinal } from '../store/cartStore';

/**
 * Un teléfono de verdad no es cualquier ristra de dígitos.
 *
 * En `agent_conversations.phone_number` conviven tres cosas distintas que se
 * parecen entre sí:
 *
 *   teléfono   0982901125 / 593982901125 -- una persona a la que se le puede
 *              vender y a la que se le puede atribuir una venta.
 *   LID        51334019559612 -- el identificador interno de WhatsApp cuando
 *              el cliente oculta su número. NO es un teléfono: nadie puede
 *              llamar ahí ni emparejarlo con un anuncio.
 *   grupo      120363427643222829 -- los dígitos del JID de un grupo de
 *              trabajo. Detrás no hay un cliente, hay varias personas.
 *
 * Tratarlos igual crea CLIENTES FANTASMA: fichas con nombre «WhatsApp -
 * 51334019559612» y un teléfono que no existe, que además ensucian la
 * atribución publicitaria porque se envían como identificador a Meta y Google.
 *
 * El criterio de LID es el MISMO que ya usa la bandeja para decidir si muestra
 * «ID interno» en vez de un número (`formatPhone` en WhatsAppInbox.tsx:
 * `digits.length > 13`). Se repite a propósito: si un día la bandeja lo
 * cambia, esto tiene que cambiar con ella, y el comentario lo dice.
 */
const PREFIJO_DE_GRUPO = '120363';

/** ¿Estos dígitos son en realidad un grupo de WhatsApp? */
export function pareceGrupo(digitos: string): boolean {
    return digitos.startsWith(PREFIJO_DE_GRUPO) || digitos.length >= 16;
}

/** ¿Y un identificador interno de WhatsApp en vez de un número? */
export function pareceLid(digitos: string, lid?: string | null): boolean {
    if (lid && digitos === String(lid).replace(/\D/g, '')) return true;
    // Un teléfono ecuatoriano en E.164 son 12 dígitos; el más largo del mundo,
    // 15. Por encima de 13 en este negocio siempre ha sido un LID.
    return digitos.length > 13;
}

/**
 * Teléfono a E.164 sin '+', igual que lo normalizan los envíos a Meta y a
 * Google (`scripts/atribucion/ventas.js`). Si los dos lados no normalizan
 * igual, el mismo cliente entra dos veces y la atribución se parte.
 *
 * Devuelve `null` para LIDs, grupos y cualquier cosa que no sea un número al
 * que se le pueda vender. `lid` es opcional: cuando se conoce (viene en la
 * conversación) el descarte es exacto en vez de por longitud.
 */
export function telefonoNormalizado(
    tel: string | null | undefined,
    lid?: string | null,
): string | null {
    if (!tel) return null;
    let d = String(tel).replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);

    // Se descarta ANTES de normalizar: aplicarle el prefijo de Ecuador a un
    // LID produciría un número inventado con pinta de válido.
    if (pareceGrupo(d) || pareceLid(d, lid)) return null;

    if (d.length === 10 && d.startsWith('0')) d = '593' + d.slice(1);
    else if (d.length === 9 && d.startsWith('9')) d = '593' + d;
    return d.length >= 10 && d.length <= 13 ? d : null;
}

/**
 * El cliente del ERP que corresponde a este teléfono, creándolo si hace falta.
 *
 * Devuelve `null` cuando no se puede resolver, y quien llama sigue con el
 * consumidor final. Una venta sin atribuir es un problema; una venta que no se
 * puede cobrar es otro mucho peor.
 */
export async function buscarOCrearComprador(
    telefono: string | null | undefined,
    nombre?: string | null,
    lid?: string | null,
): Promise<Customer | null> {
    // Con el `lid` de la conversación el descarte es exacto; sin él,
    // `telefonoNormalizado` cae a la heurística de longitud.
    const tel = telefonoNormalizado(telefono, lid);
    if (!tel) return null;

    // Los chats viejos crearon clientes con el número sin normalizar ("0982901125"
    // en vez de "593982901125"), así que se busca por las dos formas antes de
    // crear uno nuevo y duplicar la ficha.
    const variantes = [tel];
    if (tel.startsWith('593')) variantes.push('0' + tel.slice(3));

    const { data: existentes, error: errorBusqueda } = await supabase
        .from('customers')
        .select('id, identification_number, name, email, phone, is_final_consumer, customer_type, discount_percentage, claimed_by')
        .in('phone', variantes)
        .limit(1);

    if (errorBusqueda) {
        console.warn('No se pudo buscar el comprador por teléfono:', errorBusqueda.message);
        return null;
    }
    if (existentes && existentes.length > 0) return existentes[0] as Customer;

    // `identification_number` es obligatorio y suele no conocerse en un chat.
    // El teléfono sirve de identificador provisional: es único, es el dato con
    // el que se atribuye, y se corrige cuando la persona da su cédula.
    const { data: creado, error: errorAlta } = await supabase
        .from('customers')
        .insert([{
            name: nombre?.trim() || `WhatsApp - ${tel}`,
            phone: tel,
            identification_number: tel,
            /*
                `false`, aunque no se le haya pedido la cédula todavía.

                `is_final_consumer` no significa "no tengo sus datos": marca
                al CONSUMIDOR FINAL genérico, y el ERP lo trata como tal en
                dos lugares que rompen justo lo que este archivo vino a
                arreglar. `pages/Customers.tsx:774` esconde de la lista a
                todo el que lo tenga, así que nadie podría encontrar a esta
                persona para cambiarle el teléfono provisional por su cédula
                real. Y `pages/POS.tsx:196` sólo restaura el cliente de un
                pedido guardado `if (!cust.is_final_consumer)`: guardar el
                carrito como borrador y volver a abrirlo lo devolvía a
                CONSUMIDOR FINAL, perdiendo la atribución entera.

                Es además lo que ya hacía el camino hermano,
                `RegistrarClienteModal.tsx:84`.
            */
            is_final_consumer: false,
            customer_type: 'retail',
        }])
        .select('id, identification_number, name, email, phone, is_final_consumer, customer_type, discount_percentage, claimed_by')
        .single();

    if (errorAlta) {
        console.warn('No se pudo crear el comprador del chat:', errorAlta.message);
        return null;
    }
    return creado as Customer;
}

/** ¿El POS sigue con el consumidor final, o el vendedor ya eligió a alguien? */
export function esConsumidorFinal(cliente: Customer): boolean {
    return cliente.id === defaultConsumidorFinal.id;
}

/**
 * El teléfono y el nombre del dueño de una conversación.
 *
 * Se lee de la conversación y no de las props de la pantalla a propósito: el
 * armador de proformas se monta desde tres lugares distintos (bandeja de
 * escritorio, móvil y el compositor), y en todos ellos la etiqueta que se muestra
 * puede ser el nombre o el número ya formateado para leerlo. Acá hace falta el
 * número crudo, y el único sitio donde siempre está es la conversación misma.
 */
export async function compradorDeConversacion(
    conversationId: number,
): Promise<{ telefono: string | null; nombre: string | null; lid: string | null }> {
    const { data, error } = await supabase
        .from('agent_conversations')
        .select('phone_number, customer_name, lid, is_group')
        .eq('id', conversationId)
        .maybeSingle();

    if (error || !data) return { telefono: null, nombre: null, lid: null };

    /*
        Un GRUPO no tiene dueño: detrás hay varias personas y su "teléfono"
        son los dígitos del JID. Crearle una ficha de cliente produciría un
        fantasma con el nombre del grupo, y peor, ataría una venta a algo que
        no es nadie. Se devuelve vacío y quien llama sigue con consumidor
        final, que es la respuesta correcta.
    */
    if ((data as { is_group?: boolean | null }).is_group === true) {
        return { telefono: null, nombre: null, lid: null };
    }

    return {
        telefono: data.phone_number ?? null,
        nombre: data.customer_name ?? null,
        lid: (data as { lid?: string | null }).lid ?? null,
    };
}

/**
 * Deja anotado en la conversación a qué cliente del ERP corresponde.
 *
 * `agent_conversations.customer_id` existe en el esquema desde siempre y estaba
 * en cero en las 7.884 conversaciones: nadie lo llenaba. Con esto, la próxima vez
 * que esa persona escriba ya se sabe quién es, y el reporte puede cruzar chats
 * con ventas sin pasar por el teléfono.
 *
 * No es crítico: si falla, la venta se cobra igual y la atribución ya quedó
 * resuelta por teléfono.
 */
export async function vincularConversacionConCliente(
    conversationId: number,
    customerId: number,
): Promise<void> {
    const { error } = await supabase
        .from('agent_conversations')
        .update({ customer_id: customerId })
        .eq('id', conversationId)
        .is('customer_id', null);

    if (error) console.warn('No se pudo vincular la conversación con el cliente:', error.message);
}
