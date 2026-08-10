import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { isProductDiscontinued } from '../utils/discontinuedHelper';
import { ProductLabelModal } from '../components/ProductLabelModal';
import { InventoryGroupSelectModal } from '../components/InventoryGroupSelectModal';
import { PrintQueuePreviewModal } from '../components/PrintQueuePreviewModal';
import { addToQueue, getPrintQueue, clearQueue, removeFromQueue, updateQueueItemQty, getQueueTotalLabels, getQueuePageCount, downloadQueuePDF, PrintQueueItem } from '../utils/mobilePrintQueue';
import { ProformaPanel } from '../components/ProformaPanel';
import { useProformaStore } from '../store/useProformaStore';

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

    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
    const [labelProduct, setLabelProduct] = useState<any>(null);
    const [isInventoryGroupSelectOpen, setIsInventoryGroupSelectOpen] = useState(false);

    const [isSourcingModalOpen, setIsSourcingModalOpen] = useState(false);
    const [sourcingProduct, setSourcingProduct] = useState<any>(null);

    // Print Queue States
    const [queueToast, setQueueToast] = useState<string | null>(null);
    const [isQueuePanelOpen, setIsQueuePanelOpen] = useState(false);
    const [isQueuePreviewOpen, setIsQueuePreviewOpen] = useState(false);
    const [printQueue, setPrintQueue] = useState<PrintQueueItem[]>([]);
    const [isQueueGenerating, setIsQueueGenerating] = useState(false);
    const [showQueueClearConfirm, setShowQueueClearConfirm] = useState(false);

    const loadQueue = useCallback(async () => {
        const q = await getPrintQueue();
        setPrintQueue(q);
    }, []);

    useEffect(() => {
        loadQueue();
    }, [loadQueue]);


    // Export ZIP
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

    // Lightbox State
    const [lightbox, setLightbox] = useState<{isOpen: boolean, media: any[], initialIndex: number, product?: any}>({ isOpen: false, media: [], initialIndex: 0 });
    const [selectedProductForTags, setSelectedProductForTags] = useState<any | null>(null);
    const [copiedSku, setCopiedSku] = useState<string | null>(null);

    // Catalog view mode: gallery (big thumbnails, default) vs. dense table.
    const [viewMode, setViewMode] = useState<'table' | 'gallery'>(() => {
        try {
            const saved = localStorage.getItem('products_view_mode');
            return saved === 'table' || saved === 'gallery' ? saved : 'gallery';
        } catch {
            return 'gallery';
        }
    });
    useEffect(() => {
        try { localStorage.setItem('products_view_mode', viewMode); } catch {}
    }, [viewMode]);

    const handleCopySku = (sku: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(sku).then(() => {
            setCopiedSku(sku);
            setTimeout(() => {
                setCopiedSku(prev => prev === sku ? null : prev);
            }, 2000);
        }).catch(err => {
            console.error('Error al copiar SKU: ', err);
        });
    };

    const navigate = useNavigate();
    const location = useLocation();

    // ──────────────────────────────────────────────
    // 2. FILTER, SORT, PAGINATION STATES
    // ──────────────────────────────────────────────
    const [searchTerms, setSearchTerms] = useState<string[]>(() => {
        const params = getInitialParams();
        const q = params.get('search');
        const k = params.getAll('k');
        
        if (q !== null || k.length > 0) {
            return [q || '', ...k];
        }
        
        try {
            const saved = localStorage.getItem('last_erp_products_queries');
            const savedTime = localStorage.getItem('last_erp_products_queries_time');
            if (saved && savedTime) {
                const ageMs = Date.now() - parseInt(savedTime, 10);
                if (ageMs < 24 * 60 * 60 * 1000) {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        return parsed;
                    }
                }
            }
        } catch (e) {
            console.error('Error al leer queries de catálogo de productos del ERP desde localStorage', e);
        }
        
        return [''];
    });

    const [expanded, setExpanded] = useState<boolean[]>(() => {
        return [true, ...Array(Math.max(0, searchTerms.length - 1)).fill(false)];
    });

    // Guardar en localStorage
    useEffect(() => {
        const hasAnyQuery = searchTerms.some(b => b.trim().length > 0);
        if (hasAnyQuery) {
            localStorage.setItem('last_erp_products_queries', JSON.stringify(searchTerms));
            localStorage.setItem('last_erp_products_queries_time', Date.now().toString());
        } else {
            localStorage.removeItem('last_erp_products_queries');
            localStorage.removeItem('last_erp_products_queries_time');
        }
    }, [searchTerms]);

    const [filters, setFilters] = useState<{ [key: string]: string }>(() => {
        const params = getInitialParams();
        const initialFilters: { [key: string]: string } = {};
        const filterKeys = ['sku', 'name', 'category', 'brand', 'imageStatus', 'videoStatus', 'stockStatus', 'discontinuedStatus'];
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

    // Funciones para gestionar filtros dinámicos múltiples
    const addSearchFilter = () => {
        setSearchTerms(prev => [...prev, '']);
        setExpanded(prev => [...prev, true]);
    };

    const removeSearchFilter = (index: number) => {
        setSearchTerms(prev => prev.filter((_, i) => i !== index));
        setExpanded(prev => prev.filter((_, i) => i !== index));
    };

    const toggleExpandFilter = (index: number) => {
        setExpanded(prev => prev.map((exp, i) => i === index ? !exp : exp));
    };

    const updateSearchTerm = (index: number, value: string) => {
        setSearchTerms(prev => prev.map((val, i) => i === index ? value : val));
    };

    const collapseAllFilters = () => {
        setExpanded(prev => prev.map((_, i) => i === 0 ? true : false));
    };

    const clearAllAdditionalFilters = () => {
        setSearchTerms([searchTerms[0]]);
        setExpanded([true]);
    };

    const handleBlurContainer = (event: React.FocusEvent<HTMLDivElement>, index: number) => {
        const currentTarget = event.currentTarget;
        setTimeout(() => {
            if (!currentTarget.contains(document.activeElement)) {
                const query = searchTerms[index];
                if (!query || !query.trim()) {
                    removeSearchFilter(index);
                }
            }
        }, 250);
    };

    // ──────────────────────────────────────────────
    // 3. DEBOUNCED SEARCH, FILTER, AND PAGINATION EFFECT
    // ──────────────────────────────────────────────
    const searchTermsString = useMemo(() => JSON.stringify(searchTerms), [searchTerms]);
    const [debouncedSearchTermsString, setDebouncedSearchTermsString] = useState(searchTermsString);
    const [debouncedFilters, setDebouncedFilters] = useState(filters);

    // Debounce search term and column filters by 300ms
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            setDebouncedSearchTermsString(searchTermsString);
            setDebouncedFilters(filters);
            setPagination(prev => {
                if (prev.page === 1) return prev;
                return { ...prev, page: 1 };
            });
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTermsString, filters]);

    const debouncedSearchTerms = useMemo(() => JSON.parse(debouncedSearchTermsString) as string[], [debouncedSearchTermsString]);

    // Sync state changes to the URL (using replace navigation to avoid polluting history on typing)
    useEffect(() => {
        if (location.pathname !== '/products') return;

        const params = new URLSearchParams();
        
        const q = searchTerms[0] || '';
        const k = searchTerms.slice(1).map(s => s.trim()).filter(s => s.length > 0);

        if (q) params.set('search', q);
        k.forEach(keyword => {
            params.append('k', keyword);
        });
        
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
    }, [searchTerms, filters, sortConfig.key, sortConfig.direction, pagination.page, navigate, location.pathname]);

    // Sync URL changes back to state (essential for browser history back/forward navigation)
    useEffect(() => {
        if (location.pathname !== '/products') return;

        const params = getInitialParams();
        
        const urlSearch = params.get('search') || '';
        const urlK = params.getAll('k');

        const currentQ = searchTerms[0] || '';
        const currentK = searchTerms.slice(1);

        const qChanged = urlSearch !== currentQ;
        const kChanged = urlK.length !== currentK.length || urlK.some((val, idx) => val !== currentK[idx]);

        if (qChanged || kChanged) {
            setSearchTerms([urlSearch, ...urlK]);
            setExpanded(prev => {
                const nextExpanded = [true];
                for (let i = 0; i < urlK.length; i++) {
                    nextExpanded.push(prev[i + 1] !== undefined ? prev[i + 1] : false);
                }
                return nextExpanded;
            });
        }
        
        const urlFilters: { [key: string]: string } = {};
        const filterKeys = ['sku', 'name', 'category', 'brand', 'imageStatus', 'videoStatus', 'stockStatus', 'discontinuedStatus'];
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
    }, [debouncedSearchTermsString, debouncedFilters, pagination.page, pagination.pageSize, sortConfig]);

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

            // Global Search (OR across name and sku for each active search term, support exclusions with '-')
            const activeSearchTerms = debouncedSearchTerms.map(s => s.trim()).filter(Boolean);
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

            // Video Status Filter (Checking if gallery contains video)
            if (debouncedFilters.videoStatus === 'con_video') {
                query = query.contains('gallery', '[{"type": "video"}]');
            } else if (debouncedFilters.videoStatus === 'sin_video') {
                query = query.or('gallery.is.null,gallery.not.cs.[{"type": "video"}]');
            }

            // Stock Status Filter
            if (debouncedFilters.stockStatus === 'disponibles_importadora') {
                query = query.gt('importer_stock', 0);
            } else if (debouncedFilters.stockStatus === 'solo_local') {
                query = query.gt('local_stock', 0).or('importer_stock.eq.0,importer_stock.is.null');
            } else if (debouncedFilters.stockStatus === 'disponibles_local') {
                query = query.gt('local_stock', 0);
            } else if (debouncedFilters.stockStatus === 'solo_importadora') {
                query = query.or('local_stock.eq.0,local_stock.is.null').gt('importer_stock', 0);
            } else if (debouncedFilters.stockStatus === 'disponibles_cualquiera') {
                query = query.or('local_stock.gt.0,importer_stock.gt.0');
            } else if (debouncedFilters.stockStatus === 'agotados') {
                query = query.or('local_stock.eq.0,local_stock.is.null').or('importer_stock.eq.0,importer_stock.is.null');
            }

            // Discontinued Status Filter
            if (debouncedFilters.discontinuedStatus === 'descontinuados') {
                query = query.eq('is_discontinued', true);
            } else if (debouncedFilters.discontinuedStatus === 'activos') {
                query = query.or('is_discontinued.is.null,is_discontinued.eq.false');
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
    }, [debouncedSearchTermsString, debouncedFilters, sortConfig, pagination.page, pagination.pageSize]);

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

    const handleOpenLightbox = (prod: any, clickedType: 'video' | 'image' | 'gallery', index = 0) => {
        const mediaArray: any[] = [];
        if (prod.image_url) mediaArray.push({ type: 'image', url: prod.image_url, title: prod.sku + ' - ' + prod.name });
        
        if (prod.gallery && Array.isArray(prod.gallery)) {
            prod.gallery.forEach((item: any) => {
                mediaArray.push({ type: item.type, url: item.url, title: prod.sku + ' - ' + prod.name });
            });
        }

        setLightbox({
            isOpen: true,
            media: mediaArray,
            initialIndex: index,
            product: prod
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

    const handleDuplicateProduct = async (prod: any) => {
        const confirmed = window.confirm(`¿Estás seguro de que deseas duplicar este producto (${prod.sku})? Se generará un nuevo código SKU automáticamente.`);
        if (!confirmed) return;

        setLoading(true);
        try {
            // Parse SKU using strict regex
            const match = prod.sku.match(/^(.*)-([A-Z]{1,2})$/);
            const baseSku = match ? match[1] : prod.sku;

            // Find existing SKUs
            const { data: existing, error: fetchError } = await supabase
                .from('products')
                .select('sku')
                .eq('is_active', true)
                .ilike('sku', `${baseSku}%`);
            
            if (fetchError) throw fetchError;

            // Generate unique suffix
            const getSuffix = (index: number): string => {
                let suffix = '';
                let temp = index;
                while (temp >= 0) {
                    suffix = String.fromCharCode((temp % 26) + 65) + suffix;
                    temp = Math.floor(temp / 26) - 1;
                }
                return suffix;
            };

            let nextSku = '';
            let index = 0;
            while (true) {
                const candidate = `${baseSku}-${getSuffix(index)}`;
                if (!existing?.some(p => p.sku.toLowerCase() === candidate.toLowerCase())) {
                    nextSku = candidate;
                    break;
                }
                index++;
            }

            const { data: { user } } = await supabase.auth.getUser();

            // Construct sanitized payload
            const payload = {
                sku: nextSku,
                name: prod.name,
                brand_id: prod.brand_id,
                category: prod.category,
                price: prod.price,
                cost_without_vat: prod.cost_without_vat,
                vat_percentage: prod.vat_percentage,
                profit_margin: prod.profit_margin,
                min_stock_threshold: prod.min_stock_threshold,
                image_url: prod.image_url,
                gallery: prod.gallery,
                is_active: true,
                is_discontinued: prod.is_discontinued || false,
                discontinued_until: prod.discontinued_until || null,
                last_edited_by: user?.id || null,
                last_edited_at: new Date().toISOString()
            };

            const { data: newProd, error: insertError } = await supabase
                .from('products')
                .insert([payload])
                .select('id')
                .single();

            if (insertError) throw insertError;

            // Duplicate tags
            if (newProd && prod.product_tags && prod.product_tags.length > 0) {
                const tagInserts = prod.product_tags
                    .map((pt: any) => pt.tags?.id)
                    .filter(Boolean)
                    .map((tagId: any) => ({
                        product_id: newProd.id,
                        tag_id: tagId
                    }));
                
                if (tagInserts.length > 0) {
                    const { error: tagError } = await supabase.from('product_tags').insert(tagInserts);
                    if (tagError) console.error('Error duplicando etiquetas:', tagError);
                }
            }

            alert(`Producto duplicado exitosamente. Nuevo SKU: ${nextSku}`);
            fetchCatalogData(pagination.page);
        } catch (error: any) {
            console.error('Error al duplicar producto:', error);
            alert('Error al duplicar producto: ' + error.message);
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

            // 2. Crear el ZIP (jszip se carga solo al exportar, para no inflar el bundle inicial)
            const { default: JSZip } = await import('jszip');
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
        const currentPageIds = products.map(p => p.id);
        const allSelectedOnPage = currentPageIds.length > 0 && currentPageIds.every(id => selectedIds.has(id));

        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allSelectedOnPage) {
                currentPageIds.forEach(id => next.delete(id));
            } else {
                currentPageIds.forEach(id => next.add(id));
            }
            return next;
        });
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
                <td className="px-6 py-4 font-mono text-sm text-slate-500 dark:text-slate-400 align-top whitespace-nowrap">
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <span>{prod.sku}</span>
                        <button
                            type="button"
                            onClick={(e) => handleCopySku(prod.sku, e)}
                            className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
                                copiedSku === prod.sku
                                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                                    : 'text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                            }`}
                            title={copiedSku === prod.sku ? "¡Copiado!" : "Copiar Código"}
                        >
                            <span className="material-symbols-outlined text-[16px]">
                                {copiedSku === prod.sku ? 'check' : 'content_copy'}
                            </span>
                        </button>
                        <a
                            href={`https://www.lvparts.ec/catalogo?q=${encodeURIComponent(prod.sku)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg transition-colors flex items-center justify-center text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                            title="Buscar en catálogo LV Parts"
                        >
                            <span className="material-symbols-outlined text-[16px]">
                                open_in_new
                            </span>
                        </a>
                    </div>
                </td>
                <td className="px-6 py-4 align-top">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-start gap-3">
                        {/* Image Thumbnail with Hover Gallery Preview */}
                        <div className="relative group">
                            {prod.image_url ? (
                                <div 
                                    onClick={() => handleOpenLightbox(prod, 'image', 0)}
                                    className="h-10 w-10 flex-shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white shadow-sm relative cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-[20px] text-slate-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0">image</span>
                                    <img 
                                       src={getThumbnailUrl(prod.image_url, 80, 80)} 
                                       alt="" 
                                       loading="lazy"
                                       decoding="async"
                                       className="h-full w-full object-cover transition-opacity duration-300 relative z-10" 
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
                                    {prod.gallery && prod.gallery.some((item: any) => item.type === 'video') && (
                                        <div className="absolute bottom-0.5 right-0.5 bg-black/60 rounded p-0.5 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-[12px] text-emerald-400">play_arrow</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div 
                                    title="Sin Imagen"
                                    className="h-10 w-10 flex-shrink-0 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center"
                                >
                                    <span className="material-symbols-outlined text-[20px] text-slate-400">image</span>
                                </div>
                            )}

                            {/* Hover Gallery Preview */}
                            {(prod.gallery && prod.gallery.length > 0) && (
                                <div className="absolute left-12 top-0 z-50 hidden group-hover:flex flex-wrap gap-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl w-max max-w-[200px]">
                                    {prod.gallery.map((item: any, idx: number) => (
                                        <div 
                                            key={idx} 
                                            onClick={(e) => { e.stopPropagation(); handleOpenLightbox(prod, 'gallery', idx + 1); }}
                                            className="w-10 h-10 rounded overflow-hidden border border-slate-200 dark:border-slate-700 bg-black flex items-center justify-center relative cursor-pointer hover:opacity-80 transition-opacity"
                                        >
                                            {item.type === 'video' ? (
                                                <span className="material-symbols-outlined text-emerald-500 text-[18px]">play_circle</span>
                                            ) : (
                                                <img src={getThumbnailUrl(item.url, 80, 80)} alt="" className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-2 flex-wrap">
                            {/*
                                Nombre completo también en la vista de tabla.
                                `max-w-prose` acota la medida de línea: un texto que cruza
                                toda la pantalla obliga al ojo a saltar de renglón y se
                                vuelve incómodo de leer (regla clásica de 45-75 caracteres
                                por línea; en monoespaciada conviene quedarse en la parte
                                baja de ese rango).
                            */}
                            <span
                                className="font-bold text-fg break-words whitespace-normal leading-relaxed max-w-prose"
                                lang="es"
                            >
                                {prod.name}
                            </span>
                            {isProductDiscontinued(prod) && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${prod.discontinued_until ? 'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400' : 'border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-400'} flex items-center gap-1`} title={prod.discontinued_until ? `Descontinuado Temporalmente hasta ${new Date(prod.discontinued_until).toLocaleDateString()}` : 'Descontinuado Permanentemente'}>
                                    <span className="material-symbols-outlined text-[10px]">{prod.discontinued_until ? 'hourglass_empty' : 'warning'}</span>
                                    {prod.discontinued_until ? 'Desc. Temporal' : 'Descontinuado'}
                                </span>
                            )}
                            {prod.group_id && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400 flex items-center gap-1 cursor-help" title={`Grupo: ${prod.group_id.split('-')[0]}`}>
                                    <span className="material-symbols-outlined text-[10px]">link</span>
                                    Equivalente
                                </span>
                            )}
                            {(prod.demand_count > 0) && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400 flex items-center gap-1" title={`${prod.demand_count} registros de demanda activos`}>
                                    <span className="material-symbols-outlined text-[10px] animate-pulse">notifications_active</span>
                                    {prod.demand_count} Demanda{prod.demand_count > 1 ? 's' : ''}
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
                            onClick={() => handleDuplicateProduct(prod)}
                            className="p-1.5 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                            title="Duplicar Producto"
                        >
                            <span className="material-symbols-outlined text-[18px]">copy_all</span>
                        </button>
                        <button
                            onClick={() => { setDemandProduct(prod); setIsDemandModalOpen(true); }}
                            className={`p-1.5 rounded-lg transition-colors relative ${
                                prod.demand_count > 0
                                    ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 font-semibold'
                                    : 'text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                            }`}
                            title="Registrar / Ver Demanda (Lista de Espera)"
                        >
                            <span className="material-symbols-outlined text-[18px]">notifications_active</span>
                            {prod.demand_count > 0 && (
                                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-bold px-1 rounded-full min-w-[15px] h-[15px] flex items-center justify-center border border-white dark:border-slate-900 shadow-sm animate-pulse">
                                    {prod.demand_count}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => { setLabelProduct(prod); setIsLabelModalOpen(true); }}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                            title="Generar Etiqueta (Código de Barras)"
                        >
                            <span className="material-symbols-outlined text-[18px]">barcode_scanner</span>
                        </button>
                        <button
                            onClick={async () => {
                                await addToQueue({ id: prod.id, sku: prod.sku, name: prod.name, image_url: prod.image_url }, 1);
                                await loadQueue();
                                setQueueToast(`✓ 1 etiqueta de ${prod.sku} agregada a la cola`);
                                setTimeout(() => setQueueToast(null), 2000);
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                            title="Agregar 1 etiqueta a la cola de impresión"
                        >
                            <span className="material-symbols-outlined text-[18px]">playlist_add</span>
                        </button>
                        <button
                            onClick={() => useProformaStore.getState().addItem({ id: prod.id, sku: prod.sku, name: prod.name, price: prod.price }, 1)}
                            className="p-1.5 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors"
                            title="Agregar a Proforma"
                        >
                            <span className="material-symbols-outlined text-[18px]">request_quote</span>
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
    }, [products, selectedIds, groupCounts, copiedSku]);

    // Gallery view: same data + same handlers as the table rows above, just
    // laid out as cards with a large image so parts can be told apart at a
    // glance instead of having to open each one to check a 40px thumbnail.
    const renderedCards = useMemo(() => {
        return products.map(prod => {
            const totalStock = prod.inventory_levels ? prod.inventory_levels.reduce((acc: number, level: any) => acc + (level.current_stock || 0), 0) : 0;
            const costWithVat = (prod.cost_without_vat || 0) * (1 + (prod.vat_percentage || 15.0) / 100);
            const isSelected = selectedIds.has(prod.id);

            return (
                <div
                    key={prod.id}
                    className={`relative flex flex-col rounded-xl border overflow-hidden bg-white dark:bg-slate-800 shadow-sm transition-all hover:shadow-lg ${isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-slate-200 dark:border-slate-700'}`}
                >
                    {/* Selection checkbox */}
                    <div className="absolute top-2 left-2 z-20">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(prod.id)}
                            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer shadow"
                        />
                    </div>

                    {/* Discontinued badge */}
                    {isProductDiscontinued(prod) && (
                        <span
                            className={`absolute top-2 right-2 z-20 px-1.5 py-0.5 rounded text-[10px] font-medium border shadow-sm ${prod.discontinued_until ? 'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-900/80 dark:border-amber-800 dark:text-amber-400' : 'border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-900/80 dark:border-rose-800 dark:text-rose-400'} flex items-center gap-1`}
                            title={prod.discontinued_until ? `Descontinuado Temporalmente hasta ${new Date(prod.discontinued_until).toLocaleDateString()}` : 'Descontinuado Permanentemente'}
                        >
                            <span className="material-symbols-outlined text-[10px]">{prod.discontinued_until ? 'hourglass_empty' : 'warning'}</span>
                            {prod.discontinued_until ? 'Temporal' : 'Descontinuado'}
                        </span>
                    )}

                    {/* Big thumbnail */}
                    <div
                        onClick={() => handleOpenLightbox(prod, 'image', 0)}
                        className="relative aspect-[4/3] w-full bg-slate-50 dark:bg-slate-900 cursor-pointer group border-b border-slate-100 dark:border-slate-700 overflow-hidden"
                    >
                        {prod.image_url ? (
                            <img
                                src={getThumbnailUrl(prod.image_url, 500, 375)}
                                alt={prod.name}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                                onError={(e) => {
                                    const target = e.currentTarget;
                                    if (target.src.includes('render/image')) {
                                        try { localStorage.setItem('supabase_transform_unsupported', 'true'); } catch (err) {}
                                        target.src = prod.image_url || '';
                                    } else {
                                        target.style.display = 'none';
                                        if (target.parentElement) {
                                            target.parentElement.innerHTML = '<span class="material-symbols-outlined text-5xl text-slate-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">image</span>';
                                        }
                                    }
                                }}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-5xl text-slate-300">image</span>
                            </div>
                        )}
                        {prod.gallery && prod.gallery.some((item: any) => item.type === 'video') && (
                            <div className="absolute bottom-2 right-2 bg-black/60 rounded-full p-1 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[16px] text-emerald-400">play_arrow</span>
                            </div>
                        )}
                        {prod.gallery && prod.gallery.length > 0 && (
                            <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                +{prod.gallery.length}
                            </span>
                        )}
                    </div>

                    {/* Body */}
                    <div className="flex flex-col gap-2 p-3 flex-1">
                        {/* SKU row */}
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 truncate">{prod.sku}</span>
                            <button
                                type="button"
                                onClick={(e) => handleCopySku(prod.sku, e)}
                                className={`p-1 rounded-lg transition-colors flex items-center justify-center ${copiedSku === prod.sku ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
                                title={copiedSku === prod.sku ? "¡Copiado!" : "Copiar Código"}
                            >
                                <span className="material-symbols-outlined text-[14px]">{copiedSku === prod.sku ? 'check' : 'content_copy'}</span>
                            </button>
                            <a
                                href={`https://www.lvparts.ec/catalogo?q=${encodeURIComponent(prod.sku)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded-lg transition-colors flex items-center justify-center text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                                title="Buscar en catálogo LV Parts"
                            >
                                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                            </a>
                        </div>

                        {/* Name + status badges */}
                        <div>
                            {/*
                                Nombre completo, sin recorte.
                                `line-clamp-2` escondía las descripciones largas y obligaba
                                a pasar el ratón para leerlas. Ahora envuelve entero con
                                interlineado holgado (1.625) — necesario en monoespaciada,
                                donde las líneas apretadas se leen como un bloque compacto.
                                `break-words` evita que una referencia larga sin espacios
                                desborde la tarjeta.
                            */}
                            <h3
                                className="font-bold text-sm text-fg leading-relaxed break-words hyphens-auto"
                                lang="es"
                            >
                                {prod.name}
                            </h3>
                            {(prod.group_id || prod.demand_count > 0 || prod.investigation_status === 'en_consulta' || prod.investigation_status === 'no_encontrado') && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {prod.group_id && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400 flex items-center gap-1 cursor-help" title={`Grupo: ${prod.group_id.split('-')[0]}`}>
                                            <span className="material-symbols-outlined text-[10px]">link</span>
                                            Equivalente
                                        </span>
                                    )}
                                    {prod.demand_count > 0 && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400 flex items-center gap-1" title={`${prod.demand_count} registros de demanda activos`}>
                                            <span className="material-symbols-outlined text-[10px] animate-pulse">notifications_active</span>
                                            {prod.demand_count} Demanda{prod.demand_count > 1 ? 's' : ''}
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
                            )}
                        </div>

                        {/* Brand */}
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            {prod.brands?.name || '—'}
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1 items-center">
                            {prod.product_tags && prod.product_tags.length > 0 && prod.product_tags.map((pt: any) => {
                                const tag = pt.tags;
                                if (!tag) return null;
                                return (
                                    <span
                                        key={tag.id}
                                        className="px-1.5 py-0.5 text-[10px] font-bold rounded cursor-pointer hover:opacity-80 transition-opacity"
                                        style={{ backgroundColor: tag.color + '20', color: tag.color, border: `1px solid ${tag.color}40` }}
                                        onClick={() => setSelectedProductForTags(prod)}
                                        title="Clic para editar etiquetas"
                                    >
                                        {tag.name}
                                    </span>
                                );
                            })}
                            <button
                                onClick={() => setSelectedProductForTags(prod)}
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-400 border border-dashed border-slate-300 dark:border-slate-600 hover:text-primary hover:border-primary transition-colors flex items-center gap-0.5 bg-slate-50 dark:bg-slate-800"
                                title="Asignar etiquetas"
                            >
                                <span className="material-symbols-outlined text-[12px]">add</span>
                                Etiqueta
                            </button>
                        </div>

                        {/* Prices */}
                        <div className="grid grid-cols-3 gap-1 text-[11px] bg-slate-50 dark:bg-slate-900/40 rounded-lg px-2 py-1.5">
                            <div className="flex flex-col">
                                <span className="text-slate-400 dark:text-slate-500">Costo</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">${(prod.cost_without_vat || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-slate-400 dark:text-slate-500">c/IVA</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">${costWithVat.toFixed(2)}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-slate-500 dark:text-slate-400">PVP</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">${(prod.price || 0).toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Stock */}
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-900 dark:text-white">
                                {totalStock} <span className="font-normal text-slate-400">local</span>
                            </span>
                            {prod.importer_stock > 0 ? (
                                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                    {prod.importer_stock} imp.
                                </span>
                            ) : (
                                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-full">
                                    Agotado imp.
                                </span>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center flex-wrap gap-0.5 mt-auto pt-2 border-t border-slate-100 dark:border-slate-700">
                            <button
                                onClick={() => handleOpenGroupModal(prod.group_id, prod)}
                                className={`p-1.5 rounded-lg transition-colors relative ${prod.group_id ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
                                title="Ver Repuestos Relacionados"
                            >
                                <span className="material-symbols-outlined text-[16px]">link</span>
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
                                <span className="material-symbols-outlined text-[16px]">travel_explore</span>
                            </button>
                            <button
                                onClick={() => handleOpenModal(prod)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                title="Editar Producto"
                            >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                            <button
                                onClick={() => handleDuplicateProduct(prod)}
                                className="p-1.5 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                                title="Duplicar Producto"
                            >
                                <span className="material-symbols-outlined text-[16px]">copy_all</span>
                            </button>
                            <button
                                onClick={() => { setDemandProduct(prod); setIsDemandModalOpen(true); }}
                                className={`p-1.5 rounded-lg transition-colors relative ${prod.demand_count > 0 ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 font-semibold' : 'text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}
                                title="Registrar / Ver Demanda (Lista de Espera)"
                            >
                                <span className="material-symbols-outlined text-[16px]">notifications_active</span>
                                {prod.demand_count > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-bold px-1 rounded-full min-w-[15px] h-[15px] flex items-center justify-center border border-white dark:border-slate-900 shadow-sm animate-pulse">
                                        {prod.demand_count}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => { setLabelProduct(prod); setIsLabelModalOpen(true); }}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                title="Generar Etiqueta (Código de Barras)"
                            >
                                <span className="material-symbols-outlined text-[16px]">barcode_scanner</span>
                            </button>
                            <button
                                onClick={async () => {
                                    await addToQueue({ id: prod.id, sku: prod.sku, name: prod.name, image_url: prod.image_url }, 1);
                                    await loadQueue();
                                    setQueueToast(`✓ 1 etiqueta de ${prod.sku} agregada a la cola`);
                                    setTimeout(() => setQueueToast(null), 2000);
                                }}
                                className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                title="Agregar 1 etiqueta a la cola de impresión"
                            >
                                <span className="material-symbols-outlined text-[16px]">playlist_add</span>
                            </button>
                            <button
                                onClick={() => useProformaStore.getState().addItem({ id: prod.id, sku: prod.sku, name: prod.name, price: prod.price }, 1)}
                                className="p-1.5 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors"
                                title="Agregar a Proforma"
                            >
                                <span className="material-symbols-outlined text-[16px]">request_quote</span>
                            </button>
                            <button
                                onClick={() => handleDeleteProduct(prod)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                title="Eliminar Producto"
                            >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            );
        });
    }, [products, selectedIds, groupCounts, copiedSku]);

    return (
        // `font-mono` = JetBrains Mono en todo el Catálogo (ver fontFamily en index.html).
        // Al ser monoespaciada ocupa ~10% más de ancho por carácter, así que los
        // nombres largos se compensan abajo con más interlineado y sin recortes.
        <div className="font-mono p-6 md:p-8 max-w-[1400px] mx-auto flex flex-col gap-6">
            {/* ═══════ HEADER ═══════ */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold dark:text-white tracking-tight">Catálogo de Productos</h1>
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
            <div className="flex flex-col gap-4">
                {/* 1. Filtros Rápidos (Arriba) */}
                <div className="flex flex-col sm:flex-row gap-2 w-full justify-end items-center bg-slate-50 dark:bg-slate-900/50 p-2 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-wider px-2 hidden lg:block mr-auto">Filtros Rápidos</span>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
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
                        <select
                            value={filters.discontinuedStatus || ''}
                            onChange={(e) => handleFilterChange('discontinuedStatus', e.target.value)}
                            className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-700 dark:text-slate-300 lg:min-w-[180px]"
                        >
                            <option value="">⚙️ Todos (General)</option>
                            <option value="activos">✅ Solo Activos</option>
                            <option value="descontinuados">🚨 Descontinuados</option>
                        </select>
                    </div>

                    {/* View mode toggle: gallery (big thumbnails) vs. dense table */}
                    <div className="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shrink-0">
                        <button
                            type="button"
                            onClick={() => setViewMode('gallery')}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'gallery' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                            title="Vista de galería (miniaturas grandes)"
                        >
                            <span className="material-symbols-outlined text-[18px]">grid_view</span>
                            <span className="hidden sm:inline">Galería</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'table' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                            title="Vista de tabla (detallada)"
                        >
                            <span className="material-symbols-outlined text-[18px]">table_rows</span>
                            <span className="hidden sm:inline">Tabla</span>
                        </button>
                    </div>
                </div>

                {/* 2. Barra de Búsqueda (Abajo) */}
                <div className="flex-1 flex flex-col gap-2">
                    <div className="flex gap-2 items-center">
                        <div className="relative flex-1">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input
                                type="text"
                                placeholder="Buscar por nombre o SKU..."
                                value={searchTerms[0] || ''}
                                onChange={(e) => updateSearchTerm(0, e.target.value)}
                                className="w-full pl-10 pr-10 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                            />
                            {(searchTerms[0] || '') && (
                                <button
                                    onClick={() => updateSearchTerm(0, '')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-650 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            )}
                        </div>
                        <button
                            onClick={addSearchFilter}
                            title="Agregar palabra clave"
                            className="h-[46px] w-[46px] bg-primary text-white hover:bg-primary/90 rounded-xl flex items-center justify-center shadow-sm hover:shadow active:scale-95 transition-all text-xl font-bold shrink-0"
                        >
                            +
                        </button>
                    </div>

                    {searchTerms.length > 1 && (
                        <div className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                                <span>Palabras Clave Adicionales</span>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={collapseAllFilters} 
                                        className="text-primary hover:underline transition-all text-xs font-bold"
                                    >
                                        Contraer todos
                                    </button>
                                    <span>•</span>
                                    <button 
                                        onClick={clearAllAdditionalFilters} 
                                        className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:underline transition-all text-xs font-bold"
                                    >
                                        Borrar filtros
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 items-center mt-1">
                                {searchTerms.slice(1).map((term, idx) => {
                                    const actualIdx = idx + 1;
                                    const isCollapsed = !expanded[actualIdx];
                                    const isExclude = term.trim().startsWith('-');
                                    const cleanTerm = isExclude ? term.trim().slice(1).trim() : term.trim();
                                    
                                    const toggleExclude = (e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        if (isExclude) {
                                            updateSearchTerm(actualIdx, cleanTerm);
                                        } else {
                                            updateSearchTerm(actualIdx, `-${cleanTerm || ''}`);
                                        }
                                    };

                                    return (
                                        <div 
                                            key={actualIdx} 
                                            className="transition-all duration-300"
                                            onBlur={(e) => handleBlurContainer(e, actualIdx)}
                                        >
                                            {isCollapsed ? (
                                                <div 
                                                    onClick={() => toggleExpandFilter(actualIdx)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-xs border shadow-sm cursor-pointer hover:scale-105 active:scale-95 transition-all ${isExclude ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/50' : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                                                >
                                                    <span className={`material-symbols-outlined text-[14px] ${isExclude ? 'text-red-500' : 'text-primary'}`}>
                                                        {isExclude ? 'block' : 'search'}
                                                    </span>
                                                    <span className="truncate max-w-[120px]">{cleanTerm || `Filtro ${actualIdx}`}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            removeSearchFilter(actualIdx);
                                                        }}
                                                        className={`ml-1 p-0.5 rounded-full transition-colors ${isExclude ? 'hover:bg-red-200 dark:hover:bg-red-800 text-red-400 hover:text-red-700' : 'hover:bg-slate-250 dark:hover:bg-slate-700 text-gray-400 hover:text-red-550'}`}
                                                        title="Eliminar filtro"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className={`flex gap-2 items-center min-w-[280px] sm:min-w-[320px] p-1 rounded-xl border shadow-sm ${isExclude ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                                    <div className="relative flex-1">
                                                        <span className={`material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] ${isExclude ? 'text-red-400' : 'text-slate-400'}`}>
                                                            {isExclude ? 'block' : 'search'}
                                                        </span>
                                                        <input
                                                            type="text"
                                                            placeholder={isExclude ? `Palabra a excluir ${actualIdx}...` : `Palabra clave ${actualIdx}...`}
                                                            value={term}
                                                            onChange={(e) => updateSearchTerm(actualIdx, e.target.value)}
                                                            className={`w-full pl-8 pr-20 py-2 bg-transparent text-sm outline-none ${isExclude ? 'text-red-700 dark:text-red-300 placeholder-red-300 dark:placeholder-red-700/50' : 'text-slate-700 dark:text-slate-200'}`}
                                                            autoFocus
                                                        />
                                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                            <button
                                                                onClick={toggleExclude}
                                                                className={`px-1.5 py-0.5 rounded-md transition-colors text-[10px] font-bold uppercase tracking-wider ${isExclude ? 'bg-red-100 dark:bg-red-800/50 text-red-700 dark:text-red-300 hover:bg-red-200' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200'}`}
                                                                title={isExclude ? "Cambiar a incluir" : "Cambiar a excluir"}
                                                            >
                                                                {isExclude ? 'Excluir' : 'Incluir'}
                                                            </button>
                                                            {term && (
                                                                <button
                                                                    onClick={() => updateSearchTerm(actualIdx, '')}
                                                                    className={`p-0.5 transition-colors ${isExclude ? 'text-red-400 hover:text-red-600' : 'text-slate-400 hover:text-slate-650'}`}
                                                                >
                                                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => toggleExpandFilter(actualIdx)}
                                                        className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${isExclude ? 'hover:bg-red-100 dark:hover:bg-red-800/50 text-red-600 dark:text-red-400' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-750'}`}
                                                        title="Contraer"
                                                    >
                                                        Contraer
                                                    </button>
                                                    <button
                                                        onClick={() => removeSearchFilter(actualIdx)}
                                                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 rounded-lg border border-transparent hover:border-red-200 dark:hover:border-red-900/40 flex items-center justify-center transition-colors shrink-0"
                                                        title="Eliminar"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">close</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══════ TABLE ═══════ */}
            <div 
                style={{ borderRadius: '6px' }}
                className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}
            >
                {viewMode === 'table' ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-medium text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-3 py-3 w-10">
                                        <input
                                            type="checkbox"
                                            checked={products.length > 0 && products.every(p => selectedIds.has(p.id))}
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
                ) : (
                    <div className="p-4">
                        {/* Gallery-only toolbar: keeps sorting/column-filtering/select-all available without a table header */}
                        <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                            <label className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={products.length > 0 && products.every(p => selectedIds.has(p.id))}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                />
                                Seleccionar todo
                            </label>
                            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden sm:block" />
                            <select
                                value={sortConfig.key}
                                onChange={(e) => handleSort(e.target.value)}
                                className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 focus:outline-none focus:border-primary"
                            >
                                {columns.map(col => (
                                    <option key={col.key} value={col.key}>Ordenar por: {col.label}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                title={sortConfig.direction === 'asc' ? 'Ascendente' : 'Descendente'}
                            >
                                <span className="material-symbols-outlined text-[18px]">{sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
                            </button>
                            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden sm:block" />
                            {columns.filter(col => col.key !== 'brand' && col.key !== 'price').map(col => (
                                <input
                                    key={col.key}
                                    type="text"
                                    placeholder={`Filtrar ${col.label}...`}
                                    value={filters[col.key] || ''}
                                    onChange={(e) => handleFilterChange(col.key, e.target.value)}
                                    className="px-3 py-1.5 text-xs w-36 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:outline-none focus:border-primary text-slate-700 dark:text-slate-200"
                                />
                            ))}
                        </div>

                        {/*
                            `items-stretch` + `auto-rows-fr` en la rejilla: al mostrarse los
                            nombres completos, cada tarjeta tiene un alto distinto. Esto
                            iguala el alto dentro de cada fila para que la rejilla no quede
                            dentada, sin volver a recortar el texto.
                        */}
                        {products.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 items-stretch auto-rows-fr">
                                {renderedCards}
                            </div>
                        ) : !loading ? (
                            <div className="flex flex-col items-center gap-2 py-12 text-slate-500">
                                <span className="material-symbols-outlined text-[36px] text-slate-300">search_off</span>
                                <span>No se encontraron productos que coincidan con tu búsqueda.</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 py-12 text-slate-500">
                                <span className="material-symbols-outlined animate-spin text-[36px] text-primary">progress_activity</span>
                                <span>Cargando catálogo...</span>
                            </div>
                        )}
                    </div>
                )}

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
                onAddMedia={() => {
                    setLightbox(prev => ({ ...prev, isOpen: false }));
                    if (lightbox.product) {
                        handleOpenModal(lightbox.product);
                    }
                }}
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
                        onClick={() => setIsInventoryGroupSelectOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-semibold transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">inventory</span>
                        Grupo Inventario
                    </button>
                    <button
                        onClick={() => setIsBulkEditOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-semibold transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">edit_note</span>
                        Edición Rápida
                    </button>
                    <button
                        onClick={async () => {
                            const selectedProds = products.filter(p => selectedIds.has(p.id));
                            for (const prod of selectedProds) {
                                await addToQueue({ id: prod.id, sku: prod.sku, name: prod.name, image_url: prod.image_url }, 1);
                            }
                            await loadQueue();
                            setQueueToast(`✓ ${selectedProds.length} repuesto(s) agregados a la cola`);
                            setTimeout(() => setQueueToast(null), 2200);
                            setSelectedIds(new Set());
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-400 text-white rounded-xl text-sm font-semibold transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">playlist_add</span>
                        Cola Impresión
                    </button>
                    <button
                        onClick={() => {
                            const selectedProds = products.filter(p => selectedIds.has(p.id));
                            selectedProds.forEach(prod => {
                                useProformaStore.getState().addItem({ id: prod.id, sku: prod.sku, name: prod.name, price: prod.price }, 1);
                            });
                            setSelectedIds(new Set());
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-sm font-semibold transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">request_quote</span>
                        Agregar a Proforma
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
            {isLabelModalOpen && (
                <ProductLabelModal
                    isOpen={isLabelModalOpen}
                    onClose={() => {
                        setIsLabelModalOpen(false);
                        setLabelProduct(null);
                    }}
                    product={labelProduct}
                />
            )}
            {isInventoryGroupSelectOpen && (
                <InventoryGroupSelectModal
                    isOpen={isInventoryGroupSelectOpen}
                    onClose={() => setIsInventoryGroupSelectOpen(false)}
                    onSuccess={() => setSelectedIds(new Set())}
                    selectedIds={selectedIds}
                />
            )}

            {/* ═══════ QUEUE TOAST ═══════ */}
            {queueToast && (
                <div className="fixed top-6 right-6 z-50 bg-amber-500 text-white py-3 px-5 rounded-xl shadow-2xl flex items-center gap-2 font-semibold text-sm animate-in slide-in-from-top-2">
                    <span className="material-symbols-outlined text-lg">playlist_add_check</span>
                    {queueToast}
                </div>
            )}

            {/* ═══════ PRINT QUEUE FLOATING INDICATOR ═══════ */}
            {(() => {
                const q = printQueue;
                if (q.length === 0) return null;
                const totalLabels = getQueueTotalLabels(q);
                const totalPages = getQueuePageCount(q);
                return (
                    <>
                        {/* Collapsed FAB */}
                        {!isQueuePanelOpen && (
                            <button
                                onClick={() => { loadQueue(); setIsQueuePanelOpen(true); }}
                                className="fixed bottom-6 right-6 z-40 bg-amber-500 hover:bg-amber-600 text-white w-14 h-14 rounded-full shadow-2xl shadow-amber-500/40 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                                title="Ver cola de impresión"
                            >
                                <span className="material-symbols-outlined text-2xl">print</span>
                                <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] flex items-center justify-center bg-white text-amber-600 text-[11px] font-black rounded-full shadow-md border-2 border-amber-500">
                                    {q.length}
                                </span>
                            </button>
                        )}

                        {/* Expanded Queue Panel */}
                        {isQueuePanelOpen && (
                            <div className="fixed bottom-6 right-6 z-40 w-[380px] max-h-[70vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
                                {/* Panel Header */}
                                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-900/10">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-amber-600 dark:text-amber-400">print</span>
                                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">Cola de Impresión</h3>
                                        <span className="text-xs font-bold bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full">
                                            {totalLabels} etiq · {totalPages} hoja{totalPages !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <button onClick={() => setIsQueuePanelOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                                        <span className="material-symbols-outlined text-lg">close</span>
                                    </button>
                                </div>

                                {/* Queue Items */}
                                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 max-h-[45vh]">
                                    {printQueue.map((item) => (
                                        <div key={item.sku} className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-750">
                                            <div className="flex-1 min-w-0">
                                                <span className="text-[11px] font-mono font-extrabold text-blue-700 dark:text-blue-300">{item.sku}</span>
                                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate" title={item.name}>{item.name}</p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button onClick={async () => { const updated = await updateQueueItemQty(item.id, item.quantity - 1); setPrintQueue(updated); }} className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold hover:bg-slate-300">−</button>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={async (e) => { const updated = await updateQueueItemQty(item.id, parseInt(e.target.value) || 1); setPrintQueue(updated); }}
                                                    className="w-10 h-6 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-800 dark:text-white p-0 focus:ring-0"
                                                />
                                                <button onClick={async () => { const updated = await updateQueueItemQty(item.id, item.quantity + 1); setPrintQueue(updated); }} className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold hover:bg-slate-300">+</button>
                                            </div>
                                            <button onClick={async () => { const updated = await removeFromQueue(item.id); setPrintQueue(updated); }} className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors" title="Eliminar">
                                                <span className="material-symbols-outlined text-[16px]">close</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Panel Footer */}
                                <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2">
                                    {!showQueueClearConfirm ? (
                                        <button
                                            onClick={() => setShowQueueClearConfirm(true)}
                                            className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors flex items-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                                            Vaciar
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[11px] text-rose-500 font-bold">¿Seguro?</span>
                                            <button onClick={async () => { await clearQueue(); setPrintQueue([]); setShowQueueClearConfirm(false); setIsQueuePanelOpen(false); }} className="text-[11px] font-bold text-white bg-rose-500 px-2 py-1 rounded">Sí</button>
                                            <button onClick={() => setShowQueueClearConfirm(false)} className="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">No</button>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => {
                                            setIsQueuePanelOpen(false);
                                            setIsQueuePreviewOpen(true);
                                        }}
                                        className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-lg">visibility</span>
                                        Vista Previa e Imprimir ({totalLabels})
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                );
            })()}

            {/* Print Queue Preview Interactive Modal */}
            <PrintQueuePreviewModal
                isOpen={isQueuePreviewOpen}
                onClose={() => setIsQueuePreviewOpen(false)}
                onQueueUpdated={(updatedQueue) => setPrintQueue(updatedQueue)}
                isMobile={false}
            />

            {/* Proformas floating panel */}
            <ProformaPanel />
        </div>
    );
};

export default Products;
