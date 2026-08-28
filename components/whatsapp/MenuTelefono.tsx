import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Loader2, MessageSquarePlus, MessagesSquare } from 'lucide-react';
import { cn, focusRing } from '../ui/styles';
import { formatPhoneDisplay } from '../../utils/phone';
import { abrirOCrearConversacion, buscarConversacionPorTelefono } from '../../utils/conversacionesWhatsapp';
import { copiarTexto } from '../../utils/portapapeles';

/**
 * El menú que sale al tocar un teléfono escrito dentro de un mensaje.
 *
 * Es un menú y no un salto directo por una razón concreta: el hilo se lee
 * con el dedo y con el mouse encima del texto, y saltar de conversación
 * ante un roce es perder el lugar donde uno estaba leyendo -- justo cuando
 * un cliente espera respuesta. Con un paso intermedio el toque es siempre
 * reversible.
 *
 * Además, antes de ofrecer nada sale a mirar si ese número YA tiene chat:
 * la acción no es la misma («abrir el de siempre» o «escribirle por
 * primera vez») y decirlo antes evita abrir un chat duplicado a mano.
 *
 * Se dibuja con un portal sobre el `body` porque el hilo tiene scroll y
 * `overflow` propio: colgado adentro, el menú quedaba recortado por el
 * borde de la burbuja.
 */

const ANCHO = 264;
/** Aire contra el borde de la ventana. */
const MARGEN = 8;

type Estado =
    | { fase: 'buscando' }
    | { fase: 'existe'; conversationId: number }
    | { fase: 'nueva' }
    | { fase: 'error'; mensaje: string };

interface Props {
    /** El teléfono ya normalizado (593…). */
    numero: string;
    /** Dónde quedó el número en pantalla. */
    ancla: DOMRect;
    /** La conversación abierta ahora mismo, para no ofrecer ir a ella. */
    conversacionActual?: number | null;
    /** La pantalla decide cómo mostrar el chat (escritorio y móvil difieren). */
    onAbrir: (conversationId: number) => void;
    onCerrar: () => void;
}

export const MenuTelefono: React.FC<Props> = ({
    numero,
    ancla,
    conversacionActual = null,
    onAbrir,
    onCerrar,
}) => {
    const [estado, setEstado] = useState<Estado>({ fase: 'buscando' });
    const [abriendo, setAbriendo] = useState(false);
    const [copiado, setCopiado] = useState(false);
    const cajaRef = useRef<HTMLDivElement>(null);

    // Buscar el chat apenas se abre el menú.
    useEffect(() => {
        let vivo = true;
        setEstado({ fase: 'buscando' });
        buscarConversacionPorTelefono(numero)
            .then((id) => {
                if (!vivo) return;
                setEstado(id === null ? { fase: 'nueva' } : { fase: 'existe', conversationId: id });
            })
            .catch((err: any) => {
                if (!vivo) return;
                setEstado({ fase: 'error', mensaje: err?.message ?? 'No se pudo consultar.' });
            });
        return () => {
            vivo = false;
        };
    }, [numero]);

    /*
        Cerrar al tocar fuera, con Escape, y también al desplazar o
        redimensionar: el menú está anclado a una posición fija calculada
        una sola vez, así que si el hilo se mueve debajo quedaría flotando
        lejos del número que lo abrió.
    */
    useEffect(() => {
        const fuera = (e: MouseEvent) => {
            if (!cajaRef.current?.contains(e.target as Node)) onCerrar();
        };
        const tecla = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCerrar();
        };
        // `capture` para enterarse también del scroll de la lista del hilo,
        // que no burbujea hasta la ventana.
        const mover = () => onCerrar();
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', tecla);
        window.addEventListener('scroll', mover, true);
        window.addEventListener('resize', mover);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', tecla);
            window.removeEventListener('scroll', mover, true);
            window.removeEventListener('resize', mover);
        };
    }, [onCerrar]);

    const abrir = async () => {
        if (abriendo) return;
        setAbriendo(true);
        try {
            if (estado.fase === 'existe') {
                onAbrir(estado.conversationId);
            } else {
                const { id } = await abrirOCrearConversacion(numero);
                onAbrir(id);
            }
            onCerrar();
        } catch (err: any) {
            setEstado({ fase: 'error', mensaje: err?.message ?? 'No se pudo abrir el chat.' });
        } finally {
            setAbriendo(false);
        }
    };

    const copiar = async () => {
        const ok = await copiarTexto(formatPhoneDisplay(numero));
        setCopiado(ok);
        if (ok) setTimeout(() => setCopiado(false), 1600);
    };

    /*
        Debajo del número si entra, y encima si no. El `left` se recorta
        contra los dos bordes: un número al final de una burbuja angosta
        dejaba el menú medio afuera de la pantalla en el teléfono.
    */
    const alto = 168;
    const cabeDebajo = ancla.bottom + alto + MARGEN < window.innerHeight;
    const top = cabeDebajo ? ancla.bottom + 6 : Math.max(MARGEN, ancla.top - alto - 6);
    const left = Math.min(
        Math.max(MARGEN, ancla.left),
        Math.max(MARGEN, window.innerWidth - ANCHO - MARGEN),
    );

    const esElChatDeAhora = estado.fase === 'existe' && estado.conversationId === conversacionActual;

    return createPortal(
        <div
            ref={cajaRef}
            role="menu"
            aria-label={`Acciones para el número ${formatPhoneDisplay(numero)}`}
            style={{ top, left, width: ANCHO }}
            className="fixed z-[70] overflow-hidden rounded-xl border border-wa-divider bg-wa-panel shadow-xl"
        >
            <div className="border-b border-wa-divider px-3 py-2.5">
                <p className="text-[14px] font-semibold tabular-nums text-wa-text">
                    {formatPhoneDisplay(numero)}
                </p>
                <p className="mt-0.5 text-[12px] leading-[16px] text-wa-meta">
                    {estado.fase === 'buscando' && 'Buscando el chat…'}
                    {estado.fase === 'existe' &&
                        (esElChatDeAhora ? 'Es el número de este mismo chat.' : 'Ya tiene una conversación.')}
                    {estado.fase === 'nueva' && 'Todavía no hay chat con este número.'}
                    {estado.fase === 'error' && (
                        <span className="text-wa-danger">{estado.mensaje}</span>
                    )}
                </p>
            </div>

            <div className="py-1">
                <button
                    type="button"
                    role="menuitem"
                    onClick={abrir}
                    disabled={estado.fase === 'buscando' || abriendo || esElChatDeAhora}
                    className={cn(
                        'flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13.5px] text-wa-text transition-colors',
                        focusRing,
                        'hover:bg-wa-hover disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent',
                    )}
                >
                    {abriendo || estado.fase === 'buscando' ? (
                        <Loader2 size={17} className="animate-spin text-wa-meta" aria-hidden="true" />
                    ) : estado.fase === 'nueva' ? (
                        <MessageSquarePlus size={17} className="text-wa-accent-strong" aria-hidden="true" />
                    ) : (
                        <MessagesSquare size={17} className="text-wa-accent-strong" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1">
                        {estado.fase === 'nueva' ? 'Escribirle por primera vez' : 'Abrir el chat'}
                    </span>
                </button>

                <button
                    type="button"
                    role="menuitem"
                    onClick={copiar}
                    className={cn(
                        'flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13.5px] text-wa-text transition-colors hover:bg-wa-hover',
                        focusRing,
                    )}
                >
                    {copiado ? (
                        <Check size={17} className="text-wa-accent-strong" aria-hidden="true" />
                    ) : (
                        <Copy size={17} className="text-wa-meta" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1">{copiado ? 'Copiado' : 'Copiar el número'}</span>
                </button>
            </div>
        </div>,
        document.body,
    );
};

export default MenuTelefono;
