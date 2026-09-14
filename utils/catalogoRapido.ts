/**
 * Búsqueda de repuestos del chat, instantánea y barata.
 *
 * EL PROBLEMA
 * -----------
 * Buscar un repuesto para mandárselo al cliente costaba, medido contra la
 * base real: 300 ms de espera a que la persona deje de teclear + 460-700 ms
 * del RPC `agent_search_products` (pg_trgm sobre 5.902 filas) + una segunda
 * consulta para traer las galerías. Casi un segundo con la lista en blanco,
 * por cada búsqueda, y otra vez entera si se borraba una letra. Quien
 * atiende busca decenas de veces por conversación.
 *
 * Y cada una de esas búsquedas es cómputo facturado en Supabase: la
 * similitud difusa es de lo más caro que se le puede pedir.
 *
 * CÓMO SE ARREGLA
 * ---------------
 * El catálogo entero, recortado a lo que la búsqueda de verdad lee, son
 * 2 MB. Eso cabe en el navegador. Se baja UNA vez por sesión con un
 * `select` indexado normal (barato), se guarda en IndexedDB para la
 * siguiente carga, y se busca en local con el mismo motor del catálogo
 * móvil, dentro de un Web Worker: ~5 ms, sin red y sin cómputo en Supabase.
 *
 * El RPC no desaparece -- sigue siendo la autoridad, porque sabe alias
 * aprendidos que el índice local no tiene ("pera" para tal pieza). Lo que
 * cambia es cuándo se le pregunta: sólo si lo local no encontró nada
 * convincente. Ver `RPC_INNECESARIO_DESDE`.
 *
 * Resultado: la lista aparece mientras se escribe, y a Supabase se le
 * pide MENOS que antes, no más.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { isProductDiscontinued } from './discontinuedHelper';
import { calcularRelevancia, planificarBusqueda } from './mobileSearchCore';
import { catalogoMovilEnMemoria } from './mobileSearchEngine';
import { useBusquedaProductos } from './useBusquedaProductos';
import { buscarEnCatalogo, type ProductoCatalogo } from './whatsappOutbox';

/* -------------------------------------------------------------------------- */
/*  EL ÍNDICE LOCAL                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Sólo lo que lee el algoritmo (`getNormalized` en mobileSearchCore) más lo
 * que pinta la tarjeta del resultado.
 *
 * Sin joins a propósito: `brands`, `product_tags` e `inventory_levels` son
 * tres consultas anidadas que multiplican por cuatro el coste del `select` y
 * aportan poco -- acá se busca por nombre y por código, que es lo que
 * teclea quien atiende. `gallery` tampoco está: son fotos extra que sólo
 * hacen falta cuando el repuesto YA se eligió, y se piden entonces
 * (`traerGalerias`), no para pintar la grilla.
 */
const CAMPOS_INDICE =
    'id, sku, name, category, price, image_url, local_stock, importer_stock, ' +
    'importer_unavailable_override, is_discontinued, discontinued_until';

/** Fila del índice, tal como vive en memoria y en IndexedDB. */
export interface FilaIndice {
    id: number;
    sku: string;
    name: string;
    category: string | null;
    price: number | null;
    image_url: string | null;
    local_stock: number | null;
    importer_stock: number | null;
    importer_unavailable_override: boolean | null;
    is_discontinued?: boolean | null;
    discontinued_until?: string | null;
}

/** Cuánto vale el índice guardado antes de volver a bajarlo. */
const FRESCURA_MS = 1000 * 60 * 15;
const TAMANO_PAGINA = 1000;

/*
    Se reaprovecha la base de IndexedDB del catálogo móvil con OTRA clave
    dentro del mismo almacén. Crear una base propia obligaría a subir la
    versión del esquema, y una subida de versión bloquea a las pestañas que
    ya tienen la base abierta -- justo el modo en que se usa esto, con el
    ERP abierto en dos pestañas.
*/
const DB_NOMBRE = 'erp_mobile_cache';
const DB_VERSION = 1;
const ALMACEN = 'catalog';
const CLAVE = 'wa_indice_v1';

interface EntradaCache {
    data: FilaIndice[];
    time: number;
}

function abrirDb(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
        if (typeof indexedDB === 'undefined') { resolve(null); return; }
        try {
            const req = indexedDB.open(DB_NOMBRE, DB_VERSION);
            req.onupgradeneeded = () => {
                if (!req.result.objectStoreNames.contains(ALMACEN)) {
                    req.result.createObjectStore(ALMACEN);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
            req.onblocked = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
}

async function leerCache(): Promise<EntradaCache | null> {
    const db = await abrirDb();
    if (!db) return null;
    return new Promise((resolve) => {
        try {
            const req = db.transaction(ALMACEN, 'readonly').objectStore(ALMACEN).get(CLAVE);
            req.onsuccess = () => resolve((req.result as EntradaCache) ?? null);
            req.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
}

async function escribirCache(data: FilaIndice[]): Promise<void> {
    const db = await abrirDb();
    if (!db) return;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(ALMACEN, 'readwrite');
            tx.objectStore(ALMACEN).put({ data, time: Date.now() } as EntradaCache, CLAVE);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        } catch {
            resolve();
        }
    });
}

/**
 * Baja el índice en páginas pedidas TODAS a la vez.
 *
 * En serie, seis tandas de 1.000 filas son seis idas y vueltas encadenadas
 * (~3,5 s medidos). En paralelo es una sola espera. Es el mismo patrón que
 * `fetchProductsFromServer` del catálogo móvil.
 */
async function bajarIndice(): Promise<FilaIndice[]> {
    const { count, error: errorCuenta } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);
    if (errorCuenta) throw errorCuenta;

    const paginas = Math.max(1, Math.ceil((count || 0) / TAMANO_PAGINA));
    const respuestas = await Promise.all(
        Array.from({ length: paginas }, (_, i) =>
            supabase
                .from('products')
                .select(CAMPOS_INDICE)
                .eq('is_active', true)
                .order('id', { ascending: true })
                .range(i * TAMANO_PAGINA, (i + 1) * TAMANO_PAGINA - 1),
        ),
    );

    const filas: FilaIndice[] = [];
    for (const { data, error } of respuestas) {
        if (error) throw error;
        if (data) filas.push(...(data as unknown as FilaIndice[]));
    }

    /*
        El RPC excluye los descontinuados, así que el índice también: si no,
        lo local ofrecería piezas que el bot nunca cotiza y quien atiende
        terminaría prometiendo algo que no se vende. La regla de la
        descontinuación temporal vencida es la misma del ERP
        (`isProductDiscontinued`), que es la que copia el RPC.
    */
    return filas.filter((f) => !isProductDiscontinued(f));
}

/* Caché de módulo: viva mientras viva la pestaña, compartida por el catálogo,
   la proforma y el pedido -- los tres buscan lo mismo. */
let indiceEnMemoria: FilaIndice[] | null = null;
let indiceTiempo = 0;
let indiceEnVuelo: Promise<void> | null = null;

/**
 * Si el catálogo móvil ya está cargado en esta pestaña, sirve de índice: es
 * un superconjunto (trae además marcas, etiquetas y bodegas). Bajarlo otra
 * vez sería pedirle a Supabase 2 MB que ya están en memoria.
 *
 * El resultado se memoriza contra el array de origen. Filtrar en cada
 * llamada devolvería un array nuevo cada vez, y `useBusquedaProductos`
 * reenvía el catálogo entero al Web Worker cuando cambia la identidad del
 * array: sería copiar 2 MB entre hilos en cada render.
 */
let prestado: { origen: any[]; filtrado: FilaIndice[] } | null = null;

function indiceDelCatalogoMovil(): FilaIndice[] | null {
    const movil = catalogoMovilEnMemoria();
    if (!movil || movil.length === 0) return null;
    if (prestado?.origen !== movil) {
        prestado = { origen: movil, filtrado: movil.filter((p: any) => !isProductDiscontinued(p)) as FilaIndice[] };
    }
    return prestado.filtrado;
}

async function asegurarIndice(forzar = false): Promise<FilaIndice[]> {
    if (!forzar) {
        const prestado = indiceDelCatalogoMovil();
        if (prestado) return prestado;
        if (indiceEnMemoria && Date.now() - indiceTiempo < FRESCURA_MS) return indiceEnMemoria;
    }

    if (!indiceEnVuelo) {
        indiceEnVuelo = (async () => {
            try {
                const filas = await bajarIndice();
                indiceEnMemoria = filas;
                indiceTiempo = Date.now();
                escribirCache(filas).catch(() => { /* la caché es un lujo, no un requisito */ });
            } finally {
                indiceEnVuelo = null;
            }
        })();
    }
    await indiceEnVuelo;
    return indiceEnMemoria ?? [];
}

/* -------------------------------------------------------------------------- */
/*  EL RPC, CACHEADO                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Lo que devolvió el RPC para cada consulta ya preguntada.
 *
 * Borrar una letra y volver a escribirla era, hasta ahora, otra consulta
 * completa. Con esto es gratis. Se limita el tamaño porque una sesión larga
 * acumula cientos de consultas y cada una son hasta 24 filas.
 */
const CACHE_RPC_MAX = 120;
const cacheRpc = new Map<string, ProductoCatalogo[]>();
const rpcEnVuelo = new Map<string, Promise<ProductoCatalogo[]>>();

function recordar(clave: string, filas: ProductoCatalogo[]): void {
    if (cacheRpc.size >= CACHE_RPC_MAX) {
        const primera = cacheRpc.keys().next().value;
        if (primera !== undefined) cacheRpc.delete(primera);
    }
    cacheRpc.set(clave, filas);
}

/**
 * El RPC de siempre, pero sin preguntar dos veces lo mismo.
 *
 * Tres pantallas distintas (catálogo, proforma, pedido) buscan los mismos
 * términos a lo largo del día; además, dos de ellas pueden estar montadas a
 * la vez. `rpcEnVuelo` hace que dos peticiones simultáneas de la misma
 * consulta compartan una sola llamada.
 */
export async function buscarConRpcCacheado(termino: string, limite: number): Promise<ProductoCatalogo[]> {
    const clave = `${termino.trim().toLowerCase()}|${limite}`;
    const guardado = cacheRpc.get(clave);
    if (guardado) return guardado;

    const enVuelo = rpcEnVuelo.get(clave);
    if (enVuelo) return enVuelo;

    const promesa = buscarEnCatalogo(termino, limite)
        .then((filas) => {
            recordar(clave, filas);
            return filas;
        })
        .finally(() => {
            rpcEnVuelo.delete(clave);
        });

    rpcEnVuelo.set(clave, promesa);
    return promesa;
}

/* -------------------------------------------------------------------------- */
/*  GALERÍAS BAJO DEMANDA                                                      */
/* -------------------------------------------------------------------------- */

const cacheGalerias = new Map<number, ProductoCatalogo['gallery']>();

/**
 * Fotos extra de unos pocos repuestos: los que la persona ya eligió.
 *
 * Antes venían con CADA búsqueda -- una consulta a `products` por las 24
 * filas del resultado, se usaran o no. Se usan sólo cuando alguien elige
 * un repuesto para mandarle varios ángulos, que es una de cada diez veces.
 */
export async function traerGalerias(ids: number[]): Promise<Map<number, ProductoCatalogo['gallery']>> {
    const faltan = ids.filter((id) => !cacheGalerias.has(id));
    if (faltan.length > 0) {
        const { data, error } = await supabase.from('products').select('id, gallery').in('id', faltan);
        /*
            Si la consulta falló no se cachea NADA. El `data` vacío de un
            error es indistinguible del de un repuesto sin fotos, y darlo por
            bueno dejaba a esa pieza sin galería para el resto de la sesión
            por un corte de red de un segundo: el cliente recibía una foto en
            vez de tres, y reintentar no servía.
        */
        if (error) return new Map(ids.map((id) => [id, cacheGalerias.get(id) ?? []]));

        // Con la consulta OK sí se cachea todo lo pedido, incluso lo que no
        // trajo nada: un repuesto sin galería no se vuelve a consultar.
        faltan.forEach((id) => cacheGalerias.set(id, []));
        (data ?? []).forEach((g: any) => {
            cacheGalerias.set(g.id, Array.isArray(g.gallery) ? g.gallery : []);
        });
    }
    const salida = new Map<number, ProductoCatalogo['gallery']>();
    ids.forEach((id) => salida.set(id, cacheGalerias.get(id) ?? []));
    return salida;
}

/* -------------------------------------------------------------------------- */
/*  BÚSQUEDA COMBINADA                                                         */
/* -------------------------------------------------------------------------- */

/** Fila del índice -> lo que esperan las pantallas del chat. */
export function aProductoCatalogo(f: FilaIndice | any): ProductoCatalogo {
    return {
        product_id: f.id,
        name: f.name,
        sku: f.sku,
        price: f.price ?? null,
        image_url: f.image_url ?? null,
        local_stock: f.local_stock ?? null,
        importer_stock: f.importer_stock ?? null,
        importer_unavailable_override: f.importer_unavailable_override ?? null,
        // `match_confidence` se deja fuera a propósito: es la confianza del
        // RPC, en su escala, y el puntaje local está en otra (hasta 2.000).
        // Meter uno donde se espera el otro es pedir que alguien los compare.
        gallery: cacheGalerias.get(f.id) ?? null,
    };
}

/**
 * A partir de qué puntaje local se da por buena la búsqueda y NO se molesta
 * al RPC.
 *
 * La escala la fija `calcularRelevancia`: un SKU exacto son 2.000 puntos; un
 * nombre que contiene la frase entera, 250; cada palabra que calza sobre el
 * límite de palabra, ~150. O sea que 300 significa "el nombre contiene lo
 * que escribió, o dos palabras calzan limpio" -- eso ya es un acierto, y
 * preguntarle al RPC sólo devolvería los mismos repuestos en otro orden.
 *
 * Por debajo de eso lo local está adivinando, y ahí es donde el RPC gana:
 * sabe alias que el cliente usa y el catálogo no escribe. Se le pregunta.
 */
const RPC_INNECESARIO_DESDE = 300;
/**
 * Y con menos de esto en pantalla, aunque puntúen alto, se pregunta igual:
 * dos resultados sueltos suelen ser un calce parcial, y ahí el RPC completa.
 */
const RPC_INNECESARIO_CON = 3;
/**
 * Puntaje que se basta solo, haya un resultado o cien.
 *
 * Existe por un caso que el umbral de arriba trataba al revés: pegar un SKU
 * completo puntúa 2.000 y devuelve UN resultado -- el correcto, el único
 * posible -- y la regla de "al menos tres" mandaba igual una consulta al
 * RPC. Era el caso más seguro de todos y el que más se consultaba.
 *
 * 700 deja dentro el SKU exacto (2.000), el SKU por prefijo (500 + término)
 * y el nombre que contiene la frase entera con dos palabras que calzan
 * limpio -- comprobado contra el catálogo real.
 */
const CERTEZA_SUFICIENTE = 700;

export interface BusquedaCatalogo {
    resultados: ProductoCatalogo[];
    /**
     * Ya hay una respuesta para el término que se está mirando.
     *
     * Sirve para una sola cosa, y hace falta: decidir si mostrar "ningún
     * repuesto coincide". `resultados.length === 0 && !buscando` no alcanza,
     * porque las dos búsquedas arrancan DENTRO de efectos -- en el render
     * inmediatamente posterior a teclear la segunda letra todavía no hay
     * resultados y `buscando` sigue en false, así que el cartel de "no hay
     * nada" alcanzaba a pintarse antes de que la búsqueda empezara.
     */
    respondido: boolean;
    /** Hay algo en vuelo. Sirve para atenuar, no para tapar: ya hay resultados. */
    buscando: boolean;
    error: string | null;
    /** El índice local todavía se está bajando (primera vez en la sesión). */
    preparando: boolean;
}

/**
 * Lo que usan el catálogo, la proforma y el pedido.
 *
 * Devuelve resultados locales en cuanto se teclea y, si hacen falta, añade
 * al final los que sólo el RPC sabe encontrar. Nunca deja la lista en
 * blanco mientras piensa.
 */
export function useBusquedaCatalogo(
    termino: string,
    opciones: { activo: boolean; limite?: number },
): BusquedaCatalogo {
    const { activo, limite = 24 } = opciones;

    const [indice, setIndice] = useState<FilaIndice[]>(() => indiceEnMemoria ?? []);
    const [preparando, setPreparando] = useState(false);
    const [extras, setExtras] = useState<ProductoCatalogo[]>([]);
    const [consultandoRpc, setConsultandoRpc] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /* ── El índice: se pide la primera vez que se abre un buscador ── */
    useEffect(() => {
        if (!activo) return;
        let cancelado = false;

        (async () => {
            const prestado = indiceDelCatalogoMovil();
            if (prestado) { setIndice(prestado); return; }

            if (!indiceEnMemoria) {
                // Lo guardado pinta de inmediato; la versión fresca llega por
                // detrás. Quien abre el catálogo busca YA, no cuando termine
                // la descarga.
                const guardado = await leerCache();
                if (cancelado) return;
                if (guardado && guardado.data.length > 0) {
                    indiceEnMemoria = guardado.data;
                    indiceTiempo = guardado.time;
                    setIndice(guardado.data);
                } else {
                    setPreparando(true);
                }
            }

            try {
                const filas = await asegurarIndice();
                if (!cancelado) setIndice(filas);
            } catch (err: any) {
                // Sin índice local no se rompe nada: abajo se cae al RPC, que
                // es exactamente como funcionaba antes de todo esto.
                if (!cancelado) console.warn('No se pudo preparar el índice del catálogo:', err?.message ?? err);
            } finally {
                if (!cancelado) setPreparando(false);
            }
        })();

        return () => { cancelado = true; };
    }, [activo]);

    /* ── Editar un repuesto rehace la lista ── */
    useEffect(() => {
        if (!activo) return;
        const avisar = () => setIndice(indiceActual());
        oyentes.add(avisar);
        return () => { oyentes.delete(avisar); };
    }, [activo]);

    /* ── Lo local: instantáneo, en el worker ── */
    const consulta = activo ? termino.trim() : '';
    const { resultados: localesCrudos, buscando: buscandoLocal } = useBusquedaProductos(
        indice as any[],
        consulta.length >= 2 ? consulta : '',
        // El mínimo del catálogo móvil (5) descarta calces por una sola
        // palabra floja, que acá sí valen: mejor mostrarlos abajo y que la
        // persona decida, que decirle "ningún repuesto coincide".
        2,
    );

    const locales = useMemo<ProductoCatalogo[]>(() => {
        if (!localesCrudos) return [];
        return localesCrudos.slice(0, limite).map(aProductoCatalogo);
    }, [localesCrudos, limite]);

    /*
        El puntaje del mejor resultado, recalculado acá.

        No se puede leer `_relevancia` del objeto: cuando la búsqueda corre en
        el Web Worker, el puntaje se queda en el otro hilo (el worker devuelve
        sólo ids, ver mobileSearchWorker). Volver a puntuar UN producto con el
        plan ya masticado son microsegundos, y así el umbral significa lo
        mismo con worker y sin él -- si no, con worker el RPC se dispararía
        siempre y no se ahorraría nada.
    */
    const mejorPuntaje = useMemo(() => {
        const primero = localesCrudos?.[0];
        if (!primero || consulta.length < 2) return 0;
        /*
            Se recalcula SIEMPRE, sin mirar `_relevancia`.

            Esa propiedad la escribe `searchProducts` encima del objeto del
            producto, que es compartido, y nunca se borra. O sea que es el
            puntaje de la ÚLTIMA búsqueda que pasó por el hilo principal --
            no el de ésta. El camino del worker nunca la escribe (devuelve
            sólo ids), así que leerla daba el número de otra consulta y el
            umbral decidía con él: llamaba al RPC sin motivo, o peor, se lo
            ahorraba cuando lo local no había encontrado nada bueno.

            Puntuar un solo producto con el plan ya masticado son
            microsegundos; leer un dato equivocado sale más caro.
        */
        const plan = planificarBusqueda(consulta);
        return plan ? calcularRelevancia(primero, plan) : 0;
    }, [localesCrudos, consulta]);

    const bastaConLoLocal =
        mejorPuntaje >= CERTEZA_SUFICIENTE ||
        (locales.length >= RPC_INNECESARIO_CON && mejorPuntaje >= RPC_INNECESARIO_DESDE);

    /* ── El RPC: sólo cuando lo local no convence ── */
    useEffect(() => {
        if (!activo || consulta.length < 2) { setExtras([]); setError(null); return; }
        // Mientras el índice no esté, lo local no puede opinar: se consulta el
        // RPC sin esperar, que es el comportamiento de siempre.
        /*
            `setError(null)` también acá: sin esto, un fallo del RPC quedaba
            escrito en pantalla para siempre. Bastaba que fallara una vez y
            que la siguiente consulta la resolviera lo local -- este `return`
            se saltaba la limpieza y el cartel rojo no se iba más, aunque
            debajo hubiera resultados perfectos.
        */
        if (indice.length > 0 && bastaConLoLocal) { setExtras([]); setError(null); return; }

        let cancelado = false;
        setConsultandoRpc(true);

        /*
            250 ms y no 300: el usuario ya está viendo resultados locales, así
            que esta espera no es tiempo en blanco -- es tiempo de gracia para
            no disparar una consulta por cada tecla. Lo que la acortaba antes
            era que no había nada en pantalla.
        */
        const t = setTimeout(async () => {
            try {
                const filas = await buscarConRpcCacheado(consulta, limite);
                if (cancelado) return;
                setExtras(filas);
                setError(null);
            } catch (err: any) {
                if (cancelado) return;
                // Si lo local ya trajo algo, un RPC caído no es noticia: se
                // sigue trabajando con lo que hay.
                if (locales.length === 0) setError(err?.message ?? 'No se pudo buscar en el catálogo.');
            } finally {
                if (!cancelado) setConsultandoRpc(false);
            }
        }, 250);

        return () => { cancelado = true; clearTimeout(t); setConsultandoRpc(false); };
        // `locales.length` a propósito y no `locales`: el array se reconstruye
        // en cada render y reiniciaría el temporizador para siempre.
    }, [activo, consulta, limite, bastaConLoLocal, indice.length, locales.length]);

    /**
     * Lo local primero, lo del RPC después.
     *
     * El orden importa: lo local puntúa por nombre y código, que es como
     * busca quien atiende, y aparece sin esperar. Lo que sólo sabe el RPC
     * (alias aprendidos) se añade detrás en vez de reordenar la lista debajo
     * del cursor -- que alguien esté por hacer clic y se le mueva el
     * resultado es peor que tenerlo dos filas más abajo.
     */
    const resultados = useMemo(() => {
        if (extras.length === 0) return locales;
        if (locales.length === 0) return extras;
        const vistos = new Set(locales.map((p) => p.product_id));
        const nuevos = extras.filter((p) => !vistos.has(p.product_id));
        return nuevos.length === 0 ? locales : [...locales, ...nuevos].slice(0, limite);
    }, [locales, extras, limite]);

    /*
        `localesCrudos` es null sólo mientras no se ha buscado nada; en cuanto
        el hook local responde pasa a ser un array, aunque esté vacío. Con el
        índice todavía vacío no se puede afirmar nada: ahí manda el RPC, y
        hasta que conteste `consultandoRpc` sigue en true.
    */
    const respondido = consulta.length < 2 || (localesCrudos !== null && indice.length > 0) || extras.length > 0;

    return {
        resultados,
        buscando: buscandoLocal || consultandoRpc,
        respondido,
        error,
        preparando: preparando && indice.length === 0,
    };
}

/**
 * Deja el índice listo antes de que haga falta.
 *
 * Se llama al abrir una conversación: para cuando la persona toque "catálogo"
 * el índice ya está, y la primera búsqueda del día también es instantánea.
 * No hace nada si ya está cargado.
 */
export function precalentarCatalogo(): void {
    if (indiceEnMemoria || indiceEnVuelo) return;
    if (indiceDelCatalogoMovil()) return;
    (async () => {
        const guardado = await leerCache();
        if (guardado && guardado.data.length > 0) {
            indiceEnMemoria = guardado.data;
            indiceTiempo = guardado.time;
        }
        asegurarIndice().catch(() => { /* se reintenta al abrir el buscador */ });
    })();
}

/**
 * Refresca en memoria un repuesto que se acaba de editar.
 *
 * Sin esto, editar el precio desde el chat y volver a buscar el mismo
 * repuesto mostraría el precio viejo hasta que caduque el índice (15 min) --
 * y se lo cotizaría así al cliente.
 */
export function actualizarEnIndice(id: number, cambios: Partial<FilaIndice>): void {
    /*
        Se REEMPLAZA la fila, y el array entero cambia de identidad. Las dos
        cosas hacen falta y por motivos distintos:

        - La fila, porque el motor guarda el texto ya normalizado de cada
          producto en un WeakMap con el objeto como clave (`getNormalized`):
          tocar el objeto por dentro dejaría ese texto viejo, y un repuesto
          renombrado se seguiría encontrando por el nombre anterior.

        - El array, porque el Web Worker tiene su propia COPIA del catálogo y
          sólo la renueva cuando cambia la identidad del array que se le pasa
          (ver `useBusquedaProductos`). Mutando en el sitio, el worker
          seguiría buscando sobre los datos de antes de la edición.
    */
    let tocado = false;

    if (indiceEnMemoria) {
        const i = indiceEnMemoria.findIndex((f) => f.id === id);
        if (i >= 0) {
            const copia = indiceEnMemoria.slice();
            copia[i] = { ...copia[i], ...cambios };
            indiceEnMemoria = copia;
            tocado = true;
        }
    }

    // El catálogo móvil se comparte por referencia con sus pantallas: ahí la
    // fila se reemplaza en el sitio (no es nuestro array) y se tira la copia
    // filtrada, que se rehará con identidad nueva en la próxima lectura.
    const movil = catalogoMovilEnMemoria();
    if (movil) {
        const i = movil.findIndex((f: any) => f.id === id);
        if (i >= 0) {
            movil[i] = { ...movil[i], ...cambios };
            prestado = null;
            tocado = true;
        }
    }

    // Lo que el RPC hubiera cacheado de este repuesto también quedó viejo, y
    // no hay forma barata de saber en qué consultas salía.
    cacheRpc.clear();
    cacheGalerias.delete(id);
    if (indiceEnMemoria) escribirCache(indiceEnMemoria).catch(() => {});
    if (tocado) oyentes.forEach((avisar) => avisar());
}

/**
 * Quién quiere enterarse de que el índice cambió.
 *
 * Lo usan los buscadores montados para rehacer su lista después de editar un
 * repuesto. Sin esto, quien acaba de corregir un precio desde el chat lo
 * seguiría viendo mal en la misma pantalla donde lo arregló.
 */
const oyentes = new Set<() => void>();

/** El índice tal como está ahora, sin pedir nada. */
function indiceActual(): FilaIndice[] {
    return indiceDelCatalogoMovil() ?? indiceEnMemoria ?? [];
}
