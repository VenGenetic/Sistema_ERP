import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { ProductModal } from '../components/ProductModal';
import { CatalogImportWizard } from '../components/CatalogImportWizard';

const Products: React.FC = () => {
    // ──────────────────────────────────────────────
    // 1. DATA STATES
    // ──────────────────────────────────────────────
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<any>(null);
    const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

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
                `, { count: 'exact' });

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
                        onClick={() => handleOpenModal()}
                        className="px-4 py-2 bg-primary text-white rounded-lg flex items-center gap-2 shadow-sm shadow-primary/30 hover:bg-primary/90 transition-colors"
                    >
                        <span className="material-symbols-outlined">add</span>
                        Nuevo Producto
                    </button>
                </div>
            </div>

            {/* ═══════ GLOBAL SEARCH ═══════ */}
            <div className="relative">
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

            {/* ═══════ TABLE ═══════ */}
            <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-medium text-xs uppercase tracking-wider">
                            <tr>
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
                                <tr key={prod.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                                    <td className="px-6 py-4 font-mono text-sm text-slate-500 dark:text-slate-400">{prod.sku}</td>
                                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{prod.name}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{prod.category || '—'}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{prod.brands?.name || '—'}</td>
                                    <td className="px-6 py-4 text-center font-bold text-slate-900 dark:text-white">
                                        {prod.inventory_levels ? prod.inventory_levels.reduce((acc: number, level: any) => acc + (level.current_stock || 0), 0) : 0}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => handleOpenModal(prod)}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                            title="Editar Producto"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">edit</span>
                                        </button>
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
        </div>
    );
};

export default Products;
