import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, UserPen, X } from 'lucide-react';
import { useBackDismiss } from '../../hooks/useBackDismiss';
import { guardarNombreContacto, MAX_NOMBRE_CONTACTO } from '../../utils/whatsappContacto';
import { cn, focusRing } from '../ui/styles';

/**
 * Ponerle nombre a un chat sin salir de la bandeja.
 *
 * Es la pieza que faltaba para poder trabajar de verdad desde acá: hasta
 * ahora el nombre venía solo del perfil de WhatsApp del cliente, no se
 * podía tocar desde ninguna pantalla, y la mitad de los chats se leían como
 * un número de diez dígitos. Buscar «Taller Vélez» no encontraba nada.
 *
 * El nombre se usa en toda la bandeja: la lista, el encabezado del chat, el
 * buscador, la proforma y el aviso de llegada. Por eso se escribe en un
 * solo lugar (`utils/whatsappContacto.ts`) y no en cada pantalla.
 *
 * Compartido por escritorio y móvil, como MoverChatModal: una acción no
 * puede existir en una pantalla y faltar en la otra.
 */

interface Props {
    isOpen: boolean;
    conversationId: number | null;
    /** El nombre vigente, si tiene. */
    nombreActual: string | null;
    /** El teléfono formateado. Es lo que se ve cuando no hay nombre. */
    telefono: string;
    onClose: () => void;
    /** Refleja el cambio en la lista sin esperar a recargar. */
    onRenombrado: (conversationId: number, nombre: string | null) => void;
}

export const RenombrarContactoModal: React.FC<Props> = ({
    isOpen,
    conversationId,
    nombreActual,
    telefono,
    onClose,
    onRenombrado,
}) => {
    const [nombre, setNombre] = useState(nombreActual ?? '');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const cajaRef = useRef<HTMLInputElement>(null);
    useBackDismiss(isOpen && !guardando, onClose);

    useEffect(() => {
        if (!isOpen) return;
        setNombre(nombreActual ?? '');
        setError(null);
        const foco = requestAnimationFrame(() => {
            cajaRef.current?.focus();
            cajaRef.current?.select();
        });
        return () => cancelAnimationFrame(foco);
    }, [isOpen, nombreActual]);

    if (!isOpen || conversationId === null) return null;

    const limpio = nombre.trim().replace(/\s+/g, ' ');
    const sinCambios = limpio === (nombreActual ?? '').trim();

    const guardar = async (destino: string | null) => {
        if (guardando) return;
        setGuardando(true);
        setError(null);
        try {
            const guardado = await guardarNombreContacto(conversationId, destino);
            onRenombrado(conversationId, guardado);
            onClose();
        } catch (err: any) {
            setError(err?.message ?? 'No se pudo guardar el nombre.');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[170] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
            onPointerDown={(e) => {
                if (e.target === e.currentTarget && !guardando) onClose();
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="renombrar-contacto-titulo"
                className="w-full overflow-hidden rounded-t-3xl border border-wa-divider bg-wa-panel shadow-2xl sm:max-w-md sm:rounded-2xl"
            >
                <div className="flex items-start gap-3 border-b border-wa-divider px-5 py-4">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-wa-accent-strong/10 text-wa-accent-strong">
                        <UserPen size={18} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 id="renombrar-contacto-titulo" className="text-base font-semibold text-wa-text">
                            Nombre del contacto
                        </h2>
                        <p className="truncate text-[13px] text-wa-meta">{telefono}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={guardando}
                        aria-label="Cerrar"
                        className={cn(
                            focusRing,
                            'flex h-9 w-9 items-center justify-center rounded-full text-wa-meta hover:bg-wa-hover disabled:opacity-40',
                        )}
                    >
                        <X size={19} aria-hidden="true" />
                    </button>
                </div>

                <form
                    className="space-y-3 px-5 py-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!sinCambios) void guardar(limpio || null);
                    }}
                >
                    <div>
                        <label htmlFor="nombre-contacto" className="mb-1 block text-sm font-medium text-wa-text">
                            Cómo querés verlo en la bandeja
                        </label>
                        <input
                            id="nombre-contacto"
                            ref={cajaRef}
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            disabled={guardando}
                            maxLength={MAX_NOMBRE_CONTACTO}
                            autoComplete="off"
                            placeholder="Taller Vélez · Dmax blanca"
                            className={cn(
                                focusRing,
                                'h-11 w-full rounded-xl border border-wa-divider bg-wa-inset/[0.05] px-3 text-[15px] text-wa-text placeholder:text-wa-meta disabled:opacity-50',
                            )}
                        />
                        <p className="mt-1 text-[11.5px] leading-4 text-wa-meta">
                            Sirve para reconocerlo y para buscarlo. Poné lo que de verdad ayuda a ubicarlo: el
                            taller, el vehículo, la zona.
                        </p>
                    </div>

                    {/* Que este nombre pueda volver atrás no es un detalle:
                        el proceso del agente reescribe el campo cuando el
                        cliente cambia su perfil de WhatsApp. Mejor decirlo
                        que dejar que alguien lo descubra un mes después. */}
                    <p className="rounded-lg bg-wa-inset/[0.07] px-3 py-2 text-[11.5px] leading-4 text-wa-meta">
                        Solo cambia cómo se ve el chat en el ERP. No le llega al cliente y no modifica su
                        ficha ni lo que sale impreso en una factura.
                    </p>

                    {error && (
                        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-[12.5px] text-danger-soft-fg">
                            {error}
                        </p>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1">
                        {nombreActual ? (
                            <button
                                type="button"
                                onClick={() => void guardar(null)}
                                disabled={guardando}
                                title="Volver al nombre que trae WhatsApp"
                                className={cn(
                                    focusRing,
                                    'flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-wa-meta hover:bg-wa-hover disabled:opacity-40',
                                )}
                            >
                                <RotateCcw size={15} aria-hidden="true" />
                                Quitar nombre
                            </button>
                        ) : (
                            <span />
                        )}

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={guardando}
                                className={cn(
                                    focusRing,
                                    'h-10 rounded-lg px-4 text-sm font-semibold text-wa-meta hover:bg-wa-hover disabled:opacity-40',
                                )}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={guardando || sinCambios}
                                className={cn(
                                    focusRing,
                                    'h-10 rounded-lg bg-wa-accent-strong px-4 text-sm font-semibold text-wa-accent-fg transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45',
                                )}
                            >
                                {guardando ? 'Guardando…' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </form>
            </section>
        </div>
    );
};

export default RenombrarContactoModal;
