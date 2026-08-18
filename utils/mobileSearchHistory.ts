/**
 * mobileSearchHistory.ts
 * Últimos términos buscados desde el teléfono.
 *
 * El panel de la barra de búsqueda ofrecía nueve "búsquedas populares" que en
 * realidad eran un array escrito a mano dentro del componente: las mismas para
 * todo el mundo y sin relación con lo que se busca de verdad. Quien pasa el día
 * en el mostrador repite unos pocos términos, y ésos son los que valen como
 * atajo.
 *
 * Vive en localStorage, igual que `mobilePrintHistory.ts`: es una preferencia
 * de este teléfono, no un dato del negocio, y no merece un viaje a la red.
 */

const HISTORY_KEY = 'mobile_search_history';
const MAX_HISTORY = 8;

export const getSearchHistory = (): string[] => {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
    } catch {
        return [];
    }
};

/**
 * Anota un término. El más reciente va primero y no se repite: buscar dos veces
 * lo mismo lo sube al principio en vez de duplicar la ficha.
 */
export const rememberSearch = (term: string): void => {
    const cleaned = term.trim();
    // Un código de barras completo no es un atajo útil: se escanea, no se
    // vuelve a tocar. Se guardan las búsquedas por palabras.
    if (cleaned.length < 2 || cleaned.length > 40) return;

    try {
        const history = getSearchHistory();
        const filtered = history.filter(t => t.toLowerCase() !== cleaned.toLowerCase());
        filtered.unshift(cleaned);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, MAX_HISTORY)));
    } catch (e) {
        console.error('Error guardando el historial de búsqueda:', e);
    }
};

export const clearSearchHistory = (): void => {
    try {
        localStorage.removeItem(HISTORY_KEY);
    } catch {
        /* modo privado: no había nada que borrar */
    }
};
