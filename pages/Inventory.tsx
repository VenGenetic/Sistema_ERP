import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import InventoryMovementModal from '../components/InventoryMovementModal';
import { ProductEntryForm } from '../components/ProductEntryForm';
import { BatchProductEntry } from '../components/BatchProductEntry'; // New Component
import { utils, writeFile } from 'xlsx';

// Define types based on our join queries
interface StockItem {
    id: number;
    product_id: number;
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
}

interface Warehouse {
    id: number;
    name: string;
    type: string;
    location: string;
    is_active: boolean;
}

const Inventory: React.FC = () => {
    // ... (Existing State) ...
    const [activeTab, setActiveTab] = useState<'warehouses' | 'stock' | 'movements'>('warehouses');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isProductEntryOpen, setIsProductEntryOpen] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);

    // Advanced Search & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [filters, setFilters] = useState<{ [key: string]: string }>({});

    // New State for Batch Entry
    const [isBatchEntryOpen, setIsBatchEntryOpen] = useState(false);

    // Export modal state
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportIvaPercent, setExportIvaPercent] = useState<number>(12);

    // Expanded products state for grouped view
    const [expandedProductIds, setExpandedProductIds] = useState<number[]>([]);

    // Data states
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [movements, setMovements] = useState<Movement[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    // Data fetching logic
    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'warehouses') {
                const { data, error } = await supabase.from('warehouses').select('*').order('id');
                if (error) throw error;
                setWarehouses(data || []);
            } else if (activeTab === 'stock') {
                let query = supabase
                    .from('inventory_levels')
                    .select(`
                        id, current_stock, product_id,
                        products (
                            id, name, sku, category, min_stock_threshold, brand_id, profit_margin,
                            cost_without_vat, vat_percentage,
                            brands (name)
                        ),
                        warehouses (name)
                    `);

                // Apply filter if a warehouse is selected
                if (selectedWarehouseId) {
                    query = query.eq('warehouse_id', selectedWarehouseId);
                }

                const { data, error } = await query.order('product_id');

                if (error) throw error;
                // @ts-ignore
                setStockItems(data || []);
            } else if (activeTab === 'movements') {
                // ... (movements fetch logic) ...
                const { data, error } = await supabase
                    .from('inventory_logs')
                    .select(`
                        id, created_at, quantity_change, reason, user_id,
                        products (name),
                        warehouses (name)
                    `)
                    .order('created_at', { ascending: false })
                    .limit(50);
                if (error) throw error;
                // @ts-ignore
                setMovements(data || []);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleMovementSuccess = () => {
        // Refresh data after successful transaction
        fetchData();
    };

    const handleOpenProductEntry = (productId: number) => {
        setSelectedProductId(productId);
        setIsProductEntryOpen(true);
    };

    // Handlers

    // Replaced Logic: New Product opens Batch Entry
    const handleNewProduct = () => {
        setIsBatchEntryOpen(true);
    };

    // Export current stock view to Excel using the same format as the import template
    const handleExportToExcel = () => {
        const ivaMult = 1 + exportIvaPercent / 100;

        const exportData = groupedStockItems.map(group => {
            const costWithoutVat = group.product?.cost_without_vat ?? null;
            const storedVat = group.product?.vat_percentage ?? exportIvaPercent;
            // Costo C/IVA stored in DB = cost_without_vat * (1 + storedVat/100)
            const costWithVat = costWithoutVat !== null
                ? parseFloat((costWithoutVat * (1 + storedVat / 100)).toFixed(4))
                : null;
            // Back-calculate Costo S/I using the user-supplied IVA %
            const costoSinIva = costWithVat !== null
                ? parseFloat((costWithVat / ivaMult).toFixed(4))
                : '';

            return {
                'SKU': group.product?.sku || '',
                'Nombre': group.product?.name || '',
                'Cantidad': group.global_stock,
                'Costo S/I': costoSinIva,
                'Costo Desc.': '',
                'Margen': group.product?.profit_margin ?? 0.30,
                'Costo C/IVA': costWithVat ?? '',
            };
        });

        const ws = utils.json_to_sheet(exportData, {
            header: ['SKU', 'Nombre', 'Cantidad', 'Costo S/I', 'Costo Desc.', 'Margen', 'Costo C/IVA']
        });

        ws['!cols'] = [
            { wch: 20 }, // SKU
            { wch: 40 }, // Nombre
            { wch: 12 }, // Cantidad
            { wch: 14 }, // Costo S/I
            { wch: 14 }, // Costo Desc.
            { wch: 10 }, // Margen
            { wch: 14 }, // Costo C/IVA
        ];

        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Inventario');
        writeFile(wb, `inventario_${new Date().toISOString().slice(0, 10)}.xlsx`);
        setShowExportModal(false);
    };

    const handleWarehouseClick = (warehouseId: number) => {
        setSelectedWarehouseId(warehouseId);
        setActiveTab('stock');
    };

    const clearWarehouseFilter = () => {
        setSelectedWarehouseId(null);
        fetchData(); // Refresh to show all
    };

    // Advanced Search & Sort Logic
    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const filteredAndSortedItems = useMemo(() => {
        let items = [...stockItems];

        // 1. Global Search (Smart Search)
        if (searchTerm) {
            const searchTerms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
            items = items.filter(item => {
                const productName = item.products?.name?.toLowerCase() || '';
                const sku = item.products?.sku?.toLowerCase() || '';
                // Check if ALL search terms are present in EITHER name OR sku
                return searchTerms.every(term => productName.includes(term) || sku.includes(term));
            });
        }

        // 2. Column Filters
        Object.keys(filters).forEach(key => {
            const filterValue = filters[key].toLowerCase();
            if (!filterValue) return;

            items = items.filter(item => {
                let itemValue = '';
                if (key === 'product') itemValue = item.products?.name?.toLowerCase() || '';
                else if (key === 'brand') itemValue = item.products?.brands?.name?.toLowerCase() || '';
                else if (key === 'sku') itemValue = item.products?.sku?.toLowerCase() || '';
                else if (key === 'warehouse') itemValue = item.warehouses?.name?.toLowerCase() || '';
                else if (key === 'stock') itemValue = item.current_stock.toString();

                return itemValue.includes(filterValue);
            });
        });

        // 3. Sorting
        if (sortConfig) {
            items.sort((a, b) => {
                let aValue: any = '';
                let bValue: any = '';

                if (sortConfig.key === 'product') {
                    aValue = a.products?.name || '';
                    bValue = b.products?.name || '';
                } else if (sortConfig.key === 'brand') {
                    aValue = a.products?.brands?.name || '';
                    bValue = b.products?.brands?.name || '';
                } else if (sortConfig.key === 'sku') {
                    aValue = a.products?.sku || '';
                    bValue = b.products?.sku || '';
                } else if (sortConfig.key === 'warehouse') {
                    aValue = a.warehouses?.name || '';
                    bValue = b.warehouses?.name || '';
                } else if (sortConfig.key === 'stock') {
                    aValue = a.current_stock;
                    bValue = b.current_stock;
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return items;
    }, [stockItems, searchTerm, filters, sortConfig]);

    const groupedStockItems = useMemo(() => {
        const groups = new Map<number, any>();
        filteredAndSortedItems.forEach(item => {
            if (!groups.has(item.product_id)) {
                groups.set(item.product_id, {
                    product_id: item.product_id,
                    product: item.products,
                    global_stock: 0,
                    details: []
                });
            }
            const group = groups.get(item.product_id)!;
            group.global_stock += item.current_stock;
            group.details.push(item);
        });
        return Array.from(groups.values());
    }, [filteredAndSortedItems]);

    const toggleExpandProduct = (productId: number) => {
        setExpandedProductIds(prev =>
            prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
        );
    };

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
                                <p>Columnas: SKU · Nombre · Cantidad · Costo S/I · Costo Desc. · Margen · Costo C/IVA</p>
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
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                            >
                                <span className="material-symbols-outlined text-[18px]">download</span>
                                Descargar
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
                // ... (Existing modal code)
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
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                                    title="Exportar inventario visible como Excel (mismo formato que importación)"
                                >
                                    <span className="material-symbols-outlined text-[18px] text-emerald-600">table_view</span>
                                    Exportar Excel
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
            </div>



            {/* Advanced Search Input */}
            {activeTab === 'stock' && (
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nombre, SKU, palabras clave..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                </div>
            )}


            {/* ... Rest of file (Tabs, Tables) ... */}
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="flex gap-6">
                    <button
                        onClick={() => {
                            setActiveTab('warehouses');
                            setSelectedWarehouseId(null); // Optional: clear filter when going back to list
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
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
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
                                                            <span className={`material-symbols-outlined text-[10px] leading-none ${sortConfig?.key === col.key && sortConfig.direction === 'asc' ? 'text-primary' : 'text-slate-300'}`}>arrow_drop_up</span>
                                                            <span className={`material-symbols-outlined text-[10px] leading-none ${sortConfig?.key === col.key && sortConfig.direction === 'desc' ? 'text-primary' : 'text-slate-300'}`}>arrow_drop_down</span>
                                                        </div>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder={`Filtrar...`}
                                                        value={filters[col.key] || ''}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={(e) => handleFilterChange(col.key, e.target.value)}
                                                        className="w-full min-w-[80px] px-2 py-1 text-xs font-normal border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 focus:outline-none focus:border-primary"
                                                    />
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
                                            <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                                No hay registros que coincidan con tu búsqueda.
                                            </td>
                                        </tr>
                                    )}
                                    {groupedStockItems.map(group => (
                                        <React.Fragment key={group.product_id}>
                                            <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer" onClick={() => toggleExpandProduct(group.product_id)}>
                                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`material-symbols-outlined text-[18px] text-slate-400 transition-transform ${expandedProductIds.includes(group.product_id) ? 'rotate-90' : ''}`}>chevron_right</span>
                                                        <div>
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
                                                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 rounded-md text-xs font-semibold transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">add_shopping_cart</span>
                                                            Surtir
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedProductIds.includes(group.product_id) && group.details.map((detail: StockItem) => (
                                                <tr key={detail.id} className="bg-slate-50/50 dark:bg-slate-800/50 border-t-0">
                                                    <td className="px-6 py-3 pl-14 text-sm text-slate-600 dark:text-slate-400" colSpan={3}>
                                                        <div className="flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-[16px] text-slate-400">subdirectory_arrow_right</span>
                                                            Almacén: <span className="font-medium text-slate-900 dark:text-white">{detail.warehouses?.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                                                        {detail.current_stock}
                                                    </td>
                                                    <td colSpan={2}></td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
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
                                        <th className="px-6 py-3 text-right">Cantidad</th>
                                        <th className="px-6 py-3">Usuario</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {movements.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
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
        </div>
    );
};

export default Inventory;
