/**
 * Nucleo de busqueda del catalogo movil: algoritmo puro, sin React ni Supabase.
 *
 * Vive separado de `mobileSearchEngine.ts` por una razon concreta: este fichero
 * lo carga tambien un Web Worker (`mobileSearchWorker.ts`), y un worker que
 * importara el motor entero se traeria React y el cliente de Supabase con el,
 * que ahi dentro no sirven para nada y engordan el paquete.
 *
 * Aqui NO va nada que toque el DOM, la red ni el estado de React.
 * `mobileSearchEngine.ts` re-exporta todo lo de aqui, asi que quien ya
 * importaba de alli no tiene que cambiar nada.
 */
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
/** Parte un texto en palabras. Se usa UNA vez por producto, no por pulsacion. */
const partirPalabras = (text: string): string[] => text.split(/[\s\-_/]+/);

/**
 * Igual que `isFuzzyMatch`, pero recibe las palabras YA partidas.
 *
 * Partir el texto era el gasto mas caro de toda la busqueda: `text.split(regex)`
 * se ejecutaba una vez por producto Y por sinonimo, o sea ~50.000 veces por
 * pulsacion (5.900 repuestos x ~9 sinonimos por termino), cada una estrenando
 * un array que luego habia que recoger. Ahora las palabras se parten una sola
 * vez por producto y viven en la cache normalizada (ver `getNormalized`).
 */
export const fuzzyMatchWords = (words: string[], term: string): boolean => {
    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (Math.abs(w.length - term.length) > 1) continue;

        let mismatches = 0;
        let a = 0, b = 0;
        while (a < term.length && b < w.length) {
            if (term[a] !== w[b]) {
                mismatches++;
                if (mismatches > 1) break;
                if (term[a + 1] === w[b]) a++;
                else if (term[a] === w[b + 1]) b++;
                else { a++; b++; }
            } else {
                a++; b++;
            }
        }
        mismatches += (term.length - a) + (w.length - b);
        if (mismatches <= 1) return true;
    }
    return false;
};

export const isFuzzyMatch = (text: string, term: string): boolean => {
    if (!text || !term) return false;
    if (text.includes(term)) return true;
    if (term.length <= 3) return false;
    return fuzzyMatchWords(partirPalabras(text), term);
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
    /** `nombre` y `codigo` ya partidos en palabras, para el emparejado difuso. */
    nombrePalabras: string[];
    codigoPalabras: string[];
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
        nombrePalabras: partirPalabras(nombre),
        codigoPalabras: partirPalabras(codigo),
        hasStock: globalStock > 0
    };

    normalizedCache.set(producto, norm);
    return norm;
}

// ─────────────────────────────────────────────────────────────
// 4. ALGORITMO DE CALCULO DE RELEVANCIA (OPTIMIZADO)
//    - No crea RegExp por cada expansion
//    - Usa campos pre-normalizados (WeakMap)
//    - Early exit para SKU exacto
//    - Los sinonimos se expanden UNA vez por consulta, no por producto
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

/**
 * Consulta ya masticada: terminos, texto completo y sinonimos de cada termino.
 *
 * `expandirTerminos` se llamaba DENTRO del bucle de productos, asi que cada
 * pulsacion reconstruia el mismo Set de sinonimos 5.900 veces por termino. Se
 * calcula una sola vez aqui y se reparte a todos los productos.
 */
export interface QueryPlan {
    terminos: string[];
    queryCompleta: string;
    /** `expansiones[i]` son los sinonimos de `terminos[i]`. */
    expansiones: string[][];
}

export const planificarBusqueda = (query: string): QueryPlan | null => {
    const terminos = limpiarTexto(query)
        .split(' ')
        .map(t => t.trim())
        .filter(t => t.length > 0);

    if (terminos.length === 0) return null;

    return {
        terminos,
        queryCompleta: terminos.join(' '),
        expansiones: terminos.map(t => expandirTerminos([t])),
    };
};

export const calcularRelevancia = (producto: any, plan: QueryPlan): number => {
    const { terminos, queryCompleta, expansiones } = plan;
    if (terminos.length === 0) return 0;

    const norm = getNormalized(producto);
    const { nombre, codigo, marca, categoria, descripcion, tagsTexto, textoGlobal } = norm;

    let puntuacion = 0;
    let terminosEncontrados = 0;

    // SKU exacto -> maxima prioridad (early exit)
    if (codigo === queryCompleta) return 2000;
    if (codigo.startsWith(queryCompleta)) puntuacion += 500;
    else if (codigo.includes(queryCompleta)) puntuacion += 300;
    if (nombre.includes(queryCompleta)) puntuacion += 250;

    for (let t = 0; t < terminos.length; t++) {
        const termLower = terminos[t];
        const expansions = expansiones[t];
        let maxTermScore = 0;
        let termFound = false;

        for (let e = 0; e < expansions.length; e++) {
            const exp = expansions[e];
            const isOriginal = exp === termLower;
            let currentScore = 0;
            let matchedInExp = false;

            if (!textoGlobal.includes(exp)) {
                /*
                    `textoGlobal` es la concatenacion de todos los campos, asi
                    que si el no contiene `exp`, ninguno de ellos puede
                    contenerlo: todas las comparaciones por subcadena darian
                    false. Lo unico que queda es el emparejado difuso, que exige
                    mas de 3 letras. Saltarse el resto ahorra ~10 barridos de
                    texto por producto y por sinonimo, que es ademas el caso
                    comun: la mayor parte del catalogo no tiene nada que ver con
                    lo que se esta buscando.
                */
                if (exp.length > 3) {
                    if (fuzzyMatchWords(norm.codigoPalabras, exp)) { currentScore += 90; matchedInExp = true; }
                    if (fuzzyMatchWords(norm.nombrePalabras, exp)) { currentScore += 30; matchedInExp = true; }
                }
            } else {
                // SKU
                if (codigo === exp) { currentScore += 250; matchedInExp = true; }
                else if (codigo.includes(exp)) { currentScore += 120; matchedInExp = true; }
                else if (exp.length > 3 && fuzzyMatchWords(norm.codigoPalabras, exp)) { currentScore += 90; matchedInExp = true; }

                // Nombre (sin RegExp)
                if (!matchedInExp || currentScore < 180) {
                    if (nombre === exp) { currentScore += 180; matchedInExp = true; }
                    else if (isWordBoundaryMatch(nombre, exp)) {
                        currentScore += nombre.startsWith(exp) ? 120 : 90;
                        matchedInExp = true;
                    }
                    else if (nombre.startsWith(exp)) { currentScore += 70; matchedInExp = true; }
                    else if (nombre.includes(exp)) { currentScore += 45; matchedInExp = true; }
                    else if (exp.length > 3 && fuzzyMatchWords(norm.nombrePalabras, exp)) { currentScore += 30; matchedInExp = true; }
                }

                // Marca, categoria, tags, descripcion
                if (marca.includes(exp)) { currentScore += 40; matchedInExp = true; }
                if (categoria.includes(exp)) { currentScore += 25; matchedInExp = true; }
                if (tagsTexto.includes(exp)) { currentScore += 35; matchedInExp = true; }
                if (descripcion.includes(exp)) { currentScore += 15; matchedInExp = true; }
            }

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
// 5. EJECUTAR BUSQUEDA (OPTIMIZADA)
//    - Avoids spreading every product (major GC savings)
//    - Uses pre-normalized cache
//    - Un solo plan de consulta para todo el catalogo
// ─────────────────────────────────────────────────────────────
export const searchProducts = (products: any[], query: string, minScore = 5): any[] => {
    if (!query || !query.trim()) {
        return products;
    }

    const plan = planificarBusqueda(query);
    if (!plan) return products;

    const results: Array<[any, number]> = [];

    for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const score = calcularRelevancia(p, plan);
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
