import React, { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Bell, ExternalLink, Loader2, Package, RefreshCw, Send, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { badge, button, card, cn } from '../ui/styles';
import { formatearPrecio, precioParaCliente, stockUtil } from '../../utils/whatsappOutbox';

/**
 * Quién es el cliente que está del otro lado, sin salir del chat.
 *
 * Sirve para lo que un vendedor de repuestos necesita saber antes de
 * cotizar: si ya es cliente del ERP (y con qué descuento), qué repuestos
 * dejó pedidos y siguen esperando stock, y si alguno ya llegó -- porque
 * "avisale que ya llegó el que pediste" es una venta hecha, y hoy ese dato
 * vive en otra pantalla que nadie abre mientras contesta.
 *
 * El vínculo con `customers` se busca por teléfono: `agent_conversations`
 * guarda solo dígitos (migración 0021) y `customers.phone` viene escrito a
 * mano de mil formas, así que se comparan los últimos 9 dígitos (el número
 * local ecuatoriano sin el 0 ni el código de país).
 */

interface Props {
    conversationId: number;
    phoneNumber: string;
    customerName: string | null;
    /** Agrega un repuesto que ya llegó a la proforma en curso. */
    onCotizar?: (producto: { product_id: number; sku: string; name: string; price: number | null; image_url: string | null }) => void;
    /**
     * Abre el aviso de "ya llegó lo que pediste" para este cliente.
     *
     * La ficha no lo manda ella: la pantalla es la que tiene el modal, y
     * este panel lo usan las dos (bandeja y modo móvil). Si no se pasa, el
     * botón no aparece.
     */
    onAvisar?: () => void;
}

interface ClienteErp {
    id: number;
    name: string;
    identification_number: string;
    phone: string | null;
    customer_type: string | null;
    discount_percentage: number | null;
}

interface Demanda {
    id: number;
    status: string;
    created_at: string;
    notes: string | null;
    product: {
        id: number;
        name: string;
        sku: string;
        price: number | null;
        image_url: string | null;
        local_stock: number | null;
        importer_stock: number | null;
        importer_unavailable_override: boolean | null;
    } | null;
}

const ESTADO_DEMANDA: Record<string, { texto: string; tono: keyof typeof badge.tone }> = {
    pending_stock: { texto: 'Esperando stock', tono: 'warning' },
    stock_available: { texto: '¡Ya llegó!', tono: 'success' },
    notified: { texto: 'Avisado', tono: 'info' },
    cancelled: { texto: 'Cancelada', tono: 'neutral' },
    expired: { texto: 'Vencida', tono: 'neutral' },
    discontinued: { texto: 'Descontinuado', tono: 'danger' },
};

/** Los últimos 9 dígitos: el número local, sin 0 inicial ni código de país. */
function cola(numero: string): string {
    return numero.replace(/\D/g, '').slice(-9);
}

export const CustomerPanel: React.FC<Props> = ({
    conversationId,
    phoneNumber,
    customerName,
    onCotizar,
    onAvisar,
}) => {
    const [cliente, setCliente] = useState<ClienteErp | null>(null);
    const [demandas, setDemandas] = useState<Demanda[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        const local = cola(phoneNumber);

        try {
            // 1) Cliente del ERP. `ilike *cola*` en vez de igualdad: los
            //    teléfonos de `customers` están cargados a mano y vienen con
            //    espacios, guiones, +593 o el 0 adelante.
            if (local.length >= 7) {
                const { data } = await supabase
                    .from('customers')
                    .select('id, name, identification_number, phone, customer_type, discount_percentage')
                    .ilike('phone', `%${local}%`)
                    .limit(1);
                setCliente((data?.[0] as ClienteErp) ?? null);
            } else {
                setCliente(null);
            }

            // 2) Repuestos que este número dejó pedidos. `product_demands`
            //    guarda el teléfono como lo escribió quien la creó, así que
            //    también se compara por la cola.
            const { data: dem, error: errorDem } = await supabase
                .from('product_demands')
                .select(
                    'id, status, created_at, notes, product:products(id, name, sku, price, image_url, local_stock, importer_stock, importer_unavailable_override)',
                )
                .ilike('phone_number', `%${local}%`)
                .order('created_at', { ascending: false })
                .limit(10);
            if (errorDem) throw errorDem;
            setDemandas((dem ?? []) as unknown as Demanda[]);
        } catch (err: any) {
            setError(err?.message ?? 'No se pudo cargar la ficha del cliente.');
        } finally {
            setCargando(false);
        }
    }, [phoneNumber]);

    useEffect(() => {
        cargar();
    }, [cargar, conversationId]);

    const activas = demandas.filter((d) => d.status === 'pending_stock' || d.status === 'stock_available');
    /*
        Lo que ya se le puede entregar: pedido activo Y con stock HOY.

        No alcanza con mirar el estado `stock_available`. Ese estado lo pone
        un disparador que solo corre al hacer UPDATE del stock en `products`,
        así que el stock que entra por cualquier otro camino deja el pedido en
        `pending_stock` para siempre. Filtrando por estado, este bloque decía
        "Llegó lo que pidió (0)" con el repuesto en la bodega -- y es
        justamente el dato por el que existe la ficha.

        Es la misma regla que usan el botón "Por avisar" de la bandeja y la
        tarjeta de Solicitudes: activa + `stockUtil().hay`.
    */
    const llegaron = activas.filter((d) => d.product && stockUtil(d.product).hay);

    return (
        <div className={cn(card.base, 'overflow-hidden')}>
            <div className={cn(card.header, 'py-2.5')}>
                <p className={card.title}>Ficha del cliente</p>
                <button
                    onClick={cargar}
                    disabled={cargando}
                    aria-label="Actualizar la ficha"
                    className="p-1 rounded text-fg-subtle hover:text-fg hover:bg-surface-hover"
                >
                    {cargando ? (
                        <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                    ) : (
                        <RefreshCw size={13} aria-hidden="true" />
                    )}
                </button>
            </div>

            <div className="p-4 space-y-3">
                {error && <p className="text-xs text-danger">{error}</p>}

                {/* Vínculo con el ERP */}
                {cliente ? (
                    <div className="rounded-lg border border-subtle bg-surface-2 px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-fg flex items-center gap-1.5">
                                    <BadgeCheck size={14} className="text-success shrink-0" aria-hidden="true" />
                                    <span className="truncate">{cliente.name}</span>
                                </p>
                                <p className="text-2xs text-fg-muted mt-0.5">
                                    {cliente.identification_number}
                                    {cliente.customer_type && ` · ${cliente.customer_type}`}
                                </p>
                            </div>
                            <Link
                                to="/customers"
                                className="shrink-0 text-fg-subtle hover:text-primary p-1"
                                title="Abrir en Clientes"
                            >
                                <ExternalLink size={13} aria-hidden="true" />
                            </Link>
                        </div>
                        {/* El descuento cambia el precio que hay que cotizar: si no
                            se ve acá, se cotiza de más y el cliente reclama. */}
                        {!!cliente.discount_percentage && cliente.discount_percentage > 0 && (
                            <p className="mt-1.5">
                                <span className={cn(badge.base, badge.size.sm, badge.tone.info)}>
                                    {cliente.discount_percentage}% de descuento
                                </span>
                            </p>
                        )}
                    </div>
                ) : (
                    !cargando && (
                        <div className="rounded-lg border border-dashed border-strong px-3 py-2.5">
                            <p className="text-xs text-fg-muted flex items-center gap-1.5">
                                <UserPlus size={13} className="shrink-0" aria-hidden="true" />
                                {customerName ? `"${customerName}" no` : 'Este número no'} está registrado como cliente.
                            </p>
                            <Link
                                to="/customers"
                                className="text-2xs text-primary hover:underline mt-1 inline-block"
                            >
                                Registrarlo en Clientes →
                            </Link>
                        </div>
                    )
                )}

                {/* Lo que ya llegó: es lo que se puede vender AHORA. */}
                {llegaron.length > 0 && (
                    <div className="rounded-lg border border-success/30 bg-success-soft px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-success-soft-fg flex items-center gap-1.5">
                                <Bell size={13} aria-hidden="true" />
                                Llegó lo que pidió ({llegaron.length})
                            </p>
                            {/* Avisarle es la mitad que faltaba: el repuesto puede
                                estar hace una semana en la bodega y el cliente no
                                tiene forma de saberlo. */}
                            {onAvisar && (
                                <button
                                    onClick={onAvisar}
                                    className={cn(button.base, button.variant.success, button.size.xs)}
                                >
                                    <Send size={12} aria-hidden="true" />
                                    Avisarle
                                </button>
                            )}
                        </div>
                        <div className="mt-1.5 space-y-1.5">
                            {llegaron.map((d) => (
                                <div key={d.id} className="flex items-center gap-2">
                                    <p className="text-2xs text-success-soft-fg flex-1 min-w-0 truncate">
                                        {d.product?.name ?? 'Repuesto'}
                                    </p>
                                    {onCotizar && d.product && (
                                        <button
                                            onClick={() =>
                                                onCotizar({
                                                    product_id: d.product!.id,
                                                    sku: d.product!.sku,
                                                    name: d.product!.name,
                                                    price: d.product!.price,
                                                    image_url: d.product!.image_url,
                                                })
                                            }
                                            className={cn(button.base, button.variant.success, button.size.xs)}
                                        >
                                            Cotizar
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Pedidos pendientes */}
                <div>
                    <p className="text-2xs font-semibold uppercase tracking-wider text-fg-subtle mb-1.5">
                        Repuestos que dejó pedidos ({activas.length})
                    </p>
                    {cargando && demandas.length === 0 ? (
                        <p className="text-xs text-fg-muted">Cargando…</p>
                    ) : demandas.length === 0 ? (
                        <p className="text-xs text-fg-muted flex items-center gap-1.5">
                            <Package size={13} className="text-fg-subtle shrink-0" aria-hidden="true" />
                            Nunca dejó un pedido anotado.
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {demandas.slice(0, 6).map((d) => {
                                const estado = ESTADO_DEMANDA[d.status] ?? { texto: d.status, tono: 'neutral' as const };
                                return (
                                    <div key={d.id} className="flex items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs text-fg leading-snug line-clamp-2">
                                                {d.product?.name ?? 'Repuesto sin vincular'}
                                            </p>
                                            <p className="text-2xs text-fg-subtle">
                                                {new Date(d.created_at).toLocaleDateString('es-EC')}
                                                {d.product?.price != null &&
                                                    ` · ${formatearPrecio(precioParaCliente(d.product.price))}`}
                                            </p>
                                        </div>
                                        <span className={cn(badge.base, badge.size.sm, badge.tone[estado.tono], 'shrink-0')}>
                                            {estado.texto}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <Link to="/product-demands" className="text-2xs text-primary hover:underline mt-2 inline-block">
                        Ver todos los pedidos →
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default CustomerPanel;
