/**
 * Busca en el catálogo fuera del hilo principal.
 *
 * El problema que resuelve: buscar recorre los 5.892 repuestos en memoria, y
 * mientras eso ocurre el hilo principal no puede pintar ni atender el teclado.
 * Aunque el algoritmo se optimizó (de ~50 ms a ~18 ms por pulsación en un PC,
 * bastante más en un teléfono), sigue siendo tiempo en el que el dedo del
 * vendedor no recibe respuesta. Aquí ese trabajo ocurre en otro hilo: el
 * principal queda libre pase lo que pase, y escribir nunca se traba.
 *
 * Importa `mobileSearchCore` y no `mobileSearchEngine` a propósito: el motor
 * arrastra React y el cliente de Supabase, que dentro de un worker no sirven
 * para nada. El algoritmo es exactamente el mismo fichero que usa la pantalla,
 * así que los dos caminos no pueden dar resultados distintos.
 *
 * Devuelve SOLO ids, nunca los objetos: el resultado de una búsqueda pueden ser
 * miles de repuestos, y volver a copiarlos enteros al hilo principal costaría
 * más que la propia búsqueda. La pantalla ya tiene los objetos; le basta el
 * orden.
 */
import { searchProducts } from './mobileSearchCore';

/** Sólo los campos que lee el algoritmo. Ver `proyectarParaBusqueda`. */
export interface ProductoBuscable {
    id: any;
    sku?: string | null;
    name?: string | null;
    category?: string | null;
    description?: string | null;
    brands?: { name?: string | null } | null;
    product_tags?: any[] | null;
    inventory_levels?: any[] | null;
}

export type PeticionBusqueda =
    | { tipo: 'catalogo'; productos: ProductoBuscable[] }
    | { tipo: 'buscar'; peticion: number; consulta: string; minScore: number };

export type RespuestaBusqueda =
    | { tipo: 'listo'; total: number }
    | { tipo: 'resultado'; peticion: number; ids: any[] }
    | { tipo: 'error'; peticion: number; mensaje: string };

let catalogo: ProductoBuscable[] = [];

const contexto = self as unknown as {
    onmessage: ((e: MessageEvent<PeticionBusqueda>) => void) | null;
    postMessage: (m: RespuestaBusqueda) => void;
};

contexto.onmessage = (e: MessageEvent<PeticionBusqueda>) => {
    const msg = e.data;

    if (msg.tipo === 'catalogo') {
        catalogo = msg.productos || [];
        /*
            La caché de normalización del algoritmo es un WeakMap con el objeto
            del producto como clave. Como aquí llegan objetos nuevos (copiados al
            cruzar de hilo), la caché se rehace sola en la primera búsqueda y
            luego ya sirve para todas las demás.
        */
        contexto.postMessage({ tipo: 'listo', total: catalogo.length });
        return;
    }

    if (msg.tipo === 'buscar') {
        try {
            const encontrados = searchProducts(catalogo, msg.consulta, msg.minScore);
            contexto.postMessage({
                tipo: 'resultado',
                peticion: msg.peticion,
                ids: encontrados.map((p: any) => p.id),
            });
        } catch (err: any) {
            contexto.postMessage({
                tipo: 'error',
                peticion: msg.peticion,
                mensaje: err?.message || 'fallo al buscar',
            });
        }
    }
};
