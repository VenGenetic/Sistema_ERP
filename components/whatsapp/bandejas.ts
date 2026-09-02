import type { Etapa } from './etapas';

/**
 * Las bandejas de trabajo de la bandeja de WhatsApp.
 *
 * EL PROBLEMA QUE RESUELVEN
 *
 * Antes había quince filtros en un mismo plano y todos mutuamente
 * excluyentes, mezclando tres preguntas distintas: quién tiene el chat, si
 * está leído, y cómo lo guardó cada uno. Con noventa conversaciones abiertas
 * eso no organiza nada -- había que elegir un filtro por vez y adivinar cuál,
 * y "los no leídos que atiende la IA" directamente no se podía pedir.
 *
 * LA DECISIÓN
 *
 * Cada conversación cae en UNA sola bandeja, por una regla de prioridad. Eso
 * es lo que hace que la suma de los contadores sea el total y que nadie tenga
 * que preguntarse si un chat que ya atendió sigue escondido en otra pestaña.
 *
 * El orden de `BANDEJAS` ES la regla: se recorre de arriba a abajo y gana la
 * primera que acepta. Por eso está escrito como una lista y no como un
 * `switch` -- para que el orden se lea y se pueda cambiar sin tocar lógica.
 */

export type Bandeja = 'cotizar' | 'responder' | 'ia' | 'esperando' | 'cerrados';

/** Lo que la clasificación necesita saber de una conversación. */
export interface ConversacionClasificable {
    id: number;
    status: string;
    bot_enabled: boolean;
    unread_count: number;
    etapa?: Etapa;
    last_message_direction: string | null;
}

export interface DefinicionDeBandeja {
    id: Bandeja;
    /** Nombre corto, el que se lee en la lista. */
    texto: string;
    /** Qué hay que hacer con lo que cae acá. Va en el `title`. */
    ayuda: string;
    /**
     * Si pide acción nuestra. Las dos primeras sí; las otras tres son
     * estado, no trabajo. Sirve para pintar distinto lo que urge.
     */
    pideAccion: boolean;
    /**
     * ¿Esta conversación cae acá? Se evalúa EN ORDEN: la primera que dice
     * que sí se la queda.
     *
     * `sinLeer` viene de afuera porque el "no leído" del ERP no es solo la
     * columna: incluye los que alguien marcó a mano y todavía no se
     * reflejaron del lado de WhatsApp.
     */
    cumple: (c: ConversacionClasificable, sinLeer: boolean) => boolean;
    /**
     * Condición PostgREST que trae un SUPERCONJUNTO de esta bandeja, para
     * poder buscarla más allá de las conversaciones ya cargadas. `null` =
     * no se puede expresar y se resuelve solo en el cliente.
     *
     * Es un superconjunto y no la bandeja exacta a propósito: la regla de
     * prioridad se aplica igual en el cliente, así que de más no molesta y
     * escribir las exclusiones en PostgREST las volvería ilegibles.
     */
    sql: string | null;
    /** Si la condición de arriba menciona `etapa` (migración 0035). */
    usaEtapa: boolean;
}

const cerrada = (c: ConversacionClasificable) => c.status === 'closed' || c.etapa === 'resolved';

export const BANDEJAS: ReadonlyArray<DefinicionDeBandeja> = [
    {
        id: 'cotizar',
        texto: 'IA lista, por cotizar',
        ayuda: 'La IA terminó de recopilar los datos del repuesto y dejó la ficha armada. Falta que un vendedor cotice.',
        pideAccion: true,
        // Va PRIMERO aunque el chat esté sin leer: acá lo que hace falta no
        // es contestar sino cotizar, y decir cuál de las dos cosas toca es
        // justamente para lo que sirven las bandejas.
        cumple: (c) => c.etapa === 'ready_for_sales',
        sql: 'etapa.eq.ready_for_sales',
        usaEtapa: true,
    },
    {
        id: 'responder',
        texto: 'Necesitan respuesta',
        ayuda: 'El cliente escribió y todavía no le contestamos. Incluye los que volvieron a escribir a un chat que ya estaba cerrado.',
        pideAccion: true,
        /*
            Sin leer, o el último que habló fue el cliente. Lo segundo importa
            tanto como lo primero: un mensaje leído al pasar y nunca
            contestado desaparecía de todas las listas.

            Va por encima de "cerrados" a propósito -- un cliente que vuelve a
            escribir a un chat cerrado es una venta nueva, no un archivo.
        */
        cumple: (c, sinLeer) => sinLeer || c.last_message_direction === 'inbound',
        sql: 'unread_count.gt.0,last_message_direction.eq.inbound',
        usaEtapa: false,
    },
    {
        id: 'cerrados',
        texto: 'Cerrados',
        ayuda: 'Terminados y sin nada pendiente. Vuelven solos a «Necesitan respuesta» si el cliente escribe.',
        pideAccion: false,
        cumple: (c) => cerrada(c),
        sql: 'status.eq.closed,etapa.eq.resolved',
        usaEtapa: true,
    },
    {
        id: 'ia',
        texto: 'IA atendiendo',
        ayuda: 'El agente está conversando con el cliente ahora mismo. No hace falta hacer nada.',
        pideAccion: false,
        cumple: (c) => c.bot_enabled && c.status === 'bot_active',
        sql: 'and(bot_enabled.is.true,status.eq.bot_active)',
        usaEtapa: false,
    },
    {
        id: 'esperando',
        texto: 'Esperando al cliente',
        ayuda: 'Ya contestamos o cotizamos y falta que el cliente responda. En pausa, no es trabajo pendiente.',
        pideAccion: false,
        // El resto. Es la última a propósito: sin una bandeja que acepte
        // todo, una conversación con datos raros no aparecería en ninguna.
        cumple: () => true,
        sql: null,
        usaEtapa: false,
    },
];

/** En qué bandeja cae esta conversación. Siempre devuelve una. */
export function bandejaDe(c: ConversacionClasificable, sinLeer: boolean): Bandeja {
    for (const b of BANDEJAS) {
        if (b.cumple(c, sinLeer)) return b.id;
    }
    return 'esperando';
}

/** Cuántas hay en cada bandeja. Una sola pasada por la lista. */
export function contarPorBandeja(
    conversaciones: ConversacionClasificable[],
    sinLeer: (c: ConversacionClasificable) => boolean,
): Record<Bandeja, number> {
    const cuentas: Record<Bandeja, number> = {
        cotizar: 0,
        responder: 0,
        ia: 0,
        esperando: 0,
        cerrados: 0,
    };
    for (const c of conversaciones) cuentas[bandejaDe(c, sinLeer(c))] += 1;
    return cuentas;
}
