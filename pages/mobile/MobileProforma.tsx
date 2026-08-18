/**
 * MobileProforma.tsx
 * Pantalla de la proforma en el modo móvil.
 *
 * El catálogo móvil ya permitía agregar repuestos a la proforma, pero no había
 * dónde verla: los ítems se acumulaban invisibles. Esta pantalla cierra ese
 * hueco con las mismas operaciones del panel de escritorio
 * (components/ProformaPanel.tsx) —cantidad, precio, envío, imagen para el
 * cliente y conversión a venta— sobre el mismo store, así que una proforma
 * armada en el teléfono se termina en la computadora si hace falta.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProformaStore } from '../../store/useProformaStore';
import { convertProformaToPosCart } from '../../utils/proformaToCart';
import { fetchProformaStockInfo, ProformaStockInfo, STOCK_STATUS_LABELS } from '../../utils/proformaStock';
import { ProformaPreviewModal } from '../../components/ProformaPreviewModal';
import { setPreferredViewMode } from '../../utils/deviceDetection';
import {
    FileText,
    ImageIcon,
    Loader2,
    Pencil,
    ShoppingCart,
    Trash2,
    TriangleAlert,
} from 'lucide-react';

const STOCK_BADGE: Record<string, string> = {
    in_stock: 'bg-emerald-900/30 text-emerald-400',
    backorder: 'bg-amber-900/30 text-amber-400',
    out_of_stock: 'bg-rose-900/30 text-rose-400',
};

/** Un estado que no esté en la tabla dejaba la insignia sin color de fondo ni
 *  de texto: se veía el hueco pero no el dato. */
const stockBadgeClass = (status: string) => STOCK_BADGE[status] || 'bg-slate-800 text-slate-300';

const MobileProforma: React.FC = () => {
    const navigate = useNavigate();

    const items = useProformaStore(s => s.items);
    const shippingEnabled = useProformaStore(s => s.shippingEnabled);
    const shippingCost = useProformaStore(s => s.shippingCost);
    const removeItem = useProformaStore(s => s.removeItem);
    const updateQuantity = useProformaStore(s => s.updateQuantity);
    const updateUnitPrice = useProformaStore(s => s.updateUnitPrice);
    const setShippingEnabled = useProformaStore(s => s.setShippingEnabled);
    const setShippingCost = useProformaStore(s => s.setShippingCost);
    const clear = useProformaStore(s => s.clear);
    const getItemsTotal = useProformaStore(s => s.getItemsTotal);
    const getTotal = useProformaStore(s => s.getTotal);

    const [stockInfo, setStockInfo] = useState<Record<number, ProformaStockInfo>>({});
    const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isConverting, setIsConverting] = useState(false);

    /*
        Avisos de la conversión a venta.

        Eran tres `alert()` nativos, dos de ellos seguidos: en el teléfono tapan
        la pantalla, salen con el estilo del sistema y hay que descartarlos uno a
        uno antes de poder mirar la proforma que describen. Etiquetas ya los
        había eliminado por lo mismo. Aquí el aviso se queda en pantalla, cita
        los SKU y se cierra cuando se ha leído.
    */
    const [conversionNotice, setConversionNotice] = useState<string[] | null>(null);

    // Se depende de la lista de ids serializada, no del array: `items` cambia de
    // identidad con cada edición de cantidad o precio, y eso volvería a pedir el
    // stock en cada toque del contador.
    const productIdsKey = items.map(i => i.productId).join(',');
    useEffect(() => {
        if (!productIdsKey) {
            setStockInfo({});
            return;
        }
        let cancelled = false;
        fetchProformaStockInfo(productIdsKey.split(',').map(Number))
            .then(info => { if (!cancelled) setStockInfo(info); })
            .catch(err => {
                // Sin insignias de stock la proforma se sigue pudiendo armar y
                // enviar; lo que no puede es reventar por ello en silencio.
                console.error('No se pudo consultar el stock de la proforma:', err);
                if (!cancelled) setStockInfo({});
            });
        return () => { cancelled = true; };
    }, [productIdsKey]);

    /*
        El POS sólo existe en la versión de escritorio: ProtectedRoute manda
        cualquier ruta que no sea /mobile de vuelta al modo móvil. Por eso se
        fija la preferencia a escritorio antes de navegar, igual que hace el
        botón «Escritorio» de la cabecera; si no, el usuario terminaría de
        nuevo en el inicio del móvil con el carrito cargado y sin explicación.
    */
    const handleConvertToSale = async () => {
        if (items.length === 0 || isConverting) return;
        setIsConverting(true);
        try {
            const { unresolved, lowStock } = await convertProformaToPosCart(items);

            const avisos: string[] = [];
            if (unresolved.length > 0) {
                avisos.push(`Sin bodega asignada, no se agregaron: ${unresolved.join(', ')}. Configura una bodega por defecto en Editar Producto, o agrégalos a mano en el POS.`);
            }
            if (lowStock.length > 0) {
                avisos.push(`Sin stock suficiente en su bodega: ${lowStock.join(', ')}. Corrígelo desde el carrito del POS antes de cerrar la venta.`);
            }

            /*
                Con avisos no se navega todavía: en el escritorio el mensaje ya
                no estaría, y el usuario llegaría al POS sin saber que faltan
                líneas. Se enseña aquí y se vuelve a pulsar para continuar.
            */
            if (avisos.length > 0 && !conversionNotice) {
                setConversionNotice(avisos);
                return;
            }

            setConversionNotice(null);
            setPreferredViewMode('desktop');
            navigate('/pos');
        } catch (err: any) {
            console.error('Error convirtiendo proforma a venta:', err);
            setConversionNotice([`No se pudo convertir la proforma a venta: ${err?.message || 'error de conexión'}`]);
        } finally {
            setIsConverting(false);
        }
    };

    const itemsTotal = getItemsTotal();
    const total = getTotal();

    return (
        <div className="flex flex-col min-h-full bg-slate-950 pb-mobile-page-bar font-sans">
            {/* Cabecera */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-400 p-4 pt-6 shadow-lg text-slate-950 rounded-b-3xl mb-1 z-20">
                <h1 className="text-2xl font-black flex items-center gap-2 tracking-tight">
                    <FileText size={28} aria-hidden="true" />
                    Proforma
                </h1>
                <p className="text-slate-950/70 text-xs mt-1 font-semibold">
                    {items.length === 0
                        ? 'Agrega repuestos desde el catálogo'
                        : `${items.length} ítem${items.length !== 1 ? 's' : ''} · $${total.toFixed(2)}`}
                </p>
            </div>

            <div className="flex-1 p-4 flex flex-col gap-4">
                {items.length === 0 ? (
                    <div className="text-center py-12 px-4 bg-slate-900 rounded-3xl border-2 border-dashed border-amber-800/40 shadow-xs mt-4">
                        <FileText size={48} className="text-amber-700 mb-2 mx-auto" aria-hidden="true" />
                        <h3 className="font-bold text-sm text-slate-200">La proforma está vacía</h3>
                        <p className="text-xs text-slate-400 mt-1 max-w-[260px] mx-auto leading-relaxed">
                            Busca repuestos en el catálogo y usa «A proforma» en el menú de cada uno.
                            Aquí podrás ajustar cantidades y precios antes de enviarla.
                        </p>
                        <button
                            type="button"
                            onClick={() => navigate('/mobile/catalog')}
                            className="mt-5 px-5 min-h-[48px] rounded-xl bg-amber-500 text-slate-950 font-bold text-sm active:bg-amber-600"
                        >
                            Ir al catálogo
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Ítems */}
                        <div className="flex flex-col gap-2.5">
                            {items.map((item) => {
                                const info = stockInfo[item.productId];
                                return (
                                    <div
                                        key={item.id}
                                        className="bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-800 flex flex-col gap-3"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 text-xs font-mono font-extrabold rounded-lg border border-amber-500/20">
                                                        {item.sku}
                                                    </span>
                                                    {info && (
                                                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-lg ${stockBadgeClass(info.status)}`}>
                                                            {info.status === 'in_stock'
                                                                ? `Stock: ${info.totalStock}`
                                                                : STOCK_STATUS_LABELS[info.status]}
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="font-bold text-white text-xs leading-snug">{item.name}</h3>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeItem(item.id)}
                                                className="active:scale-90 min-w-[44px] min-h-[44px] flex items-center justify-center bg-rose-900/20 active:bg-rose-900/40 text-rose-400 rounded-xl transition-all shrink-0 border border-rose-800/50"
                                                aria-label={`Quitar ${item.sku} de la proforma`}
                                            >
                                                <Trash2 size={18} aria-hidden="true" />
                                            </button>
                                        </div>

                                        {/* Precio unitario: se toca para editarlo */}
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-bold text-slate-400">Precio c/u</span>
                                            {editingPriceId === item.id ? (
                                                <input
                                                    type="number"
                                                    inputMode="decimal"
                                                    step="0.01"
                                                    min="0"
                                                    autoFocus
                                                    defaultValue={item.unitPrice}
                                                    onBlur={(e) => {
                                                        updateUnitPrice(item.id, parseFloat(e.target.value) || 0);
                                                        setEditingPriceId(null);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            updateUnitPrice(item.id, parseFloat((e.target as HTMLInputElement).value) || 0);
                                                            setEditingPriceId(null);
                                                        }
                                                        if (e.key === 'Escape') setEditingPriceId(null);
                                                    }}
                                                    className="w-28 h-12 px-3 text-right bg-slate-800 border-2 border-amber-500 rounded-xl text-white font-bold text-base"
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingPriceId(item.id)}
                                                    className="inline-flex items-center gap-1.5 h-12 px-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-base active:bg-slate-700"
                                                >
                                                    ${item.unitPrice.toFixed(2)}
                                                    <Pencil size={13} className="opacity-60" aria-hidden="true" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Cantidad y subtotal de la línea */}
                                        <div className="flex items-center justify-between gap-2 bg-amber-900/10 p-2 px-3 rounded-xl border border-amber-800/40">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                    disabled={item.quantity <= 1}
                                                    className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xl font-bold active:bg-slate-700 disabled:opacity-40"
                                                    aria-label="Quitar una unidad"
                                                >
                                                    −
                                                </button>
                                                <input
                                                    type="number"
                                                    inputMode="numeric"
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                                                    className="w-16 h-11 text-center bg-slate-900 border border-amber-700/60 rounded-xl text-amber-300 font-black text-base"
                                                    aria-label="Cantidad"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                    className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xl font-bold active:bg-slate-700"
                                                    aria-label="Agregar una unidad"
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <span className="text-sm font-black text-white tabular-nums">
                                                ${(item.quantity * item.unitPrice).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Envío */}
                        <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 flex flex-col gap-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={shippingEnabled}
                                    onChange={(e) => setShippingEnabled(e.target.checked)}
                                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-0"
                                />
                                <span className="text-sm font-bold text-slate-300">Incluir costo de envío</span>
                            </label>
                            {shippingEnabled && (
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-base">$</span>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        step="0.01"
                                        min="0"
                                        value={shippingCost}
                                        onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="w-full h-12 pl-7 pr-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-base"
                                        aria-label="Costo de envío"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Resumen */}
                        <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                                <span>Subtotal</span>
                                <span className="tabular-nums">${itemsTotal.toFixed(2)}</span>
                            </div>
                            {shippingEnabled && (
                                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                                    <span>Envío</span>
                                    <span className="tabular-nums">${shippingCost.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-800">
                                <span className="text-sm font-black text-slate-200 uppercase tracking-wide">Total</span>
                                <span className="text-xl font-black text-amber-400 tabular-nums">${total.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Vaciar */}
                        <div className="flex justify-center">
                            {!showClearConfirm ? (
                                <button
                                    type="button"
                                    onClick={() => setShowClearConfirm(true)}
                                    className="text-xs font-bold text-rose-400 active:text-rose-300 flex items-center gap-1.5 min-h-[44px] px-4"
                                >
                                    <Trash2 size={15} aria-hidden="true" />
                                    Vaciar proforma
                                </button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-rose-400 font-bold">¿Seguro?</span>
                                    <button
                                        type="button"
                                        onClick={() => { clear(); setShowClearConfirm(false); }}
                                        className="text-xs font-extrabold text-white bg-rose-500 px-4 min-h-[44px] rounded-xl active:scale-95"
                                    >
                                        Sí, vaciar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowClearConfirm(false)}
                                        className="text-xs font-extrabold text-slate-300 bg-slate-800 px-4 min-h-[44px] rounded-xl active:scale-95"
                                    >
                                        No
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {conversionNotice && (
                <div
                    role="alert"
                    className="fixed bottom-above-bar-2 left-2 right-2 z-40 animate-slide-up"
                >
                    <div className="max-w-md mx-auto bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl p-3 px-4 flex gap-3">
                        <TriangleAlert size={20} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="flex-1 min-w-0 flex flex-col gap-2">
                            {conversionNotice.map((aviso, i) => (
                                <p key={i} className="text-xs font-semibold text-slate-200 leading-snug">{aviso}</p>
                            ))}
                            <button
                                type="button"
                                onClick={() => setConversionNotice(null)}
                                className="self-start min-h-[44px] px-3 -my-1 rounded-xl text-xs font-bold text-slate-400 active:text-white"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Barra flotante de acciones */}
            {items.length > 0 && (
                <div className="fixed bottom-above-nav left-2 right-2 z-40">
                    <div className="max-w-md mx-auto bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-800 p-3 px-4 flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={() => setIsPreviewOpen(true)}
                            className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 active:from-amber-600 active:to-amber-500 text-slate-950 rounded-xl font-extrabold text-sm shadow-lg shadow-amber-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                            <ImageIcon size={18} aria-hidden="true" />
                            Generar imagen (${total.toFixed(2)})
                        </button>
                        <button
                            type="button"
                            onClick={handleConvertToSale}
                            disabled={isConverting}
                            className="w-full py-2.5 bg-slate-800 active:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs border border-slate-700 flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                            {isConverting
                                ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                                : <ShoppingCart size={16} aria-hidden="true" />}
                            {isConverting
                                ? 'Convirtiendo...'
                                : conversionNotice
                                    ? 'Continuar de todos modos'
                                    : 'Convertir a venta (abre escritorio)'}
                        </button>
                    </div>
                </div>
            )}

            <ProformaPreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                stockInfo={stockInfo}
            />
        </div>
    );
};

export default MobileProforma;
