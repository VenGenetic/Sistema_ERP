import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { getThumbnailUrl } from '../../utils/image';
import { useMobileProducts, searchProducts } from '../../utils/mobileSearchEngine';
import MobileSearchBar from '../../components/mobile/MobileSearchBar';
import { MediaLightbox, type MediaItem } from '../../components/MediaLightbox';
import { AlertCircle, CheckCircle2, ImageOff, MapPin, Minus, Package, Plus, SearchX, Undo2, WifiOff } from 'lucide-react';

const LAST_WAREHOUSE_KEY = 'mobile:lastWarehouseId';

/**
 * Saltos de cantidad por toque.
 *
 * Estaban fijos en el código, pero cambian según el trabajo del día: recibir
 * una caja de 24 no se cuenta igual que reponer de a una. Se guardan.
 */
const STEP_PRESETS_KEY = 'mobile:inventoryStepPresets';
const DEFAULT_STEP_PRESETS = [1, 5, 10];

const readStepPresets = (): number[] => {
    try {
        const saved = JSON.parse(localStorage.getItem(STEP_PRESETS_KEY) || 'null');
        if (Array.isArray(saved) && saved.length === 3 && saved.every(n => Number.isInteger(n) && n > 0)) {
            return saved;
        }
    } catch { /* valor corrupto: se usa el de siempre */ }
    return DEFAULT_STEP_PRESETS;
};

const MobileInventory: React.FC = () => {
    const { products: allProducts, loading: catalogLoading, refresh: refreshCatalog } = useMobileProducts();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    /** La foto del repuesto a pantalla completa: en 144px no se distingue un retén de otro. */
    const [foto, setFoto] = useState<MediaItem[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
    const [processing, setProcessing] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    // Unidades que mueve cada pulsación. Recibir 20 piezas eran 20 toques.
    const [step, setStep] = useState(1);
    const [stepPresets, setStepPresets] = useState<number[]>(readStepPresets);

    /** Mantener pulsada una ficha la reprograma con el salto que haya en el campo. */
    const rememberPreset = (index: number) => {
        setStepPresets(prev => {
            const next = prev.map((v, i) => (i === index ? step : v));
            try { localStorage.setItem(STEP_PRESETS_KEY, JSON.stringify(next)); } catch { /* modo privado */ }
            return next;
        });
        if (navigator.vibrate) navigator.vibrate(20);
    };

    /*
        Almacenes.

        El `error` de la consulta se descartaba y tampoco se contemplaba que la
        lista viniera vacía. Sin `selectedWarehouseId`, `handleMovement` hace
        `return` en su primera línea: el toque en «+» se perdía sin mensaje, sin
        vibración y sin nada que explicara por qué. Es el fallo más difícil de
        diagnosticar desde la bodega, así que ahora se dice y se puede reintentar.
    */
    const [warehouseError, setWarehouseError] = useState<string | null>(null);
    const [loadingWarehouses, setLoadingWarehouses] = useState(true);

    const fetchWarehouses = useCallback(async () => {
        setLoadingWarehouses(true);
        setWarehouseError(null);
        const { data, error } = await supabase.from('warehouses').select('*').order('id');
        setLoadingWarehouses(false);

        if (error) {
            setWarehouseError(`No se pudieron cargar los almacenes: ${error.message}`);
            return;
        }
        if (!data || data.length === 0) {
            setWarehouseError('No hay ningún almacén configurado. Créalo desde el escritorio antes de ajustar stock.');
            return;
        }

        setWarehouses(data);
        // Se recuerda el último almacén: en bodega siempre se trabaja en el mismo
        // y volver a elegirlo en cada repuesto era trabajo repetido.
        const remembered = localStorage.getItem(LAST_WAREHOUSE_KEY);
        const isValid = remembered && data.some(w => w.id.toString() === remembered);
        setSelectedWarehouseId(isValid ? remembered! : data[0].id.toString());
    }, []);

    useEffect(() => { fetchWarehouses(); }, [fetchWarehouses]);

    const handleWarehouseChange = (id: string) => {
        setSelectedWarehouseId(id);
        localStorage.setItem(LAST_WAREHOUSE_KEY, id);
    };

    // Búsqueda inteligente
    const matchedProducts = useMemo(() => {
        if (!searchTerm || searchTerm.trim().length < 2) return [];
        return searchProducts(allProducts, searchTerm.trim(), 2).slice(0, 10);
    }, [allProducts, searchTerm]);

    // Selección automática si hay coincidencia exacta de código, o solo 1 resultado por escaneo
    useEffect(() => {
        if (!searchTerm || searchTerm.trim().length < 2) {
            setSelectedProduct(null);
            return;
        }
        if (matchedProducts.length === 1) {
            setSelectedProduct(matchedProducts[0]);
        } else {
            // Si el SKU coincide exactamente con el texto
            const exact = matchedProducts.find(p => p.sku?.toUpperCase() === searchTerm.trim().toUpperCase());
            if (exact) {
                setSelectedProduct(exact);
            } else if (!selectedProduct || !matchedProducts.some(p => p.id === selectedProduct.id)) {
                setSelectedProduct(null);
            }
        }
    }, [matchedProducts, searchTerm]);

    // Los avisos se retiran solos. El error antes se quedaba pegado hasta cambiar de
    // producto, porque solo el mensaje de éxito tenía temporizador.
    useEffect(() => {
        if (!message) return;
        const timer = setTimeout(() => {
            setMessage(null);
            setLastMovement(null);
        }, message.type === 'success' ? 6000 : 4000);
        return () => clearTimeout(timer);
    }, [message]);

    /*
        Cerrojo por referencia, no por estado.

        `processing` sólo desactiva los botones en el render SIGUIENTE, así que
        dos toques rápidos sobre «+» (fácil con guantes o el teléfono en la mano
        en bodega) entraban los dos y movían el doble de stock. El ref se cierra
        de inmediato, en el mismo tick del primer toque.
    */
    const movementLock = useRef(false);

    /*
        Último movimiento, para poder deshacerlo.

        Un toque de más con salto 10 son diez unidades mal contadas, y hasta
        ahora corregirlo obligaba a ir a la computadora. El aviso de éxito ya
        está en pantalla y ya se conoce el `qtyChange` aplicado: revertirlo es
        el mismo RPC con el signo cambiado.
    */
    const [lastMovement, setLastMovement] = useState<{ productId: string; warehouseId: string; change: number } | null>(null);

    /*
        Refresco del catálogo, agrupado.

        El catálogo lee la misma caché de useMobileProducts, así que sin
        refrescarla Catálogo y Etiquetas seguían enseñando el stock viejo hasta
        que caducara: dos pantallas del mismo teléfono dando cifras distintas del
        mismo repuesto.

        Pero `refresh` se trae el catálogo entero del servidor, y recibir una
        caja son veinte toques seguidos: hacerlo por toque serían veinte
        descargas completas desde la bodega. Se agrupa y se lanza una sola vez,
        cuando la mano para. El número que se está mirando ya está actualizado en
        el acto por la actualización optimista de arriba.
    */
    const catalogRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const scheduleCatalogRefresh = useCallback(() => {
        if (catalogRefreshTimer.current) clearTimeout(catalogRefreshTimer.current);
        catalogRefreshTimer.current = setTimeout(() => { refreshCatalog(); }, 2500);
    }, [refreshCatalog]);

    // Al salir de la pantalla se refresca ya: el usuario va camino del catálogo.
    useEffect(() => () => {
        if (catalogRefreshTimer.current) {
            clearTimeout(catalogRefreshTimer.current);
            refreshCatalog();
        }
    }, [refreshCatalog]);

    /** Aplica el RPC y actualiza el producto en pantalla. Compartido por el
     *  ajuste normal y por «Deshacer», que es el mismo movimiento al revés. */
    const applyMovement = async (productId: string, warehouseId: string, qtyChange: number) => {
        const { error } = await supabase.rpc('process_inventory_movement', {
            p_product_id: parseInt(productId),
            p_warehouse_id: parseInt(warehouseId),
            p_quantity_change: qtyChange,
            p_reason: 'Ajuste Móvil',
            p_reference_type: 'manual_adjustment',
            p_reference_id: null
        });
        if (error) throw error;

        // Optimistic update.
        // Cada nivel se reemplaza por un objeto nuevo: los productos vienen de la caché
        // compartida de useMobileProducts, así que mutarlos en sitio corrompía el stock
        // que ve el catálogo sin que nada lo volviera a refrescar.
        setSelectedProduct((prev: any) => {
            if (!prev || String(prev.id) !== String(productId)) return prev;
            const wId = parseInt(warehouseId);
            const levels = (prev.inventory_levels || []).map((l: any) =>
                l.warehouse_id === wId
                    ? { ...l, current_stock: (l.current_stock || 0) + qtyChange }
                    : l
            );
            if (!levels.some((l: any) => l.warehouse_id === wId)) {
                levels.push({ warehouse_id: wId, current_stock: qtyChange > 0 ? qtyChange : 0 });
            }
            return { ...prev, inventory_levels: levels };
        });

        scheduleCatalogRefresh();
    };

    const handleUndo = async () => {
        if (!lastMovement || movementLock.current) return;
        movementLock.current = true;
        setProcessing(true);
        const undone = lastMovement;
        setLastMovement(null);
        try {
            await applyMovement(undone.productId, undone.warehouseId, -undone.change);
            if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
            setMessage({ type: 'success', text: `Movimiento deshecho (${-undone.change > 0 ? '+' : ''}${-undone.change})` });
        } catch (err: any) {
            console.error(err);
            setLastMovement(undone);
            setMessage({ type: 'error', text: `No se pudo deshacer: ${err?.message || 'error de conexión'}` });
        } finally {
            movementLock.current = false;
            setProcessing(false);
        }
    };

    const handleMovement = async (type: 'IN' | 'OUT') => {
        if (!selectedProduct || !selectedWarehouseId) return;
        if (movementLock.current) return;
        movementLock.current = true;

        setProcessing(true);
        setMessage(null);
        try {
            // Nunca se saca más de lo que hay: con salto 10 y 3 en almacén, salen 3.
            const amount = type === 'IN' ? step : Math.min(step, currentStockInSelectedWarehouse);
            if (amount <= 0) {
                setMessage({ type: 'error', text: 'No hay stock que sacar en este almacén' });
                return;
            }
            // Se avisa del recorte: pediste 10 y sólo había 3. Antes el ajuste
            // salía en silencio y parecía que el botón se había comido el toque.
            const trimmed = type === 'OUT' && amount < step;
            const qtyChange = type === 'IN' ? amount : -amount;

            await applyMovement(String(selectedProduct.id), selectedWarehouseId, qtyChange);
            setLastMovement({ productId: String(selectedProduct.id), warehouseId: selectedWarehouseId, change: qtyChange });

            if (navigator.vibrate) {
                navigator.vibrate(type === 'IN' ? 50 : [50, 50, 50]);
            }

            setMessage({
                type: 'success',
                text: trimmed
                    ? `Solo había ${amount}: se sacaron todas (${qtyChange})`
                    : `Stock actualizado (${qtyChange > 0 ? '+' : ''}${qtyChange})`,
            });
        } catch (err: any) {
            console.error(err);
            // El motivo real importa: "sin permisos" y "sin conexión" se
            // arreglan de formas muy distintas, y antes los dos decían lo mismo.
            setMessage({ type: 'error', text: `No se pudo actualizar el stock: ${err?.message || 'error de conexión'}` });
        } finally {
            movementLock.current = false;
            setProcessing(false);
        }
    };

    const currentStockInSelectedWarehouse = selectedProduct?.inventory_levels?.find((l: any) => l.warehouse_id === parseInt(selectedWarehouseId))?.current_stock || 0;
    const globalStock = selectedProduct?.inventory_levels?.reduce((acc: number, level: any) => acc + (level.current_stock || 0), 0) || 0;
    const imageUrl = selectedProduct?.image_url ? getThumbnailUrl(selectedProduct.image_url, 300) : null;

    return (
        <div className="flex flex-col min-h-full bg-slate-950 animate-fade-in pb-mobile-page font-sans">
            {/* Header */}
            <div className="bg-slate-900 border-b border-slate-800 rounded-b-[36px] px-6 pt-8 pb-6 shadow-lg shadow-black/20 mb-3 text-white relative overflow-hidden z-20">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl"></div>
                <h1 className="text-3xl font-extrabold mb-1 relative z-10 flex items-center gap-2">
                    <Package size={30} className="text-cyan-400" aria-hidden="true" />
                    Inventario Móvil
                </h1>
                <p className="text-slate-400 text-xs font-semibold relative z-10">Ajuste rápido en almacén. Escanea código o busca repuesto.</p>
            </div>

            {/* Content */}
            <div className="flex-1 px-4 flex flex-col gap-4">
                
                {/* Search Input Inteligente */}
                <div className="relative z-30">
                    <MobileSearchBar
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        products={allProducts}
                        placeholder="Escanea SKU o busca por descripción..."
                        onClear={() => setSelectedProduct(null)}
                        autoFocus={true}
                    />
                </div>

                {warehouseError && (
                    <div role="alert" className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/40 text-rose-200 flex items-start gap-3">
                        <WifiOff size={20} className="shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm leading-snug">{warehouseError}</p>
                            <button
                                type="button"
                                onClick={fetchWarehouses}
                                disabled={loadingWarehouses}
                                className="mt-2 min-h-[44px] px-4 rounded-xl bg-rose-500 text-white font-bold text-sm active:bg-rose-600 disabled:opacity-60"
                            >
                                {loadingWarehouses ? 'Reintentando…' : 'Reintentar'}
                            </button>
                        </div>
                    </div>
                )}

                {catalogLoading && allProducts.length === 0 && (
                    <div className="flex flex-col items-center justify-center mt-10 gap-3 text-slate-400">
                        <div className="w-9 h-9 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-extrabold uppercase tracking-wider animate-pulse">Cargando catálogo inteligente...</span>
                    </div>
                )}

                {/* Messages */}
                {message && (
                    <div role="status" aria-live="polite" className={`p-3 pl-4 rounded-2xl flex items-center gap-2 font-bold animate-fade-in shadow-sm ${
                        message.type === 'success' 
                            ? 'bg-emerald-500 text-white border border-emerald-400'
                            : 'bg-rose-500 text-white border border-rose-400'
                    }`}>
                        {message.type === 'success'
                            ? <CheckCircle2 size={20} aria-hidden="true" />
                            : <AlertCircle size={20} aria-hidden="true" />}
                        <span className="flex-1">{message.text}</span>
                        {message.type === 'success' && lastMovement && (
                            <button
                                type="button"
                                onClick={handleUndo}
                                disabled={processing}
                                className="shrink-0 min-h-[44px] px-3 rounded-xl bg-white/20 active:bg-white/30 text-white font-extrabold text-sm flex items-center gap-1.5 disabled:opacity-50"
                            >
                                <Undo2 size={16} aria-hidden="true" />
                                Deshacer
                            </button>
                        )}
                    </div>
                )}

                {/* Si hay múltiples resultados y ninguno está seleccionado aún */}
                {!selectedProduct && matchedProducts.length > 1 && (
                    <div className="animate-fade-in flex flex-col gap-2.5 my-2">
                        <span className="text-xs font-black text-slate-500 uppercase tracking-wider px-1">
                            {matchedProducts.length} coincidencias · Selecciona para ajustar:
                        </span>
                        {matchedProducts.map((prod) => {
                            const totStock = prod.inventory_levels?.reduce((acc: number, l: any) => acc + (l.current_stock || 0), 0) || 0;
                            return (
                                /* Botón, no un <div onClick>: así responde al
                                   teclado del lector de código y lo anuncia el
                                   lector de pantalla. `w-full text-left` para
                                   que se siga viendo igual que antes. */
                                <button
                                    key={prod.id}
                                    type="button"
                                    onClick={() => setSelectedProduct(prod)}
                                    className="w-full text-left bg-slate-900 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3.5 shadow-xs active:scale-95 active:border-cyan-500/50 transition-all"
                                >
                                    {prod.image_url ? (
                                        <img src={getThumbnailUrl(prod.image_url, 150)} alt={prod.name} loading="lazy" className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0" />
                                    ) : (
                                        <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                                            <ImageOff size={20} aria-hidden="true" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <span className="text-xs font-mono font-extrabold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                                            {prod.sku}
                                        </span>
                                        <h4 className="font-bold text-slate-100 text-sm truncate mt-1">{prod.name}</h4>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                        <span className="text-xs text-slate-500 font-bold uppercase">Stock</span>
                                        <span className={`text-sm font-black px-2 py-0.5 rounded-lg ${totStock > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                            {totStock}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Si no hay resultados */}
                {searchTerm.trim().length >= 2 && matchedProducts.length === 0 && !catalogLoading && (
                    <div className="text-center py-12 px-6 text-slate-400 bg-slate-900 rounded-3xl border border-slate-800 my-4 shadow-sm">
                        <SearchX size={48} className="opacity-40 mb-2 mx-auto" aria-hidden="true" />
                        <p className="font-bold text-sm text-slate-200">Producto no encontrado</p>
                        <p className="text-xs text-slate-400 mt-1 max-w-[240px] mx-auto">Verifica las palabras clave o el código SKU. El buscador inteligente busca por doble filtro.</p>
                    </div>
                )}

                {/* Product Card & Controls */}
                {selectedProduct && (
                    <div className="flex flex-col gap-4 animate-fade-in">
                        {/*
                            Almacén, como fichas y no como <select>.

                            El desplegable nativo abre la rueda del sistema: tres
                            gestos para elegir entre pocas opciones, y sin ver cuál
                            está activa hasta abrirlo. El emoji 📍 que lo acompañaba
                            está prohibido en MASTER.md — cada sistema lo dibuja
                            distinto y no combina con lucide-react.
                        */}
                        <div className="bg-slate-900 rounded-2xl p-3 border border-slate-800 shadow-xs flex flex-col gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Almacén</span>
                            <div className="flex flex-wrap gap-2">
                                {warehouses.map(w => {
                                    const active = selectedWarehouseId === w.id.toString();
                                    return (
                                        <button
                                            key={w.id}
                                            type="button"
                                            onClick={() => handleWarehouseChange(w.id.toString())}
                                            aria-pressed={active}
                                            className={`min-h-[44px] px-3 rounded-xl text-sm font-bold border transition-colors flex items-center gap-1.5 ${
                                                active
                                                    ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                                                    : 'bg-slate-800 border-slate-700 text-slate-300 active:bg-slate-700'
                                            }`}
                                        >
                                            <MapPin size={14} aria-hidden="true" />
                                            {w.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Card */}
                        <div className="bg-slate-900 rounded-3xl p-5 shadow-lg border border-slate-800 flex flex-col items-center relative overflow-hidden">
                            {/* Stock Badge */}
                            <div className="absolute top-4 right-4 flex flex-col items-end">
                                <span className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-0.5">Stock Global</span>
                                <div className={`px-3 py-1 rounded-xl font-extrabold text-sm ${
                                    globalStock > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                }`}>
                                    {globalStock}
                                </div>
                            </div>

                            {imageUrl ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setFoto([
                                            {
                                                type: 'image',
                                                url: selectedProduct.image_url || imageUrl,
                                                title: `${selectedProduct.sku} - ${selectedProduct.name}`,
                                            },
                                        ])
                                    }
                                    aria-label="Ver la foto en grande"
                                    className="w-36 h-36 rounded-2xl bg-slate-800/60 mb-4 p-2 border border-slate-700 flex items-center justify-center shadow-inner active:scale-95 transition-transform"
                                >
                                    <img src={imageUrl} alt={selectedProduct.name} className="w-full h-full object-contain" />
                                </button>
                            ) : (
                                <div className="w-36 h-36 rounded-2xl bg-slate-800/60 mb-4 p-2 border border-slate-700 flex items-center justify-center shadow-inner">
                                    <ImageOff size={48} className="text-slate-600" aria-hidden="true" />
                                </div>
                            )}

                            <span className="text-sm font-mono font-extrabold text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-xl mb-1.5 border border-cyan-500/20">
                                {selectedProduct.sku}
                            </span>
                            <h2 className="text-lg font-black text-white text-center leading-tight">
                                {selectedProduct.name}
                            </h2>

                            {/* Salto de cantidad */}
                            <div className="w-full mt-5 flex flex-col items-center gap-2">
                                <span className="text-xs text-slate-500 font-extrabold uppercase tracking-widest">Por toque</span>
                                <div className="flex items-center justify-center gap-2">
                                    {stepPresets.map((preset, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setStep(preset)}
                                            onContextMenu={(e) => { e.preventDefault(); rememberPreset(i); }}
                                            aria-pressed={step === preset}
                                            className={`min-w-[44px] min-h-[44px] px-3 rounded-xl text-base font-black border transition-colors ${
                                                step === preset
                                                    ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                                                    : 'bg-slate-800 border-slate-700 text-slate-300 active:bg-slate-700'
                                            }`}
                                        >
                                            {preset}
                                        </button>
                                    ))}
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min={1}
                                        value={step}
                                        onChange={(e) => setStep(Math.max(1, parseInt(e.target.value) || 1))}
                                        aria-label="Cantidad personalizada por toque"
                                        className="w-20 min-h-[44px] px-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-center text-base font-black outline-none focus:border-cyan-500"
                                    />
                                </div>
                                <span className="text-xs text-slate-600">Mantén pulsada una ficha para guardar el salto del campo</span>
                            </div>

                            {/* Stock Controls */}
                            <div className="w-full mt-3 bg-slate-950/60 p-4 rounded-3xl flex items-center justify-between border border-slate-800 shadow-inner">
                                <button
                                    type="button"
                                    onClick={() => handleMovement('OUT')}
                                    disabled={processing || currentStockInSelectedWarehouse <= 0}
                                    className="w-16 h-16 rounded-2xl bg-slate-800 shadow-md border border-rose-500/30 flex items-center justify-center text-rose-400 active:scale-90 transition-transform disabled:opacity-30 disabled:active:scale-100"
                                    aria-label={`Sacar ${step} del almacén`}
                                >
                                    <Minus size={36} strokeWidth={3} aria-hidden="true" />
                                </button>

                                <div className="flex flex-col items-center">
                                    <span className="text-xs text-slate-500 font-extrabold uppercase tracking-widest">En almacén</span>
                                    <span className="text-4xl font-black text-white my-0.5">
                                        {currentStockInSelectedWarehouse}
                                    </span>
                                    <span className={`text-xs font-bold ${currentStockInSelectedWarehouse > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        {currentStockInSelectedWarehouse > 0 ? 'Listo para ajustar' : 'Sin existencias aquí'}
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleMovement('IN')}
                                    disabled={processing}
                                    className="w-16 h-16 rounded-2xl bg-cyan-500 active:bg-cyan-400 shadow-lg shadow-cyan-500/30 flex items-center justify-center text-slate-950 active:scale-90 transition-transform disabled:opacity-50 disabled:active:scale-100"
                                    aria-label={`Ingresar ${step} al almacén`}
                                >
                                    <Plus size={36} strokeWidth={3} aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <MediaLightbox isOpen={foto.length > 0} media={foto} onClose={() => setFoto([])} />
        </div>
    );
};

export default MobileInventory;
