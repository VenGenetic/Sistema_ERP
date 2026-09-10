import React, { useMemo, useState } from 'react';
import { Bot, Check, CheckCheck, Clock, FolderInput, Headset, Sparkles, X } from 'lucide-react';
import { useBackDismiss } from '../../hooks/useBackDismiss';
import { guardarBandejaManual } from '../../utils/whatsappBandejaManual';
import { BANDEJAS, type Bandeja, type BandejaManual } from './bandejas';
import { cn, focusRing } from '../ui/styles';

interface Props {
    isOpen: boolean;
    conversationId: number | null;
    nombre: string;
    bandejaActual: Bandeja | null;
    bandejaManual: BandejaManual | null;
    iaActiva: boolean;
    userId: string | null;
    onClose: () => void;
    onMoved: (conversationId: number, destino: BandejaManual | null) => void;
}

const ICONO: Record<BandejaManual, React.ElementType> = {
    cotizar: Sparkles,
    responder: Headset,
    esperando: Clock,
    cerrados: CheckCheck,
};

const TONO: Record<BandejaManual, string> = {
    cotizar: 'bg-primary',
    responder: 'bg-wa-accent-strong',
    esperando: 'bg-warning',
    cerrados: 'bg-success',
};

/** Selector compartido por escritorio y móvil para no divergir reglas. */
const MoverChatModal: React.FC<Props> = ({
    isOpen,
    conversationId,
    nombre,
    bandejaActual,
    bandejaManual,
    iaActiva,
    userId,
    onClose,
    onMoved,
}) => {
    const [guardando, setGuardando] = useState<BandejaManual | 'auto' | null>(null);
    const [error, setError] = useState<string | null>(null);
    useBackDismiss(isOpen, onClose);

    const destinos = useMemo(
        () => BANDEJAS.filter((b): b is (typeof BANDEJAS)[number] & { id: BandejaManual } => b.id !== 'ia'),
        [],
    );

    if (!isOpen || conversationId === null) return null;

    const mover = async (destino: BandejaManual | null) => {
        if (guardando || (iaActiva && destino !== null)) return;
        setGuardando(destino ?? 'auto');
        setError(null);
        try {
            await guardarBandejaManual(conversationId, destino, userId);
            onMoved(conversationId, destino);
            onClose();
        } catch (err: any) {
            setError(err?.message ?? 'No se pudo mover el chat.');
        } finally {
            setGuardando(null);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[170] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
            onPointerDown={(event) => event.target === event.currentTarget && onClose()}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="mover-chat-titulo"
                className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-wa-divider bg-wa-panel shadow-2xl sm:max-w-md sm:rounded-2xl"
            >
                <div className="flex items-start gap-3 border-b border-wa-divider px-5 py-4">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-wa-accent-strong/10 text-wa-accent-strong">
                        <FolderInput size={19} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 id="mover-chat-titulo" className="text-base font-semibold text-wa-text">Mover a otra bandeja</h2>
                        <p className="truncate text-[13px] text-wa-meta">{nombre}</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Cerrar" className={cn(focusRing, 'flex h-9 w-9 items-center justify-center rounded-full text-wa-meta hover:bg-wa-hover')}>
                        <X size={19} aria-hidden="true" />
                    </button>
                </div>

                <div className="p-3">
                    <button
                        type="button"
                        disabled={!!guardando}
                        onClick={() => void mover(null)}
                        className={cn(
                            focusRing,
                            'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-wa-hover disabled:opacity-50',
                            bandejaManual === null && 'bg-wa-accent-strong/[0.09]',
                        )}
                    >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wa-inset/10 text-wa-meta">
                            <Bot size={18} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-wa-text">Automático</span>
                            <span className="block text-[12px] leading-4 text-wa-meta">
                                El sistema decide según quién debe responder y el estado del chat.
                            </span>
                        </span>
                        {bandejaManual === null && <Check size={18} className="shrink-0 text-wa-accent-strong" aria-label="Ubicación actual" />}
                    </button>

                    <div className="my-2 border-t border-wa-divider" />

                    {destinos.map((destino) => {
                        const Icon = ICONO[destino.id];
                        const activa = bandejaManual === destino.id || (bandejaManual === null && bandejaActual === destino.id);
                        return (
                            <button
                                key={destino.id}
                                type="button"
                                disabled={!!guardando || iaActiva}
                                onClick={() => void mover(destino.id)}
                                className={cn(
                                    focusRing,
                                    'group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-wa-hover disabled:cursor-not-allowed disabled:opacity-45',
                                    bandejaManual === destino.id && 'bg-wa-accent-strong/[0.09]',
                                )}
                            >
                                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wa-inset/10 text-wa-meta">
                                    <span className={cn('absolute inset-y-1 left-0 w-1 rounded-full', TONO[destino.id])} />
                                    <Icon size={18} aria-hidden="true" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold text-wa-text">{destino.texto}</span>
                                    <span className="block text-[12px] leading-4 text-wa-meta">{destino.ayuda}</span>
                                </span>
                                {activa && <Check size={18} className="shrink-0 text-wa-accent-strong" aria-label="Ubicación actual" />}
                            </button>
                        );
                    })}

                    {iaActiva ? (
                        <p className="mx-2 mt-2 rounded-lg bg-warning-soft px-3 py-2 text-[12px] leading-4 text-warning-soft-fg">
                            Este chat está atendido por la IA. Apágala antes de moverlo para evitar que una persona y la IA respondan al mismo tiempo.
                        </p>
                    ) : (
                        <p className="mx-2 mt-2 text-[11.5px] leading-4 text-wa-meta">
                            La ubicación manual dura hasta la próxima actividad. Cuando llegue o envíes un mensaje, el sistema vuelve a ordenarlo automáticamente.
                        </p>
                    )}

                    {error && <p role="alert" className="mx-2 mt-2 rounded-lg bg-danger-soft px-3 py-2 text-[12px] text-danger-soft-fg">{error}</p>}
                </div>
            </section>
        </div>
    );
};

export default MoverChatModal;
