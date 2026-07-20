import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import JSZip from 'jszip';
import { supabase } from '../../supabaseClient';
import { getThumbnailUrl } from '../../utils/image';
import { isProductDiscontinued } from '../../utils/discontinuedHelper';

// Modals
import { ProductModal } from '../../components/ProductModal';
import { ProductGroupModal } from '../../components/ProductGroupModal';
import { CatalogImportWizard } from '../../components/CatalogImportWizard';
import { BulkEditModal } from '../../components/BulkEditModal';
import { BulkMediaUploadModal } from '../../components/BulkMediaUploadModal';
import { MediaLightbox } from '../../components/MediaLightbox';
import { QuickTagAssignModal } from '../../components/QuickTagAssignModal';
import { ProductDemandModal } from '../../components/ProductDemandModal';
import { SourcingQuickEditModal } from '../../components/SourcingQuickEditModal';

const MobileCatalog: React.FC = () => {
    // ──────────────────────────────────────────────
    // 1. STATES
    // ──────────────────────────────────────────────
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const observer = useRef<IntersectionObserver | null>(null);
    const pageSize = 15;

    // Search & Filters
    const [searchTerms, setSearchTerms] = useState<string[]>(['']);
    const [filters, setFilters] = useState<{ [key: string]: string }>({});
    
    // UI States
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isFabOpen, setIsFabOpen] = useState(false);
    const [copiedSku, setCopiedSku] = useState<string | null>(null);

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [groupCounts, setGroupCounts] = useState<{ [key: string]: number }>({});

    // Export
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<any>(null);
    const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
    const [isBulkMediaOpen, setIsBulkMediaOpen] = useState(false);
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
    const [isDemandModalOpen, setIsDemandModalOpen] = useState(false);
    const [demandProduct, setDemandProduct] = useState<any>(null);
    const [isSourcingModalOpen, setIsSourcingModalOpen] = useState(false);
    const [sourcingProduct, setSourcingProduct] = useState<any>(null);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [groupModalProduct, setGroupModalProduct] = useState<any>(null);
    const [lightbox, setLightbox] = useState<{ isOpen: boolean, media: any[], initialIndex: number, product?: any }>({ isOpen: false, media: [], initialIndex: 0 });
    const [selectedProductForTags, setSelectedProductForTags] = useState<any | null>(null);

    // ──────────────────────────────────────────────
    // 2. SEARCH & FILTER HANDLERS
    // ──────────────────────────────────────────────
    const addSearchFilter = () => setSearchTerms(prev => [...prev, '']);
    const removeSearchFilter = (index: number) => setSearchTerms(prev => prev.filter((_, i) => i !== index));
    const updateSearchTerm = (index: number, value: string) => setSearchTerms(prev => prev.map((val, i) => i === index ? value : val));

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    // Debounce effects
    const searchTermsString = useMemo(() => JSON.stringify(searchTerms), [searchTerms]);
    const [debouncedSearchTermsString, setDebouncedSearchTermsString] = useState(searchTermsString);
    const [debouncedFilters, setDebouncedFilters] = useState(filters);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTermsString(searchTermsString);
            setDebouncedFilters(filters);
            setPage(1);
            setHasMore(true);
        }, 150);
        return () => clearTimeout(timer);
    }, [searchTermsString, filters]);

    // ──────────────────────────────────────────────
    // 3. FETCH DATA
    // ──────────────────────────────────────────────
    const fetchCatalogData = useCallback(async (pageNum: number, isAppend: boolean) => {
        setLoading(true);
        try {
            let query = supabase
                .from('products')
                .select(`
                    *,
                    brands (name),
                    inventory_levels (current_stock),
                    profiles (full_name),
                    product_tags ( tags (*) )
                `)
                .eq('is_active', true);

            // Active Search Terms (Global Search)
            const activeSearchTerms = JSON.parse(debouncedSearchTermsString).map((s: string) => s.trim()).filter(Boolean);
            for (const term of activeSearchTerms) {
                if (term.startsWith('-')) {
                    const cleanTerm = term.slice(1).trim();
                    if (cleanTerm) {
                        query = query.not('name', 'ilike', `%${cleanTerm}%`);
                        query = query.not('sku', 'ilike', `%${cleanTerm}%`);
                    }
                } else {
                    query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
                }
            }

            // Column Filters
            if (debouncedFilters.imageStatus === 'con_imagen') query = query.not('image_url', 'is', null);
            else if (debouncedFilters.imageStatus === 'sin_imagen') query = query.is('image_url', null);

            if (debouncedFilters.videoStatus === 'con_video') query = query.contains('gallery', '[{"type": "video"}]');
            else if (debouncedFilters.videoStatus === 'sin_video') query = query.or('gallery.is.null,gallery.not.cs.[{"type": "video"}]');

            if (debouncedFilters.stockStatus === 'disponibles_importadora') query = query.gt('importer_stock', 0);
            else if (debouncedFilters.stockStatus === 'solo_local') query = query.gt('local_stock', 0).or('importer_stock.eq.0,importer_stock.is.null');
            else if (debouncedFilters.stockStatus === 'disponibles_local') query = query.gt('local_stock', 0);
            else if (debouncedFilters.stockStatus === 'solo_importadora') query = query.or('local_stock.eq.0,local_stock.is.null').gt('importer_stock', 0);
            else if (debouncedFilters.stockStatus === 'disponibles_cualquiera') query = query.or('local_stock.gt.0,importer_stock.gt.0');
            else if (debouncedFilters.stockStatus === 'agotados') query = query.or('local_stock.eq.0,local_stock.is.null').or('importer_stock.eq.0,importer_stock.is.null');

            if (debouncedFilters.discontinuedStatus === 'descontinuados') query = query.eq('is_discontinued', true);
            else if (debouncedFilters.discontinuedStatus === 'activos') query = query.or('is_discontinued.is.null,is_discontinued.eq.false');

            // Sorting (default to name asc for mobile)
            query = query.order('name', { ascending: true });

            // Pagination
            const from = (pageNum - 1) * pageSize;
            const to = from + pageSize - 1;
            query = query.range(from, to);

            const { data, error } = await query;
            if (error) throw error;

            if (data) {
                if (data.length < pageSize) setHasMore(false);
                else setHasMore(true);

                if (isAppend) {
                    setProducts(prev => {
                        // Prevent duplicates when appending
                        const existingIds = new Set(prev.map(p => p.id));
                        const newProducts = data.filter(p => !existingIds.has(p.id));
                        return [...prev, ...newProducts];
                    });
                } else {
                    setProducts(data);
                }

                // Fetch group counts
                const groupIds = data.map((p: any) => p.group_id).filter(Boolean);
                if (groupIds.length > 0) {
                    const { data: countData } = await supabase.from('products').select('group_id').in('group_id', groupIds);
                    if (countData) {
                        const counts: { [key: string]: number } = {};
                        countData.forEach((row: any) => {
                            if (row.group_id) counts[row.group_id] = (counts[row.group_id] || 0) + 1;
                        });
                        setGroupCounts(prev => ({ ...prev, ...counts }));
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching catalog:', error);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearchTermsString, debouncedFilters]);

    useEffect(() => {
        fetchCatalogData(page, page > 1);
    }, [page, fetchCatalogData]);

    const handleRefresh = () => {
        setPage(1);
        setHasMore(true);
        fetchCatalogData(1, false);
    };

    const lastElementRef = useCallback((node: HTMLDivElement | null) => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prev => prev + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, hasMore]);

    // ──────────────────────────────────────────────
    // 4. ACTIONS (Copy, Modals, Delete, Export)
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

        setLoading(true);
        try {
            const { data, error } = await supabase.from('products').delete().eq('id', product.id).select();
            if (error) {
                if (error.code === '23503') { // Foreign Key constraint
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
        } finally {
            setLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        const selectedProductsList = products.filter(p => selectedIds.has(p.id));
        const hasStock = selectedProductsList.some(p => (p.inventory_levels?.reduce((acc: number, level: any) => acc + (level.current_stock || 0), 0) || 0) > 0);
        
        if (hasStock) {
            alert('Al menos uno tiene stock. Debes vaciar sus inventarios primero.');
            return;
        }

        if (!window.confirm(`¿ELIMINAR PERMANENTEMENTE los ${selectedProductsList.length} productos?\nEsta acción no se puede deshacer.`)) return;

        setLoading(true);
        let deleted = 0, hidden = 0, failed = 0;

        for (const prod of selectedProductsList) {
            try {
                const { data, error } = await supabase.from('products').delete().eq('id', prod.id).select();
                if (error) {
                    if (error.code === '23503') {
                        const { error: softError } = await supabase.from('products').update({ is_active: false }).eq('id', prod.id);
                        if (softError) failed++; else hidden++;
                    } else failed++;
                } else if (data && data.length > 0) deleted++;
                else failed++;
            } catch { failed++; }
        }
        setLoading(false);
        setSelectedIds(new Set());
        handleRefresh();
        alert(`Lote:\n✅ ${deleted} eliminados\n👀 ${hidden} ocultados\n❌ ${failed} fallidos`);
    };

    const handleExportZip = async () => {
        setIsExporting(true);
        setExportProgress({ current: 0, total: 0 });
        setIsFabOpen(false);
        try {
            let allProducts: any[] = [];
            let from = 0;
            const batchSize = 1000;
            while (true) {
                const { data, error } = await supabase.from('products').select('sku, image_url').not('image_url', 'is', null).range(from, from + batchSize - 1);
                if (error) throw error;
                if (!data || data.length === 0) break;
                allProducts = allProducts.concat(data);
                if (data.length < batchSize) break;
                from += batchSize;
            }
            if (allProducts.length === 0) { alert('No hay imágenes.'); return; }
            setExportProgress({ current: 0, total: allProducts.length });
            
            const zip = new JSZip();
            let success = 0, failed = 0;
            for (let i = 0; i < allProducts.length; i++) {
                const { sku, image_url } = allProducts[i];
                setExportProgress({ current: i + 1, total: allProducts.length });
                try {
                    const response = await fetch(image_url);
                    if (!response.ok) throw new Error();
                    zip.file(`${sku}.webp`, await (await response.blob()).arrayBuffer());
                    success++;
                } catch { failed++; }
            }
            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `imagenes_productos_${new Date().toISOString().slice(0, 10)}.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            alert(`✅ ${success} exportadas\n❌ ${failed} fallidas`);
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        } finally {
            setIsExporting(false);
            setExportProgress({ current: 0, total: 0 });
        }
    };

    const toggleSelectRow = async (id: number) => {
        if (navigator.vibrate) navigator.vibrate(30);
        const targetProd = products.find(p => p.id === id);
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
            products.forEach(p => {
                if (p.group_id === targetProd.group_id) {
                    willBeSelected ? next.add(p.id) : next.delete(p.id);
                }
            });
            return next;
        });

        try {
            const { data } = await supabase.from('products').select('id').eq('group_id', targetProd.group_id);
            if (data) {
                const groupIds = data.map(d => d.id);
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    groupIds.forEach(gid => willBeSelected ? next.add(gid) : next.delete(gid));
                    return next;
                });
            }
        } catch (e) { console.error(e); }
    };

    const activeFilterCount = Object.values(filters).filter(Boolean).length;

    // ──────────────────────────────────────────────
    // 5. RENDER
    // ──────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 animate-fade-in relative">
            
            {/* --- HEADER STICKY --- */}
            <div className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-4 py-4 pt-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Catálogo</h1>
                    <button 
                        onClick={() => setIsFiltersOpen(true)}
                        className="relative p-2 h-11 w-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center"
                    >
                        <span className="material-symbols-outlined text-[24px]">tune</span>
                        {activeFilterCount > 0 && (
                            <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-primary text-white text-[10px] font-bold rounded-full border border-white dark:border-slate-900">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                </div>
                
                {/* Search Bar Row */}
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            type="text"
                            placeholder="Buscar SKU o nombre..."
                            value={searchTerms[0] || ''}
                            onChange={(e) => updateSearchTerm(0, e.target.value)}
                            className="w-full h-12 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl pl-10 pr-10 text-sm focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white placeholder-slate-400 shadow-inner"
                        />
                        {(searchTerms[0] || '') && (
                            <button 
                                onClick={() => updateSearchTerm(0, '')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-full active:bg-slate-200 dark:active:bg-slate-700 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        )}
                    </div>
                    <button
                        onClick={addSearchFilter}
                        className="h-12 w-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-md active:scale-90 transition-transform flex-shrink-0"
                    >
                        <span className="material-symbols-outlined font-bold">add</span>
                    </button>
                </div>

                {/* Additional Search Chips */}
                {searchTerms.length > 1 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto hide-scrollbar pb-1">
                        {searchTerms.slice(1).map((term, idx) => {
                            const actualIdx = idx + 1;
                            const isExclude = term.trim().startsWith('-');
                            const cleanTerm = isExclude ? term.trim().slice(1).trim() : term.trim();
                            
                            const toggleExclude = (e: React.MouseEvent) => {
                                e.stopPropagation();
                                updateSearchTerm(actualIdx, isExclude ? cleanTerm : `-${cleanTerm}`);
                            };

                            return (
                                <div key={actualIdx} className="flex-shrink-0 flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                                    <button
                                        onClick={toggleExclude}
                                        className={`flex items-center gap-1 px-3 py-2 text-xs font-semibold border-r border-slate-200 dark:border-slate-700 active:bg-slate-100 dark:active:bg-slate-700 transition-colors ${
                                            isExclude ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10' : 'text-primary bg-primary/5 dark:bg-primary/10'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-[14px]">
                                            {isExclude ? 'block' : 'search'}
                                        </span>
                                        {isExclude ? 'Excluir' : 'Incluir'}
                                    </button>
                                    <input
                                        type="text"
                                        placeholder="Palabra..."
                                        value={cleanTerm}
                                        onChange={(e) => updateSearchTerm(actualIdx, isExclude ? `-${e.target.value}` : e.target.value)}
                                        className="w-24 px-2 py-2 text-xs bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-300 outline-none"
                                    />
                                    <button
                                        onClick={() => removeSearchFilter(actualIdx)}
                                        className="px-2 py-2 text-slate-400 active:text-red-500 transition-colors border-l border-slate-200 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-slate-800/50"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* --- PRODUCT LIST (Infinite Scroll) --- */}
            <div className="flex-1 p-4 pb-32 overflow-y-auto">
                {products.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                        <span className="material-symbols-outlined text-[64px] mb-4 opacity-30">inventory_2</span>
                        <p className="font-medium text-slate-500">No se encontraron productos</p>
                        <p className="text-sm mt-2 max-w-[200px] text-center">Ajusta tus filtros o prueba otra búsqueda.</p>
                    </div>
                )}

                <div className="flex flex-col gap-4">
                    {products.map((prod, index) => {
                        const globalStock = prod.inventory_levels?.reduce((acc: number, level: any) => acc + (level.current_stock || 0), 0) || 0;
                        const imageUrl = prod.image_url ? getThumbnailUrl(prod.image_url, 300) : null;
                        const hasVideo = prod.gallery?.some((item: any) => item.type === 'video');
                        const isSelected = selectedIds.has(prod.id);
                        
                        return (
                            <div 
                                key={prod.id}
                                ref={index === products.length - 1 ? lastElementRef : null}
                                className={`bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.04)] border transition-all ${isSelected ? 'border-primary shadow-primary/20 bg-primary/5 dark:bg-primary/10' : 'border-slate-100 dark:border-slate-700/50'}`}
                            >
                                <div className="p-4 flex gap-4">
                                    {/* Left: Checkbox & Image */}
                                    <div className="flex flex-col items-center gap-3">
                                        <div 
                                            onClick={() => toggleSelectRow(prod.id)}
                                            className={`w-6 h-6 rounded-md border flex items-center justify-center cursor-pointer transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}`}
                                        >
                                            {isSelected && <span className="material-symbols-outlined text-white text-[16px] font-bold">check</span>}
                                        </div>

                                        <div 
                                            onClick={() => handleOpenLightbox(prod, 'image')}
                                            className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-700/50 relative overflow-hidden flex-shrink-0 cursor-pointer border border-slate-200 dark:border-slate-700"
                                        >
                                            {imageUrl ? (
                                                <img src={imageUrl} alt={prod.name} className="w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal" loading="lazy" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-300"><span className="material-symbols-outlined">image</span></div>
                                            )}
                                            {hasVideo && (
                                                <div className="absolute bottom-1 right-1 bg-black/60 rounded p-1 flex items-center justify-center backdrop-blur-sm">
                                                    <span className="material-symbols-outlined text-[12px] text-emerald-400">play_arrow</span>
                                                </div>
                                            )}
                                            {globalStock <= 0 && (
                                                <div className="absolute inset-0 bg-red-500/10 backdrop-blur-[1px] flex items-center justify-center">
                                                    <span className="bg-red-500 text-white text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full shadow-sm">Agotado</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Details */}
                                    <div className="flex-1 min-w-0">
                                        {/* Header Row: SKU & Buttons */}
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg border border-blue-100 dark:border-blue-800">
                                                {prod.sku}
                                            </span>
                                            <div className="flex gap-1">
                                                <button onClick={(e) => handleCopySku(prod.sku, e)} className="p-1.5 bg-slate-50 dark:bg-slate-700 text-slate-400 rounded-lg active:bg-slate-200 transition-colors">
                                                    <span className="material-symbols-outlined text-[16px]">{copiedSku === prod.sku ? 'check' : 'content_copy'}</span>
                                                </button>
                                                <a href={`https://www.lvparts.ec/catalogo?q=${encodeURIComponent(prod.sku)}`} target="_blank" rel="noreferrer" className="p-1.5 bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-orange-500 rounded-lg active:bg-slate-200 transition-colors flex items-center">
                                                    <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                                </a>
                                            </div>
                                        </div>

                                        {/* Product Name */}
                                        <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight mb-1 line-clamp-2">
                                            {prod.name}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 truncate">
                                            {prod.brands?.name || 'Sin marca'}
                                        </p>

                                        {/* Badges & Tags */}
                                        <div className="flex flex-wrap gap-1.5 mb-3">
                                            {isProductDiscontinued(prod) && (
                                                <span className="px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold flex items-center gap-0.5 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-400">
                                                    <span className="material-symbols-outlined text-[10px]">warning</span> Desc.
                                                </span>
                                            )}
                                            {prod.demand_count > 0 && (
                                                <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold flex items-center gap-0.5 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400">
                                                    <span className="material-symbols-outlined text-[10px] animate-pulse">notifications_active</span> {prod.demand_count}
                                                </span>
                                            )}
                                            {prod.group_id && (
                                                <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold flex items-center gap-0.5 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400">
                                                    <span className="material-symbols-outlined text-[10px]">link</span> Eq.
                                                </span>
                                            )}
                                            
                                            {/* Tags */}
                                            {prod.product_tags?.map((pt: any) => {
                                                if (!pt.tags) return null;
                                                return (
                                                    <span key={pt.tags.id} onClick={() => setSelectedProductForTags(prod)} className="px-1.5 py-0.5 text-[10px] font-bold rounded cursor-pointer" style={{ backgroundColor: pt.tags.color + '20', color: pt.tags.color, border: `1px solid ${pt.tags.color}40` }}>
                                                        {pt.tags.name}
                                                    </span>
                                                );
                                            })}
                                            <button onClick={() => setSelectedProductForTags(prod)} className="px-1.5 py-0.5 rounded bg-slate-50 border border-dashed border-slate-300 text-slate-500 text-[10px] font-semibold flex items-center gap-0.5 active:bg-slate-200 dark:bg-slate-800 dark:border-slate-600">
                                                <span className="material-symbols-outlined text-[10px]">add</span> Tag
                                            </button>
                                        </div>

                                        {/* Pricing Block */}
                                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-2 border border-slate-100 dark:border-slate-800 mb-3">
                                            <div className="flex justify-between items-center text-xs mb-1">
                                                <span className="text-slate-500">Costo / c.IVA</span>
                                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                                    ${(prod.cost_without_vat || 0).toFixed(2)} / ${((prod.cost_without_vat || 0) * (1 + (prod.vat_percentage || 15) / 100)).toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center border-t border-slate-200/50 dark:border-slate-700/50 pt-1">
                                                <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">PVP:</span>
                                                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                                    ${(prod.price || 0).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Stock Block */}
                                        <div className="flex items-center justify-between px-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-[16px] text-slate-400">inventory_2</span>
                                                <span className="text-sm font-black text-slate-800 dark:text-white">{globalStock}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] uppercase font-bold text-slate-400">Imp:</span>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${prod.importer_stock > 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                                                    {prod.importer_stock > 0 ? prod.importer_stock : 0}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons Row (Bottom) */}
                                <div className="border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30 flex divide-x divide-slate-100 dark:divide-slate-700/50">
                                    <button onClick={() => { setGroupModalProduct(prod); setSelectedGroupId(prod.group_id); setIsGroupModalOpen(true); }} className="flex-1 py-3 flex items-center justify-center text-blue-500 active:bg-blue-50 transition-colors dark:active:bg-blue-900/20" title="Relacionados">
                                        <span className="material-symbols-outlined text-[20px]">link</span>
                                    </button>
                                    <button onClick={() => { setSourcingProduct(prod); setIsSourcingModalOpen(true); }} className="flex-1 py-3 flex items-center justify-center text-indigo-500 active:bg-indigo-50 transition-colors dark:active:bg-indigo-900/20" title="Sourcing">
                                        <span className="material-symbols-outlined text-[20px]">travel_explore</span>
                                    </button>
                                    <button onClick={() => { setProductToEdit(prod); setIsModalOpen(true); }} className="flex-1 py-3 flex items-center justify-center text-slate-500 active:bg-slate-100 transition-colors dark:active:bg-slate-700" title="Editar">
                                        <span className="material-symbols-outlined text-[20px]">edit</span>
                                    </button>
                                    <button onClick={() => { setDemandProduct(prod); setIsDemandModalOpen(true); }} className="flex-1 py-3 flex items-center justify-center text-amber-500 active:bg-amber-50 transition-colors dark:active:bg-amber-900/20" title="Demanda">
                                        <span className="material-symbols-outlined text-[20px]">notifications_active</span>
                                    </button>
                                    <button onClick={() => handleDeleteProduct(prod)} className="flex-1 py-3 flex items-center justify-center text-rose-500 active:bg-rose-50 transition-colors dark:active:bg-rose-900/20" title="Eliminar">
                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Skeletons */}
                {loading && (
                    <div className="flex flex-col gap-4 mt-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white dark:bg-slate-800 rounded-3xl p-4 border border-slate-100 dark:border-slate-700/50 flex gap-4 overflow-hidden relative">
                                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent z-10"></div>
                                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-700 flex-shrink-0"></div>
                                <div className="flex-1 flex flex-col gap-2">
                                    <div className="h-6 bg-slate-100 dark:bg-slate-700 rounded-lg w-24"></div>
                                    <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded-lg w-full mt-1"></div>
                                    <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded-lg w-2/3"></div>
                                    <div className="h-12 bg-slate-100 dark:bg-slate-700 rounded-xl w-full mt-2"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* --- BOTTOM SHEET FILTERS --- */}
            {isFiltersOpen && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={() => setIsFiltersOpen(false)}></div>
                    
                    {/* Sheet */}
                    <div className="relative bg-white dark:bg-slate-900 rounded-t-[32px] p-6 pt-2 pb-10 shadow-2xl animate-slide-up border-t border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto">
                        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-6 mt-3"></div>
                        
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined">tune</span> Filtros Avanzados
                            </h2>
                            <button onClick={() => { setFilters({}); }} className="text-sm font-bold text-primary active:opacity-70">
                                Limpiar
                            </button>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1">📸 Estado de Imagen</label>
                                <div className="relative">
                                    <select value={filters.imageStatus || ''} onChange={(e) => handleFilterChange('imageStatus', e.target.value)} className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-medium text-slate-800 dark:text-slate-200 appearance-none focus:border-primary outline-none">
                                        <option value="">Todas las Imágenes</option>
                                        <option value="con_imagen">✅ Mostrar Con Imagen</option>
                                        <option value="sin_imagen">❌ Falta Imagen</option>
                                    </select>
                                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">expand_more</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1">🎬 Estado de Video</label>
                                <div className="relative">
                                    <select value={filters.videoStatus || ''} onChange={(e) => handleFilterChange('videoStatus', e.target.value)} className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-medium text-slate-800 dark:text-slate-200 appearance-none focus:border-primary outline-none">
                                        <option value="">Todos los Videos</option>
                                        <option value="con_video">✅ Mostrar Con Video</option>
                                        <option value="sin_video">❌ Falta Video</option>
                                    </select>
                                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">expand_more</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1">📦 Estado de Stock</label>
                                <div className="relative">
                                    <select value={filters.stockStatus || ''} onChange={(e) => handleFilterChange('stockStatus', e.target.value)} className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-medium text-slate-800 dark:text-slate-200 appearance-none focus:border-primary outline-none">
                                        <option value="">Todos los Repuestos</option>
                                        <option value="disponibles_importadora">🟢 En Importadora</option>
                                        <option value="solo_local">🏠 Solo Local (Agotado Imp.)</option>
                                        <option value="disponibles_local">🏢 Con Stock Local</option>
                                        <option value="solo_importadora">✈️ Solo Importadora</option>
                                        <option value="disponibles_cualquiera">⚡ Disponible (Local o Imp.)</option>
                                        <option value="agotados">🔴 Agotado en Ambos</option>
                                    </select>
                                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">expand_more</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1">⚙️ Estado</label>
                                <div className="relative">
                                    <select value={filters.discontinuedStatus || ''} onChange={(e) => handleFilterChange('discontinuedStatus', e.target.value)} className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-medium text-slate-800 dark:text-slate-200 appearance-none focus:border-primary outline-none">
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
                            className="w-full mt-6 h-14 bg-primary text-white rounded-2xl font-bold text-lg shadow-lg shadow-primary/30 active:scale-95 transition-transform"
                        >
                            Aplicar Filtros
                        </button>
                    </div>
                </div>
            )}

            {/* --- FAB SPEED DIAL --- */}
            <div className="fixed bottom-24 right-4 z-40">
                {/* Overlay backdrop for dial */}
                {isFabOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsFabOpen(false)}></div>}
                
                <div className={`absolute bottom-full right-0 mb-4 flex flex-col items-end gap-3 transition-all duration-300 ${isFabOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
                    <button onClick={() => { setIsFabOpen(false); setIsImportWizardOpen(true); }} className="flex items-center gap-3 active:scale-95 transition-transform">
                        <span className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg shadow-md text-sm font-bold">Importar</span>
                        <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg"><span className="material-symbols-outlined">magic_button</span></div>
                    </button>
                    <button onClick={() => { setIsFabOpen(false); setIsBulkMediaOpen(true); }} className="flex items-center gap-3 active:scale-95 transition-transform">
                        <span className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg shadow-md text-sm font-bold">Multimedia</span>
                        <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg"><span className="material-symbols-outlined">drive_folder_upload</span></div>
                    </button>
                    <button onClick={handleExportZip} disabled={isExporting} className="flex items-center gap-3 active:scale-95 transition-transform">
                        <span className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg shadow-md text-sm font-bold">Exportar ZIP</span>
                        <div className="w-12 h-12 rounded-full bg-violet-500 text-white flex items-center justify-center shadow-lg">
                            <span className={`material-symbols-outlined ${isExporting ? 'animate-spin' : ''}`}>{isExporting ? 'progress_activity' : 'folder_zip'}</span>
                        </div>
                    </button>
                    <button onClick={() => { setIsFabOpen(false); setIsModalOpen(true); setProductToEdit(null); }} className="flex items-center gap-3 active:scale-95 transition-transform">
                        <span className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg shadow-md text-sm font-bold">Nuevo Producto</span>
                        <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-lg"><span className="material-symbols-outlined">add_box</span></div>
                    </button>
                </div>

                <button 
                    onClick={() => setIsFabOpen(!isFabOpen)}
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl shadow-primary/40 transition-all duration-300 relative z-10 ${isFabOpen ? 'bg-slate-800 rotate-45' : 'bg-primary rotate-0'}`}
                >
                    <span className="material-symbols-outlined text-[28px]">add</span>
                </button>
            </div>

            {/* --- SELECTION FLOATING BAR --- */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-20 left-4 right-4 z-40 bg-slate-900 dark:bg-slate-800 rounded-2xl shadow-2xl p-2 px-4 flex items-center justify-between animate-slide-up border border-slate-700 text-white">
                    <div className="flex items-center gap-2">
                        <span className="bg-primary px-2.5 py-1 rounded-full text-xs font-black">{selectedIds.size}</span>
                        <span className="text-sm font-medium">sel.</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setIsBulkEditOpen(true)} className="px-3 py-2 bg-amber-500 hover:bg-amber-400 rounded-xl text-sm font-bold flex items-center gap-1 active:scale-95 transition-all">
                            <span className="material-symbols-outlined text-[18px]">edit_note</span>
                        </button>
                        <button onClick={handleBulkDelete} className="px-3 py-2 bg-rose-500 hover:bg-rose-400 rounded-xl text-sm font-bold flex items-center gap-1 active:scale-95 transition-all">
                            <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                        </button>
                        <div className="w-px bg-slate-700 mx-1"></div>
                        <button onClick={() => setSelectedIds(new Set())} className="p-2 text-slate-400 hover:text-white rounded-xl active:bg-slate-800 transition-all">
                            <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                    </div>
                </div>
            )}

            {/* --- MODALS --- */}
            {isModalOpen && (
                <ProductModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleRefresh} productToEdit={productToEdit} />
            )}
            {isImportWizardOpen && (
                <CatalogImportWizard isOpen={isImportWizardOpen} onClose={() => setIsImportWizardOpen(false)} onSuccess={handleRefresh} />
            )}
            {isBulkEditOpen && (
                <BulkEditModal isOpen={isBulkEditOpen} onClose={() => setIsBulkEditOpen(false)} onSuccess={() => { setSelectedIds(new Set()); handleRefresh(); }} selectedProducts={products.filter(p => selectedIds.has(p.id))} />
            )}
            {isBulkMediaOpen && (
                <BulkMediaUploadModal isOpen={isBulkMediaOpen} onClose={() => setIsBulkMediaOpen(false)} onSuccess={handleRefresh} />
            )}
            {isDemandModalOpen && (
                <ProductDemandModal isOpen={isDemandModalOpen} onClose={() => { setIsDemandModalOpen(false); setDemandProduct(null); }} product={demandProduct} />
            )}
            {isSourcingModalOpen && (
                <SourcingQuickEditModal isOpen={isSourcingModalOpen} onClose={() => { setIsSourcingModalOpen(false); setSourcingProduct(null); }} product={sourcingProduct} onSuccess={handleRefresh} />
            )}
            {isGroupModalOpen && groupModalProduct && (
                <ProductGroupModal isOpen={isGroupModalOpen} onClose={() => { setIsGroupModalOpen(false); setSelectedGroupId(null); setGroupModalProduct(null); }} groupId={selectedGroupId} initialProduct={groupModalProduct} onSuccess={handleRefresh} onEditProduct={(p) => { setIsGroupModalOpen(false); setProductToEdit(p); setIsModalOpen(true); }} />
            )}
            {selectedProductForTags && (
                <QuickTagAssignModal isOpen={!!selectedProductForTags} onClose={() => setSelectedProductForTags(null)} onSuccess={handleRefresh} productId={selectedProductForTags.id} productName={selectedProductForTags.name} />
            )}
            {lightbox.isOpen && (
                <MediaLightbox isOpen={lightbox.isOpen} media={lightbox.media} initialIndex={lightbox.initialIndex} onClose={() => setLightbox(prev => ({ ...prev, isOpen: false }))} onAddMedia={() => { setLightbox(prev => ({ ...prev, isOpen: false })); if (lightbox.product) { setProductToEdit(lightbox.product); setIsModalOpen(true); } }} />
            )}

            {/* --- STYLES --- */}
            <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes shimmer { 100% { transform: translateX(100%); } }
                .animate-fade-in { animation: fade-in 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
                .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.2) forwards; }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default MobileCatalog;
