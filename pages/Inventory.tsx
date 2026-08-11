import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import InventoryMovementModal from '../components/InventoryMovementModal';
import { ProductEntryForm } from '../components/ProductEntryForm';
import { BatchProductEntry } from '../components/BatchProductEntry'; // New Component
import { PartProfileModal } from '../components/PartProfileModal'; // New Component
import { ProductModal } from '../components/ProductModal';
import { FitmentSearch } from '../components/FitmentSearch'; // New Component
import { getThumbnailUrl } from '../utils/image';
import { Button, Input } from '../components/ui';
import { cn, page, table as t } from '../components/ui/styles';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Cloud,
  CloudUpload,
  Copy,
  Database,
  Download,
  History,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Package,
  Pencil,
  RefreshCw,
  Search,
  SearchX,
  ShoppingCart,
  Store,
  Table,
  TriangleAlert,
  Warehouse,
  X,
} from 'lucide-react';

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

    // Part Profile 360 Modal
    const [isPartProfileOpen, setIsPartProfileOpen] = useState(false);
    const [selectedPartProfileData, setSelectedPartProfileData] = useState<any>(null);

    // Product Edit Modal (Prices / Image)
    const [isProductEditOpen, setIsProductEditOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<any>(null);
    const [copiedSku, setCopiedSku] = useState<string | null>(null);

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
    const [backupLoading, setBackupLoading] = useState(false);

    // ──────────────────────────────────────────────
    // 3. DEBOUNCED SEARCH, FILTER, AND PAGINATION EFFECT
    // ──────────────────────────────────────────────
    // Coalesce all dependency changes and debounce query by 300ms to eliminate redundant fetches on mount/input
    useEffect(() => {
        if (activeTab !== 'stock') return;
        const delayDebounceFn = setTimeout(() => {
            fetchStockData(pagination.page);
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [activeTab, searchTerm, filters, pagination.page, pagination.pageSize, sortConfig, selectedWarehouseId, fitmentFilter]);

    // Separate effect to reset page to 1 on search/filter changes (this will trigger the main effect above)
    useEffect(() => {
        if (activeTab !== 'stock') return;
        setPagination(prev => {
            if (prev.page === 1) return prev;
            return { ...prev, page: 1 };
        });
    }, [activeTab, searchTerm, filters]);

    // Fetch warehouses / movements when those tabs change
    useEffect(() => {
        if (activeTab === 'warehouses') {
            fetchWarehouses();
        } else if (activeTab === 'movements') {
            fetchMovements();
        }
    }, [activeTab]);

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
                        return terms.every(t => {
                            if (t.startsWith('-')) {
                                const cleanT = t.slice(1);
                                if (!cleanT) return true;
                                return !name.includes(cleanT) && !sku.includes(cleanT);
                            }
                            return name.includes(t) || sku.includes(t);
                        });
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
                    cost_without_vat, vat_percentage, image_url, brand_id,
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
                    if (searchTerm.startsWith('-')) {
                        const cleanTerm = searchTerm.slice(1).trim();
                        if (cleanTerm) {
                            query = query.not('name', 'ilike', `%${cleanTerm}%`);
                            query = query.not('sku', 'ilike', `%${cleanTerm}%`);
                        }
                    } else {
                        query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
                    }
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

    const handleOpenPartProfile = (groupData: any) => {
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
            // xlsx se carga solo al exportar, para no inflar el bundle inicial
            const { utils, writeFile } = await import('xlsx');
            const ivaMult = 1 + exportIvaPercent / 100;

            // 1. Fetch ALL matching products (no pagination)
            let selectStr = `
                id, name, sku, category, min_stock_threshold, profit_margin, price,
                cost_without_vat, vat_percentage, image_url, brand_id,
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
                if (searchTerm.startsWith('-')) {
                    const cleanTerm = searchTerm.slice(1).trim();
                    if (cleanTerm) {
                        query = query.not('name', 'ilike', `%${cleanTerm}%`);
                        query = query.not('sku', 'ilike', `%${cleanTerm}%`);
                    }
                } else {
                    query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
                }
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
            const exportData = (data || []).map((product: any) => {
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

    const handleCloudBackup = async () => {
        setBackupLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select(`
                    id, name, sku, category, min_stock_threshold, profit_margin, price,
                    cost_without_vat, vat_percentage, image_url, brand_id,
                    brands (name),
                    inventory_levels (
                        id, current_stock, warehouse_id,
                        warehouses (name)
                    )
                `)
                .limit(50000);

            if (error) throw error;

            const jsonData = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `inventory_backup_${timestamp}.json`;
            
            const { error: uploadError } = await supabase.storage
                .from('inventory_backups')
                .upload(fileName, blob, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            alert(`Respaldo creado con éxito en la nube como:\n${fileName}`);
        } catch (error: any) {
            console.error('Error creating cloud backup:', error);
            alert('Error al crear el respaldo en la nube: ' + error.message);
        } finally {
            setBackupLoading(false);
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-surface rounded-2xl shadow-lg w-full max-w-sm border border-subtle overflow-hidden">
                        <div className="flex items-center gap-3 p-5 border-b border-subtle bg-surface-2">
                            <div className="p-2 bg-success-soft text-success-soft-fg rounded-lg">
                                <Table size={24} aria-hidden="true" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-fg">Exportar a Excel</h3>
                                <p className="text-xs text-fg-muted">Configura el IVA para el cálculo de costos</p>
                            </div>
                        </div>
                        <div className="p-5 flex flex-col gap-4">
                            <div>
                                <label className="block text-sm font-medium text-fg mb-1">
                                    IVA para calcular <span className="font-mono text-fg-muted">Costo S/I</span> (%)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={exportIvaPercent}
                                    onChange={e => setExportIvaPercent(parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 bg-surface-2 border border-strong rounded-lg focus:ring-2 focus:ring-success focus:border-success outline-none text-sm"
                                />
                                <p className="text-xs text-fg-subtle mt-1.5">
                                    <span className="font-mono">Costo S/I = Costo C/IVA ÷ (1 + {exportIvaPercent}%)</span>
                                </p>
                            </div>
                            <div className="bg-surface-2 rounded-lg p-3 text-xs text-fg-muted space-y-1">
                                <p>Se exportarán <span className="font-semibold text-fg">{groupedStockItems.length}</span> productos visibles.</p>
                                <p>Columnas: SKU · Nombre · Cantidad · Costo S/IVA · Costo Desc. · Margen · Categoría · IVA % · Costo C/IVA</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 px-5 pb-5">
                            <button
                                onClick={() => setShowExportModal(false)}
                                className="px-4 py-2 text-sm font-medium text-fg hover:bg-surface-hover rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleExportToExcel}
                                disabled={exportLoading}
                                className="flex items-center gap-2 px-4 py-2 bg-success hover:bg-success disabled:bg-success text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                            >
                                {exportLoading ? <Loader2 size={18} className={`${exportLoading ? 'animate-spin' : ''}`} aria-hidden="true" /> : <Download size={18} className={`${exportLoading ? 'animate-spin' : ''}`} aria-hidden="true" />}
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-surface rounded-2xl shadow-lg w-full max-w-2xl overflow-hidden relative">
                        <div className="flex justify-between items-center p-4 border-b border-subtle">
                            <h3 className="text-lg font-bold dark:text-white">Registrar Costo y Entrada</h3>
                            <button
                                onClick={() => setIsProductEntryOpen(false)}
                                className="p-1 rounded-full hover:bg-surface-hover transition"
                            >
                                <X size={18} className="text-fg-muted" aria-hidden="true" />
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

            {/* Product Edit Modal */}
            <ProductModal
                isOpen={isProductEditOpen}
                onClose={() => setIsProductEditOpen(false)}
                onSuccess={() => {
                    setIsProductEditOpen(false);
                    fetchStockData(pagination.page);
                }}
                productToEdit={productToEdit}
            />

            {/* Header ... */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-sm text-fg-muted">
                    <span className="hover:text-primary transition-colors cursor-pointer">Inicio</span>
                    <ChevronRight size={16} aria-hidden="true" />
                    <span className="text-fg font-medium">Inventario y Logística</span>
                </div>
                <div className={page.header}>
                    <div>
                        <h1 className={page.title}>Gestión de Inventario</h1>
                        <p className={page.subtitle}>
                            Controla tus almacenes físicos y virtuales, stock y movimientos (ACID Compliant).
                        </p>
                    </div>

                    {/* Acciones: una sola primaria; el resto en secundario/ghost. */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="ghost"
                            onClick={fetchData}
                            loading={loading}
                            icon={<RefreshCw size={15} />}
                        >
                            Actualizar
                        </Button>

                        {activeTab === 'stock' && (
                            <>
                                <Button
                                    variant="secondary"
                                    onClick={() => setShowExportModal(true)}
                                    disabled={backupLoading}
                                    loading={exportLoading}
                                    icon={<Database size={15} className="text-success" />}
                                    title="Exportar inventario visible como Excel (mismo formato que importación)"
                                >
                                    {exportLoading ? 'Exportando…' : 'Exportar Excel'}
                                </Button>

                                <Button
                                    variant="secondary"
                                    onClick={handleCloudBackup}
                                    disabled={exportLoading}
                                    loading={backupLoading}
                                    icon={<CloudUpload size={15} />}
                                    title="Guardar copia de seguridad en la nube (formato JSON)"
                                >
                                    {backupLoading ? 'Respaldando…' : 'Respaldo Nube'}
                                </Button>

                                <Button
                                    variant="secondary"
                                    onClick={() => setIsLostDemandModalOpen(true)}
                                    icon={<TriangleAlert size={15} className="text-warning" />}
                                    title="Registrar una alerta si el cliente pidió algo que no tenemos."
                                >
                                    Demanda Perdida
                                </Button>

                                <Button
                                    variant="success"
                                    onClick={handleNewProduct}
                                    icon={<Database size={15} />}
                                >
                                    Entrada por Lote
                                </Button>
                            </>
                        )}

                        <Button
                            variant="primary"
                            onClick={() => setIsModalOpen(true)}
                            icon={<ArrowLeftRight size={15} />}
                        >
                            Registrar Movimiento
                        </Button>
                    </div>
                </div>
            </div>



            {/* Active Warehouse Filter Banner */}
            {activeTab === 'stock' && selectedWarehouseId && (
                <div className="flex items-center justify-between p-4 bg-primary/10 border border-primary/20 rounded-xl mb-2">
                    <div className="flex items-center gap-2 text-primary font-medium text-sm">
                        <MapPin size={20} aria-hidden="true" />
                        <span>
                            Mostrando inventario en: <span className="font-bold">{warehouses.find(w => w.id === selectedWarehouseId)?.name}</span>
                        </span>
                    </div>
                    <button
                        onClick={clearWarehouseFilter}
                        className="p-1 hover:bg-primary/20 rounded-full transition-colors text-primary flex items-center justify-center"
                        title="Quitar filtro"
                    >
                        <X size={18} aria-hidden="true" />
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
                        <Input
                            type="text"
                            label="Buscar en el inventario"
                            hideLabel
                            inputSize="lg"
                            placeholder="Buscar por nombre, SKU, palabras clave…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            leadingIcon={<Search size={16} />}
                            className={cn(searchTerm && 'pr-10')}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                aria-label="Limpiar búsqueda"
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-fg-subtle hover:bg-surface-hover hover:text-fg transition-colors"
                            >
                                <X size={15} aria-hidden="true" />
                            </button>
                        )}
                    </div>
                </div>
            )}


            {/* Tabs */}
            <div className="border-b border-subtle">
                <nav className="flex gap-6">
                    <button
                        onClick={() => {
                            setActiveTab('warehouses');
                            setSelectedWarehouseId(null);
                        }}
                        className={`py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'warehouses' ? 'border-primary text-primary' : 'border-transparent text-fg-muted hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        <Warehouse size={20} aria-hidden="true" />
                        Almacenes
                    </button>
                    <button
                        onClick={() => setActiveTab('stock')}
                        className={`py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'stock' ? 'border-primary text-primary' : 'border-transparent text-fg-muted hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        <Package size={20} aria-hidden="true" />
                        Inventario Global
                    </button>
                    <button
                        onClick={() => setActiveTab('movements')}
                        className={`py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'movements' ? 'border-primary text-primary' : 'border-transparent text-fg-muted hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        <History size={20} aria-hidden="true" />
                        Historial de Movimientos
                    </button>
                </nav>
            </div>

            <div className="min-h-[400px]">
                {activeTab === 'warehouses' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {warehouses.length === 0 && !loading && (
                            <div className="col-span-full text-center py-10 text-fg-muted">
                                No se encontraron almacenes.
                            </div>
                        )}
                        {warehouses.map(wh => (
                            <div
                                key={wh.id}
                                onClick={() => handleWarehouseClick(wh.id)}
                                className="bg-surface rounded-xl border border-subtle p-6 flex flex-col shadow-sm hover:shadow-md transition-all cursor-pointer group ring-offset-2 hover:ring-2 ring-primary/50"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-lg ${wh.type === 'physical' ? 'bg-primary-soft text-primary dark:text-primary' : 'bg-primary-soft text-primary dark:text-primary'}`}>
                                        {wh.type === 'physical' ? <Store size={24} aria-hidden="true" /> : <Cloud size={24} aria-hidden="true" />}
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${wh.is_active ? 'bg-success-soft text-success dark:text-success' : 'bg-slate-100 text-slate-600'}`}>
                                        {wh.is_active ? 'Activo' : 'Inactivo'}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-fg mb-1 group-hover:text-primary transition-colors">{wh.name}</h3>
                                <p className="text-sm text-fg-muted flex items-center gap-1 mb-4">
                                    <MapPin size={16} aria-hidden="true" />
                                    {wh.location || 'N/A'}
                                </p>
                                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                    <span className="text-sm font-medium text-fg-muted">Ver inventario</span>
                                    <ArrowRight size={18} className="text-primary" aria-hidden="true" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'stock' && (
                    <div className={cn(t.wrapper, 'transition-opacity', loading ? 'opacity-60' : 'opacity-100')}>
                        <div className={t.scroll}>
                            <table className={t.root}>
                                {/* Cabecera pegajosa: los títulos de columna siguen
                                    visibles al recorrer inventarios largos. */}
                                <thead className={t.thead}>
                                    <tr>
                                        {[
                                            { key: 'product', label: 'Producto' },
                                            { key: 'brand', label: 'Marca' },
                                            { key: 'sku', label: 'SKU' },
                                            { key: 'prices', label: 'Precios', align: 'right' },
                                            { key: 'stock', label: 'Stock Global', align: 'right' }
                                        ].map(col => {
                                            const sorted = sortConfig.key === col.key;
                                            const isNum = col.align === 'right';
                                            return (
                                                <th
                                                    key={col.key}
                                                    scope="col"
                                                    aria-sort={sorted ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                                                    className={cn(t.th, t.thSortable, isNum && 'text-right')}
                                                    onClick={() => handleSort(col.key)}
                                                >
                                                    <div className={cn('flex flex-col gap-1.5', isNum ? 'items-end' : 'items-start')}>
                                                        <span className="inline-flex items-center gap-1">
                                                            {col.label}
                                                            {/* Tres estados en un solo icono: sin ordenar, ascendente, descendente. */}
                                                            <span aria-hidden="true">
                                                                {!sorted
                                                                    ? <ChevronsUpDown size={12} className="text-fg-subtle/60" />
                                                                    : sortConfig.direction === 'asc'
                                                                        ? <ChevronUp size={12} className="text-primary" />
                                                                        : <ChevronDown size={12} className="text-primary" />}
                                                            </span>
                                                        </span>
                                                        {col.key !== 'stock' && (
                                                            <input
                                                                type="text"
                                                                placeholder="Filtrar…"
                                                                aria-label={`Filtrar por ${col.label}`}
                                                                value={filters[col.key] || ''}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onChange={(e) => handleFilterChange(col.key, e.target.value)}
                                                                className="w-full min-w-[80px] h-6 px-2 text-xs font-normal normal-case tracking-normal rounded border border-subtle bg-surface text-fg placeholder:text-fg-subtle focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                            />
                                                        )}
                                                    </div>
                                                </th>
                                            );
                                        })}
                                        <th scope="col" className={cn(t.th, 'text-center')}>Estado</th>
                                        <th scope="col" className={cn(t.th, 'text-center')}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className={t.tbody}>
                                    {groupedStockItems.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={7} className={t.empty}>
                                                <div className="flex flex-col items-center gap-2">
                                                    <SearchX size={32} className="text-fg-subtle" aria-hidden="true" />
                                                    <span>No hay registros que coincidan con tu búsqueda.</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {groupedStockItems.length === 0 && loading && (
                                        <tr>
                                            <td colSpan={7} className={t.empty}>
                                                <div className="flex flex-col items-center gap-2" role="status">
                                                    <Loader2 size={26} className="animate-spin text-primary" aria-hidden="true" />
                                                    <span>Cargando inventario…</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {groupedStockItems.map(group => {
                                        const isContextuallyDimmed = selectedWarehouseId !== null;

                                        return (
                                            <React.Fragment key={group.product_id}>
                                                <tr className={`transition-colors group cursor-pointer ${isContextuallyDimmed ? 'opacity-60 bg-slate-50 dark:bg-slate-800/50' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`} onClick={() => handleOpenPartProfile(group)}>
                                                    <td className="px-4 py-3 font-medium text-fg">
                                                        <div className="flex items-center gap-3">
                                                            {group.product?.image_url ? (
                                                                <div className="h-10 w-10 flex-shrink-0 rounded-lg overflow-hidden border border-subtle bg-white shadow-sm relative">
                                                                    <ImageIcon size={20} className="text-fg-subtle absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0" aria-hidden="true" />
                                                                    <img 
                                                                       src={getThumbnailUrl(group.product.image_url, 80, 80)} 
                                                                       alt="" 
                                                                       loading="lazy"
                                                                       decoding="async"
                                                                       className="h-full w-full object-cover relative z-10 transition-opacity duration-300" 
                                                                       onError={(e) => {
                                                                           const target = e.currentTarget;
                                                                           if (target.src.includes('render/image')) {
                                                                               target.src = group.product.image_url || '';
                                                                           } else {
                                                                               target.style.opacity = '0';
                                                                           }
                                                                       }}
                                                                       onLoad={(e) => {
                                                                           e.currentTarget.style.opacity = '1';
                                                                       }}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="h-10 w-10 flex-shrink-0 rounded-lg border border-dashed border-strong bg-surface-2 flex items-center justify-center">
                                                                    <ImageIcon size={20} className="text-fg-subtle" aria-hidden="true" />
                                                                </div>
                                                            )}
                                                            <div className="hover:text-primary transition-colors">
                                                                {group.product?.name}
                                                                <div className="text-xs text-fg-muted mt-0.5">{group.product?.category}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-fg-muted text-sm">
                                                        {group.product?.brands?.name || '-'}
                                                    </td>
                                                     <td className="px-4 py-3 text-fg-muted font-mono text-sm">
                                                         <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                             <span>{group.product?.sku}</span>
                                                             <button
                                                                 type="button"
                                                                 onClick={(e) => handleCopySku(group.product?.sku || '', e)}
                                                                 className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${ copiedSku === group.product?.sku ? 'text-success bg-success-soft dark:bg-success/20' : 'text-slate-400 hover:text-primary hover:bg-primary-soft dark:hover:bg-primary/20' }`}
                                                                 title={copiedSku === group.product?.sku ? "¡Copiado!" : "Copiar Código"}
                                                             >
                                                                 {copiedSku === group.product?.sku ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                                                             </button>
                                                         </div>
                                                     </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="text-sm font-bold text-fg">${(group.product?.price || 0).toFixed(2)}</div>
                                                        <div className="text-xs text-fg-muted">C/I: ${(group.product?.cost_without_vat * (1 + (group.product?.vat_percentage||15)/100)).toFixed(2)}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-[16px] text-fg">{group.global_stock}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${group.global_stock < (group.product?.min_stock_threshold || 10) ? 'bg-warning-soft text-warning border-warning/20 dark:text-warning' : 'bg-success-soft text-success border-success/20 dark:text-success'}`}>
                                                            {group.global_stock < (group.product?.min_stock_threshold || 10) ? 'Bajo Stock' : 'En Stock'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => handleOpenProductEntry(group.product_id)}
                                                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isContextuallyDimmed ? 'bg-primary-soft text-primary dark:text-primary' : 'bg-primary-soft hover:bg-primary text-primary dark:hover:bg-primary/50'}`}
                                                            >
                                                                <ShoppingCart size={14} aria-hidden="true" />
                                                                Surtir
                                                            </button>
                                                            <button
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    setProductToEdit(group.product); 
                                                                    setIsProductEditOpen(true); 
                                                                }}
                                                                className="p-1 flex items-center justify-center text-fg-subtle hover:text-primary transition-colors hover:bg-primary/10 rounded-lg"
                                                                title="Editar Valores Maestro / Foto"
                                                            >
                                                                <Pencil size={18} aria-hidden="true" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* ═══════ PAGINATION FOOTER ═══════ */}
                        {pagination.totalRecords > 0 && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-subtle bg-slate-50/50 dark:bg-slate-900/30">
                                <div className="text-sm text-fg-muted">
                                    Mostrando <span className="font-semibold text-fg">{showingFrom}–{showingTo}</span> de <span className="font-semibold text-fg">{pagination.totalRecords.toLocaleString()}</span> registros
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Page size selector */}
                                    <select
                                        value={pagination.pageSize}
                                        onChange={(e) => setPagination(prev => ({ ...prev, pageSize: parseInt(e.target.value), page: 1 }))}
                                        className="px-2 py-1.5 text-sm border border-subtle rounded-lg bg-surface text-fg focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                        <option value={20}>20 / pág</option>
                                        <option value={50}>50 / pág</option>
                                        <option value={100}>100 / pág</option>
                                    </select>

                                    {/* Previous */}
                                    <button
                                        disabled={pagination.page === 1}
                                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                        className="flex items-center gap-1 px-3 py-1.5 border border-subtle rounded-lg text-sm font-medium text-fg-muted hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft size={16} aria-hidden="true" />
                                        Anterior
                                    </button>

                                    {/* Page indicator */}
                                    <span className="px-3 py-1.5 text-sm font-medium text-fg bg-surface border border-subtle rounded-lg">
                                        {pagination.page} / {totalPages || 1}
                                    </span>

                                    {/* Next */}
                                    <button
                                        disabled={pagination.page >= totalPages || totalPages === 0}
                                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                        className="flex items-center gap-1 px-3 py-1.5 border border-subtle rounded-lg text-sm font-medium text-fg-muted hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Siguiente
                                        <ChevronRight size={16} aria-hidden="true" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'movements' && (
                    <div className="bg-surface rounded-xl border border-subtle shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-surface-2 text-fg-muted font-medium text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-2.5">Fecha</th>
                                        <th className="px-4 py-2.5">Tipo</th>
                                        <th className="px-4 py-2.5">Producto</th>
                                        <th className="px-4 py-2.5">Almacén</th>
                                        <th className="px-4 py-2.5">Motivo</th>
                                        <th className="px-4 py-2.5">Ref</th>
                                        <th className="px-4 py-2.5 text-right">Cantidad</th>
                                        <th className="px-4 py-2.5">Usuario</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-subtle">
                                    {movements.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-3 text-center text-fg-muted">
                                                No hay movimientos registrados.
                                            </td>
                                        </tr>
                                    )}
                                    {movements.map(mov => (
                                        <tr key={mov.id} className="hover:bg-surface-hover transition-colors">
                                            <td className="px-4 py-3 text-fg-muted text-sm">
                                                {new Date(mov.created_at).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`flex items-center gap-1 text-sm font-medium ${mov.quantity_change > 0 ? 'text-success dark:text-success' : 'text-danger dark:text-danger'}`}>
                                                    {mov.quantity_change > 0 ? <ArrowDown size={16} aria-hidden="true" /> : <ArrowUp size={16} aria-hidden="true" />}
                                                    {mov.quantity_change > 0 ? 'Entrada' : 'Salida'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-fg">
                                                {/* @ts-ignore */}
                                                {mov.products?.name}
                                            </td>
                                            <td className="px-4 py-3 text-fg">
                                                {/* @ts-ignore */}
                                                {mov.warehouses?.name}
                                            </td>
                                            <td className="px-4 py-3 text-fg-muted text-sm">{mov.reason}</td>
                                            <td className="px-4 py-3 text-fg-muted text-sm whitespace-nowrap">
                                                {mov.reference_type ? (
                                                    <span className="bg-surface-3 px-2 py-0.5 rounded text-xs font-mono">
                                                        {mov.reference_type} #{mov.reference_id}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-fg">{Math.abs(mov.quantity_change)}</td>
                                            <td className="px-4 py-3 text-fg-muted text-sm">{mov.user_id?.substring(0, 8)}...</td>
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
                <div className="fixed inset-0 z-[160] bg-slate-900/50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-subtle flex justify-between items-center bg-warning-soft">
                            <h2 className="font-bold text-warning uppercase tracking-tight flex items-center gap-2">
                                <TriangleAlert size={20} aria-hidden="true" />
                                Registrar Demanda Perdida
                            </h2>
                            <button onClick={() => setIsLostDemandModalOpen(false)} className="text-warning hover:text-warning font-bold px-2 py-1 rounded hover:bg-warning transition-colors">
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleManualLostDemandSubmit} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-fg-muted uppercase tracking-wider mb-1">Repuesto Buscado</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-100 border border-subtle rounded-lg p-3 text-sm font-medium text-fg-muted outline-none focus:border-warning focus:bg-white transition-colors"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Ej: Filtro de aceite"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-fg-muted uppercase tracking-wider mb-1">Marca de Moto (Opcional)</label>
                                <input
                                    autoFocus
                                    type="text"
                                    className="w-full bg-white border border-strong rounded-lg p-3 text-sm focus:border-warning outline-none"
                                    placeholder="Ej: Yamaha"
                                    value={lostDemandBrand}
                                    onChange={(e) => setLostDemandBrand(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-fg-muted uppercase tracking-wider mb-1">Modelo o Cilindraje (Opcional)</label>
                                <input
                                    type="text"
                                    className="w-full bg-white border border-strong rounded-lg p-3 text-sm focus:border-warning outline-none"
                                    placeholder="Ej: FZ16 2015"
                                    value={lostDemandBikeModel}
                                    onChange={(e) => setLostDemandBikeModel(e.target.value)}
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 px-4 bg-warning text-white font-bold uppercase rounded-lg hover:bg-warning shadow-md transition-all active:scale-95"
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
