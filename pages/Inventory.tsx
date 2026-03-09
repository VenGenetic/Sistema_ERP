import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import InventoryMovementModal from '../components/InventoryMovementModal';
import { ProductEntryForm } from '../components/ProductEntryForm';
import { BatchProductEntry } from '../components/BatchProductEntry'; // New Component
import { PartProfileModal } from '../components/PartProfileModal'; // New Component
import { FitmentSearch } from '../components/FitmentSearch'; // New Component
import { utils, writeFile } from 'xlsx';

// Define types based on our join queries
interface StockItem {
    id: number;
    product_id: number;
    warehouse_id: number;
    current_stock: number;
    products: {
        id: number;
        name: string;
        sku: string;
        category: string;
        brand_id: number | null;
        min_stock_threshold: number;
        profit_margin: number;
        cost_without_vat: number | null;
        vat_percentage: number | null;
        brands?: {
            name: string;
        } | null;
    };
    warehouses: {
        name: string;
    };
}
interface Movement {
    id: number;
    created_at: string;
    quantity_change: number;
    reason: string;
    type: string; // derived
    products: {
        name: string;
    };
    warehouses: {
        name: string;
    };
    user_id: string; // We might want to join profiles if available
    reference_type: string | null;
    reference_id: number | null;
}

interface Warehouse {
    id: number;
    name: string;
    type: string;
    location: string;
    is_active: boolean;
}

const Inventory: React.FC = () => {
    // ──────────────────────────────────────────────
    // 1. CORE UI STATES
    // ──────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<'warehouses' | 'stock' | 'movements'>('warehouses');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isProductEntryOpen, setIsProductEntryOpen] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);

    // ──────────────────────────────────────────────
    // 2. SEARCH, FILTER, SORT, PAGINATION
    // ──────────────────────────────────────────────
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
    const [filters, setFilters] = useState<{ [key: string]: string }>({});
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 20,
        totalRecords: 0
    });

    // Batch Entry
    const [isBatchEntryOpen, setIsBatchEntryOpen] = useState(false);

    // Export modal state
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportIvaPercent, setExportIvaPercent] = useState<number>(12);

    // Expanded products state for grouped view
    const [expandedProductIds, setExpandedProductIds] = useState<number[]>([]);

    // Part Profile 360 Modal
    const [isPartProfileOpen, setIsPartProfileOpen] = useState(false);
    const [selectedPartProfileData, setSelectedPartProfileData] = useState<any>(null);

    // Fitment Filter
    const [fitmentFilter, setFitmentFilter] = useState<{ make: string; model: string; year: number | null } | null>(null);

    // Lost Demand
    const [isLostDemandModalOpen, setIsLostDemandModalOpen] = useState(false);
    const [lostDemandBrand, setLostDemandBrand] = useState('');
    const [lostDemandBikeModel, setLostDemandBikeModel] = useState('');

    // Data states
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [stockItems, setStockItems] = useState<any[]>([]);
    const [movements, setMovements] = useState<Movement[]>([]);
    const [loading, setLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);

    // ──────────────────────────────────────────────
    // 3. DEBOUNCED SEARCH EFFECT
    // ──────────────────────────────────────────────
    useEffect(() => {
        if (activeTab !== 'stock') return;
        const delayDebounceFn = setTimeout(() => {
            setPagination(prev => ({ ...prev, page: 1 }));
            fetchStockData(1);
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, filters]);

    // Direct fetch on pagination or sort change (no debounce needed)
    useEffect(() => {
        if (activeTab !== 'stock') return;
        fetchStockData(pagination.page);
    }, [pagination.page, pagination.pageSize, sortConfig, selectedWarehouseId]);

    // Fetch warehouses / movements when those tabs change
    useEffect(() => {
        if (activeTab === 'warehouses') {
            fetchWarehouses();
        } else if (activeTab === 'movements') {
            fetchMovements();
        } else if (activeTab === 'stock') {
            // Initial stock load when switching to stock tab
            fetchStockData(pagination.page);
        }
    }, [activeTab, fitmentFilter]);

    // ──────────────────────────────────────────────
    // 4. SUPABASE QUERY ENGINE (STOCK TAB)
    // ──────────────────────────────────────────────
    const fetchStockData = useCallback(async (page?: number) => {
        setLoading(true);
        try {
            const currentPage = page || pagination.page;

            if (fitmentFilter) {
                // ── Fitment RPC: client-side pagination ──
                const { data, error } = await supabase.rpc('search_inventory_by_fitment', {
                    p_make: fitmentFilter.make || null,
                    p_model: fitmentFilter.model || null,
                    p_year: fitmentFilter.year || null
                });

                if (error) throw error;

                const mappedData = (data || []).map((row: any) => ({
                    id: row.inventory_id,
                    product_id: row.product_id,
                    warehouse_id: row.warehouse_id,
                    current_stock: Number(row.current_stock),
                    products: {
                        id: row.product_id,
                        name: row.product_name,
                        sku: row.product_sku,
                        category: row.product_category,
                        min_stock_threshold: row.product_min_stock,
                        price: row.product_price,
                        cost_without_vat: row.product_cost,
                        profit_margin: row.product_margin,
                        brands: { name: row.brand_name }
                    },
                    warehouses: { name: row.warehouse_name }
                }));

                // Client-side search filter for fitment results
                let filtered = mappedData as unknown as StockItem[];
                if (searchTerm) {
                    const terms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
                    filtered = filtered.filter(item => {
                        const name = item.products?.name?.toLowerCase() || '';
                        const sku = item.products?.sku?.toLowerCase() || '';
                        return terms.every(t => name.includes(t) || sku.includes(t));
                    });
                }

                setPagination(prev => ({ ...prev, totalRecords: filtered.length }));

                // Client-side paginate the filtered fitment results
                const from = (currentPage - 1) * pagination.pageSize;
                const to = from + pagination.pageSize;
                setStockItems(filtered.slice(from, to));
            } else {
                // ── Standard server-side paginated query ──
                // We query products and join inventory_levels to ensure grouping by product
                let selectStr = `
                    id, name, sku, category, min_stock_threshold, profit_margin, price,
                    cost_without_vat, vat_percentage,
                    brands${filters.brand ? '!inner' : ''} (name),
                    inventory_levels${selectedWarehouseId ? '!inner' : ''} (
                        id, current_stock, warehouse_id,
                        warehouses (name)
                    )
                `;

                let query = supabase
                    .from('products')
                    .select(selectStr, { count: 'exact' });

                // Warehouse filter (applied to the nested relation via !inner in select)
                if (selectedWarehouseId) {
                    query = query.eq('inventory_levels.warehouse_id', selectedWarehouseId);
                }

                // Search (applied to products)
                if (searchTerm) {
                    query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
                }

                // Column Filters
                if (filters.product) {
                    query = query.ilike('name', `%${filters.product}%`);
                }
                if (filters.sku) {
                    query = query.ilike('sku', `%${filters.sku}%`);
                }
                if (filters.brand) {
                    query = query.ilike('brands.name', `%${filters.brand}%`);
                }

                // Sorting
                const isAscending = sortConfig.direction === 'asc';
                if (sortConfig.key === 'product') {
                    query = query.order('name', { ascending: isAscending });
                } else if (sortConfig.key === 'sku') {
                    query = query.order('sku', { ascending: isAscending });
                } else if (sortConfig.key === 'brand') {
                    query = query.order('name', { referencedTable: 'brands', ascending: isAscending });
                } else {
                    query = query.order('id', { ascending: isAscending });
                }

                // Pagination
                const from = (currentPage - 1) * pagination.pageSize;
                const to = from + pagination.pageSize - 1;
                query = query.range(from, to);

                // Execute
                const { data, error, count } = await query;

                if (error) throw error;

                setStockItems(data || []);
                if (count !== null) {
                    setPagination(prev => ({ ...prev, totalRecords: count }));
                }
            }
        } catch (error) {
            console.error('Error fetching stock data:', error);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, filters, sortConfig, pagination.page, pagination.pageSize, fitmentFilter, selectedWarehouseId]);

    const fetchWarehouses = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('warehouses').select('*').order('id');
            if (error) throw error;
            setWarehouses(data || []);
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMovements = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('inventory_logs')
                .select(`
                    id, created_at, quantity_change, reason, user_id, reference_type, reference_id,
                    products (name),
                    warehouses (name)
                `)
                .order('created_at', { ascending: false })
                .limit(50);
            if (error) throw error;
            // @ts-ignore
            setMovements(data || []);
        } catch (error) {
            console.error('Error fetching movements:', error);
        } finally {
            setLoading(false);
        }
    };

    // Legacy compat helper
    const fetchData = () => {
        if (activeTab === 'warehouses') fetchWarehouses();
        else if (activeTab === 'stock') fetchStockData(pagination.page);
        else if (activeTab === 'movements') fetchMovements();
    };

    const handleMovementSuccess = () => {
        fetchData();
    };

    const handleOpenProductEntry = (productId: number) => {
        setSelectedProductId(productId);
        setIsProductEntryOpen(true);
    };

    const handleOpenPartProfile = (groupData: void) => {
        setSelectedPartProfileData(groupData);
        setIsPartProfileOpen(true);
    };

    // Replaced Logic: New Product opens Batch Entry
    const handleNewProduct = () => {
        setIsBatchEntryOpen(true);
    };

    const handleRegistrarDemanda = async (term: string, reason: string, customData?: any) => {
        try {
            await supabase.from('lost_demand').insert([{
                search_term: term,
                reason: reason,
                channel: 'INVENTORY',
                ...customData
            }]);
            console.log("Lost demand logged:", term);
        } catch (e) {
            console.error(e);
        }
    };

    const handleManualLostDemandSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await handleRegistrarDemanda(searchTerm || 'Búsqueda Manual', 'not_in_catalog', {
            custom_brand: lostDemandBrand,
            custom_model: lostDemandBikeModel
        });
        alert('Demanda registrada exitosamente.');
        setIsLostDemandModalOpen(false);
        setLostDemandBrand('');
        setLostDemandBikeModel('');
    };

    // ──────────────────────────────────────────────
    // GROUPING (works on paginated data)
    // ──────────────────────────────────────────────
    const groupedStockItems = useMemo(() => {
        return stockItems.map(item => {
            const levels = (item.inventory_levels || []);
            const globalStock = levels.reduce((sum: number, il: any) => sum + il.current_stock, 0);

            return {
                product_id: item.id,
                product: item,
                global_stock: globalStock,
                details: levels
            };
        });
    }, [stockItems]);

    // Export current stock view to Excel using the same format as the import template
    const handleExportToExcel = async () => {
        setExportLoading(true);
        try {
            const ivaMult = 1 + exportIvaPercent / 100;

            // 1. Fetch ALL matching products (no pagination)
            let selectStr = `
                id, name, sku, category, min_stock_threshold, profit_margin, price,
                cost_without_vat, vat_percentage,
                brands!inner (name),
                inventory_levels (
                    id, current_stock, warehouse_id,
                    warehouses (name)
                )
            `;

            let query = supabase
                .from('products')
                .select(selectStr)
                .limit(50000); // Bypass the default 1000 row limit for full catalog export

            // Same filters as fetchStockData
            if (selectedWarehouseId) {
                query = query.eq('inventory_levels.warehouse_id', selectedWarehouseId);
            }
            if (searchTerm) {
                query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
            }
            if (filters.product) {
                query = query.ilike('name', `%${filters.product}%`);
            }
            if (filters.sku) {
                query = query.ilike('sku', `%${filters.sku}%`);
            }
            if (filters.brand) {
                query = query.ilike('brands.name', `%${filters.brand}%`);
            }

            // Same sorting
            const isAscending = sortConfig.direction === 'asc';
            if (sortConfig.key === 'product') {
                query = query.order('name', { ascending: isAscending });
            } else if (sortConfig.key === 'sku') {
                query = query.order('sku', { ascending: isAscending });
            } else if (sortConfig.key === 'brand') {
                query = query.order('name', { referencedTable: 'brands', ascending: isAscending });
            } else {
                query = query.order('id', { ascending: isAscending });
            }

            const { data, error } = await query;
            if (error) throw error;

            // 2. Map to export data
            const exportData = (data || []).map(product => {
                const globalStock = (product.inventory_levels || []).reduce((sum: number, il: any) => sum + il.current_stock, 0);
                const costWithoutVat = product.cost_without_vat ?? null;
                const storedVat = product.vat_percentage ?? exportIvaPercent;
                const costWithVat = costWithoutVat !== null
                    ? parseFloat((costWithoutVat * (1 + storedVat / 100)).toFixed(4))
                    : null;
                const costoSinIva = costWithVat !== null
                    ? parseFloat((costWithVat / ivaMult).toFixed(4))
                    : '';

                return {
                    'SKU': product.sku || '',
                    'Nombre': product.name || '',
                    'Cantidad': globalStock,
                    'Costo S/IVA': costoSinIva, // Changed from Costo S/I to match Catalog Import
                    'Costo Desc.': '',
                    'Margen': product.profit_margin ?? 0.30,
                    'Categoría': product.category || '', // Added to match Catalog Import
                    'IVA %': product.vat_percentage ?? exportIvaPercent, // Added to match Catalog Import
                    'Costo C/IVA': costWithVat ?? '',
                };
            });

            const ws = utils.json_to_sheet(exportData, {
                header: ['SKU', 'Nombre', 'Cantidad', 'Costo S/IVA', 'Costo Desc.', 'Margen', 'Categoría', 'IVA %', 'Costo C/IVA']
            });

            ws['!cols'] = [
                { wch: 20 }, { wch: 40 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 8 }, { wch: 14 },
            ];

            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, 'Inventario');
            writeFile(wb, `inventario_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            alert('Error al exportar los datos. Por favor, intente de nuevo.');
        } finally {
            setExportLoading(false);
            setShowExportModal(false);
        }
    };

    const handleWarehouseClick = (warehouseId: number) => {
        setSelectedWarehouseId(warehouseId);
        setPagination(prev => ({ ...prev, page: 1 }));
        setActiveTab('stock');
    };

    const clearWarehouseFilter = () => {
        setSelectedWarehouseId(null);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    // Sort handler
    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const toggleExpandProduct = (productId: number) => {
        setExpandedProductIds(prev =>
            prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
        );
    };

    // ──────────────────────────────────────────────
    // PAGINATION HELPERS
    // ──────────────────────────────────────────────
    const totalPages = Math.ceil(pagination.totalRecords / pagination.pageSize);
    const showingFrom = pagination.totalRecords === 0 ? 0 : ((pagination.page - 1) * pagination.pageSize) + 1;
    const showingTo = Math.min(pagination.page * pagination.pageSize, pagination.totalRecords);

    return (
        <div className="flex flex-col gap-6 p-6 md:p-8 max-w-[1400px] mx-auto">
            {/* Export IVA Modal */}
            {showExportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="flex items-center gap-3 p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg">
                                <span className="material-symbols-outlined text-[22px]">table_view</span>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">Exportar a Excel</h3>
                                <p className="text-xs text-slate-500">Configura el IVA para el cálculo de costos</p>
                            </div>
                        </div>
                        <div className="p-5 flex flex-col gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    IVA para calcular <span className="font-mono text-slate-500">Costo S/I</span> (%)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={exportIvaPercent}
                                    onChange={e => setExportIvaPercent(parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                                />
                                <p className="text-xs text-slate-400 mt-1.5">
                                    <span className="font-mono">Costo S/I = Costo C/IVA ÷ (1 + {exportIvaPercent}%)</span>
                                </p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-3 text-xs text-slate-500 space-y-1">
                                <p>Se exportarán <span className="font-semibold text-slate-700 dark:text-slate-300">{groupedStockItems.length}</span> productos visibles.</p>
                                <p>Columnas: SKU · Nombre · Cantidad · Costo S/IVA · Costo Desc. · Margen · Categoría · IVA % · Costo C/IVA</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 px-5 pb-5">
                            <button
                                onClick={() => setShowExportModal(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleExportToExcel}
                                disabled={exportLoading}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                            >
                                <span className={`material-symbols-outlined text-[18px] ${exportLoading ? 'animate-spin' : ''}`}>
                                    {exportLoading ? 'progress_activity' : 'download'}
                                </span>
                                {exportLoading ? 'Exportando...' : 'Descargar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <InventoryMovementModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleMovementSuccess}
            />

            {/* Batch Entry Modal (New Product Flow) */}
            <BatchProductEntry
                isOpen={isBatchEntryOpen}
                onClose={() => setIsBatchEntryOpen(false)}
                onSuccess={() => fetchData()}
            />

            {/* Product Entry Modal (Surtir) */}
            {isProductEntryOpen && selectedProductId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden relative">
                        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-bold dark:text-white">Registrar Costo y Entrada</h3>
                            <button
                                onClick={() => setIsProductEntryOpen(false)}
                                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                            >
                                <span className="material-symbols-outlined text-slate-500">close</span>
                            </button>
                        </div>
                        <ProductEntryForm
                            productId={selectedProductId}
                            onSave={() => {
                                setIsProductEntryOpen(false);
                                fetchData();
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Part Profile Modal */}
            <PartProfileModal
                isOpen={isPartProfileOpen}
                onClose={() => setIsPartProfileOpen(false)}
                product={selectedPartProfileData}
            />

            {/* Header ... */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span className="hover:text-primary transition-colors cursor-pointer">Inicio</span>
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    <span className="text-slate-900 dark:text-white font-medium">Inventario y Logística</span>
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Gestión de Inventario</h1>
                        <p className="text-slate-500 mt-1">Controla tus almacenes físicos y virtuales, stock y movimientos (ACID Compliant).</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={fetchData}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        >
                            <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
                            Actualizar
                        </button>
                        {activeTab === 'stock' && (
                            <>
                                <button
                                    onClick={() => setShowExportModal(true)}
                                    disabled={exportLoading}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
                                    title="Exportar inventario visible como Excel (mismo formato que importación)"
                                >
                                    <span className={`material-symbols-outlined text-[18px] text-emerald-600 ${exportLoading ? 'animate-spin' : ''}`}>
                                        {exportLoading ? 'progress_activity' : 'table_view'}
                                    </span>
                                    {exportLoading ? 'Exportando...' : 'Exportar Excel'}
                                </button>
                                <button
                                    onClick={handleNewProduct}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-emerald-600/30"
                                >
                                    <span className="material-symbols-outlined text-[18px]">dataset</span>
                                    Entrada por Lote
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-primary/30"
                        >
                            <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                            Registrar Movimiento
                        </button>
                    </div>
                </div>
                {activeTab === 'stock' && (
                    <div className="flex justify-end mt-2">
                        <button
                            onClick={() => setIsLostDemandModalOpen(true)}
                            className="flex items-center justify-center gap-2 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-bold transition-colors shadow-sm border border-amber-200"
                            title="Registrar una alerta si el cliente pidió algo que no tenemos."
                        >
                            <span className="material-symbols-outlined text-[16px]">warning</span>
                            Registrar Demanda Perdida
                        </button>
                    </div>
                )}
            </div>



            {/* Active Warehouse Filter Banner */}
            {activeTab === 'stock' && selectedWarehouseId && (
                <div className="flex items-center justify-between p-4 bg-primary/10 border border-primary/20 rounded-xl mb-2">
                    <div className="flex items-center gap-2 text-primary font-medium text-sm">
                        <span className="material-symbols-outlined text-[20px]">location_on</span>
                        <span>
                            Mostrando inventario en: <span className="font-bold">{warehouses.find(w => w.id === selectedWarehouseId)?.name}</span>
                        </span>
                    </div>
                    <button
                        onClick={clearWarehouseFilter}
                        className="p-1 hover:bg-primary/20 rounded-full transition-colors text-primary flex items-center justify-center"
                        title="Quitar filtro"
                    >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>
            )}

            {/* Advanced Search Input */}
            {activeTab === 'stock' && (
                <div className="flex flex-col gap-4 mb-4">
                    <FitmentSearch
                        onSearch={(make, model, year) => setFitmentFilter({ make, model, year })}
                        onReset={() => setFitmentFilter(null)}
                    />

                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            type="text"
                            placeholder="Buscar por nombre, SKU, palabras clave..."
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
                </div>
            )}


            {/* Tabs */}
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="flex gap-6">
                    <button
                        onClick={() => {
                            setActiveTab('warehouses');
                            setSelectedWarehouseId(null);
                        }}
                        className={`py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'warehouses' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        <span className="material-symbols-outlined text-[20px]">warehouse</span>
                        Almacenes
                    </button>
                    <button
                        onClick={() => setActiveTab('stock')}
                        className={`py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'stock' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                        Inventario Global
                    </button>
                    <button
                        onClick={() => setActiveTab('movements')}
                        className={`py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'movements' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        <span className="material-symbols-outlined text-[20px]">history</span>
                        Historial de Movimientos
                    </button>
                </nav>
            </div>

            <div className="min-h-[400px]">
                {activeTab === 'warehouses' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {warehouses.length === 0 && !loading && (
                            <div className="col-span-full text-center py-10 text-slate-500">
                                No se encontraron almacenes.
                            </div>
                        )}
                        {warehouses.map(wh => (
                            <div
                                key={wh.id}
                                onClick={() => handleWarehouseClick(wh.id)}
                                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col shadow-sm hover:shadow-md transition-all cursor-pointer group ring-offset-2 hover:ring-2 ring-primary/50"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-lg ${wh.type === 'physical' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'}`}>
                                        <span className="material-symbols-outlined text-[24px]">{wh.type === 'physical' ? 'store' : 'cloud'}</span>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${wh.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-600'}`}>
                                        {wh.is_active ? 'Activo' : 'Inactivo'}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 group-hover:text-primary transition-colors">{wh.name}</h3>
                                <p className="text-sm text-slate-500 flex items-center gap-1 mb-4">
                                    <span className="material-symbols-outlined text-[16px]">location_on</span>
                                    {wh.location || 'N/A'}
                                </p>
                                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Ver inventario</span>
                                    <span className="material-symbols-outlined text-primary">arrow_forward</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'stock' && (
                    <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-medium text-xs uppercase tracking-wider">
                                    <tr>
                                        {[
                                            { key: 'product', label: 'Producto' },
                                            { key: 'brand', label: 'Marca' },
                                            { key: 'sku', label: 'SKU' },
                                            { key: 'stock', label: 'Stock Global', align: 'right' }
                                        ].map(col => (
                                            <th key={col.key} className={`px-6 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${col.align === 'right' ? 'text-right' : ''}`} onClick={() => handleSort(col.key)}>
                                                <div className={`flex flex-col gap-2 ${col.align === 'right' ? 'items-end' : 'items-start'}`}>
                                                    <div className="flex items-center gap-1">
                                                        {col.label}
                                                        <div className="flex flex-col">
                                                            <span className={`material-symbols-outlined text-[10px] leading-none ${sortConfig.key === col.key && sortConfig.direction === 'asc' ? 'text-primary' : 'text-slate-300'}`}>arrow_drop_up</span>
                                                            <span className={`material-symbols-outlined text-[10px] leading-none ${sortConfig.key === col.key && sortConfig.direction === 'desc' ? 'text-primary' : 'text-slate-300'}`}>arrow_drop_down</span>
                                                        </div>
                                                    </div>
                                                    {col.key !== 'stock' && (
                                                        <input
                                                            type="text"
                                                            placeholder={`Filtrar...`}
                                                            value={filters[col.key] || ''}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={(e) => handleFilterChange(col.key, e.target.value)}
                                                            className="w-full min-w-[80px] px-2 py-1 text-xs font-normal border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 focus:outline-none focus:border-primary"
                                                        />
                                                    )}
                                                </div>
                                            </th>
                                        ))}
                                        <th className="px-6 py-3 text-center">Estado</th>
                                        <th className="px-6 py-3 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {groupedStockItems.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className="material-symbols-outlined text-[36px] text-slate-300">search_off</span>
                                                    <span>No hay registros que coincidan con tu búsqueda.</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {groupedStockItems.length === 0 && loading && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className="material-symbols-outlined animate-spin text-[36px] text-primary">progress_activity</span>
                                                    <span>Cargando inventario...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {groupedStockItems.map(group => {
                                        const isContextuallyDimmed = selectedWarehouseId !== null;
                                        const isExpanded = selectedWarehouseId !== null || expandedProductIds.includes(group.product_id);

                                        return (
                                            <React.Fragment key={group.product_id}>
                                                <tr className={`transition-colors group cursor-pointer ${isContextuallyDimmed ? 'opacity-60 bg-slate-50 dark:bg-slate-800/50' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`} onClick={() => handleOpenPartProfile(group)}>
                                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); toggleExpandProduct(group.product_id); }}
                                                                className={`material-symbols-outlined text-[20px] p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                                            >
                                                                chevron_right
                                                            </button>
                                                            <div className="hover:text-primary transition-colors">
                                                                {group.product?.name}
                                                                <div className="text-xs text-slate-500 mt-0.5">{group.product?.category}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-sm">
                                                        {group.product?.brands?.name || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500 font-mono text-sm">
                                                        {group.product?.sku}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">{group.global_stock}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${group.global_stock < (group.product?.min_stock_threshold || 10) ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
                                                            {group.global_stock < (group.product?.min_stock_threshold || 10) ? 'Bajo Stock' : 'En Stock'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => handleOpenProductEntry(group.product_id)}
                                                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${isContextuallyDimmed ? 'bg-blue-50 text-blue-500 dark:bg-blue-900/10 dark:text-blue-400' : 'bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50'}`}
                                                            >
                                                                <span className="material-symbols-outlined text-[14px]">add_shopping_cart</span>
                                                                Surtir
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isExpanded && group.details.map((detail: StockItem) => {
                                                    if (selectedWarehouseId && detail.warehouse_id !== selectedWarehouseId) {
                                                        return null;
                                                    }

                                                    const isHighlighted = selectedWarehouseId === detail.warehouse_id;

                                                    return (
                                                        <tr key={detail.id} className={`${isHighlighted ? 'bg-primary/5 dark:bg-primary/10 border-l-4 border-l-primary' : 'bg-slate-50/50 dark:bg-slate-800/50'} border-t-0`}>
                                                            <td className={`px-6 py-3 pl-14 text-sm ${isHighlighted ? 'text-primary' : 'text-slate-600 dark:text-slate-400'}`} colSpan={3}>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="material-symbols-outlined text-[16px] opacity-70">subdirectory_arrow_right</span>
                                                                    Almacén: <span className={`font-medium ${isHighlighted ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>{detail.warehouses?.name}</span>
                                                                </div>
                                                            </td>
                                                            <td className={`px-6 py-3 text-right font-semibold ${isHighlighted ? 'text-primary text-base' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                {detail.current_stock}
                                                            </td>
                                                            <td colSpan={2}></td>
                                                        </tr>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* ═══════ PAGINATION FOOTER ═══════ */}
                        {pagination.totalRecords > 0 && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                                <div className="text-sm text-slate-500">
                                    Mostrando <span className="font-semibold text-slate-700 dark:text-slate-300">{showingFrom}–{showingTo}</span> de <span className="font-semibold text-slate-700 dark:text-slate-300">{pagination.totalRecords.toLocaleString()}</span> registros
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
                )}

                {activeTab === 'movements' && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-medium text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-3">Fecha</th>
                                        <th className="px-6 py-3">Tipo</th>
                                        <th className="px-6 py-3">Producto</th>
                                        <th className="px-6 py-3">Almacén</th>
                                        <th className="px-6 py-3">Motivo</th>
                                        <th className="px-6 py-3">Ref</th>
                                        <th className="px-6 py-3 text-right">Cantidad</th>
                                        <th className="px-6 py-3">Usuario</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {movements.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                                                No hay movimientos registrados.
                                            </td>
                                        </tr>
                                    )}
                                    {movements.map(mov => (
                                        <tr key={mov.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-sm">
                                                {new Date(mov.created_at).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`flex items-center gap-1 text-sm font-medium ${mov.quantity_change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                    <span className="material-symbols-outlined text-[16px]">{mov.quantity_change > 0 ? 'arrow_downward' : 'arrow_upward'}</span>
                                                    {mov.quantity_change > 0 ? 'Entrada' : 'Salida'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                                {/* @ts-ignore */}
                                                {mov.products?.name}
                                            </td>
                                            <td className="px-6 py-4 text-slate-900 dark:text-white">
                                                {/* @ts-ignore */}
                                                {mov.warehouses?.name}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-sm">{mov.reason}</td>
                                            <td className="px-6 py-4 text-slate-500 text-sm whitespace-nowrap">
                                                {mov.reference_type ? (
                                                    <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs font-mono">
                                                        {mov.reference_type} #{mov.reference_id}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">{Math.abs(mov.quantity_change)}</td>
                                            <td className="px-6 py-4 text-slate-500 text-sm">{mov.user_id?.substring(0, 8)}...</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Lost Demand Modal */}
            {isLostDemandModalOpen && (
                <div className="fixed inset-0 z-[160] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-amber-50">
                            <h2 className="font-bold text-amber-800 uppercase tracking-tight flex items-center gap-2">
                                <span className="material-symbols-outlined text-[20px]">warning</span>
                                Registrar Demanda Perdida
                            </h2>
                            <button onClick={() => setIsLostDemandModalOpen(false)} className="text-amber-500 hover:text-amber-800 font-bold px-2 py-1 rounded hover:bg-amber-200 transition-colors">
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleManualLostDemandSubmit} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Repuesto Buscado</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-100 border border-slate-200 rounded-lg p-3 text-sm font-medium text-slate-600 outline-none focus:border-amber-500 focus:bg-white transition-colors"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Ej: Filtro de aceite"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Marca de Moto (Opcional)</label>
                                <input
                                    autoFocus
                                    type="text"
                                    className="w-full bg-white border border-slate-300 rounded-lg p-3 text-sm focus:border-amber-500 outline-none"
                                    placeholder="Ej: Yamaha"
                                    value={lostDemandBrand}
                                    onChange={(e) => setLostDemandBrand(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Modelo o Cilindraje (Opcional)</label>
                                <input
                                    type="text"
                                    className="w-full bg-white border border-slate-300 rounded-lg p-3 text-sm focus:border-amber-500 outline-none"
                                    placeholder="Ej: FZ16 2015"
                                    value={lostDemandBikeModel}
                                    onChange={(e) => setLostDemandBikeModel(e.target.value)}
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 px-4 bg-amber-500 text-white font-black uppercase rounded-lg hover:bg-amber-600 shadow-md transition-all active:scale-95"
                            >
                                Registrar Demanda
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
