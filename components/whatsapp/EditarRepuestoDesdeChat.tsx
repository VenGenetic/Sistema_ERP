import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { actualizarEnIndice } from '../../utils/catalogoRapido';

/**
 * Corregir un repuesto sin salir de la conversación.
 *
 * El caso real: se busca una pieza para cotizarla y se ve que el precio está
 * mal, o que le falta la foto, o que el nombre tiene un error que el cliente
 * va a leer. Hasta ahora eso era abrir el ERP en otra pestaña, buscar el
 * repuesto otra vez, arreglarlo, volver al chat y repetir la búsqueda -- con
 * lo cual, en la práctica, no se arreglaba: se cotizaba mal y se seguía.
 *
 * Es la MISMA ficha que la del catálogo (`ProductModal`), no una versión
 * recortada: si fueran dos formularios distintos, tarde o temprano uno
 * validaría algo que el otro no y el precio saldría distinto según desde
 * dónde se editó.
 *
 * Se carga a demanda (`lazy`): son 45 kB que quien sólo contesta mensajes no
 * tiene por qué descargar. El paquete del chat no puede engordar por una
 * acción que se usa una vez cada tantas conversaciones.
 */
const ProductModal = lazy(() =>
    import('../ProductModal').then((m) => ({ default: m.ProductModal })),
);

interface Props {
    /** Repuesto a editar, o `null` para no mostrar nada. */
    productId: number | null;
    onClose: () => void;
    /** Se llama cuando se guardó, para que la lista de atrás se refresque. */
    onGuardado: () => void;
}

export const EditarRepuestoDesdeChat: React.FC<Props> = ({ productId, onClose, onGuardado }) => {
    const [fila, setFila] = useState<any>(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /*
        La ficha necesita la fila COMPLETA (margen, costo, stock mínimo, marca,
        descontinuación...), y la búsqueda sólo trae once columnas. Se pide
        aquí, una sola vez y sólo del repuesto que se va a editar: es el mismo
        camino que usa `handleEditProduct` en el catálogo móvil.
    */
    useEffect(() => {
        if (productId == null) { setFila(null); setError(null); return; }

        let cancelado = false;
        setCargando(true);
        setError(null);

        (async () => {
            const { data, error: err } = await supabase
                .from('products')
                .select('*')
                .eq('id', productId)
                .single();
            if (cancelado) return;
            if (err || !data) {
                setError(err?.message ?? 'No se pudo leer el repuesto.');
                setFila(null);
            } else {
                setFila(data);
            }
            setCargando(false);
        })();

        return () => { cancelado = true; };
    }, [productId]);

    if (productId == null) return null;

    if (cargando || (!fila && !error)) {
        return (
            <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/50">
                <Loader2 size={26} className="animate-spin text-white" aria-hidden="true" />
                <span className="sr-only">Abriendo la ficha del repuesto…</span>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="fixed inset-0 z-[125] flex items-center justify-center bg-black/50 p-4"
                role="dialog"
                aria-modal="true"
                onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <div className="max-w-sm rounded-xl border border-subtle bg-surface p-4 text-center">
                    <p className="text-sm text-danger">{error}</p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="mt-3 rounded-lg border border-subtle px-3 py-1.5 text-sm text-fg hover:bg-surface-hover"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <Suspense
            fallback={
                <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/50">
                    <Loader2 size={26} className="animate-spin text-white" aria-hidden="true" />
                </div>
            }
        >
            <ProductModal
                isOpen
                onClose={onClose}
                productToEdit={fila}
                onSuccess={() => {
                    /*
                        El índice local vive hasta 15 minutos. Sin esto, arreglar
                        un precio y volver a buscar el mismo repuesto mostraría
                        el precio viejo -- y se lo cotizaría así al cliente, que
                        es justo lo que se acaba de venir a corregir.

                        Se relee del servidor en vez de adivinar los cambios: la
                        ficha recalcula el PVP a partir del costo y el margen, y
                        reconstruir esa cuenta acá sería tener la fórmula en dos
                        sitios.
                    */
                    supabase
                        .from('products')
                        .select('id, sku, name, category, price, image_url, local_stock, importer_stock, importer_unavailable_override, is_discontinued, discontinued_until')
                        .eq('id', productId)
                        .maybeSingle()
                        .then(({ data }) => {
                            if (data) actualizarEnIndice(productId, data as any);
                        });
                    onClose();
                    onGuardado();
                }}
            />
        </Suspense>
    );
};

export default EditarRepuestoDesdeChat;
