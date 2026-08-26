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
                className="flex items-center gap-2 rounded-lg border border-subtle bg-surface px-2.5 py-1.5 text-xs text-fg hover:bg-surface-hover"
            >
                <Mic size={14} aria-hidden="true" />
                Descargar la nota de voz
                <span className="text-2xs text-fg-subtle">(este navegador no la reproduce)</span>
            </a>
        );
    }

    const progreso = Number.isFinite(duracion) && duracion > 0 ? (posicion / duracion) * 100 : 0;

    return (
        <div className="flex items-center gap-2 min-w-[190px]">
            <audio ref={audioRef} src={url} preload="metadata" />
            <button
                onClick={alternar}
                aria-label={sonando ? 'Pausar la nota de voz' : 'Escuchar la nota de voz'}
                className="shrink-0 h-8 w-8 rounded-full bg-primary text-primary-fg flex items-center justify-center hover:bg-primary-hover"
            >
                {sonando ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
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
                    className="w-full h-1 accent-primary cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, rgb(var(--primary)) ${progreso}%, rgb(var(--surface-3)) ${progreso}%)`,
                    }}
                />
                <div className="flex items-center justify-between text-2xs text-fg-subtle mt-0.5">
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
            <div className="flex items-center gap-2 rounded-lg bg-surface-3 px-2.5 py-2 text-xs text-fg-subtle">
                <ImageOff size={14} aria-hidden="true" />
                No se pudo cargar la foto
            </div>
        );
    }
    return (
        <button
            onClick={onAbrir}
            className="block rounded-xl overflow-hidden focus-visible:ring-2 focus-visible:ring-primary"
            title="Ver en grande"
        >
            <img src={url} alt={alt} loading="lazy" onError={() => setFalló(true)} className="max-h-64 w-auto object-cover" />
        </button>
    );
};

/**
 * El video va con los controles nativos: acá sí sirven -- son compactos,
 * el usuario los conoce, y a diferencia del audio no hay que meterlos en
 * una burbuja angosta.
 */
const Video: React.FC<{ url: string }> = ({ url }) => (
    <video src={url} controls preload="metadata" className="max-h-64 w-auto rounded-xl bg-black" />
);

const Documento: React.FC<{ url: string; filename: string | null }> = ({ url, filename }) => (
    <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 rounded-lg border border-subtle bg-surface px-2.5 py-2 text-xs text-fg hover:bg-surface-hover max-w-[240px]"
    >
        <FileText size={16} className="shrink-0 text-fg-muted" aria-hidden="true" />
        <span className="truncate flex-1">{filename?.trim() || 'Abrir el archivo'}</span>
        <Download size={13} className="shrink-0 text-fg-subtle" aria-hidden="true" />
    </a>
);

export const MessageMedia: React.FC<Props> = ({ url, contentType, body, filename, onAbrirFoto }) => {
    switch (contentType) {
        case 'image':
            return <Foto url={url} alt={body ?? 'Foto del chat'} onAbrir={onAbrirFoto} />;
        case 'sticker':
            // Un sticker es una imagen, pero chica y sin marco: mostrarlo del
            // tamaño de una foto lo hace ver como un error.
            return <img src={url} alt="Sticker" loading="lazy" className="h-24 w-24 object-contain" />;
        case 'audio':
            return <NotaDeVoz url={url} />;
        case 'video':
            return <Video url={url} />;
        default:
            return <Documento url={url} filename={filename ?? null} />;
    }
};

export default MessageMedia;
