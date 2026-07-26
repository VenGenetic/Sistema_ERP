import { useState, useEffect, useCallback, useMemo } from 'react';
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
// ─────────────────────────────────────────────────────────────
export const expandirTerminos = (terminos: string[]): string[] => {
    const sinonimos: Record<string, string[]> = {
        'freno': ['frenos', 'frenado', 'pastilla', 'pastillas', 'disco', 'tambor', 'caliper', 'mordaza'],
        'pastilla': ['pastillas', 'freno', 'frenos', 'block', 'balata', 'balatas'],
        'balata': ['balatas', 'pastilla', 'pastillas', 'freno'],
        'filtro': ['filtros', 'filtrante'],
        'aceite': ['aceites', 'lubricante', 'lubricantes', '2t', '4t'],
        'cadena': ['cadenas', 'transmisión', 'transmision', 'piñón', 'piñon', 'corona', 'arrastre', 'kit arrastre'],
        'arrastre': ['tracción', 'traccion', 'cadena', 'piñon', 'corona', 'kit'],
        'amortiguador': ['amortiguadores', 'suspensión', 'suspension', 'monoshock', 'shock'],
        'llanta': ['llantas', 'neumático', 'neumaticos', 'rueda', 'ruedas', 'caucho', 'cauchos', 'cubierta'],
        'faro': ['faros', 'luz', 'luces', 'farolo', 'faroloa', 'optica', 'óptica', 'foco', 'focos', 'bombillo', 'led'],
        'escape': ['escapes', 'silenciador', 'tubo', 'caño', 'exhosto', 'muffler'],
        'motor': ['motores', 'cilindro', 'cilindros', 'piston', 'pistones', 'cabezal'],
        'velocimento': ['velocímetro', 'velocímetros', 'velocimetro', 'velocimetros', 'instrumentos', 'panel', 'tablero', 'tacometro', 'tacómetro', 'reloj'],
        'carburador': ['carburadores', 'inyección', 'inyector', 'admision'],
        'arranque': ['starter', 'partida', 'marcha', 'bendix'],
        'electrico': ['eléctrico', 'eléctrica', 'eléctricos', 'eléctricas', 'electricidad', 'ramal'],
        'telescopica': ['telescopicas', 'telescópica', 'telescópicas', 'barra', 'barras', 'suspensión delantera', 'telescopio', 'amortiguador delantero', 'amortiguadores delanteros'],
        'monoshock': ['monoshocks', 'amortiguador trasero', 'suspensión trasera', 'shock'],
        'ramal': ['arnés', 'arnes', 'cableado', 'instalación eléctrica', 'instalacion electrica', 'cable'],
        'mesa': ['mesas', 'araña', 'arañas', 'castillo', 'tija', 'yugo'],
        'bujia': ['bujia', 'bujias', 'bujías', 'bujía', 'spark'],
        'placa': ['placa', 'placas', 'plastico', 'plasticos', 'plástico', 'carenado', 'pasta', 'pastas', 'tapa', 'tapas', 'cubierta'],
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
        'manubrio': ['manubrio', 'timón', 'timon', 'manillar', 'handlebar'],
        'comando': ['comandos', 'switch', 'switche', 'botonera', 'interruptor', 'piña'],
        'manzana': ['manzana', 'manzanas', 'carrete', 'buje', 'hub'],
        'disco': ['discos', 'rotor', 'discodel', 'freno disco', 'rotores'],
        'kit': ['juego', 'set', 'combo', 'pack']
    };

    const expandidos = new Set<string>();

    terminos.forEach(termino => {
        const tLower = termino.toLowerCase();
        expandidos.add(tLower);
        Object.entries(sinonimos).forEach(([clave, valores]) => {
            if (clave === tLower || clave.includes(tLower) || valores.some(v => v.includes(tLower))) {
                expandidos.add(clave);
                valores.forEach(s => expandidos.add(s));
            }
        });
    });

    return Array.from(expandidos);
};

// ─────────────────────────────────────────────────────────────
// 3. HELPER: FUZZY MATCHING RÁPIDO (Tolerancia a "dedos gordos")
// ─────────────────────────────────────────────────────────────
export const isFuzzyMatch = (text: string, term: string): boolean => {
    if (!text || !term) return false;
    if (text.includes(term)) return true;
    if (term.length <= 3) return false;

    const words = text.split(/[\s-_/]+/);
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
// 4. ALGORITMO DE CÁLCULO DE RELEVANCIA ("DOBLE FILTRO")
// ─────────────────────────────────────────────────────────────
export const calcularRelevancia = (producto: any, terminos: string[]): number => {
    if (!terminos || terminos.length === 0) return 0;

    const nombre = limpiarTexto(producto.name || '');
    const codigo = limpiarTexto(producto.sku || '');
    const marca = limpiarTexto(producto.brands?.name || '');
    const categoria = limpiarTexto(producto.category || '');
    const descripcion = limpiarTexto(producto.description || '');
    
    // Extraer etiquetas si existen
    let tagsTexto = '';
    if (Array.isArray(producto.product_tags)) {
        tagsTexto = producto.product_tags
            .map((pt: any) => limpiarTexto(pt?.tags?.name || ''))
            .join(' ');
    }
    const textoGlobal = `${nombre} ${codigo} ${marca} ${categoria} ${tagsTexto} ${descripcion}`;

    let puntuacion = 0;
    let terminosEncontrados = 0;

    // Coincidencia exacta de SKU al inicio o completa (Para escaneo QR o tipeo exacto)
    const queryCompleta = terminos.join(' ');
    if (codigo === queryCompleta) {
        return 2000; // Máxima prioridad posible (código exacto)
    }
    if (codigo.startsWith(queryCompleta)) {
        puntuacion += 500;
    } else if (codigo.includes(queryCompleta)) {
        puntuacion += 300;
    }
    if (nombre.includes(queryCompleta)) {
        puntuacion += 250;
    }

    // Análisis término por término (Doble Filtro)
    for (const term of terminos) {
        const termLower = term.toLowerCase();
        const expansions = expandirTerminos([termLower]);
        let maxTermScore = 0;
        let termFound = false;

        for (const exp of expansions) {
            const isOriginal = exp === termLower;
            let currentScore = 0;
            let matchedInExp = false;

            // Coincidencia en SKU / Código
            if (codigo === exp) { currentScore += 250; matchedInExp = true; }
            else if (codigo.includes(exp)) { currentScore += 120; matchedInExp = true; }
            else if (isFuzzyMatch(codigo, exp)) { currentScore += 90; matchedInExp = true; }

            // Coincidencia en Nombre del producto
            const wordRegex = new RegExp(`\\b${exp}\\b`, 'i');
            if (nombre === exp) { currentScore += 180; matchedInExp = true; }
            else if (wordRegex.test(nombre)) {
                if (nombre.startsWith(exp)) { currentScore += 120; matchedInExp = true; }
                else { currentScore += 90; matchedInExp = true; }
            }
            else if (nombre.startsWith(exp)) { currentScore += 70; matchedInExp = true; }
            else if (nombre.includes(exp)) { currentScore += 45; matchedInExp = true; }
            else if (isFuzzyMatch(nombre, exp)) { currentScore += 30; matchedInExp = true; }

            // Coincidencia en Marca, Categoría o Tags
            if (marca.includes(exp) || wordRegex.test(marca)) { currentScore += 40; matchedInExp = true; }
            if (categoria.includes(exp)) { currentScore += 25; matchedInExp = true; }
            if (tagsTexto.includes(exp)) { currentScore += 35; matchedInExp = true; }
            if (descripcion.includes(exp)) { currentScore += 15; matchedInExp = true; }

            // Si es la palabra original exacta que escribió el usuario, tiene bonus sobre sinónimos
            if (matchedInExp && isOriginal) {
                currentScore += 60;
            }

            if (matchedInExp) {
                termFound = true;
                if (currentScore > maxTermScore) {
                    maxTermScore = currentScore;
                }
            }
        }

        if (termFound) {
            puntuacion += maxTermScore;
            terminosEncontrados++;
        }
    }

    // ⚡ REQUISITO DE DOBLE FILTRO:
    // Si el usuario busca múltiples palabras (ej: "pastilla freno del"), 
    // todas las palabras originales (o sus sinónimos) DEBEN encontrarse.
    // Si faltan palabras, castigamos severamente la puntuación para eliminar falsos positivos.
    if (terminosEncontrados < terminos.length) {
        if (terminos.length >= 2) {
            return 0; // Excluir si tiene 2 o más palabras y no coincidieron todas
        }
        puntuacion = puntuacion / 10;
    }

    // Pequeño bono si tiene stock en cualquier almacén
    const globalStock = producto.inventory_levels?.reduce((acc: number, level: any) => acc + (level.current_stock || 0), 0) || 0;
    if (globalStock > 0) {
        puntuacion += 10;
    }

    return puntuacion;
};

// ─────────────────────────────────────────────────────────────
// 5. EJECUTAR BÚSQUEDA Y ORDENAMIENTO EN LA LISTA DE PRODUCTOS
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

    return products
        .map(p => ({
            ...p,
            _relevancia: calcularRelevancia(p, terminos)
        }))
        .filter(p => p._relevancia >= minScore)
        .sort((a, b) => b._relevancia - a._relevancia);
};

// ─────────────────────────────────────────────────────────────
// 6. GENERAR SUGERENCIAS AUTORECOMPLETADO PARA EL SEARCH BAR
// ─────────────────────────────────────────────────────────────
export const getSuggestions = (products: any[], query: string, limit = 6): string[] => {
    if (!query || !query.trim()) return [];
    
    const terminoClean = limpiarTexto(query);
    const esCorto = terminoClean.length < 3;
    const sugerenciasSet = new Set<string>();

    // Si coincide con SKU
    for (const prod of products) {
        if (sugerenciasSet.size >= limit * 2) break;
        const sku = (prod.sku || '').toUpperCase();
        if (limpiarTexto(sku).includes(terminoClean)) {
            sugerenciasSet.add(`"${sku}"`);
        }
        
        // Palabras del nombre
        const nombre = (prod.name || '');
        const palabras = nombre.split(/[\s-_/]+/).filter((p: string) => p.length > (esCorto ? 1 : 2));
        for (const pal of palabras) {
            if (limpiarTexto(pal).includes(terminoClean)) {
                // Capitalizar primera letra para presentación limpia
                const cap = pal.charAt(0).toUpperCase() + pal.slice(1).toLowerCase();
                sugerenciasSet.add(cap);
            }
        }
        
        // Marca
        if (prod.brands?.name && limpiarTexto(prod.brands.name).includes(terminoClean)) {
            sugerenciasSet.add(prod.brands.name);
        }

        // Modelos o cilindradas extraídos por Regex (ej: 150cc, 250, RX150)
        const modelos = nombre.match(/\b[A-Z0-9]{2,}[\d-]+\b/gi) || [];
        for (const mod of modelos) {
            if (limpiarTexto(mod).includes(terminoClean)) {
                sugerenciasSet.add(mod.toUpperCase());
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
