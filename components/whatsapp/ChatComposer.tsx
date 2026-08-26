import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Loader2, Package, Paperclip, Plus, Send, X, Zap } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { badge, button, cn, input } from '../ui/styles';
import CatalogSendModal from './CatalogSendModal';
import {
    borrarAdjunto,
    MAX_ADJUNTO_MB,
    subirAdjunto,
    type AdjuntoSubido,
    type NuevoMensaje,
} from '../../utils/whatsappOutbox';

/**
 * La caja de escribir del chat: texto, fotos, archivos, respuestas rápidas
 * y el buscador del catálogo.
 *
 * Todo lo que sale de acá se ENCOLA (`agent_outbox`) y lo despacha el
 * proceso del agente, que es el que tiene la sesión de WhatsApp. Ver
 * `utils/whatsappOutbox.ts`.
 *
 * Las fotos se suben apenas se eligen, no al enviar: así el envío es
 * instantáneo, se ve la miniatura real antes de mandarla, y un archivo
 * demasiado pesado se rechaza cuando todavía se puede cambiar -- no
 * después de escribir el mensaje.
 */

interface RespuestaRapida {
    id: number;
    label: string;
    body: string;
}

interface Props {
    conversationId: number;
    clienteLabel: string;
    userId: string | null;
    /** Encola los mensajes. La página decide cómo (y refresca el hilo). */
    onEnviar: (mensajes: NuevoMensaje[]) => Promise<void>;
}

/** Adjunto en pantalla: mientras sube todavía no tiene URL. */
interface AdjuntoLocal {
    /** Id de la tarjeta en pantalla, no de la base. */
    key: string;
    nombre: string;
    /** Miniatura local (blob), instantánea, mientras sube y después. */
    preview: string | null;
    subido: AdjuntoSubido | null;
    error: string | null;
}

export const ChatComposer: React.FC<Props> = ({ conversationId, clienteLabel, userId, onEnviar }) => {
    const [borrador, setBorrador] = useState('');
    const [adjuntos, setAdjuntos] = useState<AdjuntoLocal[]>([]);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [arrastrando, setArrastrando] = useState(false);
    const [catalogoAbierto, setCatalogoAbierto] = useState(false);
    const [rapidas, setRapidas] = useState<RespuestaRapida[]>([]);
    const [menuRapidas, setMenuRapidas] = useState(false);
    const [guardandoRapida, setGuardandoRapida] = useState(false);

    const fileRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const contenedorRef = useRef<HTMLDivElement>(null);

    // Cambiar de conversación limpia el borrador: seguir escribiendo en el
    // chat equivocado es el error más caro que se puede cometer acá.
    useEffect(() => {
        setBorrador('');
        setAdjuntos([]);
        setError(null);
        setMenuRapidas(false);
    }, [conversationId]);

    const cargarRapidas = useCallback(async () => {
        const { data, error: err } = await supabase
            .from('agent_quick_replies')
            .select('id, label, body')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('label', { ascending: true });
        if (err) {
            console.error('No se pudieron cargar las respuestas rápidas:', err.message);
            return;
        }
        setRapidas((data ?? []) as RespuestaRapida[]);
    }, []);

    useEffect(() => {
        cargarRapidas();
    }, [cargarRapidas]);

    // Cerrar el menú de respuestas rápidas al tocar fuera.
    useEffect(() => {
        if (!menuRapidas) return;
        const fuera = (e: MouseEvent) => {
            if (!contenedorRef.current?.contains(e.target as Node)) setMenuRapidas(false);
        };
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, [menuRapidas]);

    /* ---------------------------------------------------------------- */
    /*  Adjuntos                                                         */
    /* ---------------------------------------------------------------- */

    const agregarArchivos = useCallback(async (files: File[]) => {
        if (files.length === 0) return;
        setError(null);

        for (const file of files) {
            const key = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
            setAdjuntos((prev) => [...prev, { key, nombre: file.name || 'foto', preview, subido: null, error: null }]);

            try {
                const subido = await subirAdjunto(file);
                setAdjuntos((prev) => prev.map((a) => (a.key === key ? { ...a, subido } : a)));
            } catch (err: any) {
                const mensaje = err?.message ?? 'No se pudo subir el archivo.';
                setAdjuntos((prev) => prev.map((a) => (a.key === key ? { ...a, error: mensaje } : a)));
            }
        }
    }, []);

    const quitarAdjunto = (key: string) => {
        setAdjuntos((prev) => {
            const objetivo = prev.find((a) => a.key === key);
            if (objetivo?.preview) URL.revokeObjectURL(objetivo.preview);
            // Se borra del bucket lo que ya se había subido pero nadie va a
            // enviar: si no, cada descarte queda ocupando Storage para siempre.
            if (objetivo?.subido) borrarAdjunto(objetivo.subido.url);
            return prev.filter((a) => a.key !== key);
        });
    };

    /**
     * Pegar una foto con Ctrl+V. Es la forma más rápida de mandar una
     * captura o una foto que se acaba de recortar, y evita el rodeo de
     * guardarla en Descargas para después buscarla en el explorador.
     */
    const alPegar = (e: React.ClipboardEvent) => {
        const archivos = Array.from(e.clipboardData?.files ?? []);
        if (archivos.length === 0) return;
        e.preventDefault();
        agregarArchivos(archivos);
    };

    const alSoltar = (e: React.DragEvent) => {
        e.preventDefault();
        setArrastrando(false);
        agregarArchivos(Array.from(e.dataTransfer?.files ?? []));
    };

    /* ---------------------------------------------------------------- */
    /*  Envío                                                            */
    /* ---------------------------------------------------------------- */

    const subiendo = adjuntos.some((a) => !a.subido && !a.error);
    const listos = useMemo(
        () => adjuntos.filter((a): a is AdjuntoLocal & { subido: AdjuntoSubido } => !!a.subido),
        [adjuntos],
    );
    const puedeEnviar = (borrador.trim().length > 0 || listos.length > 0) && !enviando && !subiendo;

    const enviar = async () => {
        if (!puedeEnviar) return;
        const texto = borrador.trim();

        // El texto va como pie de la PRIMERA foto, como en WhatsApp. Mandarlo
        // aparte partiría en dos mensajes lo que se escribió como uno.
        const mensajes: NuevoMensaje[] =
            listos.length > 0
                ? listos.map((a, i) => ({
                      conversationId,
                      body: i === 0 ? texto : null,
                      kind: a.subido.kind,
                      mediaUrl: a.subido.url,
                      mediaMime: a.subido.mime,
                      mediaFilename: a.subido.filename,
                  }))
                : [{ conversationId, body: texto, kind: 'text' as const }];

        setEnviando(true);
        setError(null);
        try {
            await onEnviar(mensajes);
            adjuntos.forEach((a) => a.preview && URL.revokeObjectURL(a.preview));
            setBorrador('');
            setAdjuntos([]);
        } catch (err: any) {
            setError(err?.message ?? 'No se pudo encolar el mensaje.');
        } finally {
            setEnviando(false);
        }
    };

    /* ---------------------------------------------------------------- */
    /*  Respuestas rápidas                                               */
    /* ---------------------------------------------------------------- */

    /**
     * Escribir "/" al principio filtra las respuestas rápidas sin soltar el
     * teclado -- que es cuando de verdad se usan, en medio de una
     * conversación.
     */
    const filtroRapidas = borrador.startsWith('/') ? borrador.slice(1).toLowerCase().trim() : null;
    const rapidasVisibles = useMemo(() => {
        if (filtroRapidas === null) return rapidas;
        return rapidas.filter(
            (r) => r.label.toLowerCase().includes(filtroRapidas) || r.body.toLowerCase().includes(filtroRapidas),
        );
    }, [rapidas, filtroRapidas]);

    const usarRapida = (r: RespuestaRapida) => {
        setBorrador((prev) => (prev.startsWith('/') || !prev.trim() ? r.body : `${prev.trim()}\n${r.body}`));
        setMenuRapidas(false);
        textareaRef.current?.focus();
    };

    const guardarComoRapida = async () => {
        const texto = borrador.trim();
        if (!texto || guardandoRapida) return;
        const label = window.prompt('¿Con qué nombre la guardamos?', texto.slice(0, 30));
        if (!label?.trim()) return;
        setGuardandoRapida(true);
        const { error: err } = await supabase
            .from('agent_quick_replies')
            .insert({ label: label.trim(), body: texto, created_by: userId, sort_order: 100 });
        setGuardandoRapida(false);
        if (err) {
            setError(`No se pudo guardar la respuesta rápida: ${err.message}`);
            return;
        }
        cargarRapidas();
    };

    const borrarRapida = async (r: RespuestaRapida) => {
        // Baja lógica, no borrado: puede estar en uso por otra persona del
        // equipo justo ahora, y recuperarla desde la base es trivial.
        const { error: err } = await supabase.from('agent_quick_replies').update({ is_active: false }).eq('id', r.id);
        if (err) {
            setError(`No se pudo quitar la respuesta rápida: ${err.message}`);
            return;
        }
        setRapidas((prev) => prev.filter((x) => x.id !== r.id));
    };

    /* ---------------------------------------------------------------- */

    return (
        <div
            ref={contenedorRef}
            className="relative px-5 pt-3 border-t border-subtle"
            onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
            }}
            onDragLeave={(e) => {
                // Solo cuando el puntero sale del bloque entero: los hijos
                // disparan dragleave todo el tiempo y el aviso parpadeaba.
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setArrastrando(false);
            }}
            onDrop={alSoltar}
        >
            {arrastrando && (
                <div className="absolute inset-2 z-10 rounded-xl border-2 border-dashed border-primary bg-primary-soft/70 flex items-center justify-center pointer-events-none">
                    <p className="text-sm font-semibold text-primary-soft-fg">Soltá la foto para adjuntarla</p>
                </div>
            )}

            {/* Menú de respuestas rápidas */}
            {(menuRapidas || filtroRapidas !== null) && rapidasVisibles.length > 0 && (
                <div className="absolute bottom-full left-5 right-5 mb-2 z-20 max-h-64 overflow-y-auto rounded-xl border border-strong bg-surface shadow-lg divide-y divide-subtle">
                    {rapidasVisibles.map((r) => (
                        <div key={r.id} className="flex items-start gap-2 hover:bg-surface-hover">
                            <button onClick={() => usarRapida(r)} className="flex-1 text-left px-3 py-2 min-w-0">
                                <p className="text-xs font-semibold text-fg">{r.label}</p>
                                <p className="text-2xs text-fg-muted line-clamp-2">{r.body}</p>
                            </button>
                            <button
                                onClick={() => borrarRapida(r)}
                                aria-label={`Quitar la respuesta rápida ${r.label}`}
                                className="p-2 text-fg-subtle hover:text-danger"
                            >
                                <X size={13} aria-hidden="true" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Adjuntos elegidos */}
            {adjuntos.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-2">
                    {adjuntos.map((a) => (
                        <div
                            key={a.key}
                            className={cn(
                                'relative rounded-lg border overflow-hidden bg-surface-2',
                                a.error ? 'border-danger' : 'border-subtle',
                            )}
                        >
                            {a.preview ? (
                                <img src={a.preview} alt={a.nombre} className="w-16 h-16 object-cover" />
                            ) : (
                                <div className="w-16 h-16 flex flex-col items-center justify-center gap-1 px-1">
                                    <FileText size={16} className="text-fg-subtle" aria-hidden="true" />
                                    <span className="text-[9px] text-fg-subtle truncate w-full text-center">{a.nombre}</span>
                                </div>
                            )}

                            {!a.subido && !a.error && (
                                <div className="absolute inset-0 bg-surface/70 flex items-center justify-center">
                                    <Loader2 size={16} className="animate-spin text-fg-muted" aria-hidden="true" />
                                </div>
                            )}

                            <button
                                onClick={() => quitarAdjunto(a.key)}
                                aria-label={`Quitar ${a.nombre}`}
                                className="absolute top-0.5 right-0.5 rounded-full bg-slate-900/70 text-white p-0.5 hover:bg-slate-900"
                            >
                                <X size={11} aria-hidden="true" />
                            </button>

                            {a.error && (
                                <p className="absolute inset-x-0 bottom-0 bg-danger text-danger-fg text-[9px] px-1 py-0.5 text-center">
                                    error
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {adjuntos.some((a) => a.error) && (
                <p className="text-2xs text-danger mb-1.5">
                    {adjuntos.find((a) => a.error)?.error} — quitá el archivo y probá de nuevo.
                </p>
            )}

            {/* Barra de herramientas */}
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                        agregarArchivos(Array.from(e.target.files ?? []));
                        // Se limpia para poder volver a elegir el MISMO archivo.
                        e.target.value = '';
                    }}
                />
                <button
                    onClick={() => fileRef.current?.click()}
                    className={cn(button.base, button.variant.secondary, button.size.sm)}
                    title={`Adjuntar foto o archivo (hasta ${MAX_ADJUNTO_MB} MB). También podés pegar con Ctrl+V o arrastrar.`}
                >
                    <Paperclip size={14} aria-hidden="true" /> Adjuntar
                </button>
                <button
                    onClick={() => setCatalogoAbierto(true)}
                    className={cn(button.base, button.variant.secondary, button.size.sm)}
                    title="Buscar un repuesto y mandarlo con foto y precio"
                >
                    <Package size={14} aria-hidden="true" /> Catálogo
                </button>
                <button
                    onClick={() => setMenuRapidas((v) => !v)}
                    className={cn(button.base, button.variant.secondary, button.size.sm)}
                    title="Respuestas rápidas (o escribí / al principio)"
                >
                    <Zap size={14} aria-hidden="true" /> Rápidas
                    {rapidas.length > 0 && (
                        <span className={cn(badge.base, badge.size.sm, badge.tone.neutral)}>{rapidas.length}</span>
                    )}
                </button>
                {borrador.trim().length > 0 && (
                    <button
                        onClick={guardarComoRapida}
                        disabled={guardandoRapida}
                        className={cn(button.base, button.variant.ghost, button.size.sm)}
                        title="Guardar este texto como respuesta rápida"
                    >
                        <Plus size={14} aria-hidden="true" /> Guardar como rápida
                    </button>
                )}
            </div>

            <div className="flex items-end gap-2">
                <textarea
                    ref={textareaRef}
                    value={borrador}
                    onChange={(e) => setBorrador(e.target.value)}
                    onPaste={alPegar}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') setMenuRapidas(false);
                        // Enter envía, Shift+Enter hace salto de línea.
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            enviar();
                        }
                    }}
                    rows={2}
                    placeholder={
                        adjuntos.length > 0
                            ? 'Pie de foto (opcional)…'
                            : 'Escribí tu respuesta… (Enter envía, Shift+Enter salta de línea, / para respuestas rápidas)'
                    }
                    aria-label="Mensaje para el cliente"
                    className={cn(input.base, 'py-2 px-3 text-sm resize-none')}
                />
                <button
                    onClick={enviar}
                    disabled={!puedeEnviar}
                    className={cn(button.base, button.variant.primary, button.size.md, 'shrink-0')}
                    title={subiendo ? 'Esperando a que termine de subir el archivo' : 'Enviar'}
                >
                    {enviando || subiendo ? (
                        <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                    ) : (
                        <Send size={15} aria-hidden="true" />
                    )}
                    {enviando ? 'Enviando…' : subiendo ? 'Subiendo…' : 'Enviar'}
                </button>
            </div>

            {error && <p className="text-xs text-danger mt-1.5">{error}</p>}
            <p className="text-2xs text-fg-subtle mt-1.5 flex items-center gap-1.5">
                <ImageIcon size={11} aria-hidden="true" />
                Sale por WhatsApp en unos segundos y queda guardado en esta conversación.
            </p>

            <CatalogSendModal
                isOpen={catalogoAbierto}
                onClose={() => setCatalogoAbierto(false)}
                conversationId={conversationId}
                clienteLabel={clienteLabel}
                onEnviar={onEnviar}
            />
        </div>
    );
};

export default ChatComposer;
