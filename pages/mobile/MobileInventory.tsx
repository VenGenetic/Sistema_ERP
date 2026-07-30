import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { getThumbnailUrl } from '../../utils/image';
import { useMobileProducts, searchProducts } from '../../utils/mobileSearchEngine';
import MobileSearchBar from '../../components/mobile/MobileSearchBar';

const MobileInventory: React.FC = () => {
    const { products: allProducts, loading: catalogLoading } = useMobileProducts();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
    const [processing, setProcessing] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Fetch Warehouses
    useEffect(() => {
        const fetchWarehouses = async () => {
            const { data } = await supabase.from('warehouses').select('*').order('id');
            if (data && data.length > 0) {
                setWarehouses(data);
                setSelectedWarehouseId(data[0].id.toString());
            }
        };
        fetchWarehouses();
    }, []);

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

    const handleMovement = async (type: 'IN' | 'OUT') => {
        if (!selectedProduct || !selectedWarehouseId) return;

        setProcessing(true);
        setMessage(null);
        try {
            const qtyChange = type === 'IN' ? 1 : -1;
            const { error } = await supabase.rpc('process_inventory_movement', {
                p_product_id: parseInt(selectedProduct.id),
                p_warehouse_id: parseInt(selectedWarehouseId),
                p_quantity_change: qtyChange,
                p_reason: 'Ajuste Móvil',
                p_reference_type: 'manual_adjustment',
                p_reference_id: null
            });

            if (error) throw error;

            // Optimistic update
            setSelectedProduct((prev: any) => {
                if (!prev) return prev;
                const levels = [...(prev.inventory_levels || [])];
                const wId = parseInt(selectedWarehouseId);
                const idx = levels.findIndex(l => l.warehouse_id === wId);
                if (idx >= 0) {
                    levels[idx].current_stock += qtyChange;
                } else {
                    levels.push({ warehouse_id: wId, current_stock: qtyChange > 0 ? qtyChange : 0 });
                }
                return { ...prev, inventory_levels: levels };
            });

            if (navigator.vibrate) {
                navigator.vibrate(type === 'IN' ? 50 : [50, 50, 50]);
            }

            setMessage({ type: 'success', text: `Stock actualizado (${type === 'IN' ? '+1' : '-1'})` });
            setTimeout(() => setMessage(null), 2000);
        } catch (err: any) {
            console.error(err);
            setMessage({ type: 'error', text: 'Error al actualizar stock' });
        } finally {
            setProcessing(false);
        }
    };

    const currentStockInSelectedWarehouse = selectedProduct?.inventory_levels?.find((l: any) => l.warehouse_id === parseInt(selectedWarehouseId))?.current_stock || 0;
    const globalStock = selectedProduct?.inventory_levels?.reduce((acc: number, level: any) => acc + (level.current_stock || 0), 0) || 0;
    const imageUrl = selectedProduct?.image_url ? getThumbnailUrl(selectedProduct.image_url, 300) : null;

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900 animate-fade-in pb-28 font-sans">
            {/* Header */}
            <div className="bg-gradient-to-br from-blue-700 to-indigo-600 rounded-b-[36px] px-6 pt-8 pb-6 shadow-lg shadow-blue-600/20 mb-3 text-white relative overflow-hidden z-20">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                <h1 className="text-3xl font-extrabold mb-1 relative z-10 flex items-center gap-2">
                    <span className="material-symbols-outlined text-3xl">inventory_2</span>
                    Inventario Móvil
                </h1>
                <p className="text-blue-100 text-xs font-semibold relative z-10">Ajuste rápido en almacén. Escanea código o busca repuesto.</p>
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

                {catalogLoading && allProducts.length === 0 && (
                    <div className="flex flex-col items-center justify-center mt-10 gap-3 text-slate-400">
                        <div className="w-9 h-9 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-extrabold uppercase tracking-wider animate-pulse">Cargando catálogo inteligente...</span>
                    </div>
                )}

                {/* Messages */}
                {message && (
                    <div className={`p-4 rounded-2xl flex items-center justify-center gap-2 font-bold animate-fade-in shadow-sm ${
                        message.type === 'success' 
                            ? 'bg-emerald-500 text-white border border-emerald-400'
                            : 'bg-rose-500 text-white border border-rose-400'
                    }`}>
                        <span className="material-symbols-outlined">
                            {message.type === 'success' ? 'check_circle' : 'error'}
                        </span>
                        {message.text}
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
                                <div
                                    key={prod.id}
                                    onClick={() => setSelectedProduct(prod)}
                                    className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-750 flex items-center gap-3.5 shadow-xs cursor-pointer active:scale-95 transition-all hover:border-blue-500"
                                >
                                    {prod.image_url ? (
                                        <img src={getThumbnailUrl(prod.image_url, 150)} alt={prod.name} loading="lazy" className="w-12 h-12 rounded-xl object-cover border border-slate-100 dark:border-slate-700 shrink-0" />
                                    ) : (
                                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700/60 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                                            <span className="material-symbols-outlined text-xl">image</span>
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <span className="text-xs font-mono font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800/60">
                                            {prod.sku}
                                        </span>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate mt-1">{prod.name}</h4>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">Stock</span>
                                        <span className={`text-sm font-black px-2 py-0.5 rounded-lg ${totStock > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}>
                                            {totStock}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Si no hay resultados */}
                {searchTerm.trim().length >= 2 && matchedProducts.length === 0 && !catalogLoading && (
                    <div className="text-center py-12 px-6 text-slate-400 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-750 my-4 shadow-sm">
                        <span className="material-symbols-outlined text-5xl opacity-40 mb-2">search_off</span>
                        <p className="font-bold text-sm text-slate-700 dark:text-slate-200">Producto no encontrado</p>
                        <p className="text-xs text-slate-400 mt-1 max-w-[240px] mx-auto">Verifica las palabras clave o el código SKU. El buscador inteligente busca por doble filtro.</p>
                    </div>
                )}

                {/* Product Card & Controls */}
                {selectedProduct && (
                    <div className="flex flex-col gap-4 animate-fade-in">
                        {/* Almacén Selector */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-2 px-3 border border-slate-200 dark:border-slate-750 shadow-xs flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Almacén:</span>
                            <select
                                className="w-full bg-transparent p-1.5 text-slate-800 dark:text-slate-100 font-extrabold outline-none focus:ring-0 border-none text-right cursor-pointer"
                                value={selectedWarehouseId}
                                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                            >
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">
                                        📍 {w.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Card */}
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-lg border border-slate-200/80 dark:border-slate-750 flex flex-col items-center relative overflow-hidden">
                            {/* Stock Badge */}
                            <div className="absolute top-4 right-4 flex flex-col items-end">
                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Stock Global</span>
                                <div className={`px-3 py-1 rounded-xl font-extrabold text-sm ${
                                    globalStock > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                                }`}>
                                    {globalStock}
                                </div>
                            </div>

                            <div className="w-36 h-36 rounded-2xl bg-slate-50 dark:bg-slate-700/50 mb-4 p-2 border border-slate-100 dark:border-slate-700 flex items-center justify-center shadow-inner">
                                {imageUrl ? (
                                    <img src={imageUrl} alt={selectedProduct.name} className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal" />
                                ) : (
                                    <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-500">image</span>
                                )}
                            </div>
                            
                            <span className="text-sm font-mono font-extrabold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-xl mb-1.5 border border-blue-200/60 dark:border-blue-800/60">
                                {selectedProduct.sku}
                            </span>
                            <h2 className="text-lg font-black text-slate-900 dark:text-white text-center leading-tight">
                                {selectedProduct.name}
                            </h2>

                            {/* Stock Controls */}
                            <div className="w-full mt-6 bg-slate-50 dark:bg-slate-900/80 p-4 rounded-3xl flex items-center justify-between border border-slate-200/60 dark:border-slate-800 shadow-inner">
                                <button 
                                    type="button"
                                    onClick={() => handleMovement('OUT')}
                                    disabled={processing || currentStockInSelectedWarehouse <= 0}
                                    className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 shadow-md border border-rose-200 dark:border-rose-900 flex items-center justify-center text-rose-600 dark:text-rose-400 active:scale-90 transition-transform disabled:opacity-30 disabled:active:scale-100"
                                >
                                    <span className="material-symbols-outlined text-4xl font-extrabold">remove</span>
                                </button>

                                <div className="flex flex-col items-center">
                                    <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-widest">En almacén</span>
                                    <span className="text-4xl font-black text-slate-900 dark:text-white my-0.5">
                                        {currentStockInSelectedWarehouse}
                                    </span>
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Listo para ajustar</span>
                                </div>

                                <button 
                                    type="button"
                                    onClick={() => handleMovement('IN')}
                                    disabled={processing}
                                    className="w-16 h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 shadow-lg shadow-blue-600/30 flex items-center justify-center text-white active:scale-90 transition-transform disabled:opacity-50 disabled:active:scale-100"
                                >
                                    <span className="material-symbols-outlined text-4xl font-black">add</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.25s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default MobileInventory;
