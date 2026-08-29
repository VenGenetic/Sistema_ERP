import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Loader2, Minus, Plus, Search, Send, ShoppingCart, Store, Trash2, X } from 'lucide-react';
import { useBackDismiss } from '../../hooks/useBackDismiss';
import { convertProformaToPosCart } from '../../utils/proformaToCart';
import { badge, button, cn, focusRing, input, modal } from '../ui/styles';
import { FotoRepuesto } from '../FotoRepuesto';
import { fetchProformaStockInfo, type ProformaStockInfo } from '../../utils/proformaStock';
import {
    subtotalDe,
    totalDe,
    useChatProformaStore,
    type ChatProforma,
} from '../../store/useChatProformaStore';
import { capturarProformaComoArchivo, resumenDeProforma } from '../../utils/proformaImage';
import { registerProformaAnalytics } from '../../utils/whatsappWorkflow';
import { ProformaDocument, PROFORMA_WIDTH } from './ProformaDocument';
import {
    buscarEnCatalogo,
    borrarAdjunto,
    formatearPrecio,
    precioParaCliente,
    stockUtil,
    subirAdjunto,
    type NuevoMensaje,
    type ProductoCatalogo,
} from '../../utils/whatsappOutbox';

/**
 * Armar una cotización con el cliente en línea y mandársela por WhatsApp.
 *
 * Es lo que hace un vendedor de repuestos todo el día: el cliente pide
 * tres o cuatro piezas, hay que cotizarlas juntas con el total y el envío.
 * Antes eso significaba salir del ERP, armar la proforma en la pantalla
 * del POS, exportarla como imagen, guardarla y volver a WhatsApp a
 * adjuntarla -- y esa proforma quedaba atada al POS, no a este cliente.
 *
 * Acá se arma dentro de la conversación, se ve exactamente como la va a
 * recibir el cliente, y sale al chat en un clic. El borrador es POR
 * CONVERSACIÓN (ver store/useChatProformaStore.ts) y sobrevive a cambiar
 * de chat o recargar la página.
 */

interface Props {
    isOpen: boolean;
    /**
     * `panel`: columna acoplada a la derecha del hilo, para poder ir
     * leyendo lo que el cliente pidió mientras se arma la cotización --
     * que es como se trabaja de verdad. `modal`: la ventana centrada de
     * siempre, para cuando no hay ancho.
     *
     * La página decide cuál según el ancho real (ver hooks/useMediaQuery):
     * es una decisión de QUÉ se monta, no de cómo se ve.
     */
    presentacion?: 'modal' | 'panel';
    onClose: () => void;
    conversationId: number;
    clienteLabel: string;
    clienteNombre: string | null;
    onEnviar: (mensajes: NuevoMensaje[]) => Promise<void>;
}

export const ProformaBuilder: React.FC<Props> = ({
    isOpen,
    onClose,
    presentacion = 'modal',
    conversationId,
    clienteLabel,
    clienteNombre,
    onEnviar,
}) => {
    const proforma: ChatProforma = useChatProformaStore((s) => s.obtener(conversationId));
    const agregar = useChatProformaStore((s) => s.agregar);
    const quitar = useChatProformaStore((s) => s.quitar);
    const cambiarCantidad = useChatProformaStore((s) => s.cambiarCantidad);
    const cambiarPrecio = useChatProformaStore((s) => s.cambiarPrecio);
    const setEnvio = useChatProformaStore((s) => s.setEnvio);
    const setNota = useChatProformaStore((s) => s.setNota);
    const limpiar = useChatProformaStore((s) => s.limpiar);

    const [termino, setTermino] = useState('');
    const [resultados, setResultados] = useState<ProductoCatalogo[]>([]);
    const [buscando, setBuscando] = useState(false);
    const [stockInfo, setStockInfo] = useState<Record<number, ProformaStockInfo>>({});
    const [incluirTexto, setIncluirTexto] = useState(true);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [verPrevia, setVerPrevia] = useState(false);
    const [convirtiendo, setConvirtiendo] = useState(false);
    /** Repuestos que no entraron limpios al carrito del POS. */
    const [avisosPos, setAvisosPos] = useState<string[] | null>(null);

    const navigate = useNavigate();

    const hojaRef = useRef<HTMLDivElement>(null);
    const buscadorRef = useRef<HTMLInputElement>(null);
    const contenedorPreviaRef = useRef<HTMLDivElement>(null);
    const enviandoRef = useRef(false);

    /**
     * Cuánto hay que encoger la hoja para que entre en el panel.
     *
     * La hoja mide 650px fijos porque ése es el tamaño con el que se
     * captura la imagen. Si se la dejara encogerse sola dentro de un
     * contenedor flex, el ancho bajaría pero el alto no, y la vista previa
     * mostraría un documento deformado -- distinto del que recibe el
     * cliente. Con `transform: scale` la caja real sigue midiendo 650px
     * (así la captura no cambia) y solo se ve más chica.
     */
    const [escala, setEscala] = useState(1);
    useEffect(() => {
        if (!verPrevia) return;
        const medir = () => {
            const ancho = contenedorPreviaRef.current?.clientWidth ?? PROFORMA_WIDTH;
            setEscala(Math.min(1, ancho / PROFORMA_WIDTH));
        };
        medir();
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, [verPrevia]);

    /**
     * Alto real de la hoja, medido sobre la copia de tamaño completo.
     *
     * Hace falta porque `transform: scale` NO cambia el alto que ocupa el
     * elemento en el layout: la hoja escalada se ve chica pero sigue
     * reservando su alto original, dejando un hueco enorme debajo. Con el
     * alto medido se le da al contenedor el tamaño que de verdad ocupa lo
     * que se ve.
     *
     * Se mide con ResizeObserver y no leyendo `offsetHeight` al renderizar:
     * la hoja cambia de alto con cada repuesto que se agrega o se saca, y
     * una lectura durante el render no vuelve a correr cuando eso pasa.
     */
    const [alturaHoja, setAlturaHoja] = useState(0);
    useEffect(() => {
        const nodo = hojaRef.current;
        if (!nodo) return;
        const observador = new ResizeObserver(([entrada]) => setAlturaHoja(entrada.contentRect.height));
        observador.observe(nodo);
        setAlturaHoja(nodo.offsetHeight);
        return () => observador.disconnect();
    }, [isOpen]);

    const enPanel = presentacion === 'panel';

    /**
     * El «atrás» solo cierra la proforma cuando es un overlay que tapa la
     * pantalla. Acoplada al costado es parte de la página, como la ficha
     * del cliente: empujar una entrada al historial haría que el botón
     * atrás del navegador cierre un panel en vez de volver a donde el
     * usuario venía.
     */
    useBackDismiss(isOpen && !enPanel, onClose);

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        setTermino('');
        setResultados([]);
        const t = setTimeout(() => buscadorRef.current?.focus(), 50);
        return () => clearTimeout(t);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    // Búsqueda contra la base: se espera a que termine de escribir.
    useEffect(() => {
        if (!isOpen) return;
        const texto = termino.trim();
        if (texto.length < 2) {
            setResultados([]);
            return;
        }
        let cancelado = false;
        setBuscando(true);
        const t = setTimeout(async () => {
            try {
                const filas = await buscarEnCatalogo(texto, 12);
                if (!cancelado) setResultados(filas);
            } catch (err: any) {
                if (!cancelado) setError(err?.message ?? 'No se pudo buscar en el catálogo.');
            } finally {
                if (!cancelado) setBuscando(false);
            }
        }, 300);
        return () => {
            cancelado = true;
            clearTimeout(t);
        };
    }, [termino, isOpen]);

    /**
     * Disponibilidad real de lo que está en la proforma. Es la misma
     * consulta que usa la proforma del POS, así que la etiqueta ("En
     * Stock" / "Bajo Pedido" / "Agotado") significa lo mismo en las dos.
     */
    const idsEnProforma = proforma.items.map((i) => i.productId).join(',');
    useEffect(() => {
        if (!idsEnProforma) {
            setStockInfo({});
            return;
        }
        let cancelado = false;
        fetchProformaStockInfo(idsEnProforma.split(',').map(Number)).then((info) => {
            if (!cancelado) setStockInfo(info);
        });
        return () => {
            cancelado = true;
        };
    }, [idsEnProforma]);

    const subtotal = subtotalDe(proforma);
    const total = totalDe(proforma);
    const hayItems = proforma.items.length > 0;
    const advertencias = useMemo(() => {
        const rows: string[] = [];
        const sinPrecio = proforma.items.filter((item) => item.unitPrice <= 0).length;
        const sinFoto = proforma.items.filter((item) => !item.imageUrl).length;
        const agotados = proforma.items.filter((item) => stockInfo[item.productId]?.status === 'out_of_stock').length;
        if (sinPrecio) rows.push(`${sinPrecio} repuesto${sinPrecio > 1 ? 's' : ''} sin precio.`);
        if (agotados) rows.push(`${agotados} repuesto${agotados > 1 ? 's' : ''} figura${agotados > 1 ? 'n' : ''} sin stock.`);
        if (sinFoto) rows.push(`${sinFoto} repuesto${sinFoto > 1 ? 's' : ''} aparecerá${sinFoto > 1 ? 'n' : ''} sin fotografía.`);
        if (!clienteNombre?.trim()) rows.push('La proforma no tiene nombre de cliente.');
        return rows;
    }, [proforma.items, stockInfo, clienteNombre]);

    const enviar = async () => {
        if (!hayItems || enviandoRef.current || !hojaRef.current) return;
        enviandoRef.current = true;
        setEnviando(true);
        setError(null);
        let urlSubida: string | null = null;
        try {
            const archivo = await capturarProformaComoArchivo(
                hojaRef.current,
                `proforma-${new Date().toISOString().slice(0, 10)}.png`,
            );
            const subido = await subirAdjunto(archivo);
            urlSubida = subido.url;

            const mensajes: NuevoMensaje[] = [
                {
                    conversationId,
                    // El texto va como pie de la imagen: en WhatsApp se lee
                    // junto a la foto en vez de quedar como un mensaje suelto.
                    // Solo el total y la nota -- el detalle ya está en la hoja
                    // (ver resumenDeProforma).
                    body: incluirTexto ? resumenDeProforma({ total, nota: proforma.nota }) : null,
                    kind: 'image',
                    mediaUrl: subido.url,
                    mediaMime: subido.mime,
                    mediaFilename: subido.filename,
                },
            ];

            await onEnviar(mensajes);
            // Registro analítico interno. No manda ningún mensaje adicional y
            // sus fallos no bloquean la cotización que ya quedó encolada.
            await registerProformaAnalytics(conversationId, proforma.items);
            urlSubida = null;
            // El borrador se limpia recién ACÁ, después de que se encoló: si
            // el envío falla, la proforma sigue armada y se puede reintentar
            // sin rehacerla.
            limpiar(conversationId);
            onClose();
        } catch (err: any) {
            if (urlSubida) await borrarAdjunto(urlSubida);
            setError(err?.message ?? 'No se pudo enviar la proforma.');
        } finally {
            enviandoRef.current = false;
            setEnviando(false);
        }
    };

    /**
     * El cliente aceptó: pasa la cotización al POS para cobrarla.
     *
     * Cierra el ciclo de la venta sin re-tipear nada -- que es donde se
     * cometen los errores de precio y de cantidad. Usa la MISMA conversión
     * que el panel de proformas del escritorio y el modo móvil
     * (`utils/proformaToCart.ts`), que es quien sabe resolver de qué bodega
     * sale cada repuesto.
     *
     * El borrador NO se borra: la venta todavía no está cerrada, y si en la
     * caja se cae, la proforma tiene que seguir ahí para volver a mandarla.
     */
    const pasarAlPos = async () => {
        if (!hayItems || convirtiendo) return;
        setConvirtiendo(true);
        setError(null);
        try {
            const { unresolved, lowStock } = await convertProformaToPosCart(proforma.items);
            const problemas: string[] = [];
            if (unresolved.length > 0) {
                problemas.push(`No se cargaron (nunca estuvieron en una bodega): ${unresolved.join(', ')}.`);
            }
            if (lowStock.length > 0) {
                problemas.push(`Sin stock suficiente en la bodega asignada: ${lowStock.join(', ')}.`);
            }

            // Si algo no entró limpio, se avisa ACÁ y no se salta al POS:
            // llegar a la caja sin saber que faltó un repuesto es cobrar de
            // menos. El carrito ya quedó cargado, así que el botón de abajo
            // solo navega.
            if (problemas.length > 0) {
                setAvisosPos(problemas);
                return;
            }
            navigate('/pos');
        } catch (err: any) {
            setError(err?.message ?? 'No se pudo pasar la proforma al POS.');
        } finally {
            setConvirtiendo(false);
        }
    };

    const vaciar = useCallback(() => {
        if (proforma.items.length === 0) return;
        if (!window.confirm('¿Vaciar la proforma de este cliente?')) return;
        limpiar(conversationId);
    }, [proforma.items.length, limpiar, conversationId]);

    const enProforma = useMemo(
        () => new Set(proforma.items.map((i) => i.productId)),
        [proforma.items],
    );

    if (!isOpen) return null;

    return (
        <div
            className={enPanel ? 'flex h-full min-h-0 flex-col' : cn(modal.overlay, 'lg:pointer-events-none lg:justify-end lg:bg-transparent lg:p-0 lg:backdrop-blur-none')}
            onMouseDown={enPanel ? undefined : (e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className={enPanel ? 'flex h-full min-h-0 flex-1 flex-col bg-surface' : cn(modal.panel, modal.width.full, 'lg:pointer-events-auto lg:h-full lg:max-h-full lg:w-[520px] lg:max-w-[520px] lg:rounded-none lg:border-y-0 lg:border-r-0 lg:shadow-2xl')}
                role={enPanel ? 'region' : 'dialog'}
                aria-modal={enPanel ? undefined : true}
                aria-label="Armar proforma"
            >
                <div className={cn(modal.header, enPanel && 'px-4 py-3')}>
                    <div className="min-w-0">
                        <h2 className={cn(modal.title, enPanel && 'truncate')}>
                            {enPanel ? 'Proforma' : `Proforma para ${clienteLabel}`}
                        </h2>
                        {/* En el panel el nombre del cliente ya está arriba del
                            hilo, a dos centímetros: repetirlo gastaría la única
                            línea que hay para decir algo útil. */}
                        <p className={cn(modal.subtitle, enPanel && 'truncate text-xs')}>
                            {enPanel
                                ? 'Se guarda sola mientras chateás.'
                                : 'Agregá los repuestos, ajustá precios y mandala por WhatsApp como imagen.'}
                        </p>
                    </div>
                    <button onClick={onClose} className={modal.close} aria-label="Cerrar">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                <div
                    className={cn(
                        'flex-1 min-h-0 divide-subtle',
                        'flex flex-col divide-y',
                    )}
                >
                    {/* Buscar y agregar */}
                    <div className={cn('flex flex-col min-h-0', enPanel && 'shrink-0')}>
                        <div className={cn('border-b border-subtle', enPanel ? 'px-4 py-2.5' : 'px-5 py-3')}>
                            <div className="relative">
                                <Search size={16} className={input.leadingIcon} aria-hidden="true" />
                                <input
                                    ref={buscadorRef}
                                    value={termino}
                                    onChange={(e) => setTermino(e.target.value)}
                                    placeholder="Buscar repuesto para agregar…"
                                    aria-label="Buscar repuesto"
                                    className={cn(input.base, input.size.md, input.withLeadingIcon)}
                                />
                                {buscando && (
                                    <Loader2
                                        size={16}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-fg-subtle"
                                        aria-hidden="true"
                                    />
                                )}
                            </div>
                        </div>

                        <div
                            className={cn(
                                'overflow-y-auto min-h-0 divide-y divide-subtle',
                                // En el panel la lista de resultados es el desplegable
                                // del buscador, no la mitad de la columna: lo que tiene
                                // que verse siempre es la proforma que se está armando.
                                enPanel ? 'max-h-[34vh]' : 'flex-1',
                            )}
                        >
                            {termino.trim().length < 2 && proforma.items.length === 0 && (
                                <div className="py-14 text-center text-sm text-fg-muted flex flex-col items-center gap-2">
                                    <ShoppingCart size={22} className="text-fg-subtle" aria-hidden="true" />
                                    Buscá el primer repuesto para cotizar.
                                </div>
                            )}
                            {resultados.map((p) => {
                                const stock = stockUtil(p);
                                const puesto = enProforma.has(p.product_id);
                                return (
                                    <div
                                        key={p.product_id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => agregar(conversationId, p)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                agregar(conversationId, p);
                                            }
                                        }}
                                        className={cn(
                                            focusRing,
                                            'w-full cursor-pointer text-left px-4 py-2.5 flex items-center gap-3 hover:bg-surface-hover',
                                        )}
                                    >
                                        <FotoRepuesto
                                            url={p.image_url}
                                            sku={p.sku}
                                            nombre={p.name}
                                            gallery={p.gallery}
                                            className="w-11 h-11 rounded-lg"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium text-fg line-clamp-2 leading-snug">{p.name}</p>
                                            <p className="text-2xs text-fg-subtle truncate">{p.sku}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-semibold text-fg tnum">
                                                {p.price != null ? formatearPrecio(precioParaCliente(p.price)) : '—'}
                                            </p>
                                            <span
                                                className={cn(
                                                    badge.base,
                                                    badge.size.sm,
                                                    stock.local > 0 ? badge.tone.success : stock.hay ? badge.tone.warning : badge.tone.danger,
                                                )}
                                            >
                                                {stock.local > 0 ? `${stock.local}` : stock.hay ? 'pedido' : 'sin stock'}
                                            </span>
                                        </div>
                                        <span className={cn('shrink-0 p-1.5 rounded-lg', puesto ? 'text-success' : 'text-fg-subtle')}>
                                            <Plus size={16} aria-hidden="true" />
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* La proforma */}
                    <div className={cn('flex flex-col min-h-0 bg-surface-2/40', enPanel && 'flex-1')}>
                        <div className="px-4 py-2.5 border-b border-subtle flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-fg">
                                Proforma ({proforma.items.length} {proforma.items.length === 1 ? 'ítem' : 'ítems'})
                            </p>
                            <div className="flex items-center gap-1">
                                {hayItems && (
                                    <button
                                        onClick={() => setVerPrevia((v) => !v)}
                                        className={cn(button.base, button.variant.ghost, button.size.xs)}
                                        title="Ver la hoja tal como la va a recibir el cliente"
                                    >
                                        {verPrevia ? 'Editar' : 'Vista previa'}
                                    </button>
                                )}
                                {hayItems && !verPrevia && (
                                    <button onClick={vaciar} className={cn(button.base, button.variant.ghost, button.size.xs)}>
                                        Vaciar
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* La hoja, encogida para que entre. Es EL MISMO componente
                            que se captura, así que lo que se ve acá es exactamente
                            lo que llega al WhatsApp del cliente. */}
                        {verPrevia && hayItems && (
                            <div ref={contenedorPreviaRef} className="overflow-y-auto flex-1 min-h-0 p-3 bg-surface-3">
                                <div style={{ height: `${alturaHoja * escala}px` }}>
                                    <div style={{ transform: `scale(${escala})`, transformOrigin: 'top left' }}>
                                        <ProformaDocument
                                            proforma={proforma}
                                            stockInfo={stockInfo}
                                            clienteNombre={clienteNombre}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className={cn('overflow-y-auto flex-1 min-h-0 p-3 space-y-2', verPrevia && hayItems && 'hidden')}>
                            {!hayItems && (
                                <p className="text-sm text-fg-muted text-center py-10">
                                    Todavía no agregaste ningún repuesto.
                                </p>
                            )}

                            {proforma.items.map((item) => (
                                <div key={item.id} className="rounded-xl border border-subtle bg-surface p-2.5">
                                    <div className="flex items-start gap-2">
                                        <FotoRepuesto url={item.imageUrl} sku={item.sku} nombre={item.name} className="w-10 h-10 rounded-lg" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium text-fg leading-snug line-clamp-2">{item.name}</p>
                                            <p className="text-2xs text-fg-subtle">{item.sku}</p>
                                        </div>
                                        <button
                                            onClick={() => quitar(conversationId, item.id)}
                                            aria-label={`Quitar ${item.name}`}
                                            className="shrink-0 p-1 rounded text-fg-subtle hover:text-danger hover:bg-danger-soft"
                                        >
                                            <Trash2 size={13} aria-hidden="true" />
                                        </button>
                                    </div>

                                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                                        <div className="flex items-center rounded-lg border border-strong overflow-hidden">
                                            <button
                                                onClick={() => cambiarCantidad(conversationId, item.id, item.quantity - 1)}
                                                aria-label="Quitar una unidad"
                                                className="px-1.5 py-1 text-fg-muted hover:bg-surface-hover"
                                            >
                                                <Minus size={12} aria-hidden="true" />
                                            </button>
                                            <span className="px-2 text-xs font-semibold text-fg tnum">{item.quantity}</span>
                                            <button
                                                onClick={() => cambiarCantidad(conversationId, item.id, item.quantity + 1)}
                                                aria-label="Agregar una unidad"
                                                className="px-1.5 py-1 text-fg-muted hover:bg-surface-hover"
                                            >
                                                <Plus size={12} aria-hidden="true" />
                                            </button>
                                        </div>

                                        <label className="flex items-center gap-1 text-2xs text-fg-muted">
                                            P. unit $
                                            <input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                value={item.unitPrice}
                                                onChange={(e) =>
                                                    cambiarPrecio(conversationId, item.id, Number(e.target.value))
                                                }
                                                aria-label={`Precio unitario de ${item.name}`}
                                                className={cn(input.base, input.size.sm, input.numeric, 'w-20')}
                                            />
                                        </label>

                                        <span className="ml-auto text-sm font-semibold text-fg tnum">
                                            ${(item.quantity * item.unitPrice).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {hayItems && (
                                <div className="rounded-xl border border-subtle bg-surface p-3 space-y-2">
                                    <label className="flex items-center gap-2 text-xs text-fg-muted">
                                        <input
                                            type="checkbox"
                                            className={input.checkbox}
                                            checked={proforma.shippingEnabled}
                                            onChange={(e) => setEnvio(conversationId, e.target.checked)}
                                        />
                                        Cobrar envío
                                        {proforma.shippingEnabled && (
                                            <input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                value={proforma.shippingCost}
                                                onChange={(e) => setEnvio(conversationId, true, Number(e.target.value))}
                                                aria-label="Costo del envío"
                                                className={cn(input.base, input.size.sm, input.numeric, 'w-20 ml-1')}
                                            />
                                        )}
                                    </label>

                                    <textarea
                                        value={proforma.nota}
                                        onChange={(e) => setNota(conversationId, e.target.value)}
                                        rows={2}
                                        placeholder="Nota al pie (garantía, plazo de entrega…)"
                                        aria-label="Nota de la proforma"
                                        className={cn(input.base, 'py-1.5 px-2 text-xs resize-none')}
                                    />

                                    <div className="pt-1 border-t border-subtle space-y-0.5">
                                        <div className="flex justify-between text-xs text-fg-muted">
                                            <span>Subtotal</span>
                                            <span className="tnum">${subtotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-base font-bold text-fg">
                                            <span>Total</span>
                                            <span className="tnum text-success">${total.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* El carrito ya quedó cargado, pero algo no entró como debía.
                    Se muestra antes de ir a la caja, no después de cobrar. */}
                {avisosPos && (
                    <div className="mx-5 mb-3 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5">
                        <p className="text-xs font-semibold text-warning-soft-fg">
                            El carrito se cargó, pero revisá esto antes de cobrar:
                        </p>
                        <ul className="mt-1 space-y-0.5">
                            {avisosPos.map((a) => (
                                <li key={a} className="text-2xs text-warning-soft-fg">
                                    • {a}
                                </li>
                            ))}
                        </ul>
                        <div className="mt-2 flex gap-2">
                            <button
                                onClick={() => navigate('/pos')}
                                className={cn(button.base, button.variant.primary, button.size.xs)}
                            >
                                Ir al POS igual
                            </button>
                            <button
                                onClick={() => setAvisosPos(null)}
                                className={cn(button.base, button.variant.secondary, button.size.xs)}
                            >
                                Quedarme acá
                            </button>
                        </div>
                    </div>
                )}

                <div
                    className={
                        enPanel
                            ? 'shrink-0 flex flex-col gap-2 border-t border-subtle bg-surface-2 px-4 py-3'
                            : modal.footer
                    }
                >
                    {error && <p className={cn('text-xs text-danger', !enPanel && 'mr-auto')}>{error}</p>}
                    {!error && advertencias.length > 0 && (
                        <div role="status" className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-2xs text-warning-soft-fg">
                            <p className="font-semibold">Revisá antes de enviar:</p>
                            <ul className="mt-0.5 list-disc pl-4">{advertencias.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                        </div>
                    )}
                    {!error && hayItems && (
                        <label className={cn('flex items-center gap-1.5 text-xs text-fg-muted', !enPanel && 'mr-auto')}>
                            <input
                                type="checkbox"
                                className={input.checkbox}
                                checked={incluirTexto}
                                onChange={(e) => setIncluirTexto(e.target.checked)}
                            />
                            Incluir el total en texto
                        </label>
                    )}
                    {/* En el panel cerrar es la X de la cabecera: un "Cerrar"
                        pegado a "Enviar", en una columna angosta, es el vecino
                        equivocado del botón que le manda la cotización al
                        cliente. */}
                    {!enPanel && (
                        <button onClick={onClose} className={cn(button.base, button.variant.secondary, button.size.md)}>
                            Cerrar
                        </button>
                    )}
                    {/* El cliente ya aceptó: se pasa al POS a cobrar, sin
                        re-tipear precios ni cantidades. */}
                    <button
                        onClick={pasarAlPos}
                        disabled={!hayItems || convirtiendo || enviando}
                        className={cn(button.base, button.variant.secondary, button.size.md, enPanel && 'order-2 w-full')}
                        title="Cargar estos repuestos en el carrito del POS para cobrar"
                    >
                        {convirtiendo ? (
                            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                        ) : (
                            <Store size={15} aria-hidden="true" />
                        )}
                        Cobrar en el POS
                    </button>
                    <button
                        onClick={enviar}
                        disabled={!hayItems || enviando}
                        className={cn(button.base, button.variant.primary, button.size.md, enPanel && 'order-1 w-full')}
                    >
                        {enviando ? (
                            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                        ) : (
                            <Send size={15} aria-hidden="true" />
                        )}
                        {enviando ? 'Enviando…' : 'Enviar proforma'}
                    </button>
                </div>
            </div>

            {/*
                La hoja real que se captura. Vive FUERA DE PANTALLA porque
                mide 650px fijos -- ese es el tamaño con el que se genera la
                imagen, y encogerla para que entre en el panel cambiaría lo
                que recibe el cliente. `left: -10000px` y no `display:none`
                ni `visibility:hidden`: html2canvas necesita que el nodo esté
                realmente maquetado para poder dibujarlo.
            */}
            <div aria-hidden="true" style={{ position: 'fixed', top: 0, left: -10000, width: PROFORMA_WIDTH }}>
                <ProformaDocument
                    ref={hojaRef}
                    proforma={proforma}
                    stockInfo={stockInfo}
                    clienteNombre={clienteNombre}
                />
            </div>
        </div>
    );
};

export default ProformaBuilder;
