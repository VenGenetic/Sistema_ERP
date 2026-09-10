import { useEffect, useRef } from 'react';

interface OpcionesIntervaloVisible {
    /** Ejecuta una primera vez al montar, sin esperar el intervalo. */
    inmediato?: boolean;
    /** Se pone al dia apenas la persona vuelve a mirar la pestana. */
    alVolver?: boolean;
    /** Nombre corto para que un fallo de fondo sea rastreable. */
    etiqueta?: string;
}

/**
 * Ejecuta un repaso periodico solo cuando la pestana esta visible.
 *
 * Usa `setTimeout` despues de que termina cada trabajo en lugar de
 * `setInterval`: una consulta lenta nunca se monta encima de la anterior.
 * Esto baja consumo, evita rafagas al volver de suspension y conserva una
 * actualizacion inmediata cuando la persona regresa a la pantalla.
 */
export function useIntervaloVisible(
    activo: boolean,
    trabajo: () => void | Promise<void>,
    intervaloMs: number,
    opciones: OpcionesIntervaloVisible = {},
): void {
    const ultima = useRef(trabajo);
    ultima.current = trabajo;

    const inmediato = opciones.inmediato ?? false;
    const alVolver = opciones.alVolver ?? true;
    const etiqueta = opciones.etiqueta ?? 'repaso visible';

    useEffect(() => {
        if (!activo) return;

        let cancelado = false;
        let ejecutando = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const cancelarTimer = () => {
            if (timer !== undefined) clearTimeout(timer);
            timer = undefined;
        };

        const programar = () => {
            cancelarTimer();
            if (cancelado || document.visibilityState !== 'visible') return;
            timer = setTimeout(() => void ejecutar(), intervaloMs);
        };

        const ejecutar = async () => {
            if (cancelado || ejecutando || document.visibilityState !== 'visible') return;
            ejecutando = true;
            try {
                await ultima.current();
            } catch (error) {
                console.error(`Fallo en ${etiqueta}:`, error);
            } finally {
                ejecutando = false;
                programar();
            }
        };

        const alCambiarVisibilidad = () => {
            cancelarTimer();
            if (document.visibilityState === 'visible') {
                if (alVolver) void ejecutar();
                else programar();
            }
        };

        if (document.visibilityState === 'visible') {
            if (inmediato) void ejecutar();
            else programar();
        }
        document.addEventListener('visibilitychange', alCambiarVisibilidad);

        return () => {
            cancelado = true;
            cancelarTimer();
            document.removeEventListener('visibilitychange', alCambiarVisibilidad);
        };
    }, [activo, alVolver, etiqueta, inmediato, intervaloMs]);
}
