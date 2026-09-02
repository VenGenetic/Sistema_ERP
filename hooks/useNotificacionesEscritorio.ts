import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Avisar cuando entra un mensaje y la bandeja no está a la vista.
 *
 * Era el hueco más caro de los que se podían tapar: el ERP no avisaba nada
 * fuera de la pestaña, así que un cliente escribía y nadie se enteraba
 * hasta que alguien se acordaba de mirar. En un negocio donde el que
 * contesta primero vende, eso es plata.
 *
 * Tres decisiones que importan:
 *
 *  * Solo con la pestaña OCULTA o el chat cerrado. Notificar un mensaje
 *    del chat que estás mirando es ruido, y el ruido enseña a apagar las
 *    notificaciones.
 *  * El permiso se pide con un gesto de la persona, nunca al cargar. Los
 *    navegadores bloquean para siempre el pedido automático, y una vez
 *    bloqueado no hay forma de volver a pedirlo desde la página.
 *  * Los chats silenciados no avisan. Es la misma lista de silenciados que
 *    ya usa la bandeja, así que silenciar significa una sola cosa.
 */

export type PermisoNotificacion = 'default' | 'granted' | 'denied' | 'no-soportado';

const CLAVE = 'wa-notificaciones-activas';

function permisoActual(): PermisoNotificacion {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'no-soportado';
    return Notification.permission as PermisoNotificacion;
}

/** Preferencia propia, aparte del permiso del navegador: se puede tener el
 *  permiso concedido y aun así querer trabajar en silencio un rato. */
function leerActivas(): boolean {
    try {
        return localStorage.getItem(CLAVE) !== 'off';
    } catch {
        return true;
    }
}

export interface AvisoDeMensaje {
    conversationId: number;
    titulo: string;
    cuerpo: string;
    /** Se silencia si está en esta lista. */
    silenciado?: boolean;
}

export function useNotificacionesEscritorio(opciones: {
    /** La conversación abierta ahora mismo: sus mensajes no notifican. */
    conversacionAbierta: number | null;
    /** Qué hacer al tocar la notificación. */
    onAbrir: (conversationId: number) => void;
}) {
    const [permiso, setPermiso] = useState<PermisoNotificacion>(permisoActual);
    const [activas, setActivas] = useState<boolean>(leerActivas);

    // Por referencia: `notificar` no puede cambiar de identidad en cada
    // render, porque quien la llama es una suscripción de realtime que se
    // arma una sola vez.
    const refs = useRef(opciones);
    refs.current = opciones;

    /**
     * Las notificaciones abiertas, por conversación. Diez mensajes seguidos
     * del mismo cliente tienen que ser UN aviso que se actualiza, no diez
     * apilados: para eso sirve la etiqueta, y la referencia permite
     * cerrarlas todas cuando se abre el chat.
     */
    const abiertas = useRef(new Map<number, Notification>());

    useEffect(() => {
        return () => {
            abiertas.current.forEach((n) => n.close());
            abiertas.current.clear();
        };
    }, []);

    /* Al abrir un chat se cierra su aviso: dejarlo colgado en el escritorio
       después de haberlo atendido es exactamente lo que hace que la gente
       deje de mirarlos. */
    useEffect(() => {
        const id = opciones.conversacionAbierta;
        if (id === null) return;
        const n = abiertas.current.get(id);
        if (n) {
            n.close();
            abiertas.current.delete(id);
        }
    }, [opciones.conversacionAbierta]);

    const pedirPermiso = useCallback(async () => {
        if (!('Notification' in window)) {
            setPermiso('no-soportado');
            return 'no-soportado' as const;
        }
        const resultado = (await Notification.requestPermission()) as PermisoNotificacion;
        setPermiso(resultado);
        if (resultado === 'granted') {
            setActivas(true);
            try { localStorage.setItem(CLAVE, 'on'); } catch { /* modo privado */ }
        }
        return resultado;
    }, []);

    const alternar = useCallback(() => {
        setActivas((previo) => {
            const siguiente = !previo;
            try { localStorage.setItem(CLAVE, siguiente ? 'on' : 'off'); } catch { /* modo privado */ }
            return siguiente;
        });
    }, []);

    const notificar = useCallback((aviso: AvisoDeMensaje) => {
        if (aviso.silenciado) return;
        if (!activas || permisoActual() !== 'granted') return;

        // El chat que se está mirando con la pestaña al frente no notifica:
        // el mensaje ya apareció en el hilo, delante de los ojos.
        const mirandoEseChat =
            document.visibilityState === 'visible' &&
            refs.current.conversacionAbierta === aviso.conversationId;
        if (mirandoEseChat) return;

        try {
            const n = new Notification(aviso.titulo, {
                body: aviso.cuerpo,
                // La etiqueta por conversación es lo que hace que el segundo
                // mensaje del mismo cliente REEMPLACE al primero.
                tag: `wa-${aviso.conversationId}`,
                renotify: false,
                // El icono real de la app (public/). Con una ruta que no
                // existe el navegador dibuja su propio icono genérico y el
                // aviso se confunde con el de cualquier otra pestaña.
                icon: '/android-chrome-192x192.png',
                silent: false,
            } as NotificationOptions);

            n.onclick = () => {
                window.focus();
                refs.current.onAbrir(aviso.conversationId);
                n.close();
            };
            n.onclose = () => abiertas.current.delete(aviso.conversationId);

            abiertas.current.get(aviso.conversationId)?.close();
            abiertas.current.set(aviso.conversationId, n);
        } catch (err) {
            // Algunos navegadores lanzan si se construye una Notification
            // fuera de un service worker (Android). Que falle el aviso no
            // puede romper la recepción del mensaje.
            console.warn('No se pudo mostrar la notificación:', err);
        }
    }, [activas]);

    return {
        permiso,
        activas,
        /** Se puede avisar de verdad ahora mismo. */
        listo: permiso === 'granted' && activas,
        pedirPermiso,
        alternar,
        notificar,
    };
}

export default useNotificacionesEscritorio;
