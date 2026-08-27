import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Reply, Trash2, X } from 'lucide-react';
import { cn } from '../ui/styles';

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
    onResponder: () => void;
    onReaccionar: (emoji: string) => void;
    /**
     * Solo se puede borrar para todos lo PROPIO, y WhatsApp además tiene un
     * plazo. Si no se puede, la opción no aparece en vez de ofrecer algo
     * que va a fallar.
     */
    onBorrar?: () => void;
    /** Clases del disparador; el móvil manda las suyas para llegar a 44px. */
    claseBoton?: string;
    /** De qué lado abrir el menú, para que no se salga de la burbuja. */
    alineacion?: 'izquierda' | 'derecha';
    /**
     * Hacia dónde se despliega. El disparador del hilo vive en la ESQUINA
     * DE ARRIBA de la burbuja (como en WhatsApp), así que ahí el menú tiene
     * que caer hacia abajo: hacia arriba se le salía del hilo al primer
     * mensaje de la conversación.
     */
    abrirHacia?: 'arriba' | 'abajo';
}

export const MessageActions: React.FC<Props> = ({
    onResponder,
    onReaccionar,
    onBorrar,
    claseBoton,
    alineacion = 'derecha',
    abrirHacia = 'arriba',
}) => {
    const [abierto, setAbierto] = useState(false);
    const contenedorRef = useRef<HTMLDivElement>(null);

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

    return (
        <div className="relative inline-block" ref={contenedorRef}>
            <button
                onClick={() => setAbierto((v) => !v)}
                aria-label="Acciones del mensaje"
                aria-expanded={abierto}
                className={claseBoton ?? 'p-1 rounded text-fg-subtle hover:text-fg hover:bg-surface-hover'}
            >
                {/* El galoncito hacia abajo: el mismo gesto que WhatsApp Web
                    para abrir las acciones de un mensaje. */}
                <ChevronDown size={16} aria-hidden="true" />
            </button>

            {abierto && (
                <div
                    className={cn(
                        'absolute z-30 w-44 rounded-xl border border-strong bg-surface shadow-lg overflow-hidden',
                        abrirHacia === 'abajo' ? 'top-full mt-1' : 'bottom-full mb-1',
                        alineacion === 'derecha' ? 'right-0' : 'left-0',
                    )}
                    role="menu"
                >
                    {/* Los emoji van arriba y en fila: es la acción más
                        frecuente y la que menos merece un menú. */}
                    <div className="flex items-center justify-between px-2 py-1.5 border-b border-subtle">
                        {EMOJIS.map((e) => (
                            <button
                                key={e}
                                onClick={cerrarY(() => onReaccionar(e))}
                                aria-label={`Reaccionar con ${e}`}
                                className="min-w-[32px] h-8 rounded-lg text-base hover:bg-surface-hover active:bg-surface-3"
                            >
                                {e}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={cerrarY(onResponder)}
                        role="menuitem"
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-fg hover:bg-surface-hover active:bg-surface-3"
                    >
                        <Reply size={14} aria-hidden="true" /> Responder citando
                    </button>

                    {onBorrar && (
                        <button
                            onClick={cerrarY(onBorrar)}
                            role="menuitem"
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-danger hover:bg-danger-soft active:bg-danger-soft"
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
    <div className="flex items-stretch gap-2 overflow-hidden rounded-lg bg-black/5 dark:bg-white/5">
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
