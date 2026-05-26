import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';
import { WarehouseSelect } from '../components/WarehouseSelect';

interface ImporterProduct {
    codigo: string;
    nombre: string;
    cantidad: number;
    costo: number; // Provider cost from JSON
}

interface CartItem extends ImporterProduct {
    quantity: number;
}

const Replenishment: React.FC = () => {
    // ──────────────────────────────────────────────
    // 1. STATE MANAGEMENT
    // ──────────────────────────────────────────────
    const [importerProducts, setImporterProducts] = useState<ImporterProduct[]>([]);
    const [localStockMap, setLocalStockMap] = useState<{ [sku: string]: number }>({});
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [loadingStock, setLoadingStock] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<{ [sku: string]: CartItem }>({});
    
    // Pagination for the virtualized/paged display (9k items is too much to render at once in DOM)
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 20;

    // ──────────────────────────────────────────────
    // 2. LOAD DATA: IMPORTER PRODUCTS & LOCAL STOCK
    // ──────────────────────────────────────────────
    
    // Load default warehouse from localStorage on mount
    useEffect(() => {
        const savedWarehouseId = localStorage.getItem('erp_replenishment_warehouse_id');
        if (savedWarehouseId) {
            setSelectedWarehouseId(parseInt(savedWarehouseId));
        }
    }, []);

    // Load importer products from local JSON file
    useEffect(() => {
        const loadImporterCatalog = async () => {
            setLoadingProducts(true);
            try {
                const response = await fetch('/pedidos.json');
                if (!response.ok) throw new Error('No se pudo leer el archivo pedidos.json');
                const data = await response.json();
                
                // Map data to ensure cost property is parsed correctly as number
                const parsedData = (data || []).map((item: any) => ({
                    codigo: item.codigo || '',
                    nombre: item.nombre || '',
                    cantidad: parseInt(item.cantidad) || 0,
                    costo: parseFloat(item.costo) || 0
                }));
                
                setImporterProducts(parsedData);
            } catch (error) {
                console.error('Error cargando el catálogo del importador:', error);
            } finally {
                setLoadingProducts(false);
            }
        };
        loadImporterCatalog();
    }, []);

    // Fetch local stock for selected warehouse
    const fetchLocalStock = useCallback(async (warehouseId: number | null) => {
        if (!warehouseId) {
            setLocalStockMap({});
            return;
        }
        setLoadingStock(true);
        try {
            const { data, error } = await supabase
                .from('inventory_levels')
                .select(`
                    current_stock,
                    products (sku)
                `)
                .eq('warehouse_id', warehouseId);

            if (error) throw error;

            if (data) {
                const stockMap: { [sku: string]: number } = {};
                data.forEach((item: any) => {
                    if (item.products?.sku) {
                        stockMap[item.products.sku] = item.current_stock || 0;
                    }
                });
                setLocalStockMap(stockMap);
            }
        } catch (error) {
            console.error('Error cargando el stock local:', error);
        } finally {
            setLoadingStock(false);
        }
    }, []);

    // Fetch stock when warehouse changes
    useEffect(() => {
        fetchLocalStock(selectedWarehouseId);
        if (selectedWarehouseId) {
            localStorage.setItem('erp_replenishment_warehouse_id', selectedWarehouseId.toString());
        } else {
            localStorage.removeItem('erp_replenishment_warehouse_id');
        }
    }, [selectedWarehouseId, fetchLocalStock]);

    // ──────────────────────────────────────────────
    // 3. FILTERING & SEARCH (Client side, fast)
    // ──────────────────────────────────────────────
    const filteredProducts = useMemo(() => {
        if (!searchTerm.trim()) return importerProducts;
        const term = searchTerm.toLowerCase().trim();
        return importerProducts.filter(
            p => p.codigo.toLowerCase().includes(term) || p.nombre.toLowerCase().includes(term)
        );
    }, [importerProducts, searchTerm]);

    // Reset page whenever search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // Pagination slice
    const paginatedProducts = useMemo(() => {
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize;
        return filteredProducts.slice(from, to);
    }, [filteredProducts, currentPage]);

    const totalPages = Math.ceil(filteredProducts.length / pageSize);

    // ──────────────────────────────────────────────
    // 4. CART HANDLERS
    // ──────────────────────────────────────────────
    const handleAddToCart = (product: ImporterProduct) => {
        setCart(prev => {
            const existing = prev[product.codigo];
            const newQty = existing ? existing.quantity + 1 : 1;
            
            // Limit to importer stock
            if (newQty > product.cantidad) {
                alert(`Advertencia: El stock en la importadora es de ${product.cantidad} unidades.`);
                return prev;
            }

            return {
                ...prev,
                [product.codigo]: {
                    ...product,
                    quantity: newQty
                }
            };
        });
    };

    const handleUpdateQuantity = (sku: string, qty: number, maxQty: number) => {
        if (qty <= 0) {
            handleRemoveFromCart(sku);
            return;
        }
        if (qty > maxQty) {
            alert(`Advertencia: El stock máximo disponible en la importadora es de ${maxQty} unidades.`);
            qty = maxQty;
        }
        setCart(prev => {
            if (!prev[sku]) return prev;
            return {
                ...prev,
                [sku]: {
                    ...prev[sku],
                    quantity: qty
                }
            };
        });
    };

    const handleRemoveFromCart = (sku: string) => {
        setCart(prev => {
            const next = { ...prev };
            delete next[sku];
            return next;
        });
    };

    const handleClearCart = () => {
        if (window.confirm('¿Deseas vaciar el pedido actual?')) {
            setCart({});
        }
    };

    // ──────────────────────────────────────────────
    // 5. EXPORT TO EXCEL
    // ──────────────────────────────────────────────
    const handleExportExcel = () => {
        const cartItems = Object.values(cart);
        if (cartItems.length === 0) {
            alert('El carrito de pedido está vacío.');
            return;
        }

        // Map data to match exact requested columns + cost
        const dataToExport = cartItems.map(item => ({
            'Código': item.codigo,
            'Nombre': item.nombre,
            'Cantidad': item.quantity,
            'Costo Unitario ($)': item.costo,
            'Subtotal ($)': parseFloat((item.costo * item.quantity).toFixed(2))
        }));

        // Calculate totals
        const totalQty = cartItems.reduce((acc, item) => acc + item.quantity, 0);
        const totalCost = cartItems.reduce((acc, item) => acc + (item.costo * item.quantity), 0);

        // Add total row at the end
        dataToExport.push({
            'Código': '',
            'Nombre': 'TOTAL DEL PEDIDO',
            'Cantidad': totalQty,
            'Costo Unitario ($)': 0, // Leave empty visually
            'Subtotal ($)': parseFloat(totalCost.toFixed(2))
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Pedido Abastecimiento');

        // Column widths
        worksheet['!cols'] = [
            { wch: 15 }, // Código
            { wch: 60 }, // Nombre
            { wch: 10 }, // Cantidad
            { wch: 18 }, // Costo Unitario
            { wch: 18 }  // Subtotal
        ];

        const dateStr = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `pedido_importadora_${dateStr}.xlsx`);
    };

    // ──────────────────────────────────────────────
    // 6. GENERAL CALCS
    // ──────────────────────────────────────────────
    const cartList = useMemo(() => Object.values(cart), [cart]);
    const cartCount = useMemo(() => cartList.reduce((acc, item) => acc + item.quantity, 0), [cartList]);
    const cartTotalAmount = useMemo(() => cartList.reduce((acc, item) => acc + (item.costo * item.quantity), 0), [cartList]);

    return (
        <div className="p-6 md:p-8 max-w-[1550px] mx-auto flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-64px)]">
            
            {/* ═══════ LEFT PANEL: CATALOG & CONTROLS ═══════ */}
            <div className="flex-1 flex flex-col gap-6">
                
                {/* Header Title */}
                <div>
                    <h1 className="text-3xl font-bold dark:text-white tracking-tight flex items-center gap-3">
                        <span className="material-symbols-outlined text-[32px] text-primary">local_mall</span>
                        Abastecimiento de Importadora
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Compara tu stock local con las existencias de la importadora y genera pedidos rápidos descargables en Excel con cálculo de costos.
                    </p>
                </div>

                {/* Filters & Selector */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative z-20">
                    {/* Warehouse Dropdown */}
                    <div className="md:col-span-1">
                        <WarehouseSelect
                            value={selectedWarehouseId}
                            onChange={setSelectedWarehouseId}
                            label="Verificar Stock en Almacén:"
                            required={true}
                        />
                    </div>

                    {/* Search Input */}
                    <div className="md:col-span-2 flex flex-col justify-end">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Buscar Repuestos:
                        </label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input
                                type="text"
                                placeholder="Buscar por código (SKU) o por nombre..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Catalog Table */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex-1 flex flex-col">
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-medium text-xs uppercase tracking-wider sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3.5">Código (SKU)</th>
                                    <th className="px-6 py-3.5">Nombre del Repuesto</th>
                                    <th className="px-6 py-3.5 text-center">Mi Stock (Local)</th>
                                    <th className="px-6 py-3.5 text-center">Stock Importadora</th>
                                    <th className="px-6 py-3.5 text-right">Costo Prov.</th>
                                    <th className="px-6 py-3.5 text-center w-28">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {loadingProducts ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="material-symbols-outlined animate-spin text-[36px] text-primary">progress_activity</span>
                                                <span>Cargando catálogo de la importadora...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginatedProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="material-symbols-outlined text-[36px] text-slate-300">search_off</span>
                                                <span>No se encontraron productos coincidentes en el catálogo.</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginatedProducts.map(prod => {
                                    const localStock = localStockMap[prod.codigo] !== undefined ? localStockMap[prod.codigo] : null;
                                    const inCart = cart[prod.codigo];
                                    
                                    return (
                                        <tr key={prod.codigo} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            {/* Código SKU */}
                                            <td className="px-6 py-4 font-mono text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">{prod.codigo}</td>
                                            
                                            {/* Nombre */}
                                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white break-words whitespace-normal max-w-sm">{prod.nombre}</td>
                                            
                                            {/* Mi Stock */}
                                            <td className="px-6 py-4 text-center align-middle">
                                                {!selectedWarehouseId ? (
                                                    <span className="text-xs text-slate-400 italic">Seleccione almacén</span>
                                                ) : loadingStock ? (
                                                    <span className="material-symbols-outlined text-[16px] animate-spin text-slate-400">progress_activity</span>
                                                ) : localStock !== null ? (
                                                    <span className={`px-2.5 py-1 text-xs font-bold rounded-md ${localStock > 0 ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'}`}>
                                                        {localStock} uds
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700">
                                                        No registrado (0)
                                                    </span>
                                                )}
                                            </td>

                                            {/* Stock Importadora */}
                                            <td className="px-6 py-4 text-center align-middle">
                                                <span className={`px-2.5 py-1 text-xs font-bold rounded-md ${prod.cantidad > 0 ? 'bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'}`}>
                                                    {prod.cantidad} uds
                                                </span>
                                            </td>

                                            {/* Costo Proveedor */}
                                            <td className="px-6 py-4 text-right font-mono font-semibold text-slate-700 dark:text-slate-350">
                                                ${(prod.costo || 0).toFixed(2)}
                                            </td>

                                            {/* Acción */}
                                            <td className="px-6 py-4 text-center align-middle">
                                                {prod.cantidad === 0 ? (
                                                    <button
                                                        disabled
                                                        className="w-full px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 rounded-lg text-xs font-bold cursor-not-allowed border border-slate-200 dark:border-slate-700"
                                                    >
                                                        Agotado
                                                    </button>
                                                ) : inCart ? (
                                                    <div className="flex items-center justify-center gap-1 bg-primary/10 dark:bg-primary/20 text-primary border border-primary/30 rounded-lg px-2 py-1.5">
                                                        <span className="material-symbols-outlined text-[12px]">done</span>
                                                        <span className="text-[10px] font-bold">Añadido ({inCart.quantity})</span>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleAddToCart(prod)}
                                                        className="w-full px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px] font-bold">add</span>
                                                        Añadir
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    {filteredProducts.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                            <div className="text-sm text-slate-500">
                                Mostrando <span className="font-semibold text-slate-700 dark:text-slate-300">
                                    {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredProducts.length)}
                                </span> de <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredProducts.length.toLocaleString()}</span> items encontrados
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => prev - 1)}
                                    className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                                    Anterior
                                </button>
                                <span className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg">
                                    {currentPage} / {totalPages || 1}
                                </span>
                                <button
                                    disabled={currentPage >= totalPages}
                                    onClick={() => setCurrentPage(prev => prev + 1)}
                                    className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Siguiente
                                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══════ RIGHT PANEL: SHOPPING CART DRAWER ═══════ */}
            <div className="w-full lg:w-96 flex flex-col bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg h-[calc(100vh-112px)] sticky top-24 overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[20px] text-primary">shopping_basket</span>
                        <h2 className="font-bold text-slate-900 dark:text-white">Pedido de Abastecimiento</h2>
                    </div>
                    <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                        {cartCount} piezas
                    </span>
                </div>

                {/* Cart Items List */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                    {cartList.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-12 text-center">
                            <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-700 mb-2">shopping_cart</span>
                            <p className="text-sm font-semibold">El carrito está vacío</p>
                            <p className="text-xs mt-1">Busca y añade los productos del importador que deseas reabastecer.</p>
                        </div>
                    ) : (
                        cartList.map(item => (
                            <div key={item.codigo} className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-850 flex flex-col gap-2 relative group hover:border-slate-300 dark:hover:border-slate-650 transition-colors">
                                {/* Delete Button */}
                                <button
                                    onClick={() => handleRemoveFromCart(item.codigo)}
                                    className="absolute top-2 right-2 text-slate-400 hover:text-rose-600 transition-colors bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 p-0.5 rounded-full"
                                    title="Quitar"
                                >
                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                </button>

                                <div>
                                    <span className="text-[10px] font-mono font-bold text-slate-400">{item.codigo}</span>
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white pr-6 line-clamp-2 mt-0.5" title={item.nombre}>{item.nombre}</h4>
                                </div>

                                <div className="flex items-center justify-between mt-1">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-slate-400 font-medium">Costo: ${(item.costo || 0).toFixed(2)}</span>
                                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Subt: ${((item.costo || 0) * item.quantity).toFixed(2)}</span>
                                    </div>
                                    
                                    {/* Counter */}
                                    <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 overflow-hidden self-end">
                                        <button
                                            onClick={() => handleUpdateQuantity(item.codigo, item.quantity - 1, item.cantidad)}
                                            className="px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[14px] leading-none font-bold">remove</span>
                                        </button>
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => handleUpdateQuantity(item.codigo, parseInt(e.target.value) || 0, item.cantidad)}
                                            className="w-10 text-center text-xs font-semibold bg-transparent border-none outline-none focus:ring-0 p-0"
                                        />
                                        <button
                                            onClick={() => handleUpdateQuantity(item.codigo, item.quantity + 1, item.cantidad)}
                                            className="px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[14px] leading-none font-bold">add</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Controls */}
                {cartList.length > 0 && (
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 flex flex-col gap-2.5">
                        <div className="flex justify-between text-xs text-slate-500 font-medium">
                            <span>Total de Repuestos:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">{cartList.length} SKU</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 font-medium">
                            <span>Total de Unidades:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">{cartCount} piezas</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-950 dark:text-white font-extrabold pb-2 border-t border-dashed border-slate-200 dark:border-slate-700 pt-2">
                            <span>SUMA TOTAL:</span>
                            <span className="text-emerald-600 dark:text-emerald-400 text-base">${cartTotalAmount.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex gap-2">
                            <button
                                onClick={handleClearCart}
                                className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-all"
                            >
                                Vaciar Lista
                            </button>
                            <button
                                onClick={handleExportExcel}
                                className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-2.5 text-xs font-bold shadow-md shadow-emerald-700/10 flex items-center justify-center gap-1.5 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[16px] font-bold">download</span>
                                Descargar Excel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Replenishment;
