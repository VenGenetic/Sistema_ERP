import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { supabase } from '../supabaseClient';
import { ProductModal } from '../components/ProductModal';
import { ProductGroupModal } from '../components/ProductGroupModal';
import { CatalogImportWizard } from '../components/CatalogImportWizard';
import { BulkEditModal } from '../components/BulkEditModal';
import { BulkMediaUploadModal } from '../components/BulkMediaUploadModal';
import { VideoThumbnail } from '../components/VideoThumbnail';
import { MediaLightbox } from '../components/MediaLightbox';
import { QuickTagAssignModal } from '../components/QuickTagAssignModal';
import { getThumbnailUrl } from '../utils/image';
import { ProductDemandModal } from '../components/ProductDemandModal';
import { SourcingQuickEditModal } from '../components/SourcingQuickEditModal';

// Helper to parse query parameters from the hash or query string
const getInitialParams = () => {
    let searchStr = '';
    if (window.location.hash && window.location.hash.includes('?')) {
        searchStr = window.location.hash.split('?')[1];
    } else if (window.location.search) {
        searchStr = window.location.search;
    }
    return new URLSearchParams(searchStr);
};

const Products: React.FC = () => {
    // ──────────────────────────────────────────────
    // 1. DATA STATES
    // ──────────────────────────────────────────────
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<any>(null);

    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    
    // Product Grouping states
    const [groupCounts, setGroupCounts] = useState<{ [key: string]: number }>({});
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [groupModalProduct, setGroupModalProduct] = useState<any>(null);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
    const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
    const [isBulkMediaOpen, setIsBulkMediaOpen] = useState(false);
    const [isDemandModalOpen, setIsDemandModalOpen] = useState(false);
    const [demandProduct, setDemandProduct] = useState<any>(null);

    const [isSourcingModalOpen, setIsSourcingModalOpen] = useState(false);
    const [sourcingProduct, setSourcingProduct] = useState<any>(null);

    // Export ZIP
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

    // Lightbox State
    const [lightbox, setLightbox] = useState<{isOpen: boolean, media: any[], initialIndex: number}>({ isOpen: false, media: [], initialIndex: 0 });
    const [selectedProductForTags, setSelectedProductForTags] = useState<any | null>(null);

    const navigate = useNavigate();
    const location = useLocation();

    // ──────────────────────────────────────────────
    // 2. FILTER, SORT, PAGINATION STATES
    // ──────────────────────────────────────────────
    const [searchTerm, setSearchTerm] = useState(() => {
        const params = getInitialParams();
        return params.get('search') || '';
    });
    const [filters, setFilters] = useState<{ [key: string]: string }>(() => {
        const params = getInitialParams();
        const initialFilters: { [key: string]: string } = {};
        const filterKeys = ['sku', 'name', 'category', 'brand', 'imageStatus', 'videoStatus', 'stockStatus'];
        filterKeys.forEach(key => {
            const val = params.get(key);
            if (val) initialFilters[key] = val;
        });
        return initialFilters;
    });
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>(() => {
        const params = getInitialParams();
        return {
            key: params.get('sortKey') || 'name',
            direction: (params.get('sortDir') as 'asc' | 'desc') || 'asc'
        };
    });
    const [pagination, setPagination] = useState(() => {
        const params = getInitialParams();
        const pageVal = params.get('page');
        const page = pageVal ? parseInt(pageVal, 10) : 1;
        return {
            page: isNaN(page) ? 1 : page,
            pageSize: 20,
            totalRecords: 0
        };
    });

    // ──────────────────────────────────────────────
    // 3. DEBOUNCED SEARCH, FILTER, AND PAGINATION EFFECT
    // ──────────────────────────────────────────────
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
    const [debouncedFilters, setDebouncedFilters] = useState(filters);

    // Debounce search term and column filters by 300ms
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setDebouncedFilters(filters);
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, filters]);

    // Separate effect to reset page to 1 on search/filter changes
    useEffect(() => {
        setPagination(prev => {
            if (prev.page === 1) return prev;
            return { ...prev, page: 1 };
        });
    }, [searchTerm, filters]);

    // Sync state changes to the URL (using replace navigation to avoid polluting history on typing)
    useEffect(() => {
        if (location.pathname !== '/products') return;

        const params = new URLSearchParams();
        
        if (searchTerm) params.set('search', searchTerm);
        
        Object.entries(filters).forEach(([key, val]) => {
            if (val) params.set(key, val);
        });
        
        if (sortConfig.key !== 'name') params.set('sortKey', sortConfig.key);
        if (sortConfig.direction !== 'asc') params.set('sortDir', sortConfig.direction);
        if (pagination.page > 1) params.set('page', String(pagination.page));
        
        const queryString = params.toString();
        const targetHash = `/products${queryString ? '?' + queryString : ''}`;
        
        const currentHash = window.location.hash.replace(/^#/, '');
        if (currentHash !== targetHash) {
            navigate(targetHash, { replace: true });
        }
    }, [searchTerm, filters, sortConfig.key, sortConfig.direction, pagination.page, navigate, location.pathname]);

    // Sync URL changes back to state (essential for browser history back/forward navigation)
    useEffect(() => {
        if (location.pathname !== '/products') return;

        const params = getInitialParams();
        
        const urlSearch = params.get('search') || '';
        if (urlSearch !== searchTerm) {
            setSearchTerm(urlSearch);
        }
        
        const urlFilters: { [key: string]: string } = {};
        const filterKeys = ['sku', 'name', 'category', 'brand', 'imageStatus', 'videoStatus', 'stockStatus'];
        filterKeys.forEach(key => {
            const val = params.get(key);
            if (val) urlFilters[key] = val;
        });
        const filtersChanged = JSON.stringify(urlFilters) !== JSON.stringify(filters);
        if (filtersChanged) {
            setFilters(urlFilters);
        }
        
        const urlSortKey = params.get('sortKey') || 'name';
        const urlSortDir = (params.get('sortDir') as 'asc' | 'desc') || 'asc';
        if (urlSortKey !== sortConfig.key || urlSortDir !== sortConfig.direction) {
            setSortConfig({ key: urlSortKey, direction: urlSortDir });
        }
        
        const pageVal = params.get('page');
        const urlPage = pageVal ? parseInt(pageVal, 10) : 1;
        const validPage = isNaN(urlPage) ? 1 : urlPage;
        if (validPage !== pagination.page) {
            setPagination(prev => ({ ...prev, page: validPage }));
        }
    }, [location]);

    useEffect(() => {
        fetchCatalogData(pagination.page);
    }, [debouncedSearchTerm, debouncedFilters, pagination.page, pagination.pageSize, sortConfig]);

    // ──────────────────────────────────────────────
    // 4. SUPABASE QUERY ENGINE
    // ──────────────────────────────────────────────
    const fetchCatalogData = useCallback(async (page?: number) => {
        setLoading(true);
        try {
            const currentPage = page || pagination.page;

            // Start query with exact count
            let query = supabase
                .from('products')
                .select(`
                    *,
                    brands (name),
                    inventory_levels (current_stock),
                    profiles (full_name),
                    product_tags ( tags (*) )
                `, { count: 'exact' })
                .eq('is_active', true);

            // Global Search (OR across name and sku)
            if (debouncedSearchTerm) {
                query = query.or(`name.ilike.%${debouncedSearchTerm}%,sku.ilike.%${debouncedSearchTerm}%`);
            }

            // Column Filters (AND logic)
            if (debouncedFilters.sku) {
                query = query.ilike('sku', `%${debouncedFilters.sku}%`);
            }
            if (debouncedFilters.name) {
                query = query.ilike('name', `%${debouncedFilters.name}%`);
            }
            if (debouncedFilters.category) {
                query = query.ilike('category', `%${debouncedFilters.category}%`);
            }
            
            // Image Status Filter
            if (debouncedFilters.imageStatus === 'con_imagen') {
                query = query.not('image_url', 'is', null);
            } else if (debouncedFilters.imageStatus === 'sin_imagen') {
                query = query.is('image_url', null);
            }

            // Video Status Filter
            if (debouncedFilters.videoStatus === 'con_video') {
                query = query.not('video_url', 'is', null);
            } else if (debouncedFilters.videoStatus === 'sin_video') {
                query = query.is('video_url', null);
            }

            // Stock Status Filter
            if (debouncedFilters.stockStatus === 'disponibles_importadora') {
                query = query.gt('importer_stock', 0);
            } else if (debouncedFilters.stockStatus === 'solo_local') {
                query = query.gt('local_stock', 0).eq('importer_stock', 0);
            } else if (debouncedFilters.stockStatus === 'disponibles_local') {
                query = query.gt('local_stock', 0);
            } else if (debouncedFilters.stockStatus === 'solo_importadora') {
                query = query.eq('local_stock', 0).gt('importer_stock', 0);
            } else if (debouncedFilters.stockStatus === 'disponibles_cualquiera') {
                query = query.or('local_stock.gt.0,importer_stock.gt.0');
            } else if (debouncedFilters.stockStatus === 'agotados') {
                query = query.eq('local_stock', 0).eq('importer_stock', 0);
            }

            // Sorting
            const isAscending = sortConfig.direction === 'asc';
            if (sortConfig.key === 'brand') {
                query = query.order('name', { referencedTable: 'brands', ascending: isAscending });
            } else {
                query = query.order(sortConfig.key, { ascending: isAscending });
            }

            // Pagination (range is 0-indexed)
            const from = (currentPage - 1) * pagination.pageSize;
            const to = from + pagination.pageSize - 1;
            query = query.range(from, to);

            // Execute
            const { data, error, count } = await query;

            if (error) throw error;

            setProducts(data || []);
            if (count !== null) {
                setPagination(prev => ({ ...prev, totalRecords: count }));
            }

            // Fetch group counts for the products on this page
            if (data && data.length > 0) {
                const groupIds = data.map((p: any) => p.group_id).filter(Boolean);
                if (groupIds.length > 0) {
                    const { data: countData, error: countError } = await supabase
                        .from('products')
                        .select('group_id')
                        .in('group_id', groupIds);
                    
                    if (!countError && countData) {
                        const counts: { [key: string]: number } = {};
                        countData.forEach((row: any) => {
                            if (row.group_id) {
                                counts[row.group_id] = (counts[row.group_id] || 0) + 1;
                            }
                        });
                        setGroupCounts(counts);
                    }
                } else {
                    setGroupCounts({});
                }
            } else {
                setGroupCounts({});
            }
        } catch (error) {
            console.error('Error fetching catalog:', error);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearchTerm, debouncedFilters, sortConfig, pagination.page, pagination.pageSize]);

    // ──────────────────────────────────────────────
    // HANDLERS
    // ──────────────────────────────────────────────
    const handleOpenModal = (product: any = null) => {
        setProductToEdit(product);
        setIsModalOpen(true);
    };

    const handleOpenGroupModal = (groupId: string, product: any) => {
        setSelectedGroupId(groupId);
        setGroupModalProduct(product);
        setIsGroupModalOpen(true);
    };

    const handleEditFromGroupModal = (product: any) => {
        setIsGroupModalOpen(false);
        setGroupModalProduct(null);
        setSelectedGroupId(null);
        handleOpenModal(product);
    };

    const handleOpenLightbox = (prod: any, clickedType: 'video' | 'image') => {
        const mediaArray: any[] = [];
        if (prod.video_url) mediaArray.push({ type: 'video', url: prod.video_url, title: prod.sku + ' - ' + prod.name });
        if (prod.image_url) mediaArray.push({ type: 'image', url: prod.image_url, title: prod.sku + ' - ' + prod.name });
        
        let startIndex = 0;
        if (clickedType === 'image' && prod.video_url) {
            startIndex = 1;
        }

        setLightbox({
            isOpen: true,
            media: mediaArray,
            initialIndex: startIndex
        });
    };

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleRefresh = () => {
        fetchCatalogData(pagination.page);
    };

    const handleDeleteProduct = async (product: any) => {
        const globalStock = product.inventory_levels?.reduce((acc: number, level: any) => acc + (level.current_stock || 0), 0) || 0;
        
        if (globalStock > 0) {
            alert(`No se puede eliminar el producto "${product.name}" porque tiene stock disponible (${globalStock} unidades). Debe vaciar el inventario primero.`);
            return;
        }

        const confirmed = window.confirm(`¿Estás seguro de que deseas eliminar permanentemente el producto "${product.sku} - ${product.name}"? Esta acción no se puede deshacer.`);
        
        if (!confirmed) return;

        setLoading(true);
        try {
            // Intento 1: Hard Delete (Borrado físico)
            // Usamos .select() para recibir las filas borradas y confirmar que realmente se borró algo
            const { data: deletedData, error: deleteError } = await supabase
                .from('products')
                .delete()
                .eq('id', product.id)
                .select();

            if (deleteError) {
                // Si falla por Foreign Key (historial), ofrecemos Soft Delete
                if (deleteError.code === '23503') {
                    const softConfirm = window.confirm(
                        "Este producto tiene historial comercial (ventas o movimientos) y no puede ser borrado permanentemente.\n\n" +
                        "¿Deseas ocultarlo definitivamente del catálogo?"
                    );
                    
                    if (softConfirm) {
                        const { data: updatedData, error: updateError } = await supabase
                            .from('products')
                            .update({ is_active: false })
                            .eq('id', product.id)
                            .select();
                        
                        if (updateError) throw updateError;
                        
                        // Verificar si el update realmente afectó filas
                        if (!updatedData || updatedData.length === 0) {
                            throw new Error("No se pudo ocultar el producto. Verifica tus permisos en la base de datos.");
                        }
                        
                        alert("Producto ocultado correctamente.");
                    }
                } else {
                    throw deleteError;
                }
            } else {
                // Verificar si el delete realmente afectó filas
                if (!deletedData || deletedData.length === 0) {
                    throw new Error("La base de datos rechazó la eliminación (es posible que falten permisos DELETE en RLS).");
                }
                alert("Producto eliminado permanentemente.");
            }
            
            fetchCatalogData(pagination.page);
        } catch (error: any) {
            console.error('Error deleting product:', error);
            alert('Error al intentar eliminar el producto: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        // Verificar stock de todos los seleccionados
        const hasStock = selectedProducts.some(p => {
            const stock = p.inventory_levels?.reduce((acc: number, level: any) => acc + (level.current_stock || 0), 0) || 0;
            return stock > 0;
        });

        if (hasStock) {
            alert('No se puede eliminar el lote: Al menos uno de los productos seleccionados tiene stock. Debes vaciar sus inventarios primero.');
            return;
        }

        const confirmed = window.confirm(`¿Estás súper seguro de que deseas ELIMINAR PERMANENTEMENTE los ${selectedProducts.length} productos seleccionados?\nEsta acción no se puede deshacer.`);
        if (!confirmed) return;

        setLoading(true);
        let deleted = 0;
        let hidden = 0;
        let failed = 0;

        for (const prod of selectedProducts) {
            try {
                const { data, error } = await supabase.from('products').delete().eq('id', prod.id).select();
                
                if (error) {
                    if (error.code === '23503') { // Foreign Key constraint (historial)
                        const { error: softError } = await supabase.from('products').update({ is_active: false }).eq('id', prod.id);
                        if (softError) failed++;
                        else hidden++;
                    } else {
                        failed++;
                    }
                } else if (data && data.length > 0) {
                    deleted++;
                } else {
                    failed++;
                }
            } catch (err) {
                failed++;
            }
        }

        setLoading(false);
        setSelectedIds(new Set());
        fetchCatalogData(pagination.page);
        
        alert(`Resultado del Lote:\n✅ ${deleted} eliminados permanentemente\n👀 ${hidden} ocultados (tenían historial comercial)\n❌ ${failed} fallidos`);
    };

    // ── Export ZIP handler ──
    const handleExportZip = async () => {
        setIsExporting(true);
        setExportProgress({ current: 0, total: 0 });
        try {
            // 1. Obtener TODOS los productos con imagen enlazada (sin límite de página)
            let allProducts: any[] = [];
            let from = 0;
            const batchSize = 1000;
            while (true) {
                const { data, error } = await supabase
                    .from('products')
                    .select('sku, image_url')
                    .not('image_url', 'is', null)
                    .range(from, from + batchSize - 1);
                if (error) throw error;
                if (!data || data.length === 0) break;
                allProducts = allProducts.concat(data);
                if (data.length < batchSize) break;
                from += batchSize;
            }

            if (allProducts.length === 0) {
                alert('No se encontraron productos con imágenes enlazadas.');
                return;
            }

            setExportProgress({ current: 0, total: allProducts.length });

            // 2. Crear el ZIP
            const zip = new JSZip();
            let success = 0;
            let failed = 0;

            for (let i = 0; i < allProducts.length; i++) {
                const { sku, image_url } = allProducts[i];
                setExportProgress({ current: i + 1, total: allProducts.length });
                try {
                    const response = await fetch(image_url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const blob = await response.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    zip.file(`${sku}.webp`, arrayBuffer);
                    success++;
                } catch {
                    failed++;
                }
            }

            // 3. Generar y descargar el ZIP
            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `imagenes_productos_${new Date().toISOString().slice(0, 10)}.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            alert(`✅ Exportación completa\n\n📦 ${success} imágenes exportadas\n❌ ${failed} fallidas`);
        } catch (err: any) {
            alert(`Error durante la exportación: ${err.message}`);
        } finally {
            setIsExporting(false);
            setExportProgress({ current: 0, total: 0 });
        }
    };

    // ── Selection handlers ──
    const toggleSelectAll = () => {
        if (selectedIds.size === products.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(products.map(p => p.id)));
        }
    };

    const toggleSelectRow = async (id: number) => {
        const targetProd = products.find(p => p.id === id);
        if (!targetProd) return;

        if (!targetProd.group_id) {
            setSelectedIds(prev => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
            });
            return;
        }

        // Determine intended state based on current selection
        const willBeSelected = !selectedIds.has(id);

        // 1. Synchronously update the UI for visible items instantly
        setSelectedIds(prev => {
            const next = new Set(prev);
            products.forEach(p => {
                if (p.group_id === targetProd.group_id) {
                    if (willBeSelected) next.add(p.id);
                    else next.delete(p.id);
                }
            });
            return next;
        });

        // 2. Asynchronously fetch and select all other group members across pages
        try {
            const { data } = await supabase.from('products').select('id').eq('group_id', targetProd.group_id);
            if (data) {
                const groupIds = data.map(d => d.id);
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    groupIds.forEach(gid => {
                        if (willBeSelected) next.add(gid);
                        else next.delete(gid);
                    });
                    return next;
                });
            }
        } catch (error) {
            console.error("Error fetching group ids for selection", error);
        }
    };

    const selectedProducts = products.filter(p => selectedIds.has(p.id));

    const handleBulkEditSuccess = () => {
        setSelectedIds(new Set());
        fetchCatalogData(pagination.page);
    };

    // ──────────────────────────────────────────────
    // PAGINATION HELPERS
    // ──────────────────────────────────────────────
    const totalPages = Math.ceil(pagination.totalRecords / pagination.pageSize);
    const showingFrom = pagination.totalRecords === 0 ? 0 : ((pagination.page - 1) * pagination.pageSize) + 1;
    const showingTo = Math.min(pagination.page * pagination.pageSize, pagination.totalRecords);

    // Column definitions for the sortable/filterable headers
    const columns = [
        { key: 'sku', label: 'SKU', align: '' },
        { key: 'name', label: 'Nombre y Etiquetas', align: '' },
        { key: 'brand', label: 'Marca', align: '' },
        { key: 'price', label: 'Precios y Costos', align: '' },
    ];

    // Memoize the catalog table rows to eliminate typing lag when searching
    const renderedRows = useMemo(() => {
        return products.map(prod => (
            <tr key={prod.id} className={`transition-colors group ${selectedIds.has(prod.id) ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                <td className="px-3 py-4 align-top">
                    <input
                        type="checkbox"
                        checked={selectedIds.has(prod.id)}
                        onChange={() => toggleSelectRow(prod.id)}
                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer mt-1"
                    />
                </td>
                <td className="px-6 py-4 font-mono text-sm text-slate-500 dark:text-slate-400 align-top whitespace-nowrap">{prod.sku}</td>
                <td className="px-6 py-4 align-top">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-start gap-3">
                        {/* Video Thumbnail */}
                        {prod.video_url ? (
                            <VideoThumbnail src={prod.video_url} onClick={() => handleOpenLightbox(prod, 'video')} />
                        ) : (
                            <div 
                                title="Sin Video" 
                                className="h-10 w-10 flex-shrink-0 rounded-lg border border-dashed border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-900/10 flex items-center justify-center relative"
                            >
                                <span className="material-symbols-outlined text-[16px] text-rose-400">videocam_off</span>
                            </div>
                        )}

                        {/* Image Thumbnail */}
                        {prod.image_url ? (
                            <div 
                                onClick={() => handleOpenLightbox(prod, 'image')}
                                className="h-10 w-10 flex-shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white shadow-sm relative cursor-pointer group"
                            >
                                <img 
                                   src={getThumbnailUrl(prod.image_url, 80, 80)} 
                                   alt="" 
                                   loading="lazy"
                                   decoding="async"
                                   className="h-full w-full object-cover group-hover:scale-110 transition-transform" 
                                   onError={(e) => {
                                       const target = e.currentTarget;
                                       if (target.src.includes('render/image')) {
                                           try {
                                               localStorage.setItem('supabase_transform_unsupported', 'true');
                                           } catch (err) {}
                                           target.src = prod.image_url || '';
                                       } else {
                                           target.style.display = 'none';
                                           if (target.parentElement) {
                                               target.parentElement.innerHTML = '<span class="material-symbols-outlined text-[20px] text-slate-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">image</span>';
                                               target.parentElement.className = "h-10 w-10 flex-shrink-0 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 relative";
                                           }
                                       }
                                   }}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                            </div>
                        ) : (
                            <div 
                                title="Sin Imagen"
                                className="h-10 w-10 flex-shrink-0 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center"
                            >
                                <span className="material-symbols-outlined text-[20px] text-slate-400">image</span>
                            </div>
                        )}
                        
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-white break-words whitespace-normal" title={prod.name}>{prod.name}</span>
                            {prod.group_id && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400 flex items-center gap-1 cursor-help" title={`Grupo: ${prod.group_id.split('-')[0]}`}>
                                    <span className="material-symbols-outlined text-[10px]">link</span>
                                    Equivalente
                                </span>
                            )}
                            {prod.investigation_status === 'en_consulta' && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" title="En consulta de sourcing">
                                    En Consulta
                                </span>
                            )}
                            {prod.investigation_status === 'no_encontrado' && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" title="No se encontró repuesto">
                                    No Encontrado
                                </span>
                            )}
                        </div>
                    </div>
                    {/* Tags Rendering */}
                    <div className="flex flex-wrap gap-1 mt-2 items-center">
                        {prod.product_tags && prod.product_tags.length > 0 && prod.product_tags.map((pt: any) => {
                            const tag = pt.tags;
                            if (!tag) return null;
                            return (
                                <span 
                                    key={tag.id} 
                                    className="px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer hover:opacity-80 transition-opacity"
                                    style={{ backgroundColor: tag.color + '20', color: tag.color, border: `1px solid ${tag.color}40` }}
                                    onClick={(e) => { e.stopPropagation(); setSelectedProductForTags(prod); }}
                                    title="Clic para editar etiquetas"
                                >
                                    {tag.name}
                                </span>
                            );
                        })}
                        <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedProductForTags(prod); }}
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-400 border border-dashed border-slate-300 dark:border-slate-600 hover:text-primary hover:border-primary transition-colors flex items-center gap-0.5 bg-slate-50 dark:bg-slate-800"
                            title="Asignar etiquetas"
                        >
                            <span className="material-symbols-outlined text-[12px]">add</span>
                            Etiqueta
                        </button>
                    </div>
                    </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 align-top">{prod.brands?.name || '—'}</td>
                
                {/* Precios y Costos */}
                <td className="px-6 py-4 align-top">
                    <div className="flex flex-col gap-1 text-xs min-w-[130px]">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-400 dark:text-slate-500 font-medium">Costo:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                                ${(prod.cost_without_vat || 0).toFixed(2)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-400 dark:text-slate-500 font-medium">Con IVA:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                                ${((prod.cost_without_vat || 0) * (1 + (prod.vat_percentage || 15.0) / 100)).toFixed(2)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/50">
                            <span className="text-slate-500 dark:text-slate-400 font-semibold">PVP:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                ${(prod.price || 0).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </td>

                <td className="px-6 py-4 text-center align-top">
                    <div className="flex flex-col items-center justify-center">
                        <span className="font-bold text-slate-900 dark:text-white">
                            {prod.inventory_levels ? prod.inventory_levels.reduce((acc: number, level: any) => acc + (level.current_stock || 0), 0) : 0}
                        </span>
                        {prod.importer_stock > 0 ? (
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                {prod.importer_stock} imp.
                            </span>
                        ) : (
                            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-full">
                                Agotado imp.
                            </span>
                        )}
                    </div>
                </td>
                <td className="px-6 py-4 text-center align-top">
                    <div className="flex items-center justify-center gap-1">
                        <button
                            onClick={() => handleOpenGroupModal(prod.group_id, prod)}
                            className={`p-1.5 rounded-lg transition-colors relative ${prod.group_id ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
                            title="Ver Repuestos Relacionados"
                        >
                            <span className="material-symbols-outlined text-[18px]">link</span>
                            {prod.group_id && groupCounts[prod.group_id] > 1 && (
                                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold px-1 rounded-full min-w-[15px] h-[15px] flex items-center justify-center border border-white dark:border-slate-900 shadow-sm">
                                    {groupCounts[prod.group_id] - 1}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => { setSourcingProduct(prod); setIsSourcingModalOpen(true); }}
                            className={`p-1.5 rounded-lg transition-colors ${prod.investigation_status && prod.investigation_status !== 'pending' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}
                            title="Estudio de Repuesto (Sourcing)"
                        >
                            <span className="material-symbols-outlined text-[18px]">travel_explore</span>
                        </button>
                        <button
                            onClick={() => handleOpenModal(prod)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Editar Producto"
                        >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                            onClick={() => { setDemandProduct(prod); setIsDemandModalOpen(true); }}
                            className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                            title="Registrar Demanda (Lista de Espera)"
                        >
                            <span className="material-symbols-outlined text-[18px]">notifications_active</span>
                        </button>
                        <button
                            onClick={() => handleDeleteProduct(prod)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                            title="Eliminar Producto"
                        >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        ));
    }, [products, selectedIds, groupCounts]);

    return (
        <div className="p-6 md:p-8 max-w-[1400px] mx-auto flex flex-col gap-6">
            {/* ═══════ HEADER ═══════ */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold dark:text-white tracking-tight">Catálogo de Productos</h1>
                    <p className="text-slate-500 mt-1">Gestiona la información maestra de tus productos (SKU, Nombres, Categorías).</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                    >
                        <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
                        Actualizar
                    </button>
                    <button
                        onClick={() => setIsImportWizardOpen(true)}
                        className="px-4 py-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors shadow-sm"
                        title="Master Data Override"
                    >
                        <span className="material-symbols-outlined text-[20px]">magic_button</span>
                        Importar Catálogo
                    </button>
                    <button
                        onClick={() => setIsBulkMediaOpen(true)}
                        className="px-4 py-2 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors shadow-sm"
                        title="Subir fotos y videos masivamente"
                    >
                        <span className="material-symbols-outlined text-[20px]">drive_folder_upload</span>
                        Subir Multimedia
                    </button>
                    <button
                        onClick={handleExportZip}
                        disabled={isExporting}
                        className="px-4 py-2 bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400 border border-violet-200 dark:border-violet-800 rounded-lg flex items-center gap-2 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        title="Descargar todas las imágenes enlazadas como ZIP"
                    >
                        {isExporting ? (
                            <>
                                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                                {exportProgress.total > 0
                                    ? `${exportProgress.current}/${exportProgress.total}...`
                                    : 'Preparando...'}
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[20px]">folder_zip</span>
                                Exportar ZIP
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="px-4 py-2 bg-primary text-white rounded-lg flex items-center gap-2 shadow-sm shadow-primary/30 hover:bg-primary/90 transition-colors"
                    >
                        <span className="material-symbols-outlined">add</span>
                        Nuevo Producto
                    </button>
                </div>
            </div>

            {/* ═══════ GLOBAL SEARCH & FILTERS ═══════ */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nombre o SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <select
                        value={filters.imageStatus || ''}
                        onChange={(e) => handleFilterChange('imageStatus', e.target.value)}
                        className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-700 dark:text-slate-300 lg:min-w-[180px]"
                    >
                        <option value="">📸 Todas las Imágenes</option>
                        <option value="con_imagen">✅ Mostrar Con Imagen</option>
                        <option value="sin_imagen">❌ Falta Imagen</option>
                    </select>
                    <select
                        value={filters.videoStatus || ''}
                        onChange={(e) => handleFilterChange('videoStatus', e.target.value)}
                        className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-700 dark:text-slate-300 lg:min-w-[180px]"
                    >
                        <option value="">🎬 Todos los Videos</option>
                        <option value="con_video">✅ Mostrar Con Video</option>
                        <option value="sin_video">❌ Falta Video</option>
                    </select>
                    <select
                        value={filters.stockStatus || ''}
                        onChange={(e) => handleFilterChange('stockStatus', e.target.value)}
                        className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-700 dark:text-slate-300 lg:min-w-[200px]"
                    >
                        <option value="">📦 Todos los Repuestos</option>
                        <option value="disponibles_importadora">🟢 En Importadora</option>
                        <option value="solo_local">🏠 Solo Local (Agotado Imp.)</option>
                        <option value="disponibles_local">🏢 Con Stock Local</option>
                        <option value="solo_importadora">✈️ Solo Importadora (Agotado Local)</option>
                        <option value="disponibles_cualquiera">⚡ Disponible (Local o Imp.)</option>
                        <option value="agotados">🔴 Agotado en Ambos</option>
                    </select>
                </div>
            </div>

            {/* ═══════ TABLE ═══════ */}
            <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-medium text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-3 py-3 w-10">
                                    <input
                                        type="checkbox"
                                        checked={products.length > 0 && selectedIds.size === products.length}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                    />
                                </th>
                                {columns.map(col => (
                                    <th
                                        key={col.key}
                                        className="px-6 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                        onClick={() => handleSort(col.key)}
                                    >
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-1">
                                                {col.label}
                                                <div className="flex flex-col">
                                                    <span className={`material-symbols-outlined text-[10px] leading-none ${sortConfig.key === col.key && sortConfig.direction === 'asc' ? 'text-primary' : 'text-slate-300'}`}>arrow_drop_up</span>
                                                    <span className={`material-symbols-outlined text-[10px] leading-none ${sortConfig.key === col.key && sortConfig.direction === 'desc' ? 'text-primary' : 'text-slate-300'}`}>arrow_drop_down</span>
                                                </div>
                                            </div>
                                            {col.key !== 'brand' && col.key !== 'price' && (
                                                <input
                                                    type="text"
                                                    placeholder="Filtrar..."
                                                    value={filters[col.key] || ''}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => handleFilterChange(col.key, e.target.value)}
                                                    className="w-full min-w-[80px] px-2 py-1 text-xs font-normal border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 focus:outline-none focus:border-primary"
                                                />
                                            )}
                                        </div>
                                    </th>
                                ))}
                                <th className="px-6 py-3 text-center">Stock (Local / Imp.)</th>
                                <th className="px-6 py-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {renderedRows}
                            {products.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="material-symbols-outlined text-[36px] text-slate-300">search_off</span>
                                            <span>No se encontraron productos que coincidan con tu búsqueda.</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {products.length === 0 && loading && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="material-symbols-outlined animate-spin text-[36px] text-primary">progress_activity</span>
                                            <span>Cargando catálogo...</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ═══════ PAGINATION FOOTER ═══════ */}
                {pagination.totalRecords > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                        <div className="text-sm text-slate-500">
                            Mostrando <span className="font-semibold text-slate-700 dark:text-slate-300">{showingFrom}–{showingTo}</span> de <span className="font-semibold text-slate-700 dark:text-slate-300">{pagination.totalRecords.toLocaleString()}</span> productos
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Page size selector */}
                            <select
                                value={pagination.pageSize}
                                onChange={(e) => setPagination(prev => ({ ...prev, pageSize: parseInt(e.target.value), page: 1 }))}
                                className="px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                                <option value={20}>20 / pág</option>
                                <option value={50}>50 / pág</option>
                                <option value={100}>100 / pág</option>
                            </select>

                            {/* Previous */}
                            <button
                                disabled={pagination.page === 1}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                                Anterior
                            </button>

                            {/* Page indicator */}
                            <span className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg">
                                {pagination.page} / {totalPages || 1}
                            </span>

                            {/* Next */}
                            <button
                                disabled={pagination.page >= totalPages || totalPages === 0}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Siguiente
                                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══════ MODALS ═══════ */}
            <ProductModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => fetchCatalogData(pagination.page)}
                productToEdit={productToEdit}
            />

            <CatalogImportWizard
                isOpen={isImportWizardOpen}
                onClose={() => setIsImportWizardOpen(false)}
                onSuccess={() => fetchCatalogData(1)}
            />

            <BulkEditModal
                isOpen={isBulkEditOpen}
                onClose={() => setIsBulkEditOpen(false)}
                onSuccess={handleBulkEditSuccess}
                selectedProducts={selectedProducts}
            />

            <ProductDemandModal
                isOpen={isDemandModalOpen}
                onClose={() => { setIsDemandModalOpen(false); setDemandProduct(null); }}
                product={demandProduct}
            />

            <SourcingQuickEditModal
                isOpen={isSourcingModalOpen}
                onClose={() => { setIsSourcingModalOpen(false); setSourcingProduct(null); }}
                product={sourcingProduct}
                onSuccess={() => fetchCatalogData(pagination.page)}
            />

            <BulkMediaUploadModal
                isOpen={isBulkMediaOpen}
                onClose={() => setIsBulkMediaOpen(false)}
                onSuccess={() => fetchCatalogData(pagination.page)}
            />

            <MediaLightbox
                isOpen={lightbox.isOpen}
                media={lightbox.media}
                initialIndex={lightbox.initialIndex}
                onClose={() => setLightbox(prev => ({ ...prev, isOpen: false }))}
            />

            <QuickTagAssignModal 
                isOpen={!!selectedProductForTags}
                onClose={() => setSelectedProductForTags(null)}
                onSuccess={() => fetchCatalogData(pagination.page)}
                productId={selectedProductForTags?.id}
                productName={selectedProductForTags?.name || ''}
            />

            {isGroupModalOpen && groupModalProduct && (
                <ProductGroupModal
                    isOpen={isGroupModalOpen}
                    onClose={() => { setIsGroupModalOpen(false); setSelectedGroupId(null); setGroupModalProduct(null); }}
                    groupId={selectedGroupId}
                    initialProduct={groupModalProduct}
                    onEditProduct={(prod) => {
                        setIsGroupModalOpen(false);
                        handleOpenModal(prod);
                    }}
                    onSuccess={() => fetchCatalogData(pagination.page)}
                />
            )}

            {/* ═══════ FLOATING ACTION BAR ═══════ */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl shadow-2xl shadow-slate-900/50 px-6 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-4">
                    <div className="flex items-center gap-2 text-sm">
                        <span className="bg-primary text-white font-bold px-2.5 py-0.5 rounded-full text-xs">{selectedIds.size}</span>
                        <span className="text-slate-300">seleccionado{selectedIds.size !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="w-px h-6 bg-slate-600"></div>
                    <button
                        onClick={() => setIsBulkEditOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-semibold transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">edit_note</span>
                        Edición Rápida
                    </button>
                    <button
                        onClick={handleBulkDelete}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-sm font-semibold transition-colors ml-2"
                    >
                        <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                        Eliminar Lote
                    </button>
                    <button
                        onClick={() => setSelectedIds(new Set())}
                        className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600"
                        title="Deseleccionar todo"
                    >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default Products;
