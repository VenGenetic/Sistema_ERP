import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { searchProducts } from './mobileSearchCore';

/*
    El algoritmo de busqueda vive en `mobileSearchCore.ts` y se re-exporta aqui.

    Se partio en dos para que el Web Worker pueda cargar SOLO el algoritmo: si
    importara este fichero se llevaria consigo React y el cliente de Supabase,
    que dentro de un worker no pintan nada. Al re-exportarlo, las pantallas que
    ya hacian `import { searchProducts } from '../../utils/mobileSearchEngine'`
    siguen funcionando sin tocar ni una linea.
*/
export {
    limpiarTexto,
    expandirTerminos,
    fuzzyMatchWords,
    isFuzzyMatch,
    planificarBusqueda,
    calcularRelevancia,
    searchProducts,
    getSuggestions,
} from './mobileSearchCore';
export type { QueryPlan } from './mobileSearchCore';

// ─────────────────────────────────────────────────────────────
// 7. CACHÉ EN IndexedDB (Con Caché Stale-While-Revalidate)
//
//    Antes se guardaba en localStorage, que tiene ~5MB de cuota por origen.
//    El catálogo completo ya pesa más que eso, así que el `setItem` fallaba
//    con QuotaExceededError en TODAS las cargas; el catch solo lo dejaba en
//    consola. La caché nunca llegó a persistir: cada apertura del móvil
//    volvía a descargar el catálogo entero, sin que nada lo avisara.
//
//    IndexedDB no tiene ese techo (la cuota es del disco, no ~5MB fijos) y
//    guarda los objetos ya estructurados: sin el JSON.parse de varios MB que
//    bloqueaba el hilo principal cada vez que arrancaba la app.
// ─────────────────────────────────────────────────────────────
const DB_NAME = 'erp_mobile_cache';
const DB_VERSION = 1;
const STORE_NAME = 'catalog';
const CACHE_ENTRY_KEY = 'products';
const FRESH_DURATION = 1000 * 60 * 10; // 10 minutos de frescura

interface ProductCacheEntry {
    data: any[];
    time: number;
}

function openCacheDb(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
        if (typeof indexedDB === 'undefined') { resolve(null); return; }
        try {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                if (!req.result.objectStoreNames.contains(STORE_NAME)) {
                    req.result.createObjectStore(STORE_NAME);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
}

async function readProductCache(): Promise<ProductCacheEntry | null> {
    const db = await openCacheDb();
    if (!db) return null;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(CACHE_ENTRY_KEY);
            req.onsuccess = () => resolve((req.result as ProductCacheEntry) || null);
            req.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
}

async function writeProductCache(data: any[]): Promise<void> {
    const db = await openCacheDb();
    if (!db) return;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put({ data, time: Date.now() } as ProductCacheEntry, CACHE_ENTRY_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        } catch {
            resolve();
        }
    });
}

// ─────────────────────────────────────────────────────────────
// 8. HOOK RÁPIDO: useMobileProducts
// ─────────────────────────────────────────────────────────────

// `importer_unavailable_override` es la marca manual "Agotado en
// Importadora". Parece de más para una tarjeta de catálogo y NO lo es: la
// búsqueda del chat (utils/catalogoRapido.ts) reutiliza este mismo array
// como índice cuando ya está cargado, y `stockUtil` decide con esa columna
// si el stock del importador cuenta. Sin ella se le ofrece al cliente una
// pieza que el ERP ya marcó como no disponible -- la regla que CLAUDE.md
// obliga a mantener igual que la del bot.
//
// Solo las columnas que usa la tarjeta del catálogo, el buscador y las
// pantallas de inventario/etiquetas. Editar un repuesto necesita más
// (margen, stock mínimo, marca...); esa fila completa se pide aparte,
// una sola vez, justo antes de abrir el formulario de edición — ver
// handleEditProduct en MobileCatalog. Antes se traía `select('*')` con
// 36 columnas por fila; la mitad de ese peso eran campos que el móvil
// nunca lee (auditoría, márgenes, timestamps de edición).
const MOBILE_PRODUCT_SELECT = `
    id, sku, name, image_url, gallery, group_id,
    price, cost_without_vat, vat_percentage,
    local_stock, importer_stock, importer_unavailable_override,
    is_discontinued, discontinued_until,
    demand_count, investigation_status, auto_order_disabled,
    category,
    brands ( name ),
    inventory_levels ( warehouse_id, current_stock ),
    product_tags ( tags ( id, name, color ) )
`;

async function fetchProductsFromServer(): Promise<any[]> {
    // Se cuenta primero para poder pedir todas las páginas a la vez. Antes
    // cada tanda de 1000 filas esperaba a que terminara la anterior
    // (`while` con `await` secuencial); con 5-6 tandas eso es 5-6 veces el
    // tiempo de ida y vuelta a Supabase que hace falta.
    const { count, error: countErr } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);
    if (countErr) throw countErr;

    const pageSize = 1000;
    const pageCount = Math.max(1, Math.ceil((count || 0) / pageSize));

    const pages = await Promise.all(
        Array.from({ length: pageCount }, (_, i) =>
            supabase
                .from('products')
                .select(MOBILE_PRODUCT_SELECT)
                .eq('is_active', true)
                .order('name', { ascending: true })
                .range(i * pageSize, (i + 1) * pageSize - 1)
        )
    );

    const allData: any[] = [];
    for (const { data, error: err } of pages) {
        if (err) throw err;
        if (data) allData.push(...data);
    }
    return allData;
}

// Caché en memoria del proceso: instantáneo al navegar entre las 3 pantallas
// móviles dentro de la misma sesión, sin volver a tocar IndexedDB ni la red.
let globalInMemoryProducts: any[] | null = null;

/**
 * El catálogo que ya esté cargado en esta pestaña, o `null`.
 *
 * Lo usa la búsqueda del chat (`utils/catalogoRapido.ts`) para no bajar su
 * propio índice cuando el catálogo móvil ya está en memoria: es un
 * superconjunto del que ella necesita, y son 2 MB.
 *
 * Devuelve el array TAL CUAL, no una copia, para que quien lo reciba pueda
 * compararlo por identidad y saber si cambió.
 */
export function catalogoMovilEnMemoria(): any[] | null {
    return globalInMemoryProducts;
}
let globalFetchTime: number | null = null;
let isFetchingGlobal = false;
let fetchPromise: Promise<void> | null = null;

export const useMobileProducts = () => {
    const [products, setProducts] = useState<any[]>(() => globalInMemoryProducts || []);
    const [loading, setLoading] = useState<boolean>(() => !globalInMemoryProducts);
    const [error, setError] = useState<string | null>(null);

    /*
        Estable de por vida (deps `[]`). La versión anterior dependía de
        `products.length`, así que su identidad cambiaba en cuanto llegaban
        datos y el useEffect de abajo se volvía a disparar — inofensivo hoy
        porque el caso "ya está fresco" corta antes de pedir nada, pero es
        una trampa: cualquier cambio cercano a ese código puede convertirlo
        en una petición de red de más por cada carga.

        Si dos pantallas montan el hook casi a la vez, ambas llaman a
        `load()`: la primera dispara el fetch y la segunda espera la MISMA
        promesa (no una copia) en vez de rendirse en silencio. Al terminar,
        las dos sincronizan su estado local desde la caché de módulo — así
        ninguna de las dos se queda con `loading` colgado.
    */
    const load = useCallback(async (force: boolean) => {
        if (!force && globalFetchTime && Date.now() - globalFetchTime < FRESH_DURATION) {
            setLoading(false);
            return;
        }

        if (!(isFetchingGlobal && fetchPromise)) {
            isFetchingGlobal = true;
            if (!globalInMemoryProducts) setLoading(true);

            fetchPromise = (async () => {
                try {
                    const data = await fetchProductsFromServer();
                    globalInMemoryProducts = data;
                    globalFetchTime = Date.now();
                    writeProductCache(data).catch(() => {});
                } finally {
                    isFetchingGlobal = false;
                }
            })();
        }

        try {
            await fetchPromise;
            setProducts(globalInMemoryProducts || []);
            setError(null);
        } catch (err: any) {
            console.error('Error al cargar catálogo móvil:', err);
            if (!globalInMemoryProducts) setError(err?.message || 'Error de conexión con Supabase');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!globalInMemoryProducts) {
                // Primer render de la sesión: pinta de inmediato con lo que haya
                // en IndexedDB mientras la red trae la versión fresca por detrás.
                const cached = await readProductCache();
                if (cancelled) return;
                if (cached && cached.data.length > 0) {
                    globalInMemoryProducts = cached.data;
                    globalFetchTime = cached.time;
                    setProducts(cached.data);
                    setLoading(false);
                }
            }
            if (!cancelled) await load(false);
        })();

        return () => { cancelled = true; };
    }, [load]);

    const refresh = useCallback(() => load(true), [load]);

    return {
        products,
        loading,
        error,
        refresh
    };
};
