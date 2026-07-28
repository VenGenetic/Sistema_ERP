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
// 7. HOOK RÁPIDO: useMobileProducts (Con Caché Stale-While-Revalidate)
// ─────────────────────────────────────────────────────────────
const CACHE_KEY = 'erp_mobile_products_cache';
const CACHE_TIME_KEY = 'erp_mobile_products_cache_time';
const FRESH_DURATION = 1000 * 60 * 10; // 10 minutos de frescura en memoria/local

// Caché en memoria global para cambio instantáneo entre pestañas
let globalInMemoryProducts: any[] | null = null;
let isFetchingGlobal = false;

export const useMobileProducts = () => {
    const [products, setProducts] = useState<any[]>(() => {
        if (globalInMemoryProducts && globalInMemoryProducts.length > 0) {
            return globalInMemoryProducts;
        }
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    globalInMemoryProducts = parsed;
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('Error leyendo caché inicial móvil', e);
        }
        return [];
    });

    const [loading, setLoading] = useState<boolean>(() => products.length === 0);
    const [error, setError] = useState<string | null>(null);

    const fetchAllProducts = useCallback(async (force = false) => {
        if (!force && globalInMemoryProducts && globalInMemoryProducts.length > 0) {
            try {
                const timeStr = localStorage.getItem(CACHE_TIME_KEY);
                if (timeStr) {
                    const age = Date.now() - parseInt(timeStr, 10);
                    if (age < FRESH_DURATION) {
                        setLoading(false);
                        return;
                    }
                }
            } catch (e) {}
        }

        if (isFetchingGlobal && !force) {
            return;
        }

        isFetchingGlobal = true;
        if (products.length === 0) {
            setLoading(true);
        }

        try {
            let allData: any[] = [];
            let pageNum = 0;
            const pageSize = 1000;

            while (true) {
                const { data, error: err } = await supabase
                    .from('products')
                    .select(`
                        *,
                        brands (name),
                        inventory_levels (*),
                        product_tags ( tags (*) )
                    `)
                    .eq('is_active', true)
                    .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1)
                    .order('name', { ascending: true });

                if (err) throw err;
                if (!data || data.length === 0) break;

                allData = allData.concat(data);
                if (data.length < pageSize) break;
                pageNum++;
            }

            globalInMemoryProducts = allData;
            setProducts(allData);

            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify(allData));
                localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
            } catch (storageErr) {
                console.warn('No se pudo guardar en localStorage (¿cuota llena?)', storageErr);
            }
        } catch (err: any) {
            console.error('Error al cargar catálogo móvil:', err);
            setError(err?.message || 'Error de conexión con Supabase');
        } finally {
            setLoading(false);
            isFetchingGlobal = false;
        }
    }, [products.length]);

    useEffect(() => {
        fetchAllProducts(false);
    }, [fetchAllProducts]);

    const refresh = useCallback(async () => {
        setLoading(true);
        await fetchAllProducts(true);
    }, [fetchAllProducts]);

    return {
        products,
        loading,
        error,
        refresh
    };
};
