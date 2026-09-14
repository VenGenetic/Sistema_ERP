/**
 * Búsqueda del catálogo móvil, servida desde un Web Worker.
 *
 * La pantalla no se entera de si hay worker o no: pide una consulta y recibe la
 * lista ya ordenada por relevancia. Si el navegador no soporta workers, o el
 * worker falla por lo que sea, se busca en el hilo principal con el MISMO
 * algoritmo — nunca se queda sin resultados.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { searchProducts } from './mobileSearchCore';
import type {
    PeticionBusqueda,
    ProductoBuscable,
    RespuestaBusqueda,
} from './mobileSearchWorker';

/**
 * Recorta cada repuesto a lo que el algoritmo lee de verdad.
 *
 * Mandar el catálogo entero al worker significa copiarlo (los hilos no
 * comparten memoria), y el catálogo completo son ~3 MB, de los cuales el 20 %
 * son URLs de imágenes que la búsqueda nunca mira. Copiar sólo estos campos
 * deja la transferencia en una fracción, y esa copia ocurre UNA vez por carga
 * del catálogo, no por pulsación.
 *
 * Si algún día `getNormalized` (en mobileSearchCore) empieza a leer otro campo,
 * hay que añadirlo aquí o dejará de encontrarse por él.
 */
const proyectarParaBusqueda = (productos: any[]): ProductoBuscable[] =>
    productos.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        description: p.description,
        brands: p.brands,
        product_tags: p.product_tags,
        inventory_levels: p.inventory_levels,
    }));

type Estado = {
    /** `null` = no hay consulta; la pantalla debe usar el catálogo completo. */
    resultados: any[] | null;
    /** Hay una búsqueda en vuelo: sirve para atenuar la lista, no para taparla. */
    buscando: boolean;
};

export function useBusquedaProductos(
    productos: any[],
    consulta: string,
    minScore = 2,
): Estado {
    const [estado, setEstado] = useState<Estado>({ resultados: null, buscando: false });

    const workerRef = useRef<Worker | null>(null);
    const sinWorker = useRef(false);
    const catalogoEnviado = useRef<any[] | null>(null);
    const contador = useRef(0);
    const pendientes = useRef(new Map<number, (ids: any[] | null) => void>());

    // id -> producto, para reconstruir el orden que devuelve el worker
    const porId = useMemo(() => {
        const m = new Map<any, any>();
        for (const p of productos) m.set(p.id, p);
        return m;
    }, [productos]);

    /* ── Arranque del worker (una sola vez) ── */
    useEffect(() => {
        if (sinWorker.current || workerRef.current) return;
        if (typeof Worker === 'undefined') { sinWorker.current = true; return; }
        try {
            const w = new Worker(new URL('./mobileSearchWorker.ts', import.meta.url), { type: 'module' });
            w.onmessage = (e: MessageEvent<RespuestaBusqueda>) => {
                const msg = e.data;
                if (msg.tipo === 'resultado') {
                    const resolver = pendientes.current.get(msg.peticion);
                    if (resolver) { pendientes.current.delete(msg.peticion); resolver(msg.ids); }
                } else if (msg.tipo === 'error') {
                    const resolver = pendientes.current.get(msg.peticion);
                    if (resolver) { pendientes.current.delete(msg.peticion); resolver(null); }
                }
            };
            /*
                Si el worker revienta, se marca como no disponible y se despiertan
                todas las peticiones en vuelo con `null`, que es la señal de
                «hazlo en el hilo principal». Sin esto, una búsqueda quedaría
                colgada para siempre y la lista no volvería a actualizarse.
            */
            w.onerror = () => {
                sinWorker.current = true;
                workerRef.current = null;
                // El catálogo se fue con el worker muerto.
                catalogoEnviado.current = null;
                pendientes.current.forEach((resolver) => resolver(null));
                pendientes.current.clear();
                try { w.terminate(); } catch { /* ya estaba muerto */ }
            };
            workerRef.current = w;
        } catch {
            sinWorker.current = true;
        }
        return () => {
            workerRef.current?.terminate();
            workerRef.current = null;
            pendientes.current.clear();
            /*
                Y se olvida qué catálogo se había mandado.

                El worker nuevo arranca VACÍO, pero `catalogoEnviado` seguía
                apuntando al array del anterior, así que el efecto de abajo
                cortaba por `=== productos` y no se lo enviaba nunca --
                mientras las búsquedas sí iban a él. Resultado: cero
                resultados, sin error y sin respaldo.

                No es teórico: React en modo estricto (index.tsx) monta,
                desmonta y vuelve a montar cada efecto, así que pasa en
                CUALQUIER pantalla que arranque con el catálogo ya cargado.
            */
            catalogoEnviado.current = null;
        };
    }, []);

    /* ── Mandar el catálogo cuando cambia ── */
    useEffect(() => {
        const w = workerRef.current;
        if (!w || !productos.length) return;
        if (catalogoEnviado.current === productos) return;
        catalogoEnviado.current = productos;
        const mensaje: PeticionBusqueda = { tipo: 'catalogo', productos: proyectarParaBusqueda(productos) };
        w.postMessage(mensaje);
    }, [productos]);

    /* ── Buscar ── */
    useEffect(() => {
        const term = consulta.trim();
        if (!term) { setEstado({ resultados: null, buscando: false }); return; }
        if (!productos.length) { setEstado({ resultados: [], buscando: false }); return; }

        let cancelada = false;
        const enElHilo = () => {
            // Mismo algoritmo, sólo que bloqueando. Es el camino de respaldo.
            const res = searchProducts(productos, term, minScore);
            if (!cancelada) setEstado({ resultados: res, buscando: false });
        };

        const w = workerRef.current;
        if (sinWorker.current || !w || catalogoEnviado.current !== productos) {
            // Aún no se ha mandado el catálogo (primerísima búsqueda) o no hay
            // worker: se resuelve aquí para no dejar la pantalla en blanco.
            enElHilo();
            return () => { cancelada = true; };
        }

        setEstado((prev) => ({ resultados: prev.resultados, buscando: true }));

        const id = ++contador.current;
        pendientes.current.set(id, (ids) => {
            if (cancelada) return;
            if (ids === null) { enElHilo(); return; }
            const res: any[] = [];
            for (const pid of ids) {
                const p = porId.get(pid);
                if (p) res.push(p);
            }
            setEstado({ resultados: res, buscando: false });
        });

        const mensaje: PeticionBusqueda = { tipo: 'buscar', peticion: id, consulta: term, minScore };
        w.postMessage(mensaje);

        return () => {
            cancelada = true;
            pendientes.current.delete(id);
        };
    }, [productos, consulta, minScore, porId]);

    return estado;
}
