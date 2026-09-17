import React, { useState } from 'react';
import { ClipboardList, FileText, Send, X } from 'lucide-react';
import { FotoRepuesto } from '../FotoRepuesto';
import { cn, focusRing } from '../ui/styles';
import { formatearPrecio, precioParaCliente, type ProductoCatalogo } from '../../utils/whatsappOutbox';
import { BANDEJA_VACIA, useBandejaStore, type RepuestoEnBandeja } from '../../store/useBandejaStore';

/**
 * Los repuestos de los que se está hablando en este chat, a mano.
 *
 * POR QUÉ EXISTE
 * --------------
 * Enviar al catálogo, cotizar y anotar un pedido eran tres pantallas, cada
 * una con su caja de búsqueda naciendo vacía. Encontrar un repuesto una vez
 * no servía para la segunda acción: había que volver a buscarlo. Con
 * nombres como "balinera rueda trasera BWS 125" eso son tres búsquedas y
 * tres oportunidades de mandar el repuesto equivocado.
 *
 * Esta tira es la memoria que faltaba: se busca una vez, se guarda, y las
 * acciones salen de acá.
 *
 * POR QUÉ UNA TIRA HORIZONTAL Y NO UNA LISTA
 * ------------------------------------------
 * Vive entre el hilo y la caja de escribir, el sitio más caro de la
 * pantalla. Una lista vertical de tres repuestos le comería al hilo la
 * mitad del alto y empujaría los mensajes fuera de la vista -- y el hilo es
 * lo que se está leyendo mientras se atiende. Una tira de 56 px se desliza
 * a lo ancho y no le quita sitio a nada.
 *
 * POR QUÉ NO SE DIBUJA VACÍA
 * --------------------------
 * Una tira vacía con un "todavía no guardaste nada" sería un cartel
 * permanente ocupando espacio para no decir nada. Aparece cuando hay algo
 * que mostrar y desaparece cuando no.
 */

interface Props {
    conversationId: number;
    /** Nombre del cliente, para que el menú diga a quién se le anota. */
    clienteLabel: string;
    /** Mandárselo al cliente. Abre el catálogo ya con este repuesto puesto. */
    onEnviar: (producto: ProductoCatalogo) => void;
    /** Sumarlo al borrador de proforma del chat. */
    onCotizar: (producto: ProductoCatalogo) => void;
    /**
     * Anotarlo como pedido de este cliente.
     *
     * Opcional: en un chat de grupo no hay a quién anotarle nada, y sin esta
     * función la acción no se dibuja. Mismo criterio que `MenuRepuesto`.
     */
    onPedido?: (producto: ProductoCatalogo) => void;
    /** Compacta la tira para el teléfono. */
    tactil?: boolean;
}

/**
 * De vuelta al tipo del catálogo.
 *
 * La bandeja guarda una foto de cuatro campos, no el producto entero, así
 * que lo que falta va en null: cada acción vuelve a leer el producto de la
 * base antes de usarlo, porque el precio y el stock de hace dos horas no
 * son los de ahora y cotizar con ellos sería peor que no cotizar.
 */
function comoProducto(r: RepuestoEnBandeja): ProductoCatalogo {
    return {
        product_id: r.productId,
        name: r.name,
        sku: r.sku,
        price: r.price,
        image_url: r.imageUrl,
        local_stock: null,
        importer_stock: null,
        importer_unavailable_override: null,
    };
}

export const BandejaDeRepuestos: React.FC<Props> = ({
    conversationId,
    clienteLabel,
    onEnviar,
    onCotizar,
    onPedido,
    tactil = false,
}) => {
    const repuestos = useBandejaStore((s) => s.porConversacion[conversationId]) ?? BANDEJA_VACIA;
    const quitar = useBandejaStore((s) => s.quitar);
    const [abierto, setAbierto] = useState<number | null>(null);
    // El panel de acciones es UNO solo y se reusa para el repuesto abierto,
    // así que su id es el de la bandeja y no el del repuesto.
    const idAcciones = `bandeja-acciones-${conversationId}`;

    if (repuestos.length === 0) return null;

    const seleccionado = repuestos.find((r) => r.productId === abierto) ?? null;

    return (
        <div className="shrink-0 border-t border-wa-divider bg-wa-panel/60">
            <div className="flex items-center gap-2 px-3 pt-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-wa-meta">
                    En esta conversación
                </p>
                <span className="text-[10px] text-wa-meta/70">
                    {repuestos.length === 1 ? '1 repuesto' : `${repuestos.length} repuestos`}
                </span>
            </div>

            {/* `overflow-x-auto` y no un envoltorio que salte de línea: con
                cuatro repuestos, envolver duplicaría la altura de la tira y le
                comería al hilo el espacio que esta tira existe para no quitar. */}
            <div className="wa-scroll flex gap-2 overflow-x-auto px-3 pb-2 pt-1.5">
                {repuestos.map((r) => {
                    const activo = abierto === r.productId;
                    return (
                        <div
                            key={r.productId}
                            className={cn(
                                'group relative flex shrink-0 items-center gap-2 rounded-xl border bg-surface pr-1.5 transition-colors',
                                activo ? 'border-primary' : 'border-subtle hover:border-strong',
                                tactil ? 'max-w-[210px]' : 'max-w-[240px]',
                            )}
                        >
                            <button
                                type="button"
                                onClick={() => setAbierto(activo ? null : r.productId)}
                                aria-expanded={activo}
                                aria-controls={idAcciones}
                                className={cn(focusRing, 'flex min-w-0 items-center gap-2 rounded-xl py-1.5 pl-1.5 text-left')}
                            >
                                <FotoRepuesto
                                    url={r.imageUrl}
                                    sku={r.sku}
                                    nombre={r.name}
                                    className="h-9 w-9 shrink-0 rounded-lg"
                                />
                                <span className="min-w-0">
                                    <span className="block truncate text-[12px] font-medium leading-tight text-fg">
                                        {r.name}
                                    </span>
                                    <span className="mt-0.5 block truncate text-[10px] leading-tight text-fg-subtle">
                                        {r.sku}
                                        {r.price != null && ` · ${formatearPrecio(precioParaCliente(r.price))}`}
                                    </span>
                                </span>
                            </button>

                            {/* La X va SIEMPRE visible y no sólo al pasar el ratón:
                                en el teléfono no hay ratón, y una bandeja de la que
                                no se puede sacar nada se llena y deja de servir. */}
                            <button
                                type="button"
                                onClick={() => { quitar(conversationId, r.productId); if (activo) setAbierto(null); }}
                                aria-label={`Quitar ${r.name} de la bandeja`}
                                className={cn(
                                    focusRing,
                                    'shrink-0 rounded-md p-1 text-fg-subtle hover:bg-surface-hover hover:text-fg',
                                )}
                            >
                                <X size={13} aria-hidden="true" />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Las acciones se despliegan BAJO la tira y no en un menú flotante:
                acá el sitio del repuesto es fijo y conocido, así que no hace
                falta anclar nada a un punto del cursor -- y en el teléfono un
                menú flotante sobre la caja de escribir tapa justo lo que se
                está por tocar. */}
            {seleccionado && (
                <div id={idAcciones} className="flex flex-wrap items-center gap-1.5 border-t border-wa-divider px-3 py-2">
                    <span className="mr-auto min-w-0 truncate text-[11px] text-wa-meta">
                        {seleccionado.sku}
                    </span>

                    <button
                        type="button"
                        onClick={() => { onEnviar(comoProducto(seleccionado)); setAbierto(null); }}
                        className={cn(
                            focusRing,
                            'flex min-h-[34px] items-center gap-1.5 rounded-lg bg-primary px-2.5 text-[12px] font-semibold text-primary-fg',
                        )}
                    >
                        <Send size={13} aria-hidden="true" />
                        Mandar
                    </button>

                    <button
                        type="button"
                        onClick={() => { onCotizar(comoProducto(seleccionado)); setAbierto(null); }}
                        className={cn(
                            focusRing,
                            'flex min-h-[34px] items-center gap-1.5 rounded-lg border border-strong bg-surface px-2.5 text-[12px] font-semibold text-fg',
                        )}
                    >
                        <FileText size={13} aria-hidden="true" />
                        Proforma
                    </button>

                    {onPedido && (
                        <button
                            type="button"
                            onClick={() => { onPedido(comoProducto(seleccionado)); setAbierto(null); }}
                            title={`Queda anotado para ${clienteLabel}`}
                            className={cn(
                                focusRing,
                                'flex min-h-[34px] items-center gap-1.5 rounded-lg border border-strong bg-surface px-2.5 text-[12px] font-semibold text-fg',
                            )}
                        >
                            <ClipboardList size={13} aria-hidden="true" />
                            Pedido
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default BandejaDeRepuestos;
