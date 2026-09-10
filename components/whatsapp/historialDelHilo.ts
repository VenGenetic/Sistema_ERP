import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Traer los mensajes VIEJOS de una conversación, de a tandas.
 *
 * El hilo abre con los últimos 100 (40 en el teléfono) porque una
 * conversación de un cliente frecuente puede tener miles y traerlos todos
 * es lento y caro. Hasta ahora eso era el final del asunto: arriba del hilo
 * decía «mostrando los últimos 100 mensajes» y no había ninguna forma de
 * ver el resto. Dos cosas se rompían con eso:
 *
 *   - «¿cuál era el que me cotizaste el mes pasado?» no se podía contestar
 *     sin abrir WhatsApp en el teléfono, que es justo lo que este módulo
 *     existe para evitar (ver `agente/docs/responder-desde-el-erp.md`);
 *   - el buscador del hilo (`BuscarEnHilo`) solo mira los mensajes que
 *     están cargados, así que buscar «Dmax» en un chat largo decía «sin
 *     resultados» aunque la palabra estuviera diez veces más arriba. Un
 *     buscador que miente es peor que no tenerlo.
 *
 * Lo delicado acá es el SCROLL. Al meter mensajes arriba, el contenido
 * crece por encima de lo que se está mirando y el navegador conserva el
 * `scrollTop`: visualmente el hilo pega un salto y la persona pierde el
 * renglón que estaba leyendo. Por eso se mide el alto antes de aplicar y se
 * corrige en el mismo cuadro (`useLayoutEffect`), antes de que el navegador
 * pinte -- no en un `useEffect`, que dejaría ver el salto.
 */

export interface OpcionesHistorial<T> {
    /** Cambia de chat: se reinicia el estado. */
    conversationId: number | null;
    /** Los mensajes en pantalla, ordenados del más viejo al más nuevo. */
    mensajes: T[];
    /** El contenedor con scroll del hilo. */
    contenedorRef: { current: HTMLElement | null };
    /**
     * Trae hasta `limite` mensajes anteriores a `anteriorA` (ISO), ya
     * ordenados del más viejo al más nuevo y con la autoría resuelta.
     *
     * Un fallo de verdad se LANZA. `null` significa «esto ya no aplica»
     * -- se cambió de chat mientras viajaba la consulta -- y no es un
     * error que haya que mostrarle a nadie.
     */
    traer: (anteriorA: string, limite: number) => Promise<T[] | null>;
    /** Mete la tanda en el hilo. Normalmente un `fusionarMensajes`. */
    aplicar: (viejos: T[]) => void;
    /** Cuántos por tanda. El mismo número con el que abrió el hilo. */
    porTanda: number;
}

export interface Historial {
    cargar: () => void;
    cargando: boolean;
    /** false cuando ya se llegó al principio de la conversación. */
    hayMas: boolean;
    error: string | null;
}

export function useHistorialDelHilo<T extends { id: number; created_at: string }>({
    conversationId,
    mensajes,
    contenedorRef,
    traer,
    aplicar,
    porTanda,
}: OpcionesHistorial<T>): Historial {
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** Se llegó al principio: lo dice una tanda que vino incompleta. */
    const [agotado, setAgotado] = useState(false);

    /** El alto y la posición justo antes de meter la tanda. */
    const anclaRef = useRef<{ alto: number; top: number } | null>(null);

    // Cambiar de conversación empieza de cero: el "ya no hay más" era del
    // chat anterior.
    useEffect(() => {
        setAgotado(false);
        setError(null);
        setCargando(false);
        anclaRef.current = null;
    }, [conversationId]);

    /*
        Reponer la posición ANTES de pintar.

        Corre después de cada render, pero solo hace algo cuando quedó un
        ancla puesta por `cargar`. El delta es cuánto creció el contenido:
        sumárselo al `scrollTop` deja el mismo renglón bajo los ojos.
    */
    useLayoutEffect(() => {
        const ancla = anclaRef.current;
        const cont = contenedorRef.current;
        if (!ancla || !cont) return;
        anclaRef.current = null;
        const crecio = cont.scrollHeight - ancla.alto;
        if (crecio > 0) cont.scrollTop = ancla.top + crecio;
    });

    const cargar = useCallback(() => {
        if (cargando || agotado || conversationId === null) return;
        const masViejo = mensajes[0];
        if (!masViejo) return;

        const cont = contenedorRef.current;
        setCargando(true);
        setError(null);

        void (async () => {
            try {
                const tanda = await traer(masViejo.created_at, porTanda);
                /* `null` = cambiaron de chat mientras viajaba la consulta.
                   No es un fallo: pintarlo como tal dejaba un mensaje rojo
                   en el chat recién abierto por haber tocado un botón en el
                   anterior. Los fallos de verdad llegan por `catch`. */
                if (!tanda) return;
                // Menos de una tanda completa significa que se llegó al
                // principio de la conversación.
                if (tanda.length < porTanda) setAgotado(true);
                if (tanda.length === 0) return;

                // El ancla se toma acá, con el DOM todavía sin la tanda.
                if (cont) anclaRef.current = { alto: cont.scrollHeight, top: cont.scrollTop };
                aplicar(tanda);
            } catch (err: any) {
                setError(err?.message ?? 'No se pudieron traer los mensajes anteriores.');
            } finally {
                setCargando(false);
            }
        })();
    }, [cargando, agotado, conversationId, mensajes, contenedorRef, traer, aplicar, porTanda]);

    return {
        cargar,
        cargando,
        // Con menos mensajes que una tanda no hay nada más atrás: el hilo
        // entero entró en la primera carga.
        hayMas: !agotado && mensajes.length >= porTanda,
        error,
    };
}
