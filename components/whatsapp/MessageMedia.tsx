import React, { useEffect, useRef, useState } from 'react';
import { Download, FileText, ImageOff, Mic, Pause, Play } from 'lucide-react';
import { cn } from '../ui/styles';

/**
 * La foto, la nota de voz, el video o el archivo de un mensaje, dentro de
 * la burbuja del chat.
 *
 * Antes el hilo mostraba "(foto)" o "(nota de voz)" y había que abrir el
 * WhatsApp del teléfono para verlos -- justo en el momento en que hay que
 * decidir qué contestar. En este negocio eso es lo más caro que puede
 * pasar: se midieron 585 notas de voz y 1.083 fotos recibidas, y muchos
 * pedidos de repuesto llegan como foto de la pieza o como audio del
 * cliente que va manejando.
 */

interface Props {
    url: string;
    contentType: string;
    /** Texto del mensaje, para el alt de la imagen. */
    body: string | null;
    /** Nombre a mostrar en un documento. */
    filename?: string | null;
    /** Abre la foto a pantalla completa. */
    onAbrirFoto?: () => void;
}

/** mm:ss. Devuelve '--:--' mientras no se sepa la duración. */
function tiempo(segundos: number): string {
    if (!Number.isFinite(segundos) || segundos < 0) return '--:--';
    const m = Math.floor(segundos / 60);
    const s = Math.floor(segundos % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Reproductor de nota de voz.
 *
 * No se usa `<audio controls>` nativo: mide unos 300px de ancho, no entra
 * en una burbuja de chat y se ve distinto en cada navegador. Este es el
 * mismo gesto que WhatsApp -- botón de play, barra de progreso arrastrable
 * y tiempo -- en el ancho que haya.
 *
 * Las notas de voz de WhatsApp son OGG/Opus. Chrome y Firefox las
 * reproducen; Safari no, así que si el navegador no puede se muestra el
 * enlace de descarga en vez de un reproductor mudo.
 */
const NotaDeVoz: React.FC<{ url: string }> = ({ url }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [sonando, setSonando] = useState(false);
    const [posicion, setPosicion] = useState(0);
    const [duracion, setDuracion] = useState(NaN);
    const [noSePuede, setNoSePuede] = useState(false);

    useEffect(() => {
        const a = audioRef.current;
        if (!a) return;
        const alActualizar = () => setPosicion(a.currentTime);
        const alCargar = () => setDuracion(a.duration);
        const alTerminar = () => {
            setSonando(false);
            setPosicion(0);
        };
        a.addEventListener('timeupdate', alActualizar);
        a.addEventListener('loadedmetadata', alCargar);
        a.addEventListener('durationchange', alCargar);
        a.addEventListener('ended', alTerminar);
        a.addEventListener('error', () => setNoSePuede(true));
        return () => {
            a.removeEventListener('timeupdate', alActualizar);
            a.removeEventListener('loadedmetadata', alCargar);
            a.removeEventListener('durationchange', alCargar);
            a.removeEventListener('ended', alTerminar);
        };
    }, []);

    const alternar = () => {
        const a = audioRef.current;
        if (!a) return;
        if (a.paused) {
            // Pausa cualquier otro audio del hilo: dos notas de voz sonando
            // encimadas no se entienden.
            document.querySelectorAll('audio').forEach((otro) => otro !== a && otro.pause());
            a.play().then(
                () => setSonando(true),
                () => setNoSePuede(true),
            );
        } else {
            a.pause();
            setSonando(false);
        }
    };

    if (noSePuede) {
        return (
            <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg bg-wa-inset/[0.07] px-2.5 py-2 text-[13px] text-wa-text hover:bg-wa-inset/[0.12]"
            >
                <Mic size={16} className="text-wa-meta" aria-hidden="true" />
                Descargar la nota de voz
                <span className="text-[11px] text-wa-meta">(este navegador no la reproduce)</span>
            </a>
        );
    }

    const progreso = Number.isFinite(duracion) && duracion > 0 ? (posicion / duracion) * 100 : 0;

    return (
        <div className="flex items-center gap-2.5 min-w-[210px] py-0.5">
            {/* Oculto: no lleva `controls`, pero en cuanto carga los metadatos
                Chrome le da igual el alto de su reproductor (~54px) y cada nota
                de voz arrastraba un hueco invisible debajo de la burbuja. Se
                controla desde el codigo, asi que no necesita ocupar sitio. */}
            <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
            {/* 44px: el mismo reproductor se usa en el modo móvil, donde una
                zona táctil más chica falla el toque y dispara la acción de al
                lado (design-system/modo-movil-industrial/MASTER.md). En el
                escritorio no molesta. */}
            <button
                onClick={alternar}
                aria-label={sonando ? 'Pausar la nota de voz' : 'Escuchar la nota de voz'}
                className="shrink-0 h-11 w-11 -my-1 rounded-full flex items-center justify-center text-wa-meta hover:text-wa-text"
            >
                {/* Relleno: WhatsApp usa el triangulito lleno, no el contorno. */}
                {sonando ? (
                    <Pause size={22} fill="currentColor" aria-hidden="true" />
                ) : (
                    <Play size={22} fill="currentColor" aria-hidden="true" />
                )}
            </button>
            <div className="flex-1 min-w-0">
                <input
                    type="range"
                    min={0}
                    max={Number.isFinite(duracion) && duracion > 0 ? duracion : 0}
                    step="0.1"
                    value={posicion}
                    onChange={(e) => {
                        const a = audioRef.current;
                        if (!a) return;
                        a.currentTime = Number(e.target.value);
                        setPosicion(a.currentTime);
                    }}
                    aria-label="Posición de la nota de voz"
                    // `py-2` con `bg-clip-content`: la barra se ve fina pero la
                    // zona que agarra el dedo mide 20px. Una barra de 4px es
                    // imposible de arrastrar en un teléfono.
                    className="w-full h-[3px] py-2 box-content bg-clip-content rounded-full cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-wa-accent [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-wa-accent"
                    style={{
                        background: `linear-gradient(to right, rgb(var(--wa-accent)) ${progreso}%, rgb(var(--wa-meta) / .4) ${progreso}%)`,
                    }}
                />
                <div className="flex items-center justify-between text-[11px] text-wa-meta mt-0.5">
                    <span className="tnum">{tiempo(posicion)}</span>
                    <span className="tnum">{tiempo(duracion)}</span>
                </div>
            </div>
        </div>
    );
};

const Foto: React.FC<{ url: string; alt: string; onAbrir?: () => void }> = ({ url, alt, onAbrir }) => {
    const [falló, setFalló] = useState(false);
    if (falló) {
        return (
            <div className="flex items-center gap-2 rounded-lg bg-wa-inset/[0.07] px-2.5 py-2 text-[13px] text-wa-meta">
                <ImageOff size={14} aria-hidden="true" />
                No se pudo cargar la foto
            </div>
        );
    }
    return (
        <button
            onClick={onAbrir}
            className="block w-full overflow-hidden rounded-[6px] focus-visible:ring-2 focus-visible:ring-wa-accent"
            title="Ver en grande"
        >
            <img
                src={url}
                alt={alt}
                loading="lazy"
                decoding="async"
                onError={() => setFalló(true)}
                className="max-h-80 w-auto max-w-full object-cover"
            />
        </button>
    );
};

/**
 * El video va con los controles nativos: acá sí sirven -- son compactos,
 * el usuario los conoce, y a diferencia del audio no hay que meterlos en
 * una burbuja angosta.
 */
const Video: React.FC<{ url: string }> = ({ url }) => (
    <video src={url} controls preload="metadata" className="max-h-80 w-auto max-w-full rounded-[6px] bg-black" />
);

const Documento: React.FC<{ url: string; filename: string | null }> = ({ url, filename }) => (
    <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex max-w-[260px] items-center gap-2.5 rounded-lg bg-wa-inset/[0.07] px-2.5 py-2.5 text-[13px] text-wa-text hover:bg-wa-inset/[0.12]"
    >
        <FileText size={22} className="shrink-0 text-wa-meta" aria-hidden="true" />
        <span className="flex-1 truncate underline underline-offset-2">{filename?.trim() || 'Abrir el archivo'}</span>
        <Download size={15} className="shrink-0 text-wa-meta" aria-hidden="true" />
    </a>
);

export const MessageMedia: React.FC<Props> = ({ url, contentType, body, filename, onAbrirFoto }) => {
    switch (contentType) {
        case 'image':
            return <Foto url={url} alt={body ?? 'Foto del chat'} onAbrir={onAbrirFoto} />;
        case 'sticker':
            // Un sticker es una imagen, pero chica y sin marco: mostrarlo del
            // tamaño de una foto lo hace ver como un error.
            return <img src={url} alt="Sticker" loading="lazy" decoding="async" className="h-32 w-32 object-contain" />;
        case 'audio':
            return <NotaDeVoz url={url} />;
        case 'video':
            return <Video url={url} />;
        default:
            return <Documento url={url} filename={filename ?? null} />;
    }
};

export default MessageMedia;
