import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ImageOff, Images, Loader2, MessageSquare, Search, X, ZoomIn } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { cn, focusRing } from '../ui/styles';
import { MediaLightbox, type MediaItem } from '../MediaLightbox';
import { horaLista } from './ChatThread';

/**
 * Todas las fotos que mandaron los clientes, en una cuadrícula, con el
 * nombre de quién la mandó y un atajo para abrir esa conversación.
 *
 * Existe por un caso concreto del negocio: el cliente paga y manda la FOTO
 * del comprobante. Media hora después hay que confirmar ese pago, y lo
 * único que se recuerda es la foto -- no el nombre ni la hora. Buscarla
 * abriendo chats de a uno es imposible con 3.500 conversaciones; verlas
 * todas juntas y saltar al chat desde la miniatura toma dos clics.
 *
 * Son las RECIBIDAS, no las enviadas: lo que se busca acá es siempre algo
 * que mandó el cliente (un comprobante, la pieza rota, la placa del motor).
 *
 * Sobre el consumo: cada miniatura es la foto entera -- el plan gratuito de
 * Supabase no transforma imágenes -- así que se traen de a 30 y con
 * `loading="lazy"`, para que solo se descarguen las que de verdad entran en
 * pantalla.
 */

/** Cuántas fotos por vuelta. Bajo a propósito: cada una se baja entera. */
const POR_PAGINA = 30;

interface FotoDeChat {
    id: number;
    conversation_id: number;
    media_url: string;
    body: string | null;
    created_at: string;
}

interface DatosDeChat {
    id: number;
    customer_name: string | null;
    phone_number: string;
    lid: string | null;
}

interface Props {
    /** Abre la conversación de esa foto y cierra la galería. */
    onIrAlChat: (conversationId: number) => void;
    onCerrar: () => void;
    /** El teléfono con formato, para no repetir la función en cada pantalla. */
    formatearTelefono: (c: { phone_number: string; lid: string | null }) => string;
    /** En el teléfono: menos columnas y zonas táctiles más grandes. */
    tactil?: boolean;
}

/** "Hoy" / "Ayer" / "12 de marzo" para encabezar cada bloque de la cuadrícula. */
function etiquetaDeDia(iso: string): string {
    const f = new Date(iso);
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);
    const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    if (mismoDia(f, hoy)) return 'Hoy';
    if (mismoDia(f, ayer)) return 'Ayer';
    return f.toLocaleDateString('es-EC', {
        day: 'numeric',
        month: 'long',
        ...(f.getFullYear() !== hoy.getFullYear() ? { year: 'numeric' } : {}),
    });
}

export const MediaGallery: React.FC<Props> = ({ onIrAlChat, onCerrar, formatearTelefono, tactil = false }) => {
    const [fotos, setFotos] = useState<FotoDeChat[]>([]);
    const [chats, setChats] = useState<Map<number, DatosDeChat>>(new Map());
    const [cargando, setCargando] = useState(true);
    const [cargandoMas, setCargandoMas] = useState(false);
    const [hayMas, setHayMas] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busqueda, setBusqueda] = useState('');
    const [visor, setVisor] = useState<{ media: MediaItem[]; index: number } | null>(null);

    /**
     * Los datos del cliente se piden aparte y no como consulta anidada.
     *
     * Es a propósito: una anidada obliga a PostgREST a adivinar la relación
     * entre las dos tablas, y si algún día hay dos claves foráneas hacia
     * `agent_conversations` la consulta falla entera. Dos consultas chicas
     * -- treinta fotos y los treinta chats de esas fotos -- son más baratas
     * que una anidada y no se rompen solas.
     */
    const traerDatosDeChats = useCallback(async (ids: number[]) => {
        if (ids.length === 0) return;
        const { data, error: err } = await supabase
            .from('agent_conversations')
            .select('id, customer_name, phone_number, lid')
            .in('id', ids);
        if (err || !data) return;
        setChats((prev) => {
            const siguiente = new Map(prev);
            for (const c of data as DatosDeChat[]) siguiente.set(c.id, c);
            return siguiente;
        });
    }, []);

    const cargar = useCallback(
        async (desde: number) => {
            const primeraVez = desde === 0;
            if (primeraVez) setCargando(true);
            else setCargandoMas(true);

            let consulta = supabase
                .from('agent_messages')
                .select('id, conversation_id, media_url, body, created_at')
                .eq('direction', 'inbound')
                .eq('content_type', 'image')
                .not('media_url', 'is', null)
                .order('created_at', { ascending: false })
                // Una de más: si viene, es que hay siguiente página.
                .range(desde, desde + POR_PAGINA);

            const texto = busqueda.trim();
            if (texto) {
                // Se filtra por cliente, así que primero hay que saber qué
                // conversaciones coinciden. Con 3.500 chats, buscar sobre las
                // fotos ya cargadas dejaría fuera casi todo.
                const limpio = texto.replace(/[,()*\\"]/g, ' ').trim();
                const digitos = limpio.replace(/\D/g, '');
                const condiciones = [`customer_name.ilike.*${limpio}*`];
                if (digitos) {
                    condiciones.push(`phone_number.ilike.*${digitos}*`, `lid.ilike.*${digitos}*`);
                    if (digitos.startsWith('0')) condiciones.push(`phone_number.ilike.*${digitos.slice(1)}*`);
                }
                const { data: coinciden } = await supabase
                    .from('agent_conversations')
                    .select('id')
                    .or(condiciones.join(','))
                    .limit(200);
                const ids = (coinciden ?? []).map((c: { id: number }) => c.id);
                if (ids.length === 0) {
                    setFotos([]);
                    setHayMas(false);
                    setCargando(false);
                    setCargandoMas(false);
                    return;
                }
                consulta = consulta.in('conversation_id', ids);
            }

            const { data, error: err } = await consulta;
            setCargando(false);
            setCargandoMas(false);

            if (err) {
                setError(`No se pudieron cargar las fotos: ${err.message}`);
                return;
            }
            setError(null);

            const filas = (data ?? []) as FotoDeChat[];
            setHayMas(filas.length > POR_PAGINA);
            const pagina = filas.slice(0, POR_PAGINA);
            setFotos((prev) => (primeraVez ? pagina : [...prev, ...pagina]));
            traerDatosDeChats([...new Set(pagina.map((f) => f.conversation_id))]);
        },
        [busqueda, traerDatosDeChats],
    );

    // La búsqueda va contra la base: se espera a que termine de tipear.
    useEffect(() => {
        const t = setTimeout(() => cargar(0), 350);
        return () => clearTimeout(t);
    }, [cargar]);

    /** Las fotos agrupadas por día, en el orden en que vinieron. */
    const porDia = useMemo(() => {
        const grupos: Array<{ dia: string; fotos: FotoDeChat[] }> = [];
        for (const f of fotos) {
            const dia = etiquetaDeDia(f.created_at);
            const ultimo = grupos[grupos.length - 1];
            if (ultimo && ultimo.dia === dia) ultimo.fotos.push(f);
            else grupos.push({ dia, fotos: [f] });
        }
        return grupos;
    }, [fotos]);

    const abrirVisor = (foto: FotoDeChat) => {
        setVisor({
            media: fotos.map((f) => ({
                type: 'image',
                url: f.media_url,
                title: nombreDe(f) + (f.body ? ` — ${f.body}` : ''),
            })),
            index: Math.max(0, fotos.findIndex((f) => f.id === foto.id)),
        });
    };

    function nombreDe(f: FotoDeChat): string {
        const c = chats.get(f.conversation_id);
        if (!c) return 'Cliente';
        return c.customer_name || formatearTelefono(c);
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col bg-wa-panel">
            {/* Cabecera */}
            <div className="flex shrink-0 items-center gap-2 border-b border-wa-divider bg-wa-header px-3 py-2">
                <Images size={20} className="shrink-0 text-wa-meta" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[16px] font-medium leading-[21px] text-wa-text">
                        Fotos que mandaron los clientes
                    </h2>
                    <p className="truncate text-[12.5px] leading-[17px] text-wa-meta">
                        Tocá una para abrir esa conversación
                    </p>
                </div>
                <button
                    onClick={onCerrar}
                    aria-label="Cerrar las fotos"
                    className={cn(
                        'flex shrink-0 items-center justify-center rounded-full text-wa-meta hover:bg-wa-inset/10',
                        tactil ? 'h-11 w-11' : 'h-9 w-9',
                    )}
                >
                    <X size={20} aria-hidden="true" />
                </button>
            </div>

            {/* Buscador por cliente */}
            <div className="shrink-0 border-b border-wa-divider bg-wa-panel px-3 py-2.5">
                <div className="relative">
                    <Search
                        size={15}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-wa-meta"
                        aria-hidden="true"
                    />
                    <input
                        type="search"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Filtrar por cliente (nombre o teléfono)"
                        aria-label="Filtrar las fotos por cliente"
                        className={cn(
                            'w-full rounded-lg border-none bg-wa-input pl-9 pr-9 text-wa-text outline-none placeholder:text-wa-meta focus:ring-0',
                            tactil ? 'min-h-[44px] text-base' : 'h-9 text-[13.5px]',
                        )}
                    />
                    {busqueda && (
                        <button
                            onClick={() => setBusqueda('')}
                            aria-label="Limpiar el filtro"
                            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-wa-meta hover:bg-wa-inset/10 hover:text-wa-text"
                        >
                            <X size={14} aria-hidden="true" />
                        </button>
                    )}
                </div>
            </div>

            {/* Cuadrícula */}
            <div
                className="wa-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3"
                /* El botón central de la barra de abajo sobresale por encima de
                   ella, y el hueco que reserva el layout solo cubre la barra:
                   sin estos píxeles extra la última fila de fotos queda debajo. */
                style={
                    tactil
                        ? { paddingBottom: 'calc(var(--mobile-nav-peak) - var(--mobile-nav-h) + 16px)' }
                        : undefined
                }
            >
                {error && <p className="py-6 text-center text-sm text-wa-danger">{error}</p>}

                {cargando && (
                    <p className="flex items-center justify-center gap-2 py-10 text-sm text-wa-meta">
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Buscando fotos…
                    </p>
                )}

                {!cargando && !error && fotos.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-14 text-center text-sm text-wa-meta">
                        <ImageOff size={24} aria-hidden="true" />
                        {busqueda.trim()
                            ? 'Ese cliente no mandó ninguna foto.'
                            : 'Todavía no hay fotos recibidas.'}
                    </div>
                )}

                {porDia.map((grupo) => (
                    <section key={grupo.dia} className="mb-4">
                        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-wa-meta">
                            {grupo.dia}
                        </h3>
                        <div
                            className={cn(
                                'grid gap-2',
                                tactil ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4',
                            )}
                        >
                            {grupo.fotos.map((f) => (
                                <div
                                    key={f.id}
                                    className="group relative overflow-hidden rounded-lg border border-wa-divider bg-wa-in"
                                >
                                    {/* La miniatura entera abre el chat: es lo que se
                                        viene a hacer acá. El zoom queda en su botón,
                                        para leer el comprobante antes de saltar. */}
                                    <button
                                        onClick={() => onIrAlChat(f.conversation_id)}
                                        title={`Ir al chat de ${nombreDe(f)}`}
                                        className={cn('block w-full text-left', focusRing)}
                                    >
                                        <img
                                            src={f.media_url}
                                            alt={f.body ?? `Foto de ${nombreDe(f)}`}
                                            loading="lazy"
                                            decoding="async"
                                            className="aspect-square w-full bg-wa-bg object-cover"
                                        />
                                        <div className="px-2 py-1.5">
                                            <p className="truncate text-[12.5px] font-medium text-wa-text">
                                                {nombreDe(f)}
                                            </p>
                                            <p className="truncate text-[11px] text-wa-meta">
                                                {horaLista(f.created_at)}
                                                {f.body ? ` · ${f.body}` : ''}
                                            </p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => abrirVisor(f)}
                                        aria-label={`Ver en grande la foto de ${nombreDe(f)}`}
                                        className={cn(
                                            'absolute right-1.5 top-1.5 flex items-center justify-center rounded-full bg-black/45 text-white/90 backdrop-blur-sm transition-opacity hover:bg-black/70',
                                            tactil ? 'h-9 w-9 opacity-90' : 'h-8 w-8 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                                        )}
                                    >
                                        <ZoomIn size={16} aria-hidden="true" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                ))}

                {hayMas && !cargando && (
                    <div className="pb-4 pt-1 text-center">
                        <button
                            onClick={() => cargar(fotos.length)}
                            disabled={cargandoMas}
                            className={cn(
                                'inline-flex items-center gap-2 rounded-full bg-wa-inset/[0.08] px-4 py-2 text-[13px] font-medium text-wa-text hover:bg-wa-inset/[0.14] disabled:opacity-50',
                                focusRing,
                            )}
                        >
                            {cargandoMas ? (
                                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                            ) : (
                                <MessageSquare size={14} aria-hidden="true" />
                            )}
                            Ver más fotos
                        </button>
                        {/* Cada foto se baja entera; conviene saber que "ver más"
                            no es gratis cuando la conexión es del teléfono. */}
                        <p className="mt-1.5 text-[11px] text-wa-meta">
                            Se traen de a {POR_PAGINA} para no gastar datos de más.
                        </p>
                    </div>
                )}
            </div>

            <MediaLightbox
                isOpen={!!visor}
                media={visor?.media ?? []}
                initialIndex={visor?.index ?? 0}
                onClose={() => setVisor(null)}
            />
        </div>
    );
};

export default MediaGallery;
