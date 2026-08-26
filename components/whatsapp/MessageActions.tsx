import React, { useEffect, useRef, useState } from 'react';
import { MoreVertical, Reply, Trash2 } from 'lucide-react';
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
}

export const MessageActions: React.FC<Props> = ({
    onResponder,
    onReaccionar,
    onBorrar,
    claseBoton,
    alineacion = 'derecha',
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
                <MoreVertical size={14} aria-hidden="true" />
            </button>

            {abierto && (
                <div
                    className={cn(
                        'absolute z-30 bottom-full mb-1 w-44 rounded-xl border border-strong bg-surface shadow-lg overflow-hidden',
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
    oscuro?: boolean;
}> = ({ texto, onQuitar, oscuro }) => (
    <div
        className={cn(
            'flex items-start gap-2 rounded-lg px-2.5 py-1.5 border-l-2',
            oscuro ? 'bg-slate-800 border-amber-500' : 'bg-surface-2 border-primary',
        )}
    >
        <Reply size={13} className={cn('shrink-0 mt-0.5', oscuro ? 'text-amber-400' : 'text-primary')} aria-hidden="true" />
        <p className={cn('flex-1 min-w-0 text-xs line-clamp-2', oscuro ? 'text-slate-300' : 'text-fg-muted')}>
            {texto}
        </p>
        <button
            onClick={onQuitar}
            aria-label="No citar este mensaje"
            className={cn('shrink-0 text-xs px-1', oscuro ? 'text-slate-500' : 'text-fg-subtle')}
        >
            ✕
        </button>
    </div>
);

export default MessageActions;
