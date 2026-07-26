import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { getThumbnailUrl } from '../../utils/image';
import { printLabelsQuick, addToPrintHistory, getPrintHistory, PrintHistoryItem } from '../../utils/mobileLabelPrinter';
import { useMobileProducts, searchProducts } from '../../utils/mobileSearchEngine';
import MobileSearchBar from '../../components/mobile/MobileSearchBar';

const MobileLabels: React.FC = () => {
    const { products: allProducts, loading: catalogLoading } = useMobileProducts();
    const [searchTerm, setSearchTerm] = useState('');
    const [printHistory, setPrintHistory] = useState<PrintHistoryItem[]>([]);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [customQtyMap, setCustomQtyMap] = useState<Record<string, number>>({});
    const [reprintLoading, setReprintLoading] = useState(false);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = () => {
        setPrintHistory(getPrintHistory());
    };

    // Búsqueda inteligente con doble filtro, sinónimos y tolerancia a errores
    const matchedProducts = useMemo(() => {
        if (!searchTerm || searchTerm.trim().length < 2) return [];
        return searchProducts(allProducts, searchTerm.trim(), 2).slice(0, 15);
    }, [allProducts, searchTerm]);

    const handleClear = () => {
        setSearchTerm('');
    };

    const handlePrint = async (prod: any, qty: number) => {
        try {
            await printLabelsQuick(prod, qty);
            addToPrintHistory(prod, qty);
            loadHistory();
            
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }

            setSuccessMessage(`✓ ${qty} etiquetas de ${prod.sku} descargadas`);
            
            setTimeout(() => {
                setSuccessMessage(null);
                handleClear();
            }, 1500);
        } catch (err) {
            console.error('Error printing:', err);
            alert('Error al imprimir etiquetas');
        }
    };

    const handleReprint = async (historyItem: PrintHistoryItem) => {
        setReprintLoading(true);
        try {
            // Buscar en caché primero
            let prod = allProducts.find(p => p.id === historyItem.id || p.sku === historyItem.sku);
            if (!prod) {
                const { data } = await supabase
                    .from('products')
                    .select('*, inventory_levels(*)')
                    .eq('id', historyItem.id)
                    .eq('is_active', true)
                    .limit(1);
                if (data && data.length > 0) prod = data[0];
            }
                
            if (prod) {
                handlePrint(prod, historyItem.quantity || 3);
            } else {
                alert('Producto no encontrado');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setReprintLoading(false);
        }
    };

    const timeAgo = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return `Hace ${seconds} seg`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `Hace ${minutes} min`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `Hace ${hours} h`;
        return `Hace ${Math.floor(hours / 24)} d`;
    };

    const getStock = (prod: any) => {
        if (!prod || !prod.inventory_levels || prod.inventory_levels.length === 0) return 0;
        return prod.inventory_levels.reduce((acc: number, curr: any) => acc + (curr.current_stock || 0), 0);
    };

    const getCustomQty = (id: string) => customQtyMap[id] || 3;
    const setProductCustomQty = (id: string, val: number) => {
        setCustomQtyMap(prev => ({ ...prev, [id]: Math.max(3, val) }));
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-slate-900 pb-28 font-sans">
            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes slide-down { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.25s ease-out forwards; }
                .animate-slide-down { animation: slide-down 0.25s ease-out forwards; }
            `}</style>
            
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 pt-6 shadow-lg text-white rounded-b-3xl mb-1 z-20">
                <h1 className="text-2xl font-black flex items-center gap-2 tracking-tight">
                    <span className="material-symbols-outlined text-[28px]">print</span>
                    Impresión Rápida
                </h1>
                <p className="text-emerald-100 text-xs mt-1 font-medium">
                    Búsqueda inteligente con doble filtro y sinónimos. Escanea o busca descripción.
                </p>
            </div>

            <div className="flex-1 p-4 flex flex-col gap-4">
                {/* Barra de Búsqueda Inteligente */}
                <div className="relative z-30">
                    <MobileSearchBar
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        products={allProducts}
                        placeholder="Escanea o escribe (ej: pastilla freno del)..."
                        onClear={handleClear}
                        autoFocus={true}
                    />
                </div>

                {/* Toast de Éxito */}
                {successMessage && (
                    <div className="animate-slide-down bg-emerald-500 text-white px-4 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 z-40 border border-emerald-400">
                        <span className="material-symbols-outlined text-[24px]">check_circle</span>
                        <span className="font-bold text-sm">{successMessage}</span>
                    </div>
                )}

                {/* Loading Estado Inicial Catalogo */}
                {(catalogLoading || reprintLoading) && allProducts.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-400">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-500 border-t-transparent"></div>
                        <span className="text-xs font-semibold uppercase tracking-wider animate-pulse">Cargando catálogo inteligente...</span>
                    </div>
                )}

                {/* Sin Resultados */}
                {searchTerm.trim().length >= 2 && matchedProducts.length === 0 && !catalogLoading && (
                    <div className="animate-fade-in bg-white dark:bg-slate-800 rounded-3xl p-8 text-center border border-slate-200 dark:border-slate-750 my-2 shadow-sm">
                        <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-2">search_off</span>
                        <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">No se encontró repuesto</h3>
                        <p className="text-xs text-slate-400 mt-1 max-w-[240px] mx-auto">
                            Verifica si el nombre o código está bien escrito, o intenta con palabras clave más cortas.
                        </p>
                    </div>
                )}

                {/* Lista de Resultados de Búsqueda */}
                {matchedProducts.length > 0 && (
                    <div className="animate-fade-in flex flex-col gap-4 my-1">
                        <div className="flex items-center justify-between px-1 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            <span>{matchedProducts.length} repuesto(s) encontrado(s)</span>
                            <span className="text-emerald-600 dark:text-emerald-400">Listo para imprimir</span>
                        </div>

                        {matchedProducts.map((prod) => {
                            const stock = getStock(prod);
                            const currentQty = getCustomQty(String(prod.id));

                            return (
                                <div key={prod.id} className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-md border border-slate-200/80 dark:border-slate-750 flex flex-col gap-3 transition-all">
                                    {/* Cabecera del Producto */}
                                    <div className="flex gap-3.5 items-center">
                                        {prod.image_url ? (
                                            <img
                                                src={getThumbnailUrl(prod.image_url, 200)}
                                                alt={prod.name}
                                                className="w-18 h-18 w-[72px] h-[72px] object-cover rounded-2xl border border-slate-100 dark:border-slate-700 shrink-0 shadow-sm"
                                            />
                                        ) : (
                                            <div className="w-[72px] h-[72px] bg-slate-100 dark:bg-slate-700/60 rounded-2xl flex items-center justify-center text-slate-400 shrink-0">
                                                <span className="material-symbols-outlined text-3xl">image</span>
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-mono font-extrabold rounded-lg border border-blue-200 dark:border-blue-800/60">
                                                    {prod.sku}
                                                </span>
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                                                    stock > 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                                                }`}>
                                                    Stock: {stock}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-snug line-clamp-2">
                                                {prod.name}
                                            </h3>
                                            {prod.brands?.name && (
                                                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                                                    {prod.brands.name}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Botones Rápidos 3, 6, 21 */}
                                    <div className="grid grid-cols-3 gap-2.5 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => handlePrint(prod, 3)}
                                            className="active:scale-95 transition-all bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/25 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-2xl flex flex-col items-center justify-center py-3 gap-0.5 border border-blue-200 dark:border-blue-800 shadow-xs"
                                        >
                                            <span className="material-symbols-outlined text-xl">print</span>
                                            <span className="font-black text-base">3</span>
                                            <span className="text-[9px] uppercase tracking-tighter opacity-75">etiquetas</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handlePrint(prod, 6)}
                                            className="active:scale-95 transition-all bg-violet-50 hover:bg-violet-100 dark:bg-violet-900/25 dark:hover:bg-violet-900/40 text-violet-700 dark:text-violet-300 rounded-2xl flex flex-col items-center justify-center py-3 gap-0.5 border border-violet-200 dark:border-violet-800 shadow-xs"
                                        >
                                            <span className="material-symbols-outlined text-xl">print</span>
                                            <span className="font-black text-base">6</span>
                                            <span className="text-[9px] uppercase tracking-tighter opacity-75">etiquetas</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handlePrint(prod, 21)}
                                            className="active:scale-95 transition-all bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/25 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-2xl flex flex-col items-center justify-center py-3 gap-0.5 border border-emerald-200 dark:border-emerald-800 shadow-xs"
                                        >
                                            <span className="material-symbols-outlined text-xl">print</span>
                                            <span className="font-black text-base">21</span>
                                            <span className="text-[9px] uppercase tracking-tighter opacity-75">hoja A4</span>
                                        </button>
                                    </div>

                                    {/* Fila Cantidad Personalizada */}
                                    <div className="bg-slate-50 dark:bg-slate-900/80 p-2 px-3 rounded-2xl border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3 mt-0.5">
                                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Otro número:</span>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-inner h-9">
                                                <button 
                                                    type="button"
                                                    className="px-2.5 h-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 font-bold"
                                                    onClick={() => setProductCustomQty(String(prod.id), currentQty - 3)}
                                                >
                                                    -
                                                </button>
                                                <input 
                                                    type="number"
                                                    min="3"
                                                    step="3"
                                                    value={currentQty}
                                                    onChange={(e) => setProductCustomQty(String(prod.id), parseInt(e.target.value) || 3)}
                                                    className="w-12 text-center bg-transparent border-none focus:ring-0 text-slate-800 dark:text-white font-bold text-sm p-0"
                                                />
                                                <button 
                                                    type="button"
                                                    className="px-2.5 h-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 font-bold"
                                                    onClick={() => setProductCustomQty(String(prod.id), currentQty + 3)}
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handlePrint(prod, currentQty)}
                                                className="active:scale-95 transition-transform bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-white text-white dark:text-slate-900 px-4 h-9 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm"
                                            >
                                                <span>Imprimir</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Historial de Impresiones Recientes */}
                {(!searchTerm || matchedProducts.length === 0) && (
                    <div className="mt-4 animate-fade-in z-10">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-400">history</span>
                                Impresiones Recientes
                            </h2>
                            {printHistory.length > 0 && (
                                <span className="text-[11px] font-semibold text-slate-400">Toca 🖨️ para reimprimir</span>
                            )}
                        </div>
                        
                        {printHistory.length === 0 ? (
                            <div className="text-center py-8 px-4 text-slate-400 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-750 shadow-xs">
                                <span className="material-symbols-outlined text-4xl opacity-30 mb-1">print_disabled</span>
                                <p className="font-semibold text-sm">No hay impresiones recientes</p>
                                <p className="text-xs text-slate-400 mt-0.5">Cuando imprimas etiquetas, aparecerán aquí para fácil acceso.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2.5">
                                {printHistory.map((item, index) => (
                                    <div key={`${item.id}-${index}`} className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-750 flex items-center gap-3 transition-colors hover:border-emerald-500/50">
                                        {item.image_url ? (
                                            <img
                                                src={getThumbnailUrl(item.image_url, 200)}
                                                alt={item.name}
                                                className="w-12 h-12 object-cover rounded-xl border border-slate-100 dark:border-slate-700 shrink-0"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                                                <span className="material-symbols-outlined text-xl">image</span>
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono font-extrabold text-slate-600 dark:text-slate-300 truncate">
                                                    {item.sku}
                                                </span>
                                                <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap ml-auto">
                                                    {timeAgo(item.printedAt)}
                                                </span>
                                            </div>
                                            <p className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate mt-0.5">
                                                {item.name}
                                            </p>
                                            <span className="inline-block text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md mt-1">
                                                {item.quantity} etiquetas
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleReprint(item)}
                                            className="active:scale-90 p-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-2xl transition-all shrink-0 border border-emerald-200/60 dark:border-emerald-800"
                                            title={`Reimprimir ${item.quantity} etiquetas`}
                                        >
                                            <span className="material-symbols-outlined text-xl">print</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MobileLabels;
