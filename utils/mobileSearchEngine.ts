import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';

// ─────────────────────────────────────────────────────────────
// 1. HELPER: LIMPIAR TEXTO (Sin acentos, minúsculas)
// ─────────────────────────────────────────────────────────────
export const limpiarTexto = (texto: any): string => {
    if (!texto) return '';
    return String(texto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

// ─────────────────────────────────────────────────────────────
// 2. HELPER: EXPANSIÓN DE SINÓNIMOS (Repuestos de motos / ERP)
//    OPTIMIZADO: Lookup table pre-indexada por cada sinónimo
// ─────────────────────────────────────────────────────────────
const sinonimosBase: Record<string, string[]> = {
    'freno': ['frenos', 'frenado', 'pastilla', 'pastillas', 'disco', 'tambor', 'caliper', 'mordaza'],
    'pastilla': ['pastillas', 'freno', 'frenos', 'block', 'balata', 'balatas'],
    'balata': ['balatas', 'pastilla', 'pastillas', 'freno'],
    'filtro': ['filtros', 'filtrante'],
    'aceite': ['aceites', 'lubricante', 'lubricantes', '2t', '4t'],
    'cadena': ['cadenas', 'transmision', 'pinon', 'corona', 'arrastre', 'kit arrastre'],
    'arrastre': ['traccion', 'cadena', 'pinon', 'corona', 'kit'],
    'amortiguador': ['amortiguadores', 'suspension', 'monoshock', 'shock'],
    'llanta': ['llantas', 'neumatico', 'neumaticos', 'rueda', 'ruedas', 'caucho', 'cauchos', 'cubierta'],
    'faro': ['faros', 'luz', 'luces', 'farolo', 'faroloa', 'optica', 'foco', 'focos', 'bombillo', 'led'],
    'escape': ['escapes', 'silenciador', 'tubo', 'cano', 'exhosto', 'muffler'],
    'motor': ['motores', 'cilindro', 'cilindros', 'piston', 'pistones', 'cabezal'],
    'velocimento': ['velocimetro', 'velocimetros', 'instrumentos', 'panel', 'tablero', 'tacometro', 'reloj'],
    'carburador': ['carburadores', 'inyeccion', 'inyector', 'admision'],
    'arranque': ['starter', 'partida', 'marcha', 'bendix'],
    'electrico': ['electrica', 'electricos', 'electricidad', 'ramal'],
    'telescopica': ['telescopicas', 'barra', 'barras', 'suspension delantera', 'telescopio', 'amortiguador delantero', 'amortiguadores delanteros'],
    'monoshock': ['monoshocks', 'amortiguador trasero', 'suspension trasera', 'shock'],
    'ramal': ['arnes', 'cableado', 'instalacion electrica', 'cable'],
    'mesa': ['mesas', 'arana', 'aranas', 'castillo', 'tija', 'yugo'],
    'bujia': ['bujias', 'spark'],
    'placa': ['placas', 'plastico', 'plasticos', 'carenado', 'pasta', 'pastas', 'tapa', 'tapas', 'cubierta'],
    'del': ['delantero', 'delant', 'delantera', 'delanteros', 'delanteras', 'front'],
    'delantero': ['del', 'delant', 'delantera', 'delanteros', 'delanteras'],
    'post': ['posterior', 'posteriores', 'trasero', 'trasera', 'traseros', 'traseras', 'rear'],
    'trasero': ['post', 'posterior', 'posteriores', 'trasera', 'traseros', 'traseras'],
    'der': ['derecho', 'derecha', 'derechos', 'derechas', 'rh', 'right'],
    'derecho': ['der', 'derecha', 'derechos', 'derechas'],
    'izq': ['izquierdo', 'izquierda', 'izquierdos', 'izquierdas', 'lh', 'left'],
    'izquierdo': ['izq', 'izquierda', 'izquierdos', 'izquierdas'],
    'protec': ['protector', 'protectores', 'defensa', 'defensas', 'guardabierres', 'guardabarros', 'salpicadera'],
    'espejo': ['espejos', 'retrovisor', 'retrovisores', 'mirror'],
    'manubrio': ['timon', 'manillar', 'handlebar'],
    'comando': ['comandos', 'switch', 'switche', 'botonera', 'interruptor', 'pina'],
    'manzana': ['manzanas', 'carrete', 'buje', 'hub'],
    'disco': ['discos', 'rotor', 'discodel', 'freno disco', 'rotores'],
    'kit': ['juego', 'set', 'combo', 'pack']
};

// Pre-build a reverse lookup: word -> group of all related words
const synonymLookup = new Map<string, string[]>();
(() => {
    const groupMap = new Map<string, Set<string>>();
    for (const [key, values] of Object.entries(sinonimosBase)) {
        const allWords = [key, ...values];
        const group = new Set(allWords);
        for (const w of allWords) {
            if (!groupMap.has(w)) groupMap.set(w, new Set());
            group.forEach(g => groupMap.get(w)!.add(g));
        }
    }
    groupMap.forEach((set, key) => {
        synonymLookup.set(key, Array.from(set));
    });
})();

// Cached expansion results (very hot path)
const expansionCache = new Map<string, string[]>();

export const expandirTerminos = (terminos: string[]): string[] => {
    const expandidos = new Set<string>();

    for (const termino of terminos) {
        const tLower = termino.toLowerCase();
        expandidos.add(tLower);

        // Check cache first
        const cached = expansionCache.get(tLower);
        if (cached) {
            for (const w of cached) expandidos.add(w);
            continue;
        }

        const related: string[] = [];
        // Direct O(1) lookup
        const directMatch = synonymLookup.get(tLower);
        if (directMatch) {
            for (const w of directMatch) { related.push(w); expandidos.add(w); }
        }

        expansionCache.set(tLower, related);
    }

    return Array.from(expandidos);
};

// ─────────────────────────────────────────────────────────────
// 3. HELPER: FUZZY MATCHING RÁPIDO (Tolerancia a "dedos gordos")
// ─────────────────────────────────────────────────────────────
export const isFuzzyMatch = (text: string, term: string): boolean => {
    if (!text || !term) return false;
    if (text.includes(term)) return true;
    if (term.length <= 3) return false;

    const words = text.split(/[\s\-_/]+/);
    for (const w of words) {
        if (Math.abs(w.length - term.length) <= 1) {
            let mismatches = 0;
            let i = 0, j = 0;
            while (i < term.length && j < w.length) {
                if (term[i] !== w[j]) {
                    mismatches++;
                    if (mismatches > 1) break;
                    if (term[i + 1] === w[j]) i++;
                    else if (term[i] === w[j + 1]) j++;
                    else { i++; j++; }
                } else {
                    i++; j++;
                }
            }
            mismatches += (term.length - i) + (w.length - j);
            if (mismatches <= 1) return true;
        }
    }
    return false;
};

// ─────────────────────────────────────────────────────────────
// PRE-INDEXED PRODUCT FIELDS (WeakMap cache per product object)
// Avoids re-normalizing text on every single keystroke
// ─────────────────────────────────────────────────────────────
interface NormalizedProduct {
    nombre: string;
    codigo: string;
    marca: string;
    categoria: string;
    descripcion: string;
    tagsTexto: string;
    textoGlobal: string;
    hasStock: boolean;
}

const normalizedCache = new WeakMap<any, NormalizedProduct>();

function getNormalized(producto: any): NormalizedProduct {
    const cached = normalizedCache.get(producto);
    if (cached) return cached;

    const nombre = limpiarTexto(producto.name || '');
    const codigo = limpiarTexto(producto.sku || '');
    const marca = limpiarTexto(producto.brands?.name || '');
    const categoria = limpiarTexto(producto.category || '');
    const descripcion = limpiarTexto(producto.description || '');

    let tagsTexto = '';
    if (Array.isArray(producto.product_tags)) {
        tagsTexto = producto.product_tags
            .map((pt: any) => limpiarTexto(pt?.tags?.name || ''))
            .join(' ');
    }

    const globalStock = producto.inventory_levels?.reduce((acc: number, level: any) => acc + (level.current_stock || 0), 0) || 0;

    const norm: NormalizedProduct = {
        nombre,
        codigo,
        marca,
        categoria,
        descripcion,
        tagsTexto,
        textoGlobal: `${nombre} ${codigo} ${marca} ${categoria} ${tagsTexto} ${descripcion}`,
        hasStock: globalStock > 0
    };

    normalizedCache.set(producto, norm);
    return norm;
}

// ─────────────────────────────────────────────────────────────
// 4. ALGORITMO DE CÁLCULO DE RELEVANCIA (OPTIMIZADO)
//    - No crea RegExp por cada expansión
//    - Usa campos pre-normalizados (WeakMap)
//    - Early exit para SKU exacto
// ─────────────────────────────────────────────────────────────
// Fast word-boundary match without creating a RegExp object
function isWordBoundaryMatch(text: string, word: string): boolean {
    let pos = 0;
    while (true) {
        const idx = text.indexOf(word, pos);
        if (idx === -1) return false;
        const before = idx === 0 || ' -_/'.includes(text[idx - 1]);
        const after = idx + word.length >= text.length || ' -_/'.includes(text[idx + word.length]);
        if (before && after) return true;
        pos = idx + 1;
    }
}

export const calcularRelevancia = (producto: any, terminos: string[]): number => {
    if (!terminos || terminos.length === 0) return 0;

    const norm = getNormalized(producto);
    const { nombre, codigo, marca, categoria, descripcion, tagsTexto } = norm;

    let puntuacion = 0;
    let terminosEncontrados = 0;

    // SKU exacto -> maxima prioridad (early exit)
    const queryCompleta = terminos.join(' ');
    if (codigo === queryCompleta) return 2000;
    if (codigo.startsWith(queryCompleta)) puntuacion += 500;
    else if (codigo.includes(queryCompleta)) puntuacion += 300;
    if (nombre.includes(queryCompleta)) puntuacion += 250;

    for (const term of terminos) {
        const termLower = term.toLowerCase();
        const expansions = expandirTerminos([termLower]);
        let maxTermScore = 0;
        let termFound = false;

        for (const exp of expansions) {
            const isOriginal = exp === termLower;
            let currentScore = 0;
            let matchedInExp = false;

            // SKU
            if (codigo === exp) { currentScore += 250; matchedInExp = true; }
            else if (codigo.includes(exp)) { currentScore += 120; matchedInExp = true; }
            else if (exp.length > 3 && isFuzzyMatch(codigo, exp)) { currentScore += 90; matchedInExp = true; }

            // Nombre (sin RegExp)
            if (!matchedInExp || currentScore < 180) {
                if (nombre === exp) { currentScore += 180; matchedInExp = true; }
                else if (isWordBoundaryMatch(nombre, exp)) {
                    currentScore += nombre.startsWith(exp) ? 120 : 90;
                    matchedInExp = true;
                }
                else if (nombre.startsWith(exp)) { currentScore += 70; matchedInExp = true; }
                else if (nombre.includes(exp)) { currentScore += 45; matchedInExp = true; }
                else if (exp.length > 3 && isFuzzyMatch(nombre, exp)) { currentScore += 30; matchedInExp = true; }
            }

            // Marca, categoría, tags, descripción
            if (marca.includes(exp)) { currentScore += 40; matchedInExp = true; }
            if (categoria.includes(exp)) { currentScore += 25; matchedInExp = true; }
            if (tagsTexto.includes(exp)) { currentScore += 35; matchedInExp = true; }
            if (descripcion.includes(exp)) { currentScore += 15; matchedInExp = true; }

            if (matchedInExp && isOriginal) currentScore += 60;

            if (matchedInExp) {
                termFound = true;
                if (currentScore > maxTermScore) maxTermScore = currentScore;
            }
        }

        if (termFound) {
            puntuacion += maxTermScore;
            terminosEncontrados++;
        }
    }

    // Doble filtro
    if (terminosEncontrados < terminos.length) {
        if (terminos.length >= 2) return 0;
        puntuacion = puntuacion / 10;
    }

    if (norm.hasStock) puntuacion += 10;

    return puntuacion;
};

// ─────────────────────────────────────────────────────────────
// 5. EJECUTAR BÚSQUEDA (OPTIMIZADA)
//    - Avoids spreading every product (major GC savings)
//    - Uses pre-normalized cache
// ─────────────────────────────────────────────────────────────
export const searchProducts = (products: any[], query: string, minScore = 5): any[] => {
    if (!query || !query.trim()) {
        return products;
    }

    const terminos = limpiarTexto(query)
        .split(' ')
        .map(t => t.trim())
        .filter(t => t.length > 0);

    if (terminos.length === 0) return products;

    const results: Array<[any, number]> = [];

    for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const score = calcularRelevancia(p, terminos);
        if (score >= minScore) {
            results.push([p, score]);
        }
    }

    // Sort by score descending
    results.sort((a, b) => b[1] - a[1]);

    // Attach score without spreading
    return results.map(([p, score]) => {
        p._relevancia = score;
        return p;
    });
};

// ─────────────────────────────────────────────────────────────
// 6. GENERAR SUGERENCIAS (OPTIMIZADO — early exit + scan cap)
// ─────────────────────────────────────────────────────────────
export const getSuggestions = (products: any[], query: string, limit = 6): string[] => {
    if (!query || !query.trim()) return [];
    
    const terminoClean = limpiarTexto(query);
    if (terminoClean.length < 1) return [];

    const esCorto = terminoClean.length < 3;
    const sugerenciasSet = new Set<string>();
    const maxScan = Math.min(products.length, 500); // Cap scan to keep it fast

    for (let i = 0; i < maxScan; i++) {
        if (sugerenciasSet.size >= limit) break; // EARLY EXIT

        const prod = products[i];

        // SKU match
        const sku = (prod.sku || '').toUpperCase();
        if (limpiarTexto(sku).includes(terminoClean)) {
            sugerenciasSet.add(`"${sku}"`);
            if (sugerenciasSet.size >= limit) break;
        }
        
        // Name words
        const nombre = (prod.name || '');
        const palabras = nombre.split(/[\s\-_/]+/).filter((p: string) => p.length > (esCorto ? 1 : 2));
        for (const pal of palabras) {
            if (limpiarTexto(pal).includes(terminoClean)) {
                const cap = pal.charAt(0).toUpperCase() + pal.slice(1).toLowerCase();
                sugerenciasSet.add(cap);
                if (sugerenciasSet.size >= limit) break;
            }
        }
        if (sugerenciasSet.size >= limit) break;
        
        // Brand
        if (prod.brands?.name && limpiarTexto(prod.brands.name).includes(terminoClean)) {
            sugerenciasSet.add(prod.brands.name);
            if (sugerenciasSet.size >= limit) break;
        }

        // Models/displacements
        const modelos = nombre.match(/\b[A-Z0-9]{2,}[\d-]+\b/gi);
        if (modelos) {
            for (const mod of modelos) {
                if (limpiarTexto(mod).includes(terminoClean)) {
                    sugerenciasSet.add(mod.toUpperCase());
                    if (sugerenciasSet.size >= limit) break;
                }
            }
        }
    }

    return Array.from(sugerenciasSet).slice(0, limit);
};

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
    local_stock, importer_stock, is_discontinued, discontinued_until,
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
