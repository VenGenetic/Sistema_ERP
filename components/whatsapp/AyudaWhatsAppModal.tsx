import React from 'react';
import {
    Bot,
    BookOpenText,
    CheckCheck,
    CircleAlert,
    Clock3,
    Forward,
    Keyboard,
    MessageSquareReply,
    Plus,
    ShieldCheck,
    Sparkles,
    type LucideIcon,
} from 'lucide-react';
import Modal from '../ui/Modal';
import { cn, focusRing } from '../ui/styles';

export interface AccionRapidaWhatsApp {
    id: string;
    titulo: string;
    detalle: string;
    teclas: string[];
    icono: LucideIcon;
    onEjecutar: () => void;
    disabled?: boolean;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    acciones?: AccionRapidaWhatsApp[];
}

type Seccion = 'guia' | 'atajos';

const PASOS = [
    {
        titulo: '1. Elegí qué atender',
        detalle: 'Usá No leídos, Pendientes o Por cotizar. La IA mueve cada chat cuando cambia su situación.',
        icono: Sparkles,
    },
    {
        titulo: '2. Revisá el contexto',
        detalle: 'Leé el hilo y la ficha del cliente antes de ofrecer una pieza o un precio.',
        icono: BookOpenText,
    },
    {
        titulo: '3. Tomá el chat si hace falta',
        detalle: 'Si la IA está atendiendo, apagála en ese chat antes de responder vos.',
        icono: Bot,
    },
    {
        titulo: '4. Respondé con las herramientas',
        detalle: 'El botón + abre archivos, catálogo, proforma, pedido y respuestas rápidas.',
        icono: Plus,
    },
    {
        titulo: '5. Dejá claro qué sigue',
        detalle: 'Si no podés resolverlo, marcá el chat como no leído para que siga pendiente.',
        icono: Clock3,
    },
];

/**
 * Ayuda contextual del puesto de atención.
 *
 * Abre primero una guía corta y opcional: no interrumpe el trabajo con un
 * recorrido obligatorio. En escritorio suma las acciones ejecutables y sus
 * teclas; en móvil se usa la misma guía sin mostrar atajos que allí no aplican.
 */
export const AyudaWhatsAppModal: React.FC<Props> = ({ isOpen, onClose, acciones = [] }) => {
    const [seccion, setSeccion] = React.useState<Seccion>('guia');
    const idBase = React.useId();
    const tieneAtajos = acciones.length > 0;

    React.useEffect(() => {
        if (isOpen) setSeccion('guia');
    }, [isOpen]);

    const ejecutar = (accion: AccionRapidaWhatsApp) => {
        if (accion.disabled) return;
        onClose();
        // El modal devuelve el foco al control que lo abrió. La acción corre
        // después para que Buscar o Responder puedan quedarse con ese foco.
        window.setTimeout(accion.onEjecutar, 0);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Ayuda de WhatsApp"
            subtitle="Una guía corta para atender clientes desde el ERP."
            width="lg"
        >
            {tieneAtajos && (
                <div
                    role="tablist"
                    aria-label="Secciones de ayuda"
                    className="mb-4 grid grid-cols-2 rounded-xl bg-surface-2 p-1"
                >
                    {([
                        { id: 'guia' as const, texto: 'Guía rápida', icono: BookOpenText },
                        { id: 'atajos' as const, texto: 'Acciones rápidas', icono: Keyboard },
                    ]).map((item) => {
                        const Icono = item.icono;
                        const activa = seccion === item.id;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                role="tab"
                                id={`${idBase}-tab-${item.id}`}
                                aria-selected={activa}
                                aria-controls={`${idBase}-panel-${item.id}`}
                                onClick={() => setSeccion(item.id)}
                                className={cn(
                                    focusRing,
                                    'flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors',
                                    activa ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
                                )}
                            >
                                <Icono size={16} aria-hidden="true" />
                                {item.texto}
                            </button>
                        );
                    })}
                </div>
            )}

            {seccion === 'guia' && (
                <div
                    id={`${idBase}-panel-guia`}
                    role={tieneAtajos ? 'tabpanel' : undefined}
                    aria-labelledby={tieneAtajos ? `${idBase}-tab-guia` : undefined}
                    className="space-y-4"
                >
                    <div className="flex gap-3 rounded-xl border border-warning/35 bg-warning-soft p-3 text-warning-soft-fg">
                        <ShieldCheck size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <div>
                            <p className="text-sm font-bold">Respondé siempre desde este sistema</p>
                            <p className="mt-0.5 text-xs leading-5">
                                Así la conversación queda completa en el ERP. Lo escrito desde el teléfono puede llegar cifrado y no quedar legible aquí.
                            </p>
                        </div>
                    </div>

                    <section aria-labelledby={`${idBase}-flujo`}>
                        <h3 id={`${idBase}-flujo`} className="text-sm font-bold text-fg">Flujo diario</h3>
                        <ol className="mt-2 grid gap-2 sm:grid-cols-2">
                            {PASOS.map((paso) => {
                                const Icono = paso.icono;
                                return (
                                    <li key={paso.titulo} className="flex gap-3 rounded-xl border border-subtle bg-surface px-3 py-2.5">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg">
                                            <Icono size={17} aria-hidden="true" />
                                        </span>
                                        <span>
                                            <span className="block text-sm font-semibold text-fg">{paso.titulo}</span>
                                            <span className="mt-0.5 block text-xs leading-4 text-fg-muted">{paso.detalle}</span>
                                        </span>
                                    </li>
                                );
                            })}
                        </ol>
                    </section>

                    <section aria-labelledby={`${idBase}-senales`}>
                        <h3 id={`${idBase}-senales`} className="text-sm font-bold text-fg">Señales útiles</h3>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {[
                                { icono: Bot, texto: 'Atendiendo IA: el agente sigue ese chat; no necesitás intervenir.' },
                                { icono: CircleAlert, texto: 'Pendiente: hace falta una respuesta, cotización o revisión humana.' },
                                { icono: CheckCheck, texto: 'Un check indica enviado; el doble muestra entrega o lectura.' },
                                { icono: Forward, texto: 'La flecha de cada mensaje permite citarlo o reenviarlo a otro cliente.' },
                                { icono: MessageSquareReply, texto: 'En cola: el agente todavía está despachando; podés cancelar o reintentar.' },
                            ].map((senal) => {
                                const Icono = senal.icono;
                                return (
                                    <div key={senal.texto} className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs leading-4 text-fg-muted">
                                        <Icono size={15} className="mt-0.5 shrink-0 text-fg-subtle" aria-hidden="true" />
                                        <span>{senal.texto}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>
            )}

            {tieneAtajos && seccion === 'atajos' && (
                <div
                    id={`${idBase}-panel-atajos`}
                    role="tabpanel"
                    aria-labelledby={`${idBase}-tab-atajos`}
                >
                    <div className="grid gap-2 sm:grid-cols-2">
                        {acciones.map((accion) => {
                            const Icono = accion.icono;
                            return (
                                <button
                                    type="button"
                                    key={accion.id}
                                    onClick={() => ejecutar(accion)}
                                    disabled={accion.disabled}
                                    aria-keyshortcuts={accion.teclas
                                        .map((tecla) => (tecla === 'Ctrl' ? 'Control' : tecla))
                                        .join('+')}
                                    className={cn(
                                        focusRing,
                                        'group flex min-h-[72px] cursor-pointer items-center gap-3 rounded-xl border border-subtle bg-surface px-3 py-2.5 text-left transition-colors',
                                        'hover:border-primary/35 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-45',
                                    )}
                                >
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg">
                                        <Icono size={19} aria-hidden="true" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-semibold text-fg">{accion.titulo}</span>
                                        <span className="mt-0.5 block text-xs leading-4 text-fg-muted">{accion.detalle}</span>
                                    </span>
                                    <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
                                        {accion.teclas.map((tecla) => (
                                            <kbd
                                                key={tecla}
                                                className="min-w-6 rounded-md border border-strong bg-surface-2 px-1.5 py-1 text-center font-mono text-[10px] font-semibold leading-none text-fg-muted shadow-sm"
                                            >
                                                {tecla}
                                            </kbd>
                                        ))}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-4 border-t border-subtle pt-3 text-xs text-fg-muted">
                        Las teclas de una sola letra se pausan mientras escribís un mensaje o cuando hay una ventana abierta.
                    </p>
                </div>
            )}
        </Modal>
    );
};

export default AyudaWhatsAppModal;
