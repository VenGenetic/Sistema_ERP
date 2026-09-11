import { useIntervaloVisible } from '../../hooks/useIntervaloVisible';

/**
 * Que el chat se mantenga al día sin que nadie toque "Actualizar".
 *
 * El camino principal sigue siendo el realtime de Supabase. Esto es la red
 * de abajo, y hace falta por tres motivos distintos:
 *
 *  1. El realtime solo emite eventos de las tablas incluidas en la
 *     publicación `supabase_realtime`. Si esa migración no está aplicada
 *     (0033 del agente), la suscripción se conecta perfecto y no llega
 *     NADA -- que es como se veía: escribías un mensaje, aparecía "En
 *     cola" y al salir desaparecía de la pantalla hasta recargar.
 *  2. Una suscripción se cae sola: se corta el wifi, se duerme la laptop,
 *     cambia la red del local. Vuelve la conexión pero los eventos de
 *     ese rato no se reenvían nunca.
 *  3. La pestaña en segundo plano congela los temporizadores del
 *     navegador. Al volver hay que ponerse al día de una.
 *
 * Solo corre con la pestaña A LA VISTA y solo con un chat abierto: en un
 * ERP que queda abierto todo el día, un repaso cada pocos segundos contra
 * una pestaña que nadie está mirando es factura de Supabase al pepe.
 */
// Realtime sigue siendo el camino principal. Treinta segundos conserva una
// red de seguridad razonable cuando el socket se cae sin volver a descargar
// el mismo hilo 450 veces por hora y por pestaña.
const REPASO_MS = 30_000;

export function useRepasoDelHilo(
    activo: boolean,
    recargar: () => void | Promise<void>,
    ms: number = REPASO_MS,
): void {
    useIntervaloVisible(activo, recargar, ms, {
        alVolver: true,
        etiqueta: 'repaso del hilo de WhatsApp',
    });
}

/**
 * Mete las filas recién traídas en las que ya están en pantalla.
 *
 * No se reemplaza la lista entera a propósito. Dos razones:
 *
 *  * Cada burbuja está memoizada por su objeto. Cambiar los objetos cada
 *    ocho segundos redibujaría el hilo completo -- con sus fotos y sus
 *    audios -- aunque no haya cambiado nada.
 *  * El repaso trae solo los últimos N. Los mensajes más viejos que ya
 *    estaban cargados se conservan, así el hilo no se acorta solo mientras
 *    alguien lo está leyendo.
 *
 * Si nada cambió devuelve EXACTAMENTE el array anterior, así React no
 * vuelve a renderizar.
 */
export function fusionarMensajes<T extends { id: number; created_at: string }>(
    previos: T[],
    recientes: T[],
): T[] {
    if (recientes.length === 0) return previos;

    const anteriores = new Map(previos.map((m) => [m.id, m]));
    let cambio = false;

    for (const fila of recientes) {
        const previo = anteriores.get(fila.id);
        if (!previo) {
            anteriores.set(fila.id, fila);
            cambio = true;
            continue;
        }
        // Se reusa el objeto anterior si la fila no trae nada nuevo: es lo
        // que mantiene viva la memoización de la burbuja.
        if (!igualesEnSuperficie(previo, fila)) {
            anteriores.set(fila.id, fila);
            cambio = true;
        }
    }

    if (!cambio) return previos;

    // Se ordena por fecha y no por id: una importación de historial inserta
    // mensajes VIEJOS con ids nuevos, y ordenar por id los mandaría al final
    // del hilo.
    return [...anteriores.values()].sort((a, b) => {
        const d = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return d !== 0 ? d : a.id - b.id;
    });
}

/** Compara los campos de primer nivel de dos filas de la misma tabla. */
function igualesEnSuperficie(a: Record<string, any>, b: Record<string, any>): boolean {
    const claves = Object.keys(b);
    if (claves.length !== Object.keys(a).length) return false;
    return claves.every((k) => a[k] === b[k]);
}
