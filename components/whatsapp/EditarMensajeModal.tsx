import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bold, Clock3, Code, Italic, Pencil, Strikethrough, X } from 'lucide-react';
import { useBackDismiss } from '../../hooks/useBackDismiss';
import { alternarMarca, ATAJOS_DE_FORMATO } from '../../utils/formatoWhatsApp';
import { cuentaRegresiva, restanteParaEditar } from '../../utils/whatsappOutbox';
import { cn, focusRing } from '../ui/styles';
import { TextoDeMensaje } from './ChatThread';

/**
 * Corregir un mensaje que ya salió, sin salir del chat.
 *
 * Antes esto era un `window.prompt`, y eso costaba ventas: la caja gris del
 * navegador muestra el texto en una sola línea, así que una cotización de
 * tres repuestos con saltos de línea se veía como un renglón ilegible y no
 * había forma de corregir el precio sin volver a escribirla entera. Además
 * el prompt no puede aplicar formato -- y lo que se corrige suele ser
 * justamente el número en negrita.
 *
 * Lo que este modal agrega y el prompt no podía dar:
 *
 *   - el texto ORIGINAL a la vista, para comparar contra lo que se cambia;
 *   - la misma barra de formato del compositor (*negrita*, _cursiva_, ...)
 *     con los mismos atajos, para no aprender dos maneras de escribir;
 *   - una vista previa de cómo le va a quedar al cliente;
 *   - el CONTADOR del plazo de WhatsApp corriendo en pantalla. WhatsApp
 *     solo acepta la corrección dentro de los 15 minutos y pasado ese
 *     tiempo la descarta EN SILENCIO: sin el contador, alguien escribía la
 *     corrección con calma, la guardaba, y el cliente seguía viendo el
 *     precio equivocado sin que nadie se enterara.
 */

interface Props {
    isOpen: boolean;
    /** El texto tal como salió. */
    original: string;
    /** Cuándo se envió: de acá sale el plazo que queda. */
    enviadoEn: string;
    guardando?: boolean;
    error?: string | null;
    onGuardar: (texto: string) => void;
    onClose: () => void;
}

const ICONO_DE_MARCA: Record<string, React.ReactNode> = {
    '*': <Bold size={15} aria-hidden="true" />,
    _: <Italic size={15} aria-hidden="true" />,
    '~': <Strikethrough size={15} aria-hidden="true" />,
    '`': <Code size={15} aria-hidden="true" />,
};

/** Debajo de esto el contador se pone en rojo: ya no da para pensarlo. */
const APURO_MS = 60 * 1000;

export const EditarMensajeModal: React.FC<Props> = ({
    isOpen,
    original,
    enviadoEn,
    guardando = false,
    error,
    onGuardar,
    onClose,
}) => {
    const [texto, setTexto] = useState(original);
    const [restante, setRestante] = useState(() => restanteParaEditar(enviadoEn));
    const cajaRef = useRef<HTMLTextAreaElement>(null);
    useBackDismiss(isOpen && !guardando, onClose);

    // Al abrirse se parte del texto vigente, no del que quedó de la vez
    // anterior: el modal es uno solo y lo reusan todos los mensajes.
    useEffect(() => {
        if (!isOpen) return;
        setTexto(original);
        setRestante(restanteParaEditar(enviadoEn));
        const foco = requestAnimationFrame(() => {
            const caja = cajaRef.current;
            if (!caja) return;
            caja.focus();
            // El cursor al final, no seleccionando todo: casi siempre se
            // corrige una palabra, no se reescribe el mensaje.
            caja.setSelectionRange(caja.value.length, caja.value.length);
        });
        return () => cancelAnimationFrame(foco);
    }, [isOpen, original, enviadoEn]);

    // El contador corre solo mientras el modal está abierto.
    useEffect(() => {
        if (!isOpen) return;
        const t = window.setInterval(() => setRestante(restanteParaEditar(enviadoEn)), 1000);
        return () => window.clearInterval(t);
    }, [isOpen, enviadoEn]);

    const aplicarFormato = useCallback((marca: string) => {
        const caja = cajaRef.current;
        if (!caja) return;
        const cambio = alternarMarca(caja.value, caja.selectionStart, caja.selectionEnd, marca);
        setTexto(cambio.texto);
        // El textarea se redibuja al cambiar el valor y el cursor se iría al
        // final: la selección se repone en el cuadro siguiente.
        requestAnimationFrame(() => {
            caja.focus();
            caja.setSelectionRange(cambio.inicio, cambio.fin);
        });
    }, []);

    const limpio = texto.trim();
    const vencido = restante <= 0;
    const sinCambios = limpio === original.trim();
    const puedeGuardar = !guardando && !vencido && !sinCambios && limpio.length > 0;

    const guardar = useCallback(() => {
        if (!puedeGuardar) return;
        onGuardar(limpio);
    }, [puedeGuardar, onGuardar, limpio]);

    const alTeclear = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const atajo = ATAJOS_DE_FORMATO.find(
            (a) => a.tecla === e.key.toLowerCase() && a.conShift === e.shiftKey,
        );
        if ((e.ctrlKey || e.metaKey) && atajo) {
            e.preventDefault();
            aplicarFormato(atajo.marca);
            return;
        }
        // Enter solo hace salto de línea: guardar con Enter borraría de un
        // dedazo la corrección a medio escribir de una cotización larga.
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            guardar();
        }
    };

    if (!isOpen) return null;

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
                aria-labelledby="editar-mensaje-titulo"
                className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-wa-divider bg-wa-panel shadow-2xl sm:max-w-lg sm:rounded-2xl"
            >
                <div className="flex items-start gap-3 border-b border-wa-divider px-5 py-4">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-wa-accent-strong/10 text-wa-accent-strong">
                        <Pencil size={18} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 id="editar-mensaje-titulo" className="text-base font-semibold text-wa-text">
                            Corregir mensaje
                        </h2>
                        <p className="text-[13px] text-wa-meta">
                            El cliente verá el texto corregido con la marca «editado».
                        </p>
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

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                    {/* El plazo, siempre a la vista. Es la información que
                        decide si vale la pena corregir o conviene mandar un
                        mensaje nuevo aclarando. */}
                    <div
                        className={cn(
                            'flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] leading-4',
                            vencido
                                ? 'bg-danger-soft text-danger-soft-fg'
                                : restante <= APURO_MS
                                  ? 'bg-warning-soft text-warning-soft-fg'
                                  : 'bg-wa-inset/[0.07] text-wa-meta',
                        )}
                        role={vencido ? 'alert' : undefined}
                    >
                        <Clock3 size={15} className="shrink-0" aria-hidden="true" />
                        {vencido ? (
                            <span>
                                Se venció el plazo de WhatsApp para corregir (15 minutos). Cerrá y mandá un
                                mensaje nuevo aclarando: una corrección ahora no le llegaría al cliente.
                            </span>
                        ) : (
                            <span>
                                Quedan <strong className="tnum font-semibold">{cuentaRegresiva(restante)}</strong>{' '}
                                para que WhatsApp acepte la corrección.
                            </span>
                        )}
                    </div>

                    <div>
                        <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-wa-meta">
                            Texto actual
                        </p>
                        <div className="max-h-24 overflow-y-auto rounded-lg border-l-2 border-wa-accent bg-wa-inset/[0.07] px-3 py-2 text-[13px] leading-5 text-wa-meta">
                            <span className="whitespace-pre-wrap break-words">{original}</span>
                        </div>
                    </div>

                    <div>
                        <div className="mb-1 flex items-center justify-between gap-2">
                            <label
                                htmlFor="editar-mensaje-caja"
                                className="text-[11.5px] font-semibold uppercase tracking-wide text-wa-meta"
                            >
                                Texto corregido
                            </label>
                            <div className="flex items-center gap-0.5" role="group" aria-label="Formato del texto">
                                {ATAJOS_DE_FORMATO.map((a) => (
                                    <button
                                        key={a.marca}
                                        type="button"
                                        /* `preventDefault` en mousedown: sin esto el clic
                                           le saca el foco al textarea y con el foco se va
                                           la selección, así que se aplicaría sobre nada. */
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => aplicarFormato(a.marca)}
                                        disabled={guardando || vencido}
                                        title={`${a.nombre} · ${a.hint}`}
                                        aria-label={a.nombre}
                                        className={cn(
                                            focusRing,
                                            'flex h-8 w-8 items-center justify-center rounded-lg text-wa-meta transition-colors hover:bg-wa-hover hover:text-wa-text disabled:opacity-40',
                                        )}
                                    >
                                        {ICONO_DE_MARCA[a.marca]}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <textarea
                            id="editar-mensaje-caja"
                            ref={cajaRef}
                            value={texto}
                            onChange={(e) => setTexto(e.target.value)}
                            onKeyDown={alTeclear}
                            disabled={guardando || vencido}
                            rows={5}
                            className={cn(
                                focusRing,
                                'w-full resize-y rounded-xl border border-wa-divider bg-wa-inset/[0.05] px-3 py-2.5 text-[14px] leading-5 text-wa-text placeholder:text-wa-meta disabled:opacity-50',
                            )}
                            placeholder="Escribí el mensaje corregido…"
                        />
                        <p className="mt-1 text-[11.5px] text-wa-meta">
                            Ctrl+Enter guarda. Enter hace un salto de línea.
                        </p>
                    </div>

                    {!sinCambios && limpio.length > 0 && (
                        <div>
                            <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-wa-meta">
                                Cómo lo va a ver el cliente
                            </p>
                            <div className="rounded-xl rounded-tr-sm bg-wa-out px-3 py-2 text-[14px] leading-5 text-wa-text">
                                <span className="whitespace-pre-wrap break-words">
                                    <TextoDeMensaje texto={limpio} />
                                </span>
                                <span className="ml-2 align-baseline text-[11px] italic text-wa-meta">editado</span>
                            </div>
                        </div>
                    )}

                    {error && (
                        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-[12.5px] text-danger-soft-fg">
                            {error}
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-wa-divider px-5 py-3">
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
                        type="button"
                        onClick={guardar}
                        disabled={!puedeGuardar}
                        className={cn(
                            focusRing,
                            'h-10 rounded-lg bg-wa-accent-strong px-4 text-sm font-semibold text-wa-accent-fg transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45',
                        )}
                    >
                        {guardando ? 'Guardando…' : 'Guardar corrección'}
                    </button>
                </div>
            </section>
        </div>
    );
};

export default EditarMensajeModal;
