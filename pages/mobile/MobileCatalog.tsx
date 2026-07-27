import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { getThumbnailUrl } from '../../utils/image';
import { isProductDiscontinued } from '../../utils/discontinuedHelper';
import { useMobileProducts, searchProducts } from '../../utils/mobileSearchEngine';
import MobileSearchBar from '../../components/mobile/MobileSearchBar';

// Modals
import { ProductModal } from '../../components/ProductModal';
import { ProductGroupModal } from '../../components/ProductGroupModal';
import { MediaLightbox } from '../../components/MediaLightbox';
import { QuickTagAssignModal } from '../../components/QuickTagAssignModal';
import { ProductLabelModal } from '../../components/ProductLabelModal';

import { printLabelsQuick, addToPrintHistory } from '../../utils/mobileLabelPrinter';
import { addToQueue } from '../../utils/mobilePrintQueue';

const MobileCatalog: React.FC = () => {
    // ──────────────────────────────────────────────
    // 1. DATA HOOK (Con Caché Inteligente)
    // ──────────────────────────────────────────────
    const { products: allProducts, loading: catalogLoading, refresh: refreshCatalog } = useMobileProducts();
    const [page, setPage] = useState(1);
    const observer = useRef<IntersectionObserver | null>(null);
    const pageSize = 20;

    // Search & Filters
    const [searchTerms, setSearchTerms] = useState<string[]>(['']);
    const [filters, setFilters] = useState<{ [key: string]: string }>({});
    
    // UI States
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [copiedSku, setCopiedSku] = useState<string | null>(null);
    const [printToast, setPrintToast] = useState<string | null>(null);
    const [expandedCardId, setExpandedCardId] = useState<number | null>(null);

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<any>(null);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [groupModalProduct, setGroupModalProduct] = useState<any>(null);
    const [lightbox, setLightbox] = useState<{ isOpen: boolean, media: any[], initialIndex: number, product?: any }>({ isOpen: false, media: [], initialIndex: 0 });
    const [selectedProductForTags, setSelectedProductForTags] = useState<any | null>(null);
    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
    const [labelProduct, setLabelProduct] = useState<any>(null);

    // Queue bottom-sheet
    const [queueSheetProduct, setQueueSheetProduct] = useState<any>(null);
    const [queueSheetQty, setQueueSheetQty] = useState(1);

    // ──────────────────────────────────────────────
    // 2. FILTRADO Y BÚSQUEDA INTELIGENTE
    // ──────────────────────────────────────────────
    const updateSearchTerm = (value: string) => {
        setSearchTerms([value]);
    };

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const filteredAllProducts = useMemo(() => {
        let list = allProducts;

        // Aplicar motor inteligente (doble filtro, sinónimos, tolerancia al error)
        const term = searchTerms[0] ? searchTerms[0].trim() : '';
        if (term) {
            list = searchProducts(list, term, 2);
        }

        // Filtros de Columnas
        if (filters.imageStatus === 'con_imagen') list = list.filter(p => !!p.image_url);
        else if (filters.imageStatus === 'sin_imagen') list = list.filter(p => !p.image_url);

        if (filters.videoStatus === 'con_video') {
            list = list.filter(p => Array.isArray(p.gallery) && p.gallery.some((g: any) => g.type === 'video'));
        } else if (filters.videoStatus === 'sin_video') {
            list = list.filter(p => !p.gallery || !Array.isArray(p.gallery) || !p.gallery.some((g: any) => g.type === 'video'));
        }

        if (filters.stockStatus) {
            list = list.filter(p => {
                const lStock = parseInt(p.local_stock || 0);
                const iStock = parseInt(p.importer_stock || 0);
                const gStock = p.inventory_levels?.reduce((acc: number, l: any) => acc + (l.current_stock || 0), 0) || 0;
                if (filters.stockStatus === 'disponibles_importadora') return iStock > 0;
                if (filters.stockStatus === 'solo_local') return (lStock > 0 || gStock > 0) && iStock <= 0;
                if (filters.stockStatus === 'disponibles_local') return lStock > 0 || gStock > 0;
                if (filters.stockStatus === 'solo_importadora') return iStock > 0 && lStock <= 0 && gStock <= 0;
                if (filters.stockStatus === 'disponibles_cualquiera') return lStock > 0 || iStock > 0 || gStock > 0;
                if (filters.stockStatus === 'agotados') return lStock <= 0 && iStock <= 0 && gStock <= 0;
                return true;
            });
        }

        if (filters.discontinuedStatus === 'descontinuados') list = list.filter(p => p.is_discontinued === true);
        else if (filters.discontinuedStatus === 'activos') list = list.filter(p => !p.is_discontinued);

        return list;
    }, [allProducts, searchTerms, filters]);

    const visibleProducts = useMemo(() => {
        return filteredAllProducts.slice(0, page * pageSize);
    }, [filteredAllProducts, page, pageSize]);

    const hasMore = visibleProducts.length < filteredAllProducts.length;

    // Resetear página si cambian filtros
    useEffect(() => {
        setPage(1);
    }, [searchTerms, filters]);

    const groupCounts = useMemo(() => {
        const counts: { [key: string]: number } = {};
        allProducts.forEach(p => {
            if (p.group_id) {
                counts[p.group_id] = (counts[p.group_id] || 0) + 1;
            }
        });
        return counts;
    }, [allProducts]);

    const handleRefresh = async () => {
        setPage(1);
        await refreshCatalog();
    };

    const lastElementRef = useCallback((node: HTMLDivElement | null) => {
        if (catalogLoading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prev => prev + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [catalogLoading, hasMore]);

    // ──────────────────────────────────────────────
    // 3. ACCIONES Y MÉTODOS
    // ──────────────────────────────────────────────
    const handleCopySku = (sku: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(sku).then(() => {
            if (navigator.vibrate) navigator.vibrate(50);
            setCopiedSku(sku);
            setTimeout(() => setCopiedSku(null), 2000);
        });
    };

    const handleOpenLightbox = (prod: any, clickedType: 'video' | 'image' | 'gallery', index = 0) => {
        const mediaArray: any[] = [];
        if (prod.image_url) mediaArray.push({ type: 'image', url: prod.image_url, title: prod.sku + ' - ' + prod.name });
        if (prod.gallery && Array.isArray(prod.gallery)) {
            prod.gallery.forEach((item: any) => {
                mediaArray.push({ type: item.type, url: item.url, title: prod.sku + ' - ' + prod.name });
            });
        }
        setLightbox({ isOpen: true, media: mediaArray, initialIndex: index, product: prod });
    };

    const handleDeleteProduct = async (product: any) => {
        const globalStock = product.inventory_levels?.reduce((acc: number, level: any) => acc + (level.current_stock || 0), 0) || 0;
        if (globalStock > 0) {
            alert(`No se puede eliminar "${product.name}" porque tiene stock (${globalStock} unidades). Vacía el inventario primero.`);
            return;
        }
        if (!window.confirm(`¿Eliminar permanentemente "${product.sku}"? Esta acción no se puede deshacer.`)) return;

        try {
            const { data, error } = await supabase.from('products').delete().eq('id', product.id).select();
            if (error) {
                if (error.code === '23503') {
                    if (window.confirm("Tiene historial. ¿Ocultarlo definitivamente?")) {
                        await supabase.from('products').update({ is_active: false }).eq('id', product.id);
                        alert("Ocultado correctamente.");
                    }
                } else throw error;
            } else if (!data || data.length === 0) {
                throw new Error("Sin permisos para eliminar.");
            } else {
                alert("Eliminado permanentemente.");
            }
            handleRefresh();
        } catch (error: any) {
            alert('Error: ' + error.message);
        }
    };

    const toggleSelectRow = async (id: number) => {
        if (navigator.vibrate) navigator.vibrate(30);
        const targetProd = allProducts.find(p => p.id === id);
        if (!targetProd) return;

        if (!targetProd.group_id) {
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
            });
            return;
        }

        const willBeSelected = !selectedIds.has(id);
        setSelectedIds(prev => {
            const next = new Set(prev);
            allProducts.forEach(p => {
                if (p.group_id === targetProd.group_id) {
                    willBeSelected ? next.add(p.id) : next.delete(p.id);
                }
            });
            return next;
        });
    };

    const handleQuickPrint = (prod: any, e: React.MouseEvent) => {
        e.stopPropagation();
        printLabelsQuick({ sku: prod.sku, name: prod.name }, 3);
        addToPrintHistory({ id: prod.id, sku: prod.sku, name: prod.name, image_url: prod.image_url }, 3);
        setPrintToast(`✓ 3 etiquetas de ${prod.sku}`);
        setTimeout(() => setPrintToast(null), 2000);
    };

    const handleBulkPrint = () => {
        const selectedProds = allProducts.filter(p => selectedIds.has(p.id));
        selectedProds.forEach(prod => {
            printLabelsQuick({ sku: prod.sku, name: prod.name }, 3);
            addToPrintHistory({ id: prod.id, sku: prod.sku, name: prod.name, image_url: prod.image_url }, 3);
        });
        setPrintToast(`✓ Etiquetas de ${selectedProds.length} productos`);
        setTimeout(() => setPrintToast(null), 2000);
        setSelectedIds(new Set());
    };

    const activeFilterCount = Object.values(filters).filter(Boolean).length;

    const handleOpenQueueSheet = (prod: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setQueueSheetProduct(prod);
        setQueueSheetQty(1);
    };

    const handleAddToQueueConfirm = () => {
        if (!queueSheetProduct) return;
        addToQueue(
            { id: queueSheetProduct.id, sku: queueSheetProduct.sku, name: queueSheetProduct.name, image_url: queueSheetProduct.image_url },
            queueSheetQty
        );
        if (navigator.vibrate) navigator.vibrate(50);
        setPrintToast(`✓ ${queueSheetQty} etiqueta(s) de ${queueSheetProduct.sku} agregadas a la cola`);
        setTimeout(() => setPrintToast(null), 2200);
        setQueueSheetProduct(null);
    };

    // ──────────────────────────────────────────────
    // 4. RENDER
    // ──────────────────────────────────────────────
    return (
        <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900 animate-fade-in relative font-sans">
            <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes slide-down { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes shimmer { 100% { transform: translateX(100%); } }
                .animate-fade-in { animation: fade-in 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
                .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.2) forwards; }
                .animate-slide-down { animation: slide-down 0.3s ease-out forwards; }
            `}</style>
            
            {/* --- PRINT TOAST --- */}
            {printToast && (
                <div className="fixed top-14 left-4 right-4 z-50 bg-emerald-500 text-white py-3 px-4 rounded-2xl shadow-xl flex items-center gap-2 font-bold animate-slide-down border border-emerald-400">
                    <span className="material-symbols-outlined">check_circle</span>
                    {printToast}
                </div>
            )}

            {/* --- HEADER STICKY --- */}
            <div className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 px-4 py-4 shadow-xs">
                <div className="flex justify-between items-center mb-3">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Catálogo Móvil</h1>
                        <p className="text-[11px] text-slate-400 font-semibold">{filteredAllProducts.length} de {allProducts.length} repuestos activos</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            className="p-2.5 h-11 w-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center"
                            title="Actualizar catálogo"
                        >
                            <span className={`material-symbols-outlined text-[22px] ${catalogLoading ? 'animate-spin text-blue-500' : ''}`}>sync</span>
                        </button>
                        <button 
                            onClick={() => setIsFiltersOpen(true)}
                            className="relative p-2.5 h-11 w-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-[24px]">tune</span>
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-[20px] px-1 bg-blue-600 text-white text-[10px] font-extrabold rounded-full border-2 border-white dark:border-slate-900">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
                
                {/* Search Bar Inteligente */}
                <div className="relative z-50">
                    <MobileSearchBar
                        searchTerm={searchTerms[0] || ''}
                        setSearchTerm={updateSearchTerm}
                        products={allProducts}
                        placeholder="Buscar por código, descripción, marca..."
                    />
                </div>
            </div>

            {/* --- PRODUCT LIST --- */}
            <div className="flex-1 p-4 pb-36 overflow-y-auto">
                {visibleProducts.length === 0 && !catalogLoading && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white dark:bg-slate-800/60 rounded-3xl border border-slate-200 dark:border-slate-750 my-4 shadow-sm">
                        <span className="material-symbols-outlined text-[56px] mb-2 text-slate-300 dark:text-slate-600">search_off</span>
                        <p className="font-bold text-slate-700 dark:text-slate-200">No se encontraron productos</p>
                        <p className="text-xs mt-1 max-w-[220px] text-center text-slate-400">
                            El buscador usa doble filtro y sinónimos. Verifica que todas las palabras clave existan.
                        </p>
                    </div>
                )}

                <div className="flex flex-col gap-3.5">
                    {visibleProducts.map((prod, index) => {
                        const globalStock = prod.inventory_levels?.reduce((acc: number, level: any) => acc + (level.current_stock || 0), 0) || 0;
                        const imageUrl = prod.image_url ? getThumbnailUrl(prod.image_url, 300) : null;
                        const isSelected = selectedIds.has(prod.id);
                        const isExpanded = expandedCardId === prod.id;
                        
                        return (
                            <div 
                                key={prod.id}
                                ref={index === visibleProducts.length - 1 ? lastElementRef : null}
                                className={`bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-sm border transition-all ${
                                    isSelected ? 'border-blue-500 shadow-lg shadow-blue-500/10 bg-blue-50/5 dark:bg-blue-900/10' : 'border-slate-200/80 dark:border-slate-750'
                                }`}
                            >
                                {/* Collapsed state */}
                                <div className="p-3.5 flex items-center gap-3.5 cursor-pointer" onClick={() => setExpandedCardId(isExpanded ? null : prod.id)}>
                                    <div 
                                        onClick={(e) => { e.stopPropagation(); toggleSelectRow(prod.id); }}
                                        className={`w-6 h-6 shrink-0 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                                            isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
                                        }`}
                                    >
                                        {isSelected && <span className="material-symbols-outlined text-white text-[16px] font-black">check</span>}
                                    </div>

                                    <div 
                                        onClick={(e) => { e.stopPropagation(); handleOpenLightbox(prod, 'image'); }}
                                        className="w-16 h-16 shrink-0 rounded-2xl bg-slate-100 dark:bg-slate-700/50 relative overflow-hidden flex items-center justify-center border border-slate-200/80 dark:border-slate-700 shadow-inner"
                                    >
                                        {imageUrl ? (
                                            <img src={imageUrl} alt={prod.name} className="w-full h-full object-cover" loading="lazy" />
                                        ) : (
                                            <span className="material-symbols-outlined text-slate-300 dark:text-slate-500 text-2xl">image</span>
                                        )}
                                        {globalStock <= 0 && (
                                            <div className="absolute inset-0 bg-rose-500/20 backdrop-blur-[1px] flex items-center justify-center">
                                                <span className="bg-rose-600 text-white text-[8px] uppercase font-extrabold tracking-wider px-1.5 py-0.5 rounded-full shadow-sm">Agotado</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-mono font-extrabold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-lg border border-blue-200/60 dark:border-blue-800/60 shrink-0">
                                                {prod.sku}
                                            </span>
                                            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/80 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0">
                                                <span className="material-symbols-outlined text-[13px] text-emerald-500">inventory_2</span> {globalStock}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-snug line-clamp-2">
                                            {prod.name}
                                        </h3>
                                        {prod.brands?.name && (
                                            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                                                {prod.brands.name}
                                            </p>
                                        )}
                                    </div>

                                    <button 
                                        onClick={(e) => handleQuickPrint(prod, e)} 
                                        className="shrink-0 w-11 h-11 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center active:scale-90 transition-all border border-emerald-200/50 dark:border-emerald-800/50"
                                        title="Imprimir 3 etiquetas"
                                    >
                                        <span className="material-symbols-outlined text-[22px]">print</span>
                                    </button>
                                </div>

                                {/* Expanded area */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/50 animate-fade-in">
                                        <div className="p-4">
                                            <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight mb-2">
                                                {prod.name}
                                            </h3>
                                            <div className="flex items-center gap-2 mb-3">
                                                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                                                    Marca: {prod.brands?.name || 'Sin marca'}
                                                </p>
                                                <button onClick={(e) => handleCopySku(prod.sku, e)} className="p-1 px-2 bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg active:bg-slate-300 transition-colors flex items-center gap-1 text-xs font-semibold">
                                                    <span className="material-symbols-outlined text-[14px]">{copiedSku === prod.sku ? 'check' : 'content_copy'}</span>
                                                    {copiedSku === prod.sku ? 'Copiado' : 'Copiar SKU'}
                                                </button>
                                            </div>

                                            {/* Tags block */}
                                            <div className="flex flex-wrap gap-1.5 mb-3">
                                                {isProductDiscontinued(prod) && (
                                                    <span className="px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-extrabold flex items-center gap-1 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-400">
                                                        <span className="material-symbols-outlined text-xs">warning</span> Descontinuado
                                                    </span>
                                                )}
                                                {prod.group_id && (
                                                    <span className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold flex items-center gap-1 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400">
                                                        <span className="material-symbols-outlined text-xs">link</span> Grupo
                                                    </span>
                                                )}
                                                {prod.product_tags?.map((pt: any) => {
                                                    if (!pt.tags) return null;
                                                    return (
                                                        <span key={pt.tags.id} onClick={(e) => { e.stopPropagation(); setSelectedProductForTags(prod); }} className="px-2 py-0.5 text-xs font-extrabold rounded-lg cursor-pointer" style={{ backgroundColor: pt.tags.color + '20', color: pt.tags.color, border: `1px solid ${pt.tags.color}50` }}>
                                                            {pt.tags.name}
                                                        </span>
                                                    );
                                                })}
                                                <button onClick={(e) => { e.stopPropagation(); setSelectedProductForTags(prod); }} className="px-2 py-0.5 rounded-lg bg-slate-200/60 border border-dashed border-slate-400 text-slate-600 text-xs font-bold flex items-center gap-0.5 active:bg-slate-300 dark:bg-slate-700 dark:border-slate-500 dark:text-slate-300">
                                                    <span className="material-symbols-outlined text-xs">add</span> Tag
                                                </button>
                                            </div>

                                            {/* Stock info */}
                                            <div className="flex items-center gap-4 mb-3 bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs uppercase font-extrabold text-slate-400">Stock Local:</span>
                                                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">{prod.local_stock || 0}</span>
                                                </div>
                                                <div className="h-4 w-px bg-slate-200 dark:bg-slate-800"></div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs uppercase font-extrabold text-slate-400">Importadora:</span>
                                                    <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${prod.importer_stock > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'text-slate-400'}`}>
                                                        {prod.importer_stock || 0}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {/* Price PVP */}
                                            <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-100 text-white dark:text-slate-900 rounded-2xl p-3 px-4 shadow-sm flex justify-between items-center">
                                                <span className="font-extrabold text-xs uppercase tracking-wider opacity-80">Precio PVP:</span>
                                                <span className="font-black text-lg">
                                                    ${(prod.price || 0).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="border-t border-slate-200/70 dark:border-slate-700/60 flex divide-x divide-slate-200/70 dark:divide-slate-700/60 bg-white dark:bg-slate-800 rounded-b-3xl">
                                            <button onClick={(e) => { e.stopPropagation(); setGroupModalProduct(prod); setSelectedGroupId(prod.group_id); setIsGroupModalOpen(true); }} className="flex-1 py-3.5 flex items-center justify-center text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 active:bg-blue-100 transition-colors" title="Relacionados">
                                                <span className="material-symbols-outlined text-[22px]">link</span>
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); setProductToEdit(prod); setIsModalOpen(true); }} className="flex-1 py-3.5 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 active:bg-slate-100 transition-colors" title="Editar">
                                                <span className="material-symbols-outlined text-[22px]">edit</span>
                                            </button>
                                            <button onClick={(e) => handleOpenQueueSheet(prod, e)} className="flex-1 py-3.5 flex items-center justify-center text-amber-600 dark:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 active:bg-amber-100 transition-colors" title="Agregar a cola de impresión">
                                                <span className="material-symbols-outlined text-[22px]">playlist_add</span>
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); setLabelProduct(prod); setIsLabelModalOpen(true); }} className="flex-1 py-3.5 flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 active:bg-indigo-100 transition-colors" title="Ajuste Avanzado de Etiqueta">
                                                <span className="material-symbols-outlined text-[22px]">barcode_scanner</span>
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteProduct(prod); }} className="flex-1 py-3.5 flex items-center justify-center text-rose-600 dark:text-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-900/10 active:bg-rose-100 transition-colors" title="Eliminar">
                                                <span className="material-symbols-outlined text-[22px]">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Loading Skeletons */}
                {catalogLoading && allProducts.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent"></div>
                        <span className="text-xs font-extrabold uppercase tracking-widest animate-pulse">Cargando base de datos móvil...</span>
                    </div>
                )}
            </div>

            {/* --- BOTTOM SHEET FILTERS --- */}
            {isFiltersOpen && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs animate-fade-in" onClick={() => setIsFiltersOpen(false)}></div>
                    <div className="relative bg-white dark:bg-slate-900 rounded-t-[36px] p-6 pt-2 pb-10 shadow-2xl animate-slide-up border-t border-slate-200 dark:border-slate-800 max-h-[88vh] overflow-y-auto">
                        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-6 mt-3"></div>
                        
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-600">tune</span> Filtros Avanzados
                            </h2>
                            <button onClick={() => setFilters({})} className="text-sm font-extrabold text-blue-600 active:opacity-70">
                                Limpiar todo
                            </button>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">📸 Estado de Imagen</label>
                                <div className="relative">
                                    <select value={filters.imageStatus || ''} onChange={(e) => handleFilterChange('imageStatus', e.target.value)} className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200/80 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-200 appearance-none focus:border-blue-500 outline-none">
                                        <option value="">Todas las Imágenes</option>
                                        <option value="con_imagen">✅ Mostrar Con Imagen</option>
                                        <option value="sin_imagen">❌ Falta Imagen</option>
                                    </select>
                                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">expand_more</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">🎬 Estado de Video</label>
                                <div className="relative">
                                    <select value={filters.videoStatus || ''} onChange={(e) => handleFilterChange('videoStatus', e.target.value)} className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200/80 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-200 appearance-none focus:border-blue-500 outline-none">
                                        <option value="">Todos los Videos</option>
                                        <option value="con_video">✅ Mostrar Con Video</option>
                                        <option value="sin_video">❌ Falta Video</option>
                                    </select>
                                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">expand_more</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">📦 Estado de Stock</label>
                                <div className="relative">
                                    <select value={filters.stockStatus || ''} onChange={(e) => handleFilterChange('stockStatus', e.target.value)} className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200/80 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-200 appearance-none focus:border-blue-500 outline-none">
                                        <option value="">Todos los Repuestos</option>
                                        <option value="disponibles_importadora">🟢 En Importadora</option>
                                        <option value="solo_local">🏠 Solo Local (Agotado Imp.)</option>
                                        <option value="disponibles_local">🏢 Con Stock Local</option>
                                        <option value="solo_importadora">✈️ Solo Importadora</option>
                                        <option value="disponibles_cualquiera">⚡ Disponible (Local o Imp.)</option>
                                        <option value="agotados">🔴 Agotados</option>
                                    </select>
                                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">expand_more</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">⚙️ Estado en Catálogo</label>
                                <div className="relative">
                                    <select value={filters.discontinuedStatus || ''} onChange={(e) => handleFilterChange('discontinuedStatus', e.target.value)} className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200/80 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-200 appearance-none focus:border-blue-500 outline-none">
                                        <option value="">Todos (General)</option>
                                        <option value="activos">✅ Solo Activos</option>
                                        <option value="descontinuados">🚨 Descontinuados</option>
                                    </select>
                                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">expand_more</span>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => setIsFiltersOpen(false)}
                            className="w-full mt-6 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-extrabold text-base shadow-xl shadow-blue-600/30 active:scale-95 transition-transform flex items-center justify-center gap-2"
                        >
                            <span>Aplicar Filtros</span>
                            <span className="material-symbols-outlined text-lg">check</span>
                        </button>
                    </div>
                </div>
            )}

            {/* --- SELECTION PRINT BAR --- */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-24 left-4 right-4 z-40 bg-emerald-600 rounded-3xl shadow-2xl p-3 px-5 flex items-center justify-between animate-slide-up text-white border border-emerald-400">
                    <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-2xl">print</span>
                        <span className="font-extrabold text-sm">{selectedIds.size} repuesto(s) sel.</span>
                    </div>
                    <div className="flex gap-2.5">
                        <button onClick={handleBulkPrint} className="px-4 py-2 bg-white text-emerald-800 rounded-2xl font-black text-xs active:scale-95 transition-all shadow-sm">
                            Imprimir 3
                        </button>
                        <button onClick={() => setSelectedIds(new Set())} className="p-2 text-white/80 hover:text-white flex items-center">
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Modals */}
            {isModalOpen && <ProductModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleRefresh} productToEdit={productToEdit} />}
            {isGroupModalOpen && groupModalProduct && <ProductGroupModal isOpen={isGroupModalOpen} onClose={() => { setIsGroupModalOpen(false); setSelectedGroupId(null); setGroupModalProduct(null); }} groupId={selectedGroupId} initialProduct={groupModalProduct} onSuccess={handleRefresh} onEditProduct={(p: any) => { setIsGroupModalOpen(false); setProductToEdit(p); setIsModalOpen(true); }} />}
            {lightbox.isOpen && <MediaLightbox isOpen={lightbox.isOpen} media={lightbox.media} initialIndex={lightbox.initialIndex} onClose={() => setLightbox(prev => ({ ...prev, isOpen: false }))} onAddMedia={() => { setLightbox(prev => ({ ...prev, isOpen: false })); if (lightbox.product) { setProductToEdit(lightbox.product); setIsModalOpen(true); } }} />}
            {selectedProductForTags && <QuickTagAssignModal isOpen={!!selectedProductForTags} onClose={() => setSelectedProductForTags(null)} onSuccess={handleRefresh} productId={selectedProductForTags.id} productName={selectedProductForTags.name} />}
            {isLabelModalOpen && <ProductLabelModal isOpen={isLabelModalOpen} onClose={() => { setIsLabelModalOpen(false); setLabelProduct(null); }} product={labelProduct} />}

            {/* Queue Bottom Sheet */}
            {queueSheetProduct && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs animate-fade-in" onClick={() => setQueueSheetProduct(null)}></div>
                    <div className="relative bg-white dark:bg-slate-900 rounded-t-[32px] p-5 pt-2 pb-8 shadow-2xl animate-slide-up border-t border-amber-400/40 dark:border-amber-700/40">
                        <div className="w-10 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4 mt-2"></div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-amber-500">playlist_add</span>
                            Agregar a Cola
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">Se acumulará en tu borrador de impresión</p>

                        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl mb-4 border border-slate-200/60 dark:border-slate-750">
                            {queueSheetProduct.image_url ? (
                                <img src={getThumbnailUrl(queueSheetProduct.image_url, 200)} alt={queueSheetProduct.name} className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                            ) : (
                                <div className="w-14 h-14 bg-slate-200 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                                    <span className="material-symbols-outlined">image</span>
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <span className="text-xs font-mono font-extrabold text-blue-700 dark:text-blue-300">{queueSheetProduct.sku}</span>
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{queueSheetProduct.name}</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between bg-amber-50/70 dark:bg-amber-900/15 p-3 px-4 rounded-2xl border border-amber-200/60 dark:border-amber-800/40 mb-5">
                            <span className="text-sm font-bold text-amber-800 dark:text-amber-300">Cantidad de etiquetas:</span>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center border border-amber-300/60 dark:border-amber-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-inner h-10">
                                    <button
                                        type="button"
                                        className="px-3 h-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 font-bold text-lg"
                                        onClick={() => setQueueSheetQty(Math.max(1, queueSheetQty - 1))}
                                    >
                                        −
                                    </button>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={queueSheetQty}
                                        onChange={(e) => setQueueSheetQty(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-14 text-center bg-transparent border-none focus:ring-0 text-slate-800 dark:text-white font-black text-lg p-0"
                                    />
                                    <button
                                        type="button"
                                        className="px-3 h-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 font-bold text-lg"
                                        onClick={() => setQueueSheetQty(queueSheetQty + 1)}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setQueueSheetProduct(null)}
                                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-2xl font-extrabold text-sm active:scale-95 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleAddToQueueConfirm}
                                className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-extrabold text-sm shadow-lg shadow-amber-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">add</span>
                                Agregar {queueSheetQty}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileCatalog;
