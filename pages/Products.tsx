import React, { useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { supabase } from '../supabaseClient';
import { ProductModal } from '../components/ProductModal';
import { CatalogImportWizard } from '../components/CatalogImportWizard';
import { BulkEditModal } from '../components/BulkEditModal';
import { getThumbnailUrl } from '../utils/image';

const Products: React.FC = () => {
    // ──────────────────────────────────────────────
    // 1. DATA STATES
    // ──────────────────────────────────────────────
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<any>(null);

    // Selection & Bulk Edit
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
    const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

    // Export ZIP
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

    // ──────────────────────────────────────────────
    // 2. FILTER, SORT, PAGINATION STATES
    // ──────────────────────────────────────────────
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<{ [key: string]: string }>({});
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 20,
        totalRecords: 0
    });

    // ──────────────────────────────────────────────
    // 3. DEBOUNCED SEARCH EFFECT
    // ──────────────────────────────────────────────
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            // Reset to page 1 whenever search/filters change
            setPagination(prev => ({ ...prev, page: 1 }));
            fetchCatalogData(1);
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, filters]);

    // Direct fetch on pagination or sort change (no debounce needed)
    useEffect(() => {
        fetchCatalogData(pagination.page);
    }, [pagination.page, pagination.pageSize, sortConfig]);

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
                    inventory_levels (current_stock)
                `, { count: 'exact' })
                .eq('is_active', true);

            // Global Search (OR across name and sku)
            if (searchTerm) {
                query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
            }

            // Column Filters (AND logic)
            if (filters.sku) {
                query = query.ilike('sku', `%${filters.sku}%`);
            }
            if (filters.name) {
                query = query.ilike('name', `%${filters.name}%`);
            }
            if (filters.category) {
                query = query.ilike('category', `%${filters.category}%`);
            }
            
            // Image Status Filter
            if (filters.imageStatus === 'con_imagen') {
                query = query.not('image_url', 'is', null);
            } else if (filters.imageStatus === 'sin_imagen') {
                query = query.is('image_url', null);
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
        } catch (error) {
            console.error('Error fetching catalog:', error);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, filters, sortConfig, pagination.page, pagination.pageSize]);

    // ──────────────────────────────────────────────
    // HANDLERS
    // ──────────────────────────────────────────────
    const handleOpenModal = (product: any = null) => {
        setProductToEdit(product);
        setIsModalOpen(true);
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
            const { error: deleteError } = await supabase
                .from('products')
                .delete()
                .eq('id', product.id);

            if (deleteError) {
                // Si falla por Foreign Key (historial), ofrecemos Soft Delete
                if (deleteError.code === '23503') {
                    const softConfirm = window.confirm(
                        "Este producto tiene historial comercial (ventas o movimientos) y no puede ser borrado permanentemente.\n\n" +
                        "¿Deseas ocultarlo definitivamente del catálogo?"
                    );
                    
                    if (softConfirm) {
                        const { error: updateError } = await supabase
                            .from('products')
                            .update({ is_active: false })
                            .eq('id', product.id);
                        
                        if (updateError) throw updateError;
                        alert("Producto ocultado correctamente.");
                    }
                } else {
                    throw deleteError;
                }
            } else {
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

    const toggleSelectRow = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
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
        { key: 'name', label: 'Nombre', align: '' },
        { key: 'category', label: 'Categoría', align: '' },
        { key: 'brand', label: 'Marca', align: '' },
    ];

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
                <select
                    value={filters.imageStatus || ''}
                    onChange={(e) => handleFilterChange('imageStatus', e.target.value)}
                    className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-700 dark:text-slate-300 lg:min-w-[220px]"
                >
                    <option value="">📸 Todas las Imágenes</option>
                    <option value="con_imagen">✅ Mostrar Con Imagen</option>
                    <option value="sin_imagen">❌ Faltantes (Sin Imagen)</option>
                </select>
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
                                            {col.key !== 'brand' && (
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
                                <th className="px-6 py-3 text-center">Stock Global</th>
                                <th className="px-6 py-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {products.map(prod => (
                                <tr key={prod.id} className={`transition-colors group ${selectedIds.has(prod.id) ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                                    <td className="px-3 py-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(prod.id)}
                                            onChange={() => toggleSelectRow(prod.id)}
                                            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                        />
                                    </td>
                                    <td className="px-6 py-4 font-mono text-sm text-slate-500 dark:text-slate-400">{prod.sku}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            {prod.image_url ? (
                                                <div className="h-10 w-10 flex-shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white shadow-sm relative">
                                                    <img 
                                                       src={getThumbnailUrl(prod.image_url, 80, 80)} 
                                                       alt="" 
                                                       loading="lazy"
                                                       decoding="async"
                                                       className="h-full w-full object-cover" 
                                                       onError={(e) => {
                                                           // Fallback to original if thumbnail fails, or placeholder if both fail
                                                           const target = e.currentTarget;
                                                           if (target.src.includes('render/image')) {
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
                                                </div>
                                            ) : (
                                                <div className="h-10 w-10 flex-shrink-0 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-[20px] text-slate-400">image</span>
                                                </div>
                                            )}
                                            <span className="font-bold text-slate-900 dark:text-white">{prod.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{prod.category || '—'}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{prod.brands?.name || '—'}</td>
                                    <td className="px-6 py-4 text-center font-bold text-slate-900 dark:text-white">
                                        {prod.inventory_levels ? prod.inventory_levels.reduce((acc: number, level: any) => acc + (level.current_stock || 0), 0) : 0}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => handleOpenModal(prod)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                title="Editar Producto"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">edit</span>
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
                            ))}
                            {products.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="material-symbols-outlined text-[36px] text-slate-300">search_off</span>
                                            <span>No se encontraron productos que coincidan con tu búsqueda.</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {products.length === 0 && loading && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
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
