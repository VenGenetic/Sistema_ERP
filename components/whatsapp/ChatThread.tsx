import React, { memo, useEffect, useMemo, useRef } from 'react';
import { AlertCircle, Check, CheckCheck, Clock3 } from 'lucide-react';
import { cn } from '../ui/styles';
import MessageMedia from './MessageMedia';
import MessageActions from './MessageActions';
import { partirPorTelefonos } from '../../utils/telefonosEnTexto';

/**
 * El hilo de la conversación, con el aspecto de WhatsApp.
 *
 * Es una imitación deliberada, no un capricho: el vendedor pasa el día
 * dentro del WhatsApp del teléfono y salta a esta pantalla cada dos
 * minutos. Si acá la burbuja propia no es la verde de la derecha, si el
 * doble check azul no significa «lo leyó» y si la fecha no es la píldora
 * gris del medio, tiene que traducir todo en la cabeza en el peor momento
 * -- mientras un cliente espera un precio. Así que se copia el modelo
 * completo: papel tapiz, colita de la burbuja, checks de entrega,
 * agrupado por día y por autor, hora dentro de la burbuja, y la reacción
 * colgando del borde.
 *
 * Los colores salen de los tokens `--wa-*` de index.html, que son los
 * valores exactos de WhatsApp Web en claro y en oscuro. No tocan la
 * paleta del resto del ERP.
 *
 * Vive aparte de las páginas por dos razones, y la segunda es la que
 * importa:
 *
 *   1. La bandeja de escritorio y el modo móvil usan ESTE componente. Una
 *      corrección acá llega a las dos; antes el móvil tenía su propia
 *      copia de las burbujas y se desincronizaba sola.
 *   2. Cada burbuja está MEMOIZADA. El hilo entero se redibujaba con cada
 *      mensaje que llegaba por realtime, con cada tecla del buscador y con
 *      cada recarga de la cola -- con cien mensajes, y con fotos y
 *      reproductores de audio dentro, eso se siente lento justo cuando el
 *      chat está activo. Ahora solo se redibuja la burbuja que cambió.
 */

export type ContentType =
    | 'text' | 'image' | 'audio' | 'system' | 'video'
    | 'document' | 'sticker' | 'location' | 'contact' | 'other';

export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface MensajeHilo {
    id: number;
    direction: 'inbound' | 'outbound';
    content_type: ContentType;
    body: string | null;
    created_at: string;
    /** Opcional: el modo móvil no siempre lo trae. Sin él no se dibujan checks. */
    delivery_status?: DeliveryStatus | null;
    action_taken: string | null;
    media_url: string | null;
    whatsapp_message_id: string | null;
    deleted_at: string | null;
    reaction: string | null;
}

/**
 * Qué significa cada check. El texto va en `title` y en `aria-label`: el
 * color por sí solo no puede ser la única señal (el doble check gris y el
 * azul son la misma forma), y con lector de pantalla no hay forma.
 */
export const ENTREGA: Record<DeliveryStatus, string> = {
    pending: 'Sin confirmar todavía',
    sent: 'Enviado',
    delivered: 'Entregado en el teléfono del cliente',
    read: 'Leído por el cliente',
    failed: 'No se pudo entregar',
};

/** Los checks de WhatsApp: reloj, check, doble check, doble check azul. */
export const Checks: React.FC<{ estado: DeliveryStatus; size?: number }> = ({ estado, size = 15 }) => {
    const comun = { size, 'aria-hidden': true } as const;
    const icono =
        estado === 'pending' ? <Clock3 {...comun} /> :
        estado === 'failed' ? <AlertCircle {...comun} /> :
        estado === 'sent' ? <Check {...comun} /> :
        <CheckCheck {...comun} />;

    return (
        <span
            title={ENTREGA[estado]}
            aria-label={ENTREGA[estado]}
            role="img"
            className={cn(
                'inline-flex shrink-0',
                estado === 'read' && 'text-wa-tick',
                estado === 'failed' && 'text-wa-danger',
            )}
        >
            {icono}
        </span>
    );
};

/**
 * La píldora gris del centro del hilo: separadores de fecha, avisos del
 * sistema y las notas de la pantalla («mostrando los últimos 100»).
 */
export const PildoraChat: React.FC<{ children: React.ReactNode; tono?: 'normal' | 'aviso' }> = ({
    children,
    tono = 'normal',
}) => (
    <div className="flex justify-center px-3 py-1.5">
        <span
            className={cn(
                'max-w-[85%] rounded-lg px-3 py-1.5 text-center text-[12.5px] leading-[17px] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]',
                tono === 'aviso'
                    ? 'bg-wa-notice text-wa-notice-text'
                    : 'bg-wa-pill text-wa-pill-text',
            )}
        >
            {children}
        </span>
    </div>
);

const SIN_TEXTO: Partial<Record<ContentType, string>> = {
    image: 'Foto',
    audio: 'Nota de voz',
    video: 'Video',
    document: 'Archivo',
    sticker: 'Sticker',
    location: 'Ubicación',
    contact: 'Contacto',
};

/** Tipos que DEBERÍAN traer archivo. Si no lo traen, se aclara. */
const CON_ARCHIVO = new Set<ContentType>(['image', 'audio', 'video', 'document', 'sticker']);

/**
 * Medios que llegan hasta el borde de la burbuja, sin margen: la foto, el
 * video y el sticker SON la burbuja. El reproductor de la nota de voz y la
 * tarjeta de un archivo, en cambio, necesitan su respiro adentro.
 */
const MEDIA_AL_BORDE = new Set<ContentType>(['image', 'video', 'sticker']);

export const textoDe = (m: Pick<MensajeHilo, 'body' | 'content_type'>): string =>
    m.body || SIN_TEXTO[m.content_type] || '(sin texto)';

/**
 * El texto del mensaje con los teléfonos convertidos en algo que se puede
 * tocar.
 *
 * Es la mitad visible de utils/telefonosEnTexto.ts. El caso es de todos
 * los días: «llámame al 0999123456», «este es el número de mi hermano».
 * Antes eso había que seleccionarlo a mano, copiarlo y pegarlo en el
 * buscador; ahora se toca y se salta al chat de esa persona.
 *
 * Se subraya en vez de pintarse de otro color: la burbuja propia es verde
 * y la del cliente es blanca, y un color fijo se pierde en una de las dos.
 * El subrayado hereda el color del texto y se ve igual en ambas, en claro
 * y en oscuro.
 *
 * Sin `onTelefono` se dibuja texto pelado. Así el componente sirve igual
 * en una pantalla que todavía no tenga a dónde llevar el toque.
 */
const TextoConTelefonos: React.FC<{
    texto: string;
    onTelefono?: (numero: string, ancla: DOMRect) => void;
}> = ({ texto, onTelefono }) => {
    const trozos = useMemo(() => (onTelefono ? partirPorTelefonos(texto) : null), [texto, onTelefono]);
    if (!trozos) return <>{texto}</>;

    return (
        <>
            {trozos.map((t, i) =>
                t.tipo === 'telefono' ? (
                    <button
                        key={i}
                        type="button"
                        onClick={(e) => {
                            // El hilo entero escucha clics para citar y para
                            // el menú de la burbuja: sin esto, tocar el
                            // número además abría esas otras cosas.
                            e.stopPropagation();
                            onTelefono(t.numero, e.currentTarget.getBoundingClientRect());
                        }}
                        title={`Abrir el chat de ${t.texto}`}
                        /* `inline` y no el inline-block que trae el botón por
                           defecto: así el número se parte de línea como
                           cualquier palabra en vez de saltar entero. */
                        className="inline cursor-pointer break-all text-left font-medium underline decoration-1 underline-offset-2 hover:opacity-80"
                    >
                        {t.texto}
                    </button>
                ) : (
                    <React.Fragment key={i}>{t.texto}</React.Fragment>
                ),
            )}
        </>
    );
};

/** "HOY" / "AYER" / "12 DE MARZO" -- lo que se lee de un vistazo. */
function etiquetaDeDia(iso: string): string {
    const fecha = new Date(iso);
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);

    const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    if (mismoDia(fecha, hoy)) return 'Hoy';
    if (mismoDia(fecha, ayer)) return 'Ayer';
    return fecha.toLocaleDateString('es-EC', {
        day: 'numeric',
        month: 'long',
        // El año solo cuando no es el actual: repetirlo en cada separador de
        // una conversación de esta semana es ruido.
        ...(fecha.getFullYear() !== hoy.getFullYear() ? { year: 'numeric' } : {}),
    });
}

const hora = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-EC', { hour: 'numeric', minute: '2-digit' });

/**
 * La hora que WhatsApp pone al costado de cada chat en la lista: la hora si
 * es de hoy, "ayer", el día de la semana dentro de la semana, y la fecha
 * corta más atrás.
 *
 * Es más útil que "hace 14 h" para decidir a quién contestar: dice CUÁNDO
 * escribió, no cuánto pasó. Vive acá y no en cada pantalla para que la
 * bandeja y el modo móvil no muestren dos formatos distintos del mismo dato.
 */
export function horaLista(iso: string): string {
    const f = new Date(iso);
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);
    const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();

    if (mismoDia(f, hoy)) return f.toLocaleTimeString('es-EC', { hour: 'numeric', minute: '2-digit' });
    if (mismoDia(f, ayer)) return 'ayer';
    if (Date.now() - f.getTime() < 7 * 24 * 60 * 60 * 1000) {
        return f.toLocaleDateString('es-EC', { weekday: 'long' });
    }
    return f.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/**
 * Mantiene el hilo pegado abajo, donde está lo último que se dijo.
 *
 * No alcanza con poner `scrollTop = scrollHeight` cuando cambian los mensajes:
 * en ese momento las fotos todavía no tienen alto, así que "abajo del todo" se
 * calcula sobre un hilo más corto del que va a quedar y la última foto aparece
 * cortada a la mitad. Tampoco alcanza con reintentar a los 600ms -- con la
 * conexión lenta la foto tarda más y con la rápida se desplaza dos veces.
 *
 * Se observa el ALTO REAL del contenido y se vuelve a bajar cada vez que
 * crece: cuando carga una foto, cuando llega un mensaje por realtime, cuando
 * aparece algo en la cola de salida. Pero SOLO si la persona ya estaba abajo:
 * si está leyendo mensajes viejos, no se le arranca la pantalla de las manos.
 */
export function useHiloPegadoAbajo(
    ref: { current: HTMLDivElement | null },
    conversacion: unknown,
) {
    /** La persona está mirando el final del hilo (y no leyendo algo viejo). */
    const pegado = useRef(true);

    useEffect(() => {
        const cont = ref.current;
        if (!cont) return;

        const alFondo = () => cont.scrollHeight - cont.scrollTop - cont.clientHeight;
        const bajar = () => {
            cont.scrollTop = cont.scrollHeight;
        };

        /* Solo un GESTO de la persona cambia el "estoy abajo".
         *
         * Mirar el evento `scroll` a secas no sirve: al abrir un chat con fotos
         * el hilo crece varias veces mientras cargan, y el evento de un
         * desplazamiento propio llegaba cuando el contenido ya había crecido
         * otros 300px. Se leía como "la persona se fue para arriba", el hilo
         * dejaba de bajar y el último mensaje quedaba cortado contra la caja de
         * escribir. Con el gesto de por medio, el contenido puede crecer todo
         * lo que quiera sin que nadie confunda eso con leer hacia atrás.
         */
        let ultimoGesto = 0;
        const gesto = () => {
            ultimoGesto = Date.now();
        };
        const GESTOS = ['wheel', 'touchstart', 'touchmove', 'mousedown', 'keydown'] as const;
        GESTOS.forEach((e) => cont.addEventListener(e, gesto, { passive: true }));

        const alDesplazar = () => {
            // 400ms: cubre el desplazamiento suave que sigue a una rueda o a un
            // dedo que se levanta.
            if (Date.now() - ultimoGesto > 400) return;
            // 120px de tolerancia: nadie deja el hilo clavado al píxel.
            pegado.current = alFondo() < 120;
        };
        cont.addEventListener('scroll', alDesplazar, { passive: true });

        // Cuando una foto termina de cargar. Va en fase de captura porque el
        // `load` de una <img> no burbujea.
        const alCargarMedio = () => {
            if (pegado.current) bajar();
        };
        cont.addEventListener('load', alCargarMedio, true);

        // Y ante cualquier cambio de alto del contenido: mensajes que llegan por
        // realtime, algo que entra en la cola de salida, una foto que carga.
        const contenido = cont.firstElementChild;
        const observador = new ResizeObserver(() => {
            if (pegado.current) bajar();
        });

        /* Y al volver a la pestaña. Mientras está en segundo plano el navegador
           congela el observador de tamaño, así que los mensajes que llegaron
           entre medio crecieron sin que nadie bajara el hilo: se vuelve del
           café y el último mensaje está cortado contra la caja de escribir. */
        const alVolver = () => {
            if (document.visibilityState === 'visible' && pegado.current) bajar();
        };
        document.addEventListener('visibilitychange', alVolver);

        // Al abrir un chat se arranca abajo sí o sí.
        pegado.current = true;
        bajar();
        if (contenido) observador.observe(contenido);

        return () => {
            GESTOS.forEach((e) => cont.removeEventListener(e, gesto));
            cont.removeEventListener('scroll', alDesplazar);
            cont.removeEventListener('load', alCargarMedio, true);
            document.removeEventListener('visibilitychange', alVolver);
            observador.disconnect();
        };
    }, [ref, conversacion]);
}

interface BurbujaProps {
    m: MensajeHilo;
    /**
     * Primera del grupo: lleva la colita y la esquina cuadrada. Las que
     * siguen del mismo autor se pegan sin pico, como en WhatsApp.
     */
    primeraDelGrupo: boolean;
    /** En el teléfono: texto y zonas táctiles más grandes. */
    tactil: boolean;
    onAbrirFoto: (m: MensajeHilo) => void;
    onResponder: (m: MensajeHilo) => void;
    onReaccionar: (m: MensajeHilo, emoji: string) => void;
    onBorrar: (m: MensajeHilo) => void;
    /** Tocaron un teléfono escrito dentro del mensaje. */
    onTelefono?: (numero: string, ancla: DOMRect) => void;
}

const Burbuja = memo<BurbujaProps>(
    ({ m, primeraDelGrupo, tactil, onAbrirFoto, onResponder, onReaccionar, onBorrar, onTelefono }) => {
        const entrante = m.direction === 'inbound';
        const borrado = !!m.deleted_at;

        /* Archivo sin pie de foto: no se escribe "Foto" ni "Nota de voz"
           debajo. El reproductor ya dice que es una nota de voz y la tarjeta
           ya dice el nombre del archivo -- repetirlo es una línea de texto que
           WhatsApp no pone y que en un hilo largo solo hace ruido. */
        const soloMedia = !!m.media_url && !m.body && !borrado;
        // El sticker no lleva burbuja: en WhatsApp flota sobre el papel
        // tapiz. Con pie de foto (que WhatsApp ni permite) vuelve a la burbuja
        // normal: sin fondo, ese texto quedaba suelto sobre el tapiz.
        const sticker = m.content_type === 'sticker' && !!m.media_url && !m.body && !borrado;
        const mediaAlBorde = soloMedia && MEDIA_AL_BORDE.has(m.content_type);
        /* La hora encima solo sobre una foto. Sobre el video taparía la barra
           de controles justo donde está el botón de reproducir, y el sticker
           no tiene fondo donde apoyarla. */
        const horaEncima = soloMedia && m.content_type === 'image';
        const horaDebajo = soloMedia && !horaEncima;

        const meta = (
            <>
                <span className="tnum">{hora(m.created_at)}</span>
                {!entrante && m.delivery_status && <Checks estado={m.delivery_status} size={15} />}
            </>
        );

        const claseMeta = cn(
            'flex items-center gap-[3px] text-[11px] leading-none',
            entrante ? 'text-wa-meta' : 'text-wa-meta-out',
        );

        return (
            <div
                className={cn(
                    'group flex px-2 md:px-4',
                    entrante ? 'justify-start' : 'justify-end',
                    primeraDelGrupo ? 'mt-2.5' : 'mt-0.5',
                    // Sitio para la reacción, que cuelga por fuera del borde.
                    m.reaction && 'mb-3.5',
                )}
            >
                <div
                    className={cn(
                        'relative max-w-[85%] md:max-w-[65%] min-w-0',
                        sticker
                            ? ''
                            : cn(
                                  'rounded-lg shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]',
                                  entrante ? 'bg-wa-in' : 'bg-wa-out',
                                  'text-wa-text',
                                  // La colita solo en la primera del grupo, y del
                                  // lado del autor.
                                  primeraDelGrupo &&
                                      (entrante ? 'wa-tail-in rounded-tl-none' : 'wa-tail-out rounded-tr-none'),
                                  mediaAlBorde ? 'p-[3px]' : 'px-2 py-[6px]',
                              ),
                    )}
                >
                    {/* Quién contestó. WhatsApp pone el nombre del participante
                        arriba de la burbuja en los grupos; acá sirve para lo
                        mismo: distinguir la respuesta de una persona de la del
                        agente. Solo se marca lo que consta -- si no dice
                        «vendedor», no se afirma nada. */}
                    {!entrante && primeraDelGrupo && m.action_taken === 'human_reply' && !sticker && (
                        <p className="mb-0.5 text-[12.5px] font-semibold leading-[16px] text-wa-meta-out">
                            Vendedor
                        </p>
                    )}

                    {m.media_url && !borrado && (
                        <div className={cn(mediaAlBorde ? 'overflow-hidden rounded-[6px]' : !soloMedia && 'mb-1')}>
                            <MessageMedia
                                url={m.media_url}
                                contentType={m.content_type}
                                body={m.body}
                                onAbrirFoto={() => onAbrirFoto(m)}
                            />
                        </div>
                    )}

                    {/* Texto + hora. La hora va DENTRO del párrafo, abajo a la
                        derecha, y el separador invisible de al lado le reserva
                        el hueco en la última línea: así el texto la esquiva en
                        vez de quedar tapado, que es exactamente lo que hace
                        WhatsApp. */}
                    {!soloMedia && (
                        <div
                            className={cn(
                                'relative whitespace-pre-wrap break-words',
                                tactil ? 'text-[15px] leading-[20px]' : 'text-[14.2px] leading-[19px]',
                            )}
                        >
                            <span className={cn(borrado && 'italic text-wa-meta')}>
                                {borrado ? (
                                    'Se borró este mensaje'
                                ) : (
                                    <TextoConTelefonos texto={textoDe(m)} onTelefono={onTelefono} />
                                )}
                            </span>

                            {!m.media_url && CON_ARCHIVO.has(m.content_type) && !borrado && (
                                <span className="ml-1 text-[11px] text-wa-meta">· archivo no guardado</span>
                            )}

                            {/* El hueco de la hora, reservado con la hora MISMA
                                puesta invisible: así mide exactamente lo que va a
                                ocupar, venga la hora como "20:04" o como
                                "8:04 p. m." y lleve checks o no. Con un ancho fijo
                                a ojo, el texto le quedaba por debajo. */}
                            <span aria-hidden="true" className={cn(claseMeta, 'invisible ml-2 inline-flex select-none align-bottom')}>
                                {meta}
                            </span>
                            <span className={cn(claseMeta, 'absolute bottom-0 right-0')}>{meta}</span>
                        </div>
                    )}

                    {/* Foto sin pie: la hora encima, sobre un degradado, para que
                        se lea igual sobre una foto clara o una oscura. */}
                    {horaEncima && (
                        <span className="pointer-events-none absolute bottom-[3px] right-[3px] left-[3px] flex justify-end rounded-b-[6px] bg-gradient-to-t from-black/45 to-transparent px-2 pb-1 pt-6">
                            <span className="flex items-center gap-[3px] text-[11px] leading-none text-white/90">
                                {meta}
                            </span>
                        </span>
                    )}

                    {/* Video y sticker: la hora en su propia línea, a la derecha.
                        Iba dentro del bloque de texto, así que un sticker CON pie de
                        foto la dibujaba dos veces. */}
                    {horaDebajo && (
                        <span className={cn(claseMeta, 'mt-0.5 flex justify-end pr-1')}>{meta}</span>
                    )}

                    {/* Reacción: cuelga del borde inferior de la burbuja, del
                        lado del autor, como en WhatsApp. */}
                    {m.reaction && (
                        <span
                            className={cn(
                                'absolute -bottom-3 z-10 flex items-center rounded-full border border-wa-divider bg-wa-panel px-1.5 py-[3px] text-[12px] leading-none shadow-[0_1px_2px_rgba(11,20,26,0.2)]',
                                entrante ? 'left-2' : 'right-2',
                            )}
                        >
                            {m.reaction}
                        </span>
                    )}

                    {/* Citar, reaccionar, borrar. Aparece al pasar el mouse: un
                        disparador fijo en cien mensajes es ruido constante.
                        Sigue siendo alcanzable por teclado (focus-within) y en
                        el teléfono queda tenue pero visible, porque ahí no hay
                        hover que lo revele. */}
                    {m.whatsapp_message_id && !borrado && (
                        <div
                            className={cn(
                                /* Lleva algo detrás: si no, el galoncito queda
                                   apoyado sobre las primeras letras del mensaje o
                                   sobre la foto, y no se lee ninguno de los dos.
                                   Sobre una foto va un velo oscuro (el color de la
                                   burbuja ahí sería un recuadro pegado encima). */
                                'absolute right-0 top-0 z-20 rounded-tr-lg transition-opacity',
                                sticker
                                    ? ''
                                    : mediaAlBorde
                                      ? 'rounded-bl-lg bg-black/35'
                                      : entrante
                                        ? 'bg-wa-in'
                                        : 'bg-wa-out',
                                tactil
                                    ? 'opacity-60'
                                    : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                            )}
                        >
                            <MessageActions
                                onResponder={() => onResponder(m)}
                                onReaccionar={(emoji) => onReaccionar(m, emoji)}
                                onBorrar={m.direction === 'outbound' ? () => onBorrar(m) : undefined}
                                alineacion="derecha"
                                abrirHacia="abajo"
                                claseBoton={cn(
                                    'flex items-center justify-center rounded-full',
                                    mediaAlBorde ? 'text-white/90' : 'text-wa-meta',
                                    tactil ? 'h-9 w-9' : 'h-6 w-6 hover:bg-wa-inset/10',
                                )}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    },
);
Burbuja.displayName = 'Burbuja';

interface Props {
    mensajes: MensajeHilo[];
    onAbrirFoto: (m: MensajeHilo) => void;
    onResponder: (m: MensajeHilo) => void;
    onReaccionar: (m: MensajeHilo, emoji: string) => void;
    onBorrar: (m: MensajeHilo) => void;
    /**
     * Tocaron un teléfono escrito DENTRO de un mensaje. `ancla` es dónde
     * quedó el número en pantalla, para colgarle el menú al lado.
     *
     * Sin esto los teléfonos se dibujan como texto común: la pantalla que
     * no tenga a dónde llevar el toque no muestra un enlace muerto.
     */
    onTelefono?: (numero: string, ancla: DOMRect) => void;
    /** En el teléfono: texto y zonas táctiles más grandes. */
    tactil?: boolean;
}

export const ChatThread: React.FC<Props> = ({
    mensajes,
    onAbrirFoto,
    onResponder,
    onReaccionar,
    onBorrar,
    onTelefono,
    tactil = false,
}) => {
    /**
     * Las cuatro acciones, envueltas en funciones que NO cambian de
     * identidad entre renders.
     *
     * Sin esto el `memo` de la burbuja no servía para nada: las páginas
     * declaran `abrirVisor`, `reaccionar` y `borrar` en el cuerpo del
     * componente, así que llegaban distintas en cada render y las cien
     * burbujas se redibujaban igual. La referencia guarda siempre la
     * versión más nueva, así que tampoco se cierra sobre datos viejos.
     */
    const ultimas = useRef({ onAbrirFoto, onResponder, onReaccionar, onBorrar, onTelefono });
    ultimas.current = { onAbrirFoto, onResponder, onReaccionar, onBorrar, onTelefono };

    const acciones = useMemo(
        () => ({
            abrirFoto: (m: MensajeHilo) => ultimas.current.onAbrirFoto(m),
            responder: (m: MensajeHilo) => ultimas.current.onResponder(m),
            reaccionar: (m: MensajeHilo, emoji: string) => ultimas.current.onReaccionar(m, emoji),
            borrar: (m: MensajeHilo) => ultimas.current.onBorrar(m),
            telefono: (numero: string, ancla: DOMRect) => ultimas.current.onTelefono?.(numero, ancla),
        }),
        [],
    );

    /*
        Se pasa `undefined` cuando la pantalla no trajo `onTelefono`, y no
        el envoltorio vacío: si no, los números quedarían subrayados como
        si se pudieran tocar y no harían nada. La identidad igual no cambia
        entre renders, que es lo que mantiene vivo el `memo` de la burbuja.
    */
    const alTocarTelefono = onTelefono ? acciones.telefono : undefined;

    return (
    <>
        {mensajes.map((m, i) => {
            const anterior = i > 0 ? mensajes[i - 1] : null;
            const diaNuevo =
                !anterior || new Date(anterior.created_at).toDateString() !== new Date(m.created_at).toDateString();

            if (m.content_type === 'system') {
                return (
                    <React.Fragment key={m.id}>
                        {diaNuevo && (
                            <PildoraChat>
                                <span className="uppercase">{etiquetaDeDia(m.created_at)}</span>
                            </PildoraChat>
                        )}
                        <PildoraChat>{m.body || 'Aviso del sistema'}</PildoraChat>
                    </React.Fragment>
                );
            }

            // Abre grupo si cambia el día, si cambia el autor, o si pasaron
            // más de unos minutos: dos mensajes del mismo cliente con dos
            // horas de diferencia son dos momentos distintos, no un bloque.
            const primeraDelGrupo =
                diaNuevo ||
                !anterior ||
                anterior.direction !== m.direction ||
                anterior.content_type === 'system' ||
                new Date(m.created_at).getTime() - new Date(anterior.created_at).getTime() >= 5 * 60 * 1000;

            return (
                <React.Fragment key={m.id}>
                    {diaNuevo && (
                        <PildoraChat>
                            <span className="uppercase">{etiquetaDeDia(m.created_at)}</span>
                        </PildoraChat>
                    )}
                    <Burbuja
                        m={m}
                        primeraDelGrupo={primeraDelGrupo}
                        tactil={tactil}
                        onAbrirFoto={acciones.abrirFoto}
                        onResponder={acciones.responder}
                        onReaccionar={acciones.reaccionar}
                        onBorrar={acciones.borrar}
                        onTelefono={alTocarTelefono}
                    />
                </React.Fragment>
            );
        })}
    </>
    );
};

export default ChatThread;
