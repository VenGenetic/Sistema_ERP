import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, Forward, Pencil, Reply, Trash2, X } from 'lucide-react';
import { cn } from '../ui/styles';
import { copiarTexto } from '../../utils/portapapeles';

/**
 * Lo que se puede hacer sobre un mensaje que ya está en el chat: citarlo
 * al responder, reaccionarle o borrarlo para todos.
 *
 * Compartido entre la bandeja de escritorio y el modo móvil para que una
 * acción no exista en una pantalla y falte en la otra. Lo único que cambia
 * es el tamaño del disparador, que en el teléfono tiene que llegar a 44px
 * (design-system/modo-movil-industrial/MASTER.md).
 */

/** Los que se usan de verdad contestando clientes. */
const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface Props {
    /** Cita este mensaje en la próxima respuesta. */
    onResponder?: () => void;
    onReaccionar?: (emoji: string) => void;
    /**
     * Solo se puede borrar para todos lo PROPIO, y WhatsApp además tiene un
     * plazo. Si no se puede, la opción no aparece en vez de ofrecer algo
     * que va a fallar.
     */
    onBorrar?: () => void;
    onEditar?: () => void;
    /**
     * Pasa este mensaje a otro chat. Sin esto había que descargar la foto,
     * abrir el otro chat y volver a adjuntarla -- y como eso se termina
     * haciendo desde el celular, la foto quedaba fuera del hilo del ERP.
     */
    onReenviar?: () => void;
    /** Texto que se puede llevar al portapapeles. No envia nada. */
    textoCopiable?: string;
    /** Clases del disparador; el móvil manda las suyas para llegar a 44px. */
    claseBoton?: string;
    /** De qué lado abrir el menú, para que no se salga de la burbuja. */
    alineacion?: 'izquierda' | 'derecha';
    /**
     * Hacia dónde se despliega POR PREFERENCIA. Si de ese lado no entra y
     * del otro sí, se abre igual del lado que entra: el disparador del hilo
     * vive en la esquina de arriba de la burbuja, y con una dirección fija
     * el menú del último mensaje -- el que más se usa -- quedaba cortado
     * contra la caja de escribir.
     */
    abrirHacia?: 'arriba' | 'abajo';
}

export const MessageActions: React.FC<Props> = ({
    onResponder,
    onReaccionar,
    onBorrar,
    onEditar,
    onReenviar,
    textoCopiable,
    claseBoton,
    alineacion = 'derecha',
    abrirHacia = 'arriba',
}) => {
    const [abierto, setAbierto] = useState(false);
    const [haciaAbajo, setHaciaAbajo] = useState(abrirHacia === 'abajo');
    const [copiado, setCopiado] = useState(false);
    const [falloCopia, setFalloCopia] = useState(false);
    const contenedorRef = useRef<HTMLDivElement>(null);

    /**
     * Al abrirlo, mira cuánto sitio queda de cada lado DENTRO del hilo (el
     * contenedor con scroll, no la ventana: el hilo termina bastante antes,
     * donde empieza la caja de escribir) y se abre del lado que entra.
     */
    useEffect(() => {
        if (!abierto) return;
        const disparador = contenedorRef.current;
        if (!disparador) return;

        const limite = disparador.closest('.wa-scroll')?.getBoundingClientRect();
        const arribaDe = limite?.top ?? 0;
        const abajoDe = limite?.bottom ?? window.innerHeight;
        const r = disparador.getBoundingClientRect();
        // El alto cambia según las acciones disponibles (un mensaje
        // histórico puede tener solo Copiar y Reenviar). Medirlo evita que
        // el menú completo se corte contra el compositor del chat.
        const altoMenu =
            disparador.querySelector<HTMLElement>('[role="menu"]')?.getBoundingClientRect().height ?? 200;

        const cabeAbajo = abajoDe - r.bottom >= altoMenu;
        const cabeArriba = r.top - arribaDe >= altoMenu;

        let abajo = abrirHacia === 'abajo';
        if (abajo && !cabeAbajo && cabeArriba) abajo = false;
        if (!abajo && !cabeArriba && cabeAbajo) abajo = true;
        setHaciaAbajo(abajo);
    }, [abierto, abrirHacia]);

    useEffect(() => {
        if (!abierto) return;
        const fuera = (e: MouseEvent) => {
            if (!contenedorRef.current?.contains(e.target as Node)) setAbierto(false);
        };
        const escape = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', escape);
        };
    }, [abierto]);

    const cerrarY = (accion: () => void) => () => {
        setAbierto(false);
        accion();
    };

    const copiar = async () => {
        if (!textoCopiable) return;
        const ok = await copiarTexto(textoCopiable);
        if (ok) {
            setCopiado(true);
            setFalloCopia(false);
        } else {
            setFalloCopia(true);
        }
        setTimeout(() => {
            setCopiado(false);
            setFalloCopia(false);
        }, 1600);
    };

    return (
        <div className="relative inline-block" ref={contenedorRef}>
            <button
                type="button"
                onClick={() => setAbierto((v) => !v)}
                aria-label="Acciones del mensaje"
                aria-expanded={abierto}
                title="Acciones del mensaje"
                className={claseBoton ?? 'rounded p-1 text-wa-meta hover:bg-wa-inset/10 hover:text-wa-text'}
            >
                {/* El galoncito hacia abajo: el mismo gesto que WhatsApp Web
                    para abrir las acciones de un mensaje. */}
                <ChevronDown size={16} aria-hidden="true" />
            </button>

            {abierto && (
                <div
                    className={cn(
                        // w-56: los seis emoji miden 192px y en w-44 el ultimo quedaba cortado.
                        'absolute z-30 w-56 overflow-hidden rounded-xl border border-wa-divider bg-wa-panel shadow-lg',
                        haciaAbajo ? 'top-full mt-1' : 'bottom-full mb-1',
                        alineacion === 'derecha' ? 'right-0' : 'left-0',
                    )}
                    role="menu"
                >
                    {/* Los emoji van arriba y en fila: es la acción más
                        frecuente y la que menos merece un menú. */}
                    {onReaccionar && (
                        <div className="flex items-center justify-between border-b border-wa-divider px-2 py-1.5">
                            {EMOJIS.map((e) => (
                                <button
                                    type="button"
                                    key={e}
                                    onClick={cerrarY(() => onReaccionar(e))}
                                    aria-label={`Reaccionar con ${e}`}
                                    className="h-8 min-w-[32px] rounded-lg text-base hover:bg-wa-hover active:bg-wa-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wa-accent"
                                >
                                    {e}
                                </button>
                            ))}
                        </div>
                    )}

                    {onResponder && (
                        <button
                            type="button"
                            onClick={cerrarY(onResponder)}
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-wa-text hover:bg-wa-hover focus-visible:outline-none focus-visible:bg-wa-hover"
                        >
                            <Reply size={14} aria-hidden="true" /> Responder citando
                        </button>
                    )}

                    {onReenviar && (
                        <button
                            type="button"
                            onClick={cerrarY(onReenviar)}
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-wa-text hover:bg-wa-hover focus-visible:outline-none focus-visible:bg-wa-hover"
                        >
                            <Forward size={14} aria-hidden="true" /> Reenviar
                        </button>
                    )}

                    {textoCopiable && (
                        <button
                            type="button"
                            onClick={() => void copiar()}
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-wa-text hover:bg-wa-hover focus-visible:outline-none focus-visible:bg-wa-hover"
                        >
                            {copiado ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                            {copiado ? 'Copiado' : falloCopia ? 'No se pudo copiar' : 'Copiar mensaje'}
                        </button>
                    )}

                    {onEditar && (
                        <button
                            type="button"
                            onClick={cerrarY(onEditar)}
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-wa-text hover:bg-wa-hover focus-visible:outline-none focus-visible:bg-wa-hover"
                        >
                            <Pencil size={14} aria-hidden="true" /> Editar mensaje
                        </button>
                    )}

                    {onBorrar && (
                        <button
                            type="button"
                            onClick={cerrarY(onBorrar)}
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-wa-danger hover:bg-wa-hover focus-visible:outline-none focus-visible:bg-wa-hover"
                        >
                            <Trash2 size={14} aria-hidden="true" /> Borrar para todos
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * La tarjetita del mensaje que se está citando, arriba de la caja de
 * escribir. Sin ella no hay forma de saber a qué se está contestando --
 * sobre todo si el cliente mandó varios mensajes seguidos.
 */
export const CitaEnComposer: React.FC<{
    texto: string;
    onQuitar: () => void;
    /** Sin uso: se conserva para no romper llamadas viejas. */
    oscuro?: boolean;
}> = ({ texto, onQuitar }) => (
    <div className="flex items-stretch gap-2 overflow-hidden rounded-lg bg-wa-inset/[0.07]">
        {/* La barra verde de la izquierda es la señal de WhatsApp para
            "esto es una cita". Sin ella la tarjeta se lee como un aviso. */}
        <span className="w-1 shrink-0 rounded-l bg-wa-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1 py-1.5">
            <p className="flex items-center gap-1 text-[12.5px] font-semibold text-wa-accent">
                <Reply size={12} aria-hidden="true" /> Respondiendo a
            </p>
            <p className="line-clamp-2 text-[12.5px] text-wa-meta">{texto}</p>
        </div>
        <button
            onClick={onQuitar}
            aria-label="No citar este mensaje"
            className="shrink-0 px-2.5 text-wa-meta hover:text-wa-text"
        >
            <X size={16} aria-hidden="true" />
        </button>
    </div>
);

export default MessageActions;
