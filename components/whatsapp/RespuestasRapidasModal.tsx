import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import Modal from '../ui/Modal';
import { Button } from '../ui/Button';
import { cn, focusRing, input } from '../ui/styles';

/**
 * Administrar las respuestas rápidas: agregar, corregir y quitar.
 *
 * Antes solo se podían hacer dos de las tres cosas, y las dos mal. Se
 * guardaban con un `window.prompt` -- una caja gris del navegador donde no
 * se puede ver el texto que se está guardando ni corregirlo -- y se
 * quitaban con una equis pegada al costado de la lista, sin preguntar
 * nada: un dedo mal puesto en el teléfono borraba una plantilla que usa
 * todo el equipo. Corregir, directamente, no se podía: había que borrar y
 * volver a escribir.
 *
 * Son textos COMPARTIDOS (la tabla no es por usuario), así que cada cambio
 * acá se lo cambia a todos. Por eso el borrado pregunta antes y es lógico
 * (`is_active`) y no un DELETE: si alguien se equivoca, la fila sigue en
 * la base y se recupera.
 */

export interface RespuestaRapida {
    id: number;
    label: string;
    body: string;
    sort_order?: number | null;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    /** Para dejar registrado quién la creó. */
    userId?: string | null;
    /**
     * Texto con el que arranca una respuesta nueva. Es lo que estaba
     * escrito en la caja del chat cuando se eligió «guardar esto»: se abre
     * el formulario ya cargado en vez de preguntar en una caja del
     * navegador.
     */
    borradorInicial?: string;
    /** La lista cambió: quien la muestre tiene que recargarla. */
    onCambio?: () => void;
}

/** Nombre corto para reconocerla en el menú; el cuerpo es el mensaje. */
const MAX_NOMBRE = 40;
const MAX_CUERPO = 1000;

export const RespuestasRapidasModal: React.FC<Props> = ({
    isOpen,
    onClose,
    userId,
    borradorInicial,
    onCambio,
}) => {
    const [items, setItems] = useState<RespuestaRapida[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    /** `nueva`, el id de la que se está corrigiendo, o nada. */
    const [editando, setEditando] = useState<number | 'nueva' | null>(null);
    const [nombre, setNombre] = useState('');
    const [cuerpo, setCuerpo] = useState('');
    const [guardando, setGuardando] = useState(false);
    /** La que preguntó si se quita. La confirmación va en la fila misma. */
    const [porQuitar, setPorQuitar] = useState<number | null>(null);
    const guardandoRef = useRef(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        const { data, error: err } = await supabase
            .from('agent_quick_replies')
            .select('id, label, body, sort_order')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('label', { ascending: true });
        setCargando(false);
        if (err) {
            setError(`No se pudieron cargar: ${err.message}`);
            return;
        }
        setError(null);
        setItems((data ?? []) as RespuestaRapida[]);
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        cargar();
        setPorQuitar(null);
        setError(null);
        // Si vino texto del chat, se abre directo el formulario con él
        // adentro: ese es el gesto que lo trajo hasta acá.
        if (borradorInicial?.trim()) {
            setEditando('nueva');
            setCuerpo(borradorInicial.trim());
            setNombre(borradorInicial.trim().slice(0, 30));
        } else {
            setEditando(null);
            setCuerpo('');
            setNombre('');
        }
    }, [isOpen, borradorInicial, cargar]);

    const empezarNueva = () => {
        setEditando('nueva');
        setNombre('');
        setCuerpo('');
        setPorQuitar(null);
    };

    const empezarEdicion = (r: RespuestaRapida) => {
        setEditando(r.id);
        setNombre(r.label);
        setCuerpo(r.body);
        setPorQuitar(null);
    };

    const cancelar = () => {
        setEditando(null);
        setNombre('');
        setCuerpo('');
    };

    const puedeGuardar = nombre.trim().length > 0 && cuerpo.trim().length > 0 && !guardando;

    const guardar = async () => {
        if (!puedeGuardar || editando === null || guardandoRef.current) return;
        guardandoRef.current = true;
        setGuardando(true);
        setError(null);

        const campos = { label: nombre.trim().slice(0, MAX_NOMBRE), body: cuerpo.trim().slice(0, MAX_CUERPO) };

        // Las nuevas van al final: el orden de la lista es el que el equipo
        // ya tiene aprendido y una plantilla nueva no puede colarse arriba.
        const alFinal = Math.max(0, ...items.map((i) => i.sort_order ?? 0)) + 10;

        const { error: err } =
            editando === 'nueva'
                ? await supabase
                      .from('agent_quick_replies')
                      .insert({ ...campos, created_by: userId ?? null, sort_order: alFinal })
                : await supabase.from('agent_quick_replies').update(campos).eq('id', editando);

        guardandoRef.current = false;
        setGuardando(false);
        if (err) {
            setError(`No se pudo guardar: ${err.message}`);
            return;
        }
        cancelar();
        await cargar();
        onCambio?.();
    };

    const quitar = async (id: number) => {
        setError(null);
        // Baja lógica y no borrado: la puede estar usando otra persona del
        // equipo justo ahora, y recuperarla desde la base es trivial.
        const { error: err } = await supabase
            .from('agent_quick_replies')
            .update({ is_active: false })
            .eq('id', id);
        if (err) {
            setError(`No se pudo quitar: ${err.message}`);
            return;
        }
        setPorQuitar(null);
        setItems((prev) => prev.filter((r) => r.id !== id));
        onCambio?.();
    };

    const formulario = (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary-soft/40 p-3">
            <div>
                <label htmlFor="rr-nombre" className="mb-1 block text-xs font-medium text-fg">
                    Nombre corto
                </label>
                <input
                    id="rr-nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    maxLength={MAX_NOMBRE}
                    placeholder="Pedir el modelo"
                    className={cn(input.base, input.size.md)}
                />
                <p className="mt-1 text-[11px] text-fg-muted">Es lo que se ve en el menú del chat.</p>
            </div>
            <div>
                <label htmlFor="rr-cuerpo" className="mb-1 block text-xs font-medium text-fg">
                    Mensaje
                </label>
                <textarea
                    id="rr-cuerpo"
                    value={cuerpo}
                    onChange={(e) => setCuerpo(e.target.value)}
                    maxLength={MAX_CUERPO}
                    rows={4}
                    placeholder="El texto tal cual le va a llegar al cliente."
                    className={cn(input.textarea)}
                />
                <p className="mt-1 text-right text-[11px] tabular-nums text-fg-muted">
                    {cuerpo.length}/{MAX_CUERPO}
                </p>
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={cancelar}>
                    Cancelar
                </Button>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={guardar}
                    disabled={!puedeGuardar}
                    loading={guardando}
                    icon={<Check size={14} aria-hidden="true" />}
                >
                    {editando === 'nueva' ? 'Agregar' : 'Guardar'}
                </Button>
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Respuestas rápidas"
            subtitle="Los textos que el equipo repite todo el día. Se comparten entre todos."
            width="lg"
            footer={<Button onClick={onClose}>Listo</Button>}
        >
            <div className="space-y-3">
                {error && (
                    <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-soft-fg">{error}</p>
                )}

                {editando === 'nueva' ? (
                    formulario
                ) : (
                    <Button
                        variant="secondary"
                        size="sm"
                        fullWidth
                        onClick={empezarNueva}
                        icon={<Plus size={15} aria-hidden="true" />}
                    >
                        Agregar una respuesta
                    </Button>
                )}

                {cargando ? (
                    <p className="flex items-center justify-center gap-2 py-8 text-sm text-fg-muted">
                        <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                        Cargando…
                    </p>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-fg-muted">
                        <Zap size={20} aria-hidden="true" />
                        <p>Todavía no hay ninguna. La primera te ahorra el resto del día.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-subtle overflow-hidden rounded-lg border border-subtle">
                        {items.map((r) => (
                            <li key={r.id} className="p-3">
                                {editando === r.id ? (
                                    formulario
                                ) : (
                                    <div className="flex items-start gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-fg">{r.label}</p>
                                            <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-[18px] text-fg-muted">
                                                {r.body}
                                            </p>
                                        </div>

                                        {porQuitar === r.id ? (
                                            /* La confirmación va acá, en la fila, y no en
                                               una ventana del navegador: se ve CUÁL se
                                               está por quitar mientras se decide. */
                                            <div className="flex shrink-0 items-center gap-1.5">
                                                <span className="text-xs text-fg-muted">¿Quitarla?</span>
                                                <Button variant="danger" size="sm" onClick={() => quitar(r.id)}>
                                                    Sí
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => setPorQuitar(null)}>
                                                    No
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex shrink-0 items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => empezarEdicion(r)}
                                                    aria-label={`Corregir la respuesta ${r.label}`}
                                                    title="Corregir"
                                                    className={cn(
                                                        'flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg',
                                                        focusRing,
                                                    )}
                                                >
                                                    <Pencil size={15} aria-hidden="true" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setPorQuitar(r.id)}
                                                    aria-label={`Quitar la respuesta ${r.label}`}
                                                    title="Quitar"
                                                    className={cn(
                                                        'flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-danger-soft hover:text-danger',
                                                        focusRing,
                                                    )}
                                                >
                                                    <Trash2 size={15} aria-hidden="true" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </Modal>
    );
};

export default RespuestasRapidasModal;
