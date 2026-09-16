/**
 * El resumen de una bitácora es una lista de puntos.
 *
 * Se guarda como texto plano con un punto por línea en vez de un array o
 * jsonb: la columna ya existía como TEXT, los resúmenes de una sola línea
 * que ya estaban guardados pasan a ser un punto sin migrar nada, y la
 * búsqueda sigue siendo un `includes` sobre el texto completo.
 */

export const parseBullets = (resumen: string): string[] =>
    resumen
        .split('\n')
        .map(linea => linea.trim())
        .filter(Boolean);

/** Descarta los puntos vacíos: existen mientras se escribe, no al guardar. */
export const serializeBullets = (bullets: string[]): string =>
    bullets
        .map(bullet => bullet.trim())
        .filter(Boolean)
        .join('\n');
