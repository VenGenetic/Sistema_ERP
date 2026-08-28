import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ClipboardList, FileText, Image as ImageIcon, Loader2, Package, Paperclip, Plus, Send,
    SlidersHorizontal, X, Zap,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { cn } from '../ui/styles';
import CatalogSendModal from './CatalogSendModal';
import ProformaBuilder from './ProformaBuilder';
import RegistrarPedidoModal from './RegistrarPedidoModal';
import VoiceRecorder from './VoiceRecorder';
import RespuestasRapidasModal from './RespuestasRapidasModal';
import { useChatProformaStore } from '../../store/useChatProformaStore';
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
    /** Nombre real del cliente, si se conoce. Encabeza la proforma. */
    clienteNombre: string | null;
    /** Teléfono en dígitos, para anotar pedidos. */
    phoneNumber: string;
    userId: string | null;
    /** Encola los mensajes. La página decide cómo (y refresca el hilo). */
    onEnviar: (mensajes: NuevoMensaje[]) => Promise<void>;
    /** Se llama al anotar un pedido, para refrescar la ficha del cliente. */
    onPedidoRegistrado?: () => void;
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

/**
 * Una opción del menú "+" de la barra de escribir.
 *
 * Vive fuera del componente a propósito: definida adentro, React la trata
 * como un componente distinto en cada tecla que se escribe y desmonta el
 * menú entero mientras está abierto.
 */
const Herramienta: React.FC<{
    icono: React.ReactNode;
    texto: string;
    cuenta?: number;
    onClick: () => void;
}> = ({ icono, texto, cuenta, onClick }) => (
    <button
        onClick={onClick}
        role="menuitem"
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] text-wa-text hover:bg-wa-hover"
    >
        <span className="text-wa-meta">{icono}</span>
        <span className="flex-1">{texto}</span>
        {!!cuenta && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-wa-accent px-1.5 text-[11px] font-bold text-wa-accent-fg">
                {cuenta}
            </span>
        )}
    </button>
);

export const ChatComposer: React.FC<Props> = ({
    conversationId,
    clienteLabel,
    clienteNombre,
    phoneNumber,
    userId,
    onEnviar,
    onPedidoRegistrado,
}) => {
    const [borrador, setBorrador] = useState('');
    const [adjuntos, setAdjuntos] = useState<AdjuntoLocal[]>([]);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [arrastrando, setArrastrando] = useState(false);
    const [catalogoAbierto, setCatalogoAbierto] = useState(false);
    const [proformaAbierta, setProformaAbierta] = useState(false);
    const [pedidoAbierto, setPedidoAbierto] = useState(false);

    /**
     * Cuántos repuestos tiene la proforma de ESTE chat. Se muestra en el
     * botón: una proforma a medio armar es fácil de olvidar al saltar de
     * conversación, y el número la mantiene a la vista.
     */
    const itemsEnProforma = useChatProformaStore(
        (s) => s.porConversacion[conversationId]?.items.length ?? 0,
    );
    const [rapidas, setRapidas] = useState<RespuestaRapida[]>([]);
    const [menuRapidas, setMenuRapidas] = useState(false);
    /**
     * El "+" de WhatsApp. Adjuntar, catálogo, proforma, pedido y respuestas
     * rápidas viven adentro en vez de en una fila de cinco botones sobre la
     * caja de escribir: esa fila ocupaba dos renglones, empujaba el hilo
     * hacia arriba y no se parece en nada a WhatsApp. Las funciones son
     * exactamente las mismas, a un toque de distancia.
     */
    const [menuHerramientas, setMenuHerramientas] = useState(false);
    /** Hay una nota de voz grabándose o grabada sin mandar. */
    const [grabadorOcupado, setGrabadorOcupado] = useState(false);
    /**
     * El administrador de respuestas rápidas y, si se llegó desde «guardar
     * esto», el texto con el que arranca. Se pasa por estado y no por
     * `window.prompt` porque guardar una plantilla sin ver el texto que se
     * guarda es como se llenó la lista de plantillas cortadas a la mitad.
     */
    const [gestorRapidas, setGestorRapidas] = useState(false);
    const [borradorParaGuardar, setBorradorParaGuardar] = useState('');

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
        setMenuHerramientas(false);
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

    // Cerrar los menús al tocar fuera o al apretar Escape.
    useEffect(() => {
        if (!menuRapidas && !menuHerramientas) return;
        const cerrar = () => {
            setMenuRapidas(false);
            setMenuHerramientas(false);
        };
        const fuera = (e: MouseEvent) => {
            if (!contenedorRef.current?.contains(e.target as Node)) cerrar();
        };
        const escape = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', escape);
        };
    }, [menuRapidas, menuHerramientas]);

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

    /**
     * Sube la grabación y la encola como NOTA DE VOZ.
     *
     * Va sola, sin el borrador de texto: WhatsApp ignora el pie de foto en
     * los audios (ver migración 0030), así que si acá se mandara el texto
     * junto se perdería en silencio. Lo que esté escrito queda en la caja
     * para mandarse aparte.
     */
    const enviarNotaDeVoz = async (archivo: File) => {
        const subido = await subirAdjunto(archivo);
        await onEnviar([
            {
                conversationId,
                kind: 'audio',
                mediaUrl: subido.url,
                mediaMime: subido.mime,
                mediaFilename: subido.filename,
                isVoiceNote: true,
            },
        ]);
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

    /** Guardar lo escrito como plantilla: abre el gestor ya cargado. */
    const guardarComoRapida = () => {
        const texto = borrador.trim();
        if (!texto) return;
        setBorradorParaGuardar(texto);
        setMenuRapidas(false);
        setGestorRapidas(true);
    };

    /** Agregar, corregir o quitar: todo eso vive en el gestor. */
    const administrarRapidas = () => {
        setBorradorParaGuardar('');
        setMenuRapidas(false);
        setGestorRapidas(true);
    };

    /* ---------------------------------------------------------------- */


    /* La caja crece con lo que se escribe y frena a los 160px, como en
       WhatsApp. Sin esto, con `rows={1}`, un mensaje de tres renglones se
       escribía dentro de una ranura de 44px que había que ir desplazando. */
    useEffect(() => {
        const t = textareaRef.current;
        if (!t) return;
        t.style.height = 'auto';
        t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
    }, [borrador]);

    /* Con texto escrito el botón de la derecha manda; sin nada escrito es
       el micrófono, igual que en WhatsApp. */
    const hayQueMandar = borrador.trim().length > 0 || adjuntos.length > 0;
    /* Mientras se graba manda el grabador: el botón verde volvería a aparecer
       encima de los controles de la nota de voz. */
    const mostrarEnviar = hayQueMandar && !grabadorOcupado;

    return (
        <div
            ref={contenedorRef}
            className="relative bg-wa-header px-2 py-2 md:px-3"
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
                <div className="pointer-events-none absolute inset-1 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-wa-accent bg-wa-panel/80">
                    <p className="text-sm font-semibold text-wa-text">Soltá la foto para adjuntarla</p>
                </div>
            )}

            {/* Menú de respuestas rápidas. Se abre desde el "+" o escribiendo
                "/" al principio, que es como se usan de verdad: en medio de
                una conversación, sin soltar el teclado.

                Abierto desde el "+" se muestra SIEMPRE, aunque no haya
                ninguna guardada: antes, con la lista vacía, ese renglón del
                menú no hacía absolutamente nada y no había forma de crear la
                primera. Filtrando con "/" sí se esconde cuando no coincide
                nada, para no tapar lo que se está escribiendo.

                La equis de borrar que había en cada fila ya no está: borraba
                sin preguntar una plantilla que usa todo el equipo, y estaba a
                un dedo de distancia de usarla. Agregar, corregir y quitar
                viven ahora en el gestor, que pregunta. */}
            {(menuRapidas || (filtroRapidas !== null && rapidasVisibles.length > 0)) && (
                <div className="absolute bottom-full left-2 right-2 z-20 mb-2 overflow-hidden rounded-xl border border-wa-divider bg-wa-panel shadow-lg md:left-3 md:right-3">
                    <div className="max-h-64 divide-y divide-wa-divider overflow-y-auto">
                        {rapidasVisibles.length === 0 ? (
                            <p className="px-3 py-4 text-center text-[12.5px] text-wa-meta">
                                {rapidas.length === 0
                                    ? 'Todavía no hay respuestas rápidas guardadas.'
                                    : 'Ninguna coincide con lo que escribiste.'}
                            </p>
                        ) : (
                            rapidasVisibles.map((r) => (
                                <button
                                    key={r.id}
                                    onClick={() => usarRapida(r)}
                                    className="block w-full px-3 py-2 text-left hover:bg-wa-hover"
                                >
                                    <p className="text-[13px] font-semibold text-wa-text">{r.label}</p>
                                    <p className="line-clamp-2 text-[12px] text-wa-meta">{r.body}</p>
                                </button>
                            ))
                        )}
                    </div>

                    {menuRapidas && (
                        <button
                            onClick={administrarRapidas}
                            className="flex w-full items-center gap-2 border-t border-wa-divider px-3 py-2.5 text-left text-[12.5px] font-medium text-wa-accent-strong hover:bg-wa-hover"
                        >
                            <SlidersHorizontal size={14} aria-hidden="true" />
                            Agregar, corregir o quitar
                        </button>
                    )}
                </div>
            )}

            {/* El menú del "+" */}
            {menuHerramientas && (
                <div
                    role="menu"
                    className="absolute bottom-full left-2 z-20 mb-2 w-64 overflow-hidden rounded-xl border border-wa-divider bg-wa-panel py-1 shadow-lg md:left-3"
                >
                    <Herramienta
                        icono={<ImageIcon size={19} aria-hidden="true" />}
                        texto="Foto, video o archivo"
                        onClick={() => {
                            setMenuHerramientas(false);
                            fileRef.current?.click();
                        }}
                    />
                    <Herramienta
                        icono={<Package size={19} aria-hidden="true" />}
                        texto="Repuesto del catálogo"
                        onClick={() => {
                            setMenuHerramientas(false);
                            setCatalogoAbierto(true);
                        }}
                    />
                    <Herramienta
                        icono={<FileText size={19} aria-hidden="true" />}
                        texto="Proforma"
                        cuenta={itemsEnProforma}
                        onClick={() => {
                            setMenuHerramientas(false);
                            setProformaAbierta(true);
                        }}
                    />
                    <Herramienta
                        icono={<ClipboardList size={19} aria-hidden="true" />}
                        texto="Anotar un pedido"
                        onClick={() => {
                            setMenuHerramientas(false);
                            setPedidoAbierto(true);
                        }}
                    />
                    <Herramienta
                        icono={<Zap size={19} aria-hidden="true" />}
                        texto="Respuestas rápidas"
                        cuenta={rapidas.length}
                        onClick={() => {
                            setMenuHerramientas(false);
                            setMenuRapidas(true);
                        }}
                    />
                    {borrador.trim().length > 0 && (
                        <Herramienta
                            icono={<Plus size={19} aria-hidden="true" />}
                            texto="Guardar esto como respuesta rápida"
                            onClick={() => {
                                setMenuHerramientas(false);
                                guardarComoRapida();
                            }}
                        />
                    )}
                </div>
            )}

            {/* Adjuntos elegidos */}
            {adjuntos.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2 px-1">
                    {adjuntos.map((a) => (
                        <div
                            key={a.key}
                            className={cn(
                                'relative overflow-hidden rounded-lg border bg-wa-panel',
                                a.error ? 'border-danger' : 'border-wa-divider',
                            )}
                        >
                            {a.preview ? (
                                <img src={a.preview} alt={a.nombre} className="h-16 w-16 object-cover" />
                            ) : (
                                <div className="flex h-16 w-16 flex-col items-center justify-center gap-1 px-1">
                                    <FileText size={16} className="text-wa-meta" aria-hidden="true" />
                                    <span className="w-full truncate text-center text-[9px] text-wa-meta">{a.nombre}</span>
                                </div>
                            )}

                            {!a.subido && !a.error && (
                                <div className="absolute inset-0 flex items-center justify-center bg-wa-panel/70">
                                    <Loader2 size={16} className="animate-spin text-wa-meta" aria-hidden="true" />
                                </div>
                            )}

                            <button
                                onClick={() => quitarAdjunto(a.key)}
                                aria-label={`Quitar ${a.nombre}`}
                                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                            >
                                <X size={11} aria-hidden="true" />
                            </button>

                            {a.error && (
                                <p className="absolute inset-x-0 bottom-0 bg-danger px-1 py-0.5 text-center text-[9px] text-danger-fg">
                                    error
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {adjuntos.some((a) => a.error) && (
                <p className="mb-1.5 px-1 text-[11px] text-wa-danger">
                    {adjuntos.find((a) => a.error)?.error} — quitá el archivo y probá de nuevo.
                </p>
            )}

            <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,video/*,audio/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                    agregarArchivos(Array.from(e.target.files ?? []));
                    // Se limpia para poder volver a elegir el MISMO archivo.
                    e.target.value = '';
                }}
            />

            {/* La barra: "+", el campo redondeado y el botón de la derecha.
                Tres piezas, como en WhatsApp. */}
            <div className="flex flex-wrap items-end gap-1.5">
                <button
                    onClick={() => {
                        setMenuHerramientas((v) => !v);
                        setMenuRapidas(false);
                    }}
                    aria-label="Adjuntar y herramientas"
                    aria-expanded={menuHerramientas}
                    title="Foto, catálogo, proforma, pedido y respuestas rápidas"
                    className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform',
                        'text-wa-meta hover:bg-wa-inset/10',
                        menuHerramientas && 'rotate-45',
                    )}
                >
                    <Plus size={24} aria-hidden="true" />
                </button>

                {/* Un segundo acceso directo al clip: adjuntar una foto es de
                    lejos lo más frecuente y no merece pasar por el menú. */}
                <button
                    onClick={() => fileRef.current?.click()}
                    aria-label="Adjuntar foto o archivo"
                    title={`Adjuntar foto o archivo (hasta ${MAX_ADJUNTO_MB} MB). También podés pegar con Ctrl+V o arrastrar.`}
                    className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full text-wa-meta hover:bg-wa-inset/10 sm:flex"
                >
                    <Paperclip size={22} aria-hidden="true" />
                </button>

                <textarea
                    ref={textareaRef}
                    value={borrador}
                    onChange={(e) => setBorrador(e.target.value)}
                    onPaste={alPegar}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            setMenuRapidas(false);
                            setMenuHerramientas(false);
                        }
                        // Enter envía, Shift+Enter hace salto de línea.
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            enviar();
                        }
                    }}
                    rows={1}
                    placeholder={adjuntos.length > 0 ? 'Pie de foto (opcional)…' : 'Escribí un mensaje'}
                    aria-label="Mensaje para el cliente"
                    // Los atajos van en el title y no en el placeholder: el texto
                    // largo se partía en dos renglones y descuadraba la barra.
                    title="Enter envía · Shift+Enter salta de línea · / abre las respuestas rápidas"
                    className={cn(
                        'wa-scroll min-h-[44px] max-h-40 flex-1 resize-none rounded-lg bg-wa-input px-4 py-3',
                        'text-[14.5px] leading-[19px] text-wa-text placeholder:text-wa-meta',
                        'border-none outline-none focus:ring-0',
                    )}
                />

                {mostrarEnviar && (
                    <button
                        onClick={enviar}
                        disabled={!puedeEnviar}
                        aria-label="Enviar"
                        title={subiendo ? 'Esperando a que termine de subir el archivo' : 'Enviar'}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-wa-accent-strong text-wa-accent-fg hover:brightness-110 disabled:opacity-50"
                    >
                        {enviando || subiendo ? (
                            <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                        ) : (
                            <Send size={20} aria-hidden="true" />
                        )}
                    </button>
                )}

                {/* Contestar hablando: el cliente que preguntó por audio suele
                    preferir que le respondan igual, y explicar la diferencia entre
                    dos repuestos parecidos toma diez segundos hablando y tres
                    párrafos escritos.

                    Se ESCONDE en vez de desmontarse cuando aparece el botón de
                    enviar: desmontarlo tira a la basura una nota ya grabada sin
                    avisar, y para eso basta con tocar la caja de texto. */}
                <div className={cn('shrink-0', mostrarEnviar && 'hidden')}>
                    <VoiceRecorder
                        onEnviar={enviarNotaDeVoz}
                        disabled={enviando}
                        soloIcono
                        onOcupado={setGrabadorOcupado}
                        claseBoton="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-wa-meta hover:bg-wa-inset/10 disabled:opacity-40"
                    />
                </div>
            </div>

            {error && <p className="mt-1.5 px-1 text-xs text-wa-danger">{error}</p>}
            <CatalogSendModal
                isOpen={catalogoAbierto}
                onClose={() => setCatalogoAbierto(false)}
                conversationId={conversationId}
                clienteLabel={clienteLabel}
                onEnviar={onEnviar}
            />

            <ProformaBuilder
                isOpen={proformaAbierta}
                onClose={() => setProformaAbierta(false)}
                conversationId={conversationId}
                clienteLabel={clienteLabel}
                clienteNombre={clienteNombre}
                onEnviar={onEnviar}
            />

            <RegistrarPedidoModal
                isOpen={pedidoAbierto}
                onClose={() => setPedidoAbierto(false)}
                phoneNumber={phoneNumber}
                customerName={clienteNombre}
                userId={userId}
                onRegistrado={() => onPedidoRegistrado?.()}
            />

            <RespuestasRapidasModal
                isOpen={gestorRapidas}
                onClose={() => {
                    setGestorRapidas(false);
                    // El borrador solo sirve para la vez que se abrió desde
                    // «guardar esto»: si queda, la próxima vez que se abra el
                    // gestor aparece un formulario cargado sin motivo.
                    setBorradorParaGuardar('');
                }}
                userId={userId}
                borradorInicial={borradorParaGuardar}
                onCambio={cargarRapidas}
            />
        </div>
    );
};

export default ChatComposer;
