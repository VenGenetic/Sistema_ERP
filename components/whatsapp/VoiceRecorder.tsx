import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Send, Square, Trash2 } from 'lucide-react';
import { button, cn } from '../ui/styles';

/**
 * Graba una nota de voz y la manda al cliente por WhatsApp.
 *
 * Existe porque la conversación va en los dos sentidos: se reciben 585
 * notas de voz, y contestarle por escrito a alguien que preguntó hablando
 * es más lento para todos. Explicar por audio qué diferencia hay entre dos
 * repuestos parecidos toma diez segundos y tres párrafos escritos.
 *
 * Sobre el formato: el navegador graba en el contenedor que soporte
 * (`MediaRecorder`). Chrome y Edge dan WebM/Opus; Firefox puede dar
 * OGG/Opus, que es lo que usa WhatsApp. En los dos casos el códec de audio
 * es Opus -- el mismo -- así que WhatsApp lo reproduce. Se elige el
 * formato preferido de la lista de abajo y se manda el mimetype REAL, sin
 * mentirle a WhatsApp sobre el contenedor.
 */

/** En orden de preferencia: primero el contenedor que usa WhatsApp. */
const FORMATOS = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

/** Tope de duración. Una nota de voz larga no la escucha nadie. */
const MAX_SEGUNDOS = 180;

function formatoSoportado(): string | null {
    if (typeof MediaRecorder === 'undefined') return null;
    return FORMATOS.find((f) => MediaRecorder.isTypeSupported(f)) ?? null;
}

function tiempo(segundos: number): string {
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

interface Props {
    /** Recibe la grabación lista para subir y enviar. */
    onEnviar: (archivo: File) => Promise<void>;
    disabled?: boolean;
    /**
     * Clases del botón, para que quien lo usa mande el tamaño.
     *
     * El modo móvil las necesita: sus botones miden 44px como mínimo
     * (`design-system/modo-movil-industrial/MASTER.md` -- por debajo se
     * falla el toque y se dispara la acción vecina), y los del escritorio
     * son de 32px. Sin esto habría que duplicar el grabador entero para
     * cambiarle dos clases.
     */
    claseBoton?: string;
    /**
     * Barra de WhatsApp: el botón es un círculo con el micrófono y nada más.
     * Sin esto el botón dice "Nota de voz" al lado del icono, que en una
     * barra de escribir de 48px de alto no entra ni se parece a WhatsApp.
     */
    soloIcono?: boolean;
    /**
     * Avisa si hay una grabación en curso o una grabada sin mandar.
     *
     * Lo necesita la barra de escribir: mientras el grabador esté ocupado no
     * puede desmontarlo para poner el botón de enviar en su lugar, porque la
     * grabación se perdería sin decir nada -- basta con tocar la caja de
     * texto después de grabar.
     */
    onOcupado?: (ocupado: boolean) => void;
}

export const VoiceRecorder: React.FC<Props> = ({ onEnviar, disabled, claseBoton, soloIcono, onOcupado }) => {
    const [grabando, setGrabando] = useState(false);
    const [segundos, setSegundos] = useState(0);
    const [grabacion, setGrabacion] = useState<{ blob: Blob; url: string; mime: string } | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const recorderRef = useRef<MediaRecorder | null>(null);
    const trozosRef = useRef<Blob[]>([]);
    const cronometroRef = useRef<ReturnType<typeof setInterval> | null>(null);
    /*
        La URL del blob, por referencia. La limpieza del desmontaje corre
        una sola vez y con `[]` se cerraba sobre el `grabacion` del primer
        render -- siempre null -- así que una nota grabada y no enviada
        dejaba su blob colgado en memoria hasta recargar la página.
    */
    const urlGrabacionRef = useRef<string | null>(null);

    /** Suelta el micrófono: si no, el navegador deja el indicador encendido. */
    const soltarMicrofono = () => {
        recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
        recorderRef.current = null;
    };

    useEffect(
        () => () => {
            if (cronometroRef.current) clearInterval(cronometroRef.current);
            soltarMicrofono();
            if (urlGrabacionRef.current) URL.revokeObjectURL(urlGrabacionRef.current);
        },
        [],
    );

    const ocupado = grabando || !!grabacion;
    useEffect(() => {
        onOcupado?.(ocupado);
    }, [ocupado, onOcupado]);

    const empezar = async () => {
        setError(null);
        const mime = formatoSoportado();
        if (!mime) {
            setError('Este navegador no puede grabar audio. Probá con Chrome.');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const rec = new MediaRecorder(stream, { mimeType: mime });
            trozosRef.current = [];

            rec.ondataavailable = (e) => e.data.size > 0 && trozosRef.current.push(e.data);
            rec.onstop = () => {
                const blob = new Blob(trozosRef.current, { type: mime });
                const url = URL.createObjectURL(blob);
                urlGrabacionRef.current = url;
                setGrabacion({ blob, url, mime });
                soltarMicrofono();
            };

            recorderRef.current = rec;
            rec.start();
            setGrabando(true);
            setSegundos(0);
            /*
                El actualizador de `setSegundos` solo cuenta. El corte en el
                tope vive en su propio efecto: llamar a `detener()` -- que
                cambia tres estados y para el MediaRecorder -- desde dentro
                de un actualizador es un efecto colateral en una función que
                React puede volver a ejecutar, y en modo estricto la
                grabación se cortaba dos veces.
            */
            cronometroRef.current = setInterval(() => setSegundos((s) => s + 1), 1000);
        } catch {
            // Lo más común: la persona rechazó el permiso del micrófono.
            setError('No se pudo usar el micrófono. Revisá el permiso del navegador.');
        }
    };

    /* Se corta sola en el tope: nadie escucha una nota de tres minutos, y
       una grabación abierta por olvido se queda con el micrófono. */
    useEffect(() => {
        if (grabando && segundos >= MAX_SEGUNDOS) detener();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [grabando, segundos]);

    const detener = () => {
        if (cronometroRef.current) clearInterval(cronometroRef.current);
        cronometroRef.current = null;
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
        setGrabando(false);
    };

    const descartar = () => {
        if (grabacion) URL.revokeObjectURL(grabacion.url);
        urlGrabacionRef.current = null;
        setGrabacion(null);
        setSegundos(0);
    };

    const enviar = async () => {
        if (!grabacion || enviando) return;
        setEnviando(true);
        setError(null);
        try {
            // La extensión tiene que coincidir con el contenedor real: con la
            // equivocada, el reproductor del ERP queda mudo al releer el hilo.
            const ext = grabacion.mime.includes('ogg') ? 'ogg' : grabacion.mime.includes('mp4') ? 'm4a' : 'webm';
            const archivo = new File([grabacion.blob], `nota-de-voz-${Date.now()}.${ext}`, { type: grabacion.mime });
            await onEnviar(archivo);
            descartar();
        } catch (err: any) {
            setError(err?.message ?? 'No se pudo enviar la nota de voz.');
        } finally {
            setEnviando(false);
        }
    };

    if (grabacion) {
        return (
            <div className="flex items-center gap-2 flex-wrap">
                {/* Se puede escuchar antes de mandarla: una nota de voz sale
                    una sola vez y no se puede borrar del teléfono del cliente. */}
                <audio src={grabacion.url} controls className="h-8 max-w-[220px]" />
                <button
                    onClick={enviar}
                    disabled={enviando}
                    className={claseBoton ?? cn(button.base, button.variant.primary, button.size.sm)}
                >
                    {enviando ? (
                        <Loader2 size={soloIcono ? 20 : 14} className="animate-spin" aria-hidden="true" />
                    ) : (
                        <Send size={soloIcono ? 20 : 14} aria-hidden="true" />
                    )}
                    {!soloIcono && 'Enviar nota'}
                </button>
                <button
                    onClick={descartar}
                    disabled={enviando}
                    aria-label="Descartar la grabación"
                    className={claseBoton ?? cn(button.base, button.variant.ghost, button.size.sm)}
                >
                    <Trash2 size={14} aria-hidden="true" />
                </button>
                {error && <p className="w-full text-2xs text-wa-danger">{error}</p>}
            </div>
        );
    }

    return (
        <>
            <button
                onClick={grabando ? detener : empezar}
                disabled={disabled}
                className={
                    claseBoton ??
                    cn(button.base, grabando ? button.variant.danger : button.variant.secondary, button.size.sm)
                }
                title={grabando ? 'Detener la grabación' : 'Grabar una nota de voz'}
            >
                {grabando ? (
                    <Square size={soloIcono ? 18 : 14} fill="currentColor" aria-hidden="true" />
                ) : (
                    <Mic size={soloIcono ? 21 : 14} aria-hidden="true" />
                )}
                {!soloIcono && (grabando ? `Grabando ${tiempo(segundos)}` : 'Nota de voz')}
            </button>
            {/* El cronómetro tiene que verse igual sin la etiqueta: una nota de
                voz de tres minutos se corta sola y hay que saber cuánto va. */}
            {soloIcono && grabando && (
                <span className="tnum shrink-0 text-[13px] font-semibold text-wa-danger" aria-live="polite">
                    {tiempo(segundos)}
                </span>
            )}
            {error && <p className="w-full text-2xs text-wa-danger">{error}</p>}
        </>
    );
};

export default VoiceRecorder;
