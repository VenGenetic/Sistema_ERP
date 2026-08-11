import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { WarehouseSelect } from '../components/WarehouseSelect';
import { MediaLightbox } from '../components/MediaLightbox';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Search,
  SearchX,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

interface ImporterProduct {
    codigo: string;
    nombre: string;
    cantidad: number;
    costo: number; // Provider cost from JSON
    imagen: string; // Product image URL from JSON
}

interface CartItem extends ImporterProduct {
    quantity: number;
}

interface ReplenishmentDraft {
    id: string;
    name: string;
    warehouseId: number | null;
    cart: { [sku: string]: CartItem };
    createdAt: string;
    updatedAt: string;
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
    
    // Performance Optimization: Debounced Search and Column Filters (Catalog style)
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    
    const [skuFilter, setSkuFilter] = useState('');
    const [debouncedSkuFilter, setDebouncedSkuFilter] = useState('');
    
    const [nameFilter, setNameFilter] = useState('');
    const [debouncedNameFilter, setDebouncedNameFilter] = useState('');
    
    const [cart, setCart] = useState<{ [sku: string]: CartItem }>({});
    
    // Drafts Management States
    const [drafts, setDrafts] = useState<ReplenishmentDraft[]>([]);
    const [activeDraftId, setActiveDraftId] = useState<string>('');
    const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
    const [isManageDraftsOpen, setIsManageDraftsOpen] = useState(false);
    
    // Media Lightbox State
    const [lightbox, setLightbox] = useState<{ isOpen: boolean; media: any[]; initialIndex: number }>({
        isOpen: false,
        media: [],
        initialIndex: 0
    });
    
    // Pagination for the virtualized/paged display (9k items is too much to render at once in DOM)
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 20;

    // ──────────────────────────────────────────────
    // 2. LOAD INITIAL DRAFTS FROM LOCALSTORAGE
    // ──────────────────────────────────────────────
    useEffect(() => {
        const savedDrafts = localStorage.getItem('erp_replenishment_drafts');
        let loadedDrafts: ReplenishmentDraft[] = [];
        if (savedDrafts) {
            try {
                loadedDrafts = JSON.parse(savedDrafts);
            } catch (e) {
                console.error('Error parsing saved drafts:', e);
            }
        }

        // Ensure we have at least one active draft
        if (loadedDrafts.length === 0) {
            const defaultDraft: ReplenishmentDraft = {
                id: 'default',
                name: 'Borrador Principal',
                warehouseId: null,
                cart: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            loadedDrafts = [defaultDraft];
            localStorage.setItem('erp_replenishment_drafts', JSON.stringify(loadedDrafts));
        }

        setDrafts(loadedDrafts);

        const savedActiveId = localStorage.getItem('erp_replenishment_active_draft_id');
        const activeExists = loadedDrafts.some(d => d.id === savedActiveId);
        const initialActiveId = activeExists ? savedActiveId! : loadedDrafts[0].id;
        
        setActiveDraftId(initialActiveId);

        // Apply cart and warehouse from the active draft
        const activeDraft = loadedDrafts.find(d => d.id === initialActiveId) || loadedDrafts[0];
        setCart(activeDraft.cart || {});
        setSelectedWarehouseId(activeDraft.warehouseId);

        // Mark bootstrap complete
        setTimeout(() => setIsInitialLoadComplete(true), 100);
    }, []);

    // Load importer products from local JSON file
    useEffect(() => {
        const loadImporterCatalog = async () => {
            setLoadingProducts(true);
            try {
                const response = await fetch('/pedidos.json');
                if (!response.ok) throw new Error('No se pudo leer el archivo pedidos.json');
                const data = await response.json();
                
                // Map data to ensure cost and image properties are parsed correctly
                const parsedData = (data || []).map((item: any) => ({
                    codigo: item.codigo || '',
                    nombre: item.nombre || '',
                    cantidad: parseInt(item.cantidad) || 0,
                    costo: parseFloat(item.costo) || 0,
                    imagen: item.imagen || ''
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
    }, [selectedWarehouseId, fetchLocalStock]);

    // ──────────────────────────────────────────────
    // 3. SILENT AUTO-SAVE SYSTEM
    // ──────────────────────────────────────────────
    useEffect(() => {
        if (!isInitialLoadComplete || !activeDraftId) return;

        setDrafts(prevDrafts => {
            const updated = prevDrafts.map(d => {
                if (d.id === activeDraftId) {
                    return {
                        ...d,
                        cart,
                        warehouseId: selectedWarehouseId,
                        updatedAt: new Date().toISOString()
                    };
                }
                return d;
            });
            localStorage.setItem('erp_replenishment_drafts', JSON.stringify(updated));
            return updated;
        });
    }, [cart, selectedWarehouseId, activeDraftId, isInitialLoadComplete]);

    // ──────────────────────────────────────────────
    // 4. SEARCH DEBOUNCING (Performance Optimization)
    // ──────────────────────────────────────────────
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setDebouncedSkuFilter(skuFilter);
            setDebouncedNameFilter(nameFilter);
        }, 300); // 300ms debounce delay to prevent UI lag on keystrokes across 9,000 items

        return () => {
            clearTimeout(handler);
        };
    }, [searchTerm, skuFilter, nameFilter]);

    // ──────────────────────────────────────────────
    // 5. FILTERING & PAGINATION (Client side, fast)
    // ──────────────────────────────────────────────
    const filteredProducts = useMemo(() => {
        let results = importerProducts;

        // Apply general search
        if (debouncedSearchTerm.trim()) {
            const term = debouncedSearchTerm.toLowerCase().trim();
            results = results.filter(
                p => p.codigo.toLowerCase().includes(term) || p.nombre.toLowerCase().includes(term)
            );
        }

        // Apply SKU filter
        if (debouncedSkuFilter.trim()) {
            const sku = debouncedSkuFilter.toLowerCase().trim();
            results = results.filter(p => p.codigo.toLowerCase().includes(sku));
        }

        // Apply Name / Description filter
        if (debouncedNameFilter.trim()) {
            const name = debouncedNameFilter.toLowerCase().trim();
            results = results.filter(p => p.nombre.toLowerCase().includes(name));
        }

        return results;
    }, [importerProducts, debouncedSearchTerm, debouncedSkuFilter, debouncedNameFilter]);

    // Reset page whenever search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, debouncedSkuFilter, debouncedNameFilter]);

    // Pagination slice
    const paginatedProducts = useMemo(() => {
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize;
        return filteredProducts.slice(from, to);
    }, [filteredProducts, currentPage]);

    const totalPages = Math.ceil(filteredProducts.length / pageSize);

    // ──────────────────────────────────────────────
    // 6. DRAFTS CONTROL HANDLERS
    // ──────────────────────────────────────────────
    const handleSwitchDraft = (draftId: string) => {
        const targetDraft = drafts.find(d => d.id === draftId);
        if (!targetDraft) return;

        // Temporarily disable auto-save listener to prevent overwriting
        setIsInitialLoadComplete(false);

        setActiveDraftId(draftId);
        setCart(targetDraft.cart || {});
        setSelectedWarehouseId(targetDraft.warehouseId);
        localStorage.setItem('erp_replenishment_active_draft_id', draftId);

        // Resume auto-save listener on next frame
        setTimeout(() => setIsInitialLoadComplete(true), 50);
    };

    const handleCreateDraft = () => {
        const name = window.prompt('Ingrese el nombre para el nuevo borrador de pedido:', `Borrador #${drafts.length + 1}`);
        if (!name || !name.trim()) return;

        const newDraft: ReplenishmentDraft = {
            id: Date.now().toString(),
            name: name.trim(),
            warehouseId: selectedWarehouseId, // Inherits active warehouse
            cart: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const updatedDrafts = [...drafts, newDraft];
        setDrafts(updatedDrafts);
        localStorage.setItem('erp_replenishment_drafts', JSON.stringify(updatedDrafts));

        // Shift automatically to new draft
        handleSwitchDraft(newDraft.id);
    };

    const handleRenameDraft = (draftId: string, currentName: string) => {
        const newName = window.prompt('Ingrese el nuevo nombre para este borrador:', currentName);
        if (!newName || !newName.trim()) return;

        setDrafts(prev => {
            const updated = prev.map(d => d.id === draftId ? { ...d, name: newName.trim(), updatedAt: new Date().toISOString() } : d);
            localStorage.setItem('erp_replenishment_drafts', JSON.stringify(updated));
            return updated;
        });
    };

    const handleDeleteDraft = (draftId: string) => {
        if (drafts.length === 1) {
            alert('Debe conservar al menos un borrador activo. No se puede borrar el único borrador disponible.');
            return;
        }

        const draftToDelete = drafts.find(d => d.id === draftId);
        const confirmed = window.confirm(`¿Estás seguro de que deseas eliminar permanentemente el borrador "${draftToDelete?.name}"? Esta acción no se puede deshacer.`);
        if (!confirmed) return;

        const remainingDrafts = drafts.filter(d => d.id !== draftId);
        setDrafts(remainingDrafts);
        localStorage.setItem('erp_replenishment_drafts', JSON.stringify(remainingDrafts));

        // If active draft was deleted, switch to the first remaining one
        if (activeDraftId === draftId) {
            handleSwitchDraft(remainingDrafts[0].id);
        }
    };

    // ──────────────────────────────────────────────
    // 7. CART & LIGHTBOX HANDLERS
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

    const handleAutoSuggest = async () => {
        const confirmed = window.confirm('¿Deseas buscar repuestos que ahora tienen stock y auto-agregarlos al carrito (saltando aquellos que marcaste como "No pedir automáticamente")?');
        if (!confirmed) return;

        try {
            const { data, error } = await supabase
                .from('products')
                .select('codigo:sku, nombre:name, cantidad:importer_stock, costo:cost_without_vat, imagen:image_url')
                .gt('importer_stock', 0)
                .eq('auto_order_disabled', false)
                .eq('is_active', true);

            if (error) throw error;

            if (data && data.length > 0) {
                setCart(prev => {
                    const next = { ...prev };
                    let added = 0;
                    data.forEach((prod: any) => {
                        if (!next[prod.codigo]) {
                            next[prod.codigo] = {
                                ...prod,
                                quantity: 1
                            };
                            added++;
                        }
                    });
                    
                    // Allow React render cycle to complete before alert, or simply alert with setTimeout
                    setTimeout(() => {
                        if (added > 0) {
                            alert(`Se han añadido ${added} nuevos repuestos al pedido.`);
                        } else {
                            alert('No se añadieron repuestos. Todos los sugeridos ya estaban en la lista.');
                        }
                    }, 100);
                    
                    return next;
                });
            } else {
                alert('No hay repuestos que requieran pedido automático en este momento.');
            }
        } catch (err: any) {
            console.error(err);
            alert('Error al obtener sugerencias: ' + err.message);
        }
    };

    const handleOpenLightbox = (product: ImporterProduct) => {
        if (!product.imagen) return;
        setLightbox({
            isOpen: true,
            media: [{ type: 'image', url: product.imagen, title: `${product.codigo} - ${product.nombre}` }],
            initialIndex: 0
        });
    };

    // ──────────────────────────────────────────────
    // 8. EXPORT TO EXCEL
    // ──────────────────────────────────────────────
    const handleExportExcel = async () => {
        const cartItems = Object.values(cart);
        if (cartItems.length === 0) {
            alert('El carrito de pedido está vacío.');
            return;
        }

        // xlsx se carga solo cuando se exporta, para no inflar el bundle inicial
        const XLSX = await import('xlsx');

        const activeDraft = drafts.find(d => d.id === activeDraftId);
        const draftName = activeDraft ? activeDraft.name : 'Abastecimiento';

        // Map data to match exact requested columns + cost (clean text-only columns, no images)
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

        // Format name safe for windows filenames
        const safeDraftName = draftName.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
        const dateStr = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `pedido_${safeDraftName}_${dateStr}.xlsx`);
    };

    // ──────────────────────────────────────────────
    // 9. GENERAL CALCS
    // ──────────────────────────────────────────────
    const cartList = useMemo(() => Object.values(cart), [cart]);
    const cartCount = useMemo(() => cartList.reduce((acc, item) => acc + item.quantity, 0), [cartList]);
    const cartTotalAmount = useMemo(() => cartList.reduce((acc, item) => acc + (item.costo * item.quantity), 0), [cartList]);

    return (
        <div className="p-4 md:p-6 w-full max-w-full flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-64px)]">
            
            {/* ═══════ LEFT PANEL: CATALOG & CONTROLS ═══════ */}
            <div className="flex-1 flex flex-col gap-6">
                
                {/* Header Title */}
                <div>
                    <h1 className="text-2xl font-bold dark:text-white tracking-tight flex items-center gap-3">
                        <ShoppingBag size={32} className="text-primary" aria-hidden="true" />
                        Abastecimiento de Importadora
                    </h1>
                    <p className="text-fg-muted mt-1">
                        Compara tu stock local con las existencias y fotos de la importadora, y genera pedidos rápidos descargables en Excel.
                    </p>
                </div>

                {/* Filters & Selector */}
                {/* Filters & Selector */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface p-5 rounded-xl border border-subtle shadow-sm relative z-20">
                    {/* Warehouse Dropdown */}
                    <div className="md:col-span-1">
                        <WarehouseSelect
                            value={selectedWarehouseId}
                            onChange={setSelectedWarehouseId}
                            label="Verificar Stock en Almacén:"
                            required={true}
                        />
                    </div>

                    {/* Search Input (Global) */}
                    <div className="md:col-span-2 flex flex-col justify-end">
                        <label className="block text-sm font-medium text-fg mb-1">
                            Buscador General:
                        </label>
                        <div className="relative">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
                            <input
                                type="text"
                                placeholder="Buscar por código (SKU) o por nombre..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-10 py-2 bg-surface-2 border border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm text-fg"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                >
                                    <X size={18} aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Catalog Table */}
                <div className="bg-surface rounded-xl border border-subtle shadow-sm overflow-hidden flex-1 flex flex-col">
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-surface-2 text-fg-muted font-medium text-xs uppercase tracking-wider sticky top-0 z-10">
                                <tr>
                                    {/* Código Column */}
                                    <th className="px-4 py-2.5 cursor-default min-w-[120px]">
                                        <div className="flex flex-col gap-1.5">
                                            <span className="font-bold text-xs">Código</span>
                                            <input
                                                type="text"
                                                placeholder="Filtrar..."
                                                value={skuFilter}
                                                onChange={(e) => setSkuFilter(e.target.value)}
                                                className="w-full px-2 py-0.5 text-xs font-normal border border-subtle rounded bg-surface text-fg focus:outline-none focus:border-primary shadow-sm"
                                            />
                                        </div>
                                    </th>

                                    {/* Repuesto Column */}
                                    <th className="px-4 py-2.5 cursor-default">
                                        <div className="flex flex-col gap-1.5">
                                            <span className="font-bold text-xs">Repuesto</span>
                                            <input
                                                type="text"
                                                placeholder="Filtrar..."
                                                value={nameFilter}
                                                onChange={(e) => setNameFilter(e.target.value)}
                                                className="w-full px-2 py-0.5 text-xs font-normal border border-subtle rounded bg-surface text-fg focus:outline-none focus:border-primary shadow-sm"
                                            />
                                        </div>
                                    </th>

                                    <th className="px-4 py-2.5 text-center align-bottom w-32">
                                        <span className="font-bold block mb-1 text-xs text-center">Mi Stock (Local)</span>
                                    </th>
                                    <th className="px-4 py-2.5 text-center align-bottom w-36">
                                        <span className="font-bold block mb-1 text-xs text-center">Stock Importadora</span>
                                    </th>
                                    <th className="px-4 py-2.5 text-right align-bottom w-28">
                                        <span className="font-bold block mb-1 text-xs text-right">Costo Prov.</span>
                                    </th>
                                    <th className="px-4 py-2.5 text-center w-28 align-bottom">
                                        <span className="font-bold block mb-1 text-xs text-center">Acción</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                {loadingProducts ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-16 text-center text-fg-muted">
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 size={36} className="animate-spin text-primary" aria-hidden="true" />
                                                <span>Cargando catálogo de la importadora...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginatedProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-16 text-center text-fg-muted">
                                            <div className="flex flex-col items-center gap-2">
                                                <SearchX size={36} className="text-fg-subtle" aria-hidden="true" />
                                                <span>No se encontraron productos coincidentes en el catálogo.</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginatedProducts.map(prod => {
                                    const localStock = localStockMap[prod.codigo] !== undefined ? localStockMap[prod.codigo] : null;
                                    const inCart = cart[prod.codigo];
                                    
                                    return (
                                        <tr key={prod.codigo} className="hover:bg-surface-hover transition-colors border-b border-subtle">
                                            {/* Código (SKU) Column */}
                                            <td className="px-4 py-3 font-mono text-xs text-fg-muted align-middle whitespace-nowrap">
                                                {prod.codigo}
                                            </td>

                                            {/* Repuesto (Foto + Nombre) Column */}
                                            <td className="px-4 py-3 align-middle">
                                                <div className="flex items-center gap-3">
                                                    {prod.imagen ? (
                                                        <div 
                                                            onClick={() => handleOpenLightbox(prod)}
                                                            className="h-10 w-10 flex-shrink-0 rounded-lg overflow-hidden border border-subtle bg-white shadow-sm relative cursor-zoom-in group/img"
                                                        >
                                                            <ImageIcon size={16} className="text-fg-subtle absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0" aria-hidden="true" />
                                                            <img 
                                                                src={prod.imagen} 
                                                                alt="" 
                                                                loading="lazy"
                                                                className="h-full w-full object-cover group-hover/img:scale-110 transition-all duration-300 relative z-10" 
                                                                onError={(e) => {
                                                                    const target = e.currentTarget;
                                                                    target.style.opacity = '0';
                                                                }}
                                                                onLoad={(e) => {
                                                                    e.currentTarget.style.opacity = '1';
                                                                }}
                                                            />
                                                            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors"></div>
                                                        </div>
                                                    ) : (
                                                        <div className="h-10 w-10 flex-shrink-0 rounded-lg border border-dashed border-strong bg-surface-2 flex items-center justify-center relative">
                                                            <ImageIcon size={16} className="text-fg-subtle" aria-hidden="true" />
                                                        </div>
                                                    )}
                                                    
                                                    <span 
                                                        className="font-semibold text-fg break-words line-clamp-2 max-w-lg block leading-snug text-xs md:text-sm"
                                                        title={prod.nombre}
                                                    >
                                                        {prod.nombre}
                                                    </span>
                                                </div>
                                            </td>
                                            
                                            {/* Mi Stock */}
                                            <td className="px-4 py-3 text-center align-middle">
                                                {!selectedWarehouseId ? (
                                                    <span className="text-[11px] text-slate-405 italic">Seleccione almacén</span>
                                                ) : loadingStock ? (
                                                    <Loader2 size={14} className="animate-spin text-fg-subtle" aria-hidden="true" />
                                                ) : localStock !== null ? (
                                                    <span className={`px-2 py-0.5 text-[11px] font-bold rounded-lg ${localStock > 0 ? 'bg-success-soft text-success border border-success/20 dark:border-success' : 'bg-danger-soft text-danger border border-danger/20 dark:border-danger'}`}>
                                                        {localStock} uds
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 text-[11px] font-bold rounded-lg bg-surface-2 text-fg-subtle border border-subtle">
                                                        No registrado (0)
                                                    </span>
                                                )}
                                            </td>

                                            {/* Stock Importadora */}
                                            <td className="px-4 py-3 text-center align-middle">
                                                <span className={`px-2 py-0.5 text-[11px] font-bold rounded-lg ${prod.cantidad > 0 ? 'bg-primary-soft text-primary border border-primary/20 dark:border-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-505 border border-subtle dark:border-slate-700'}`}>
                                                    {prod.cantidad} uds
                                                </span>
                                            </td>

                                            {/* Costo Proveedor */}
                                            <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-fg dark:text-slate-300 align-middle">
                                                ${(prod.costo || 0).toFixed(2)}
                                            </td>

                                            {/* Acción */}
                                            <td className="px-4 py-3 text-center align-middle">
                                                {prod.cantidad === 0 ? (
                                                    <button
                                                        disabled
                                                        className="w-full px-2 py-1 bg-surface-3 text-fg-subtle rounded-lg text-xs font-bold cursor-not-allowed border border-subtle"
                                                    >
                                                        Agotado
                                                    </button>
                                                ) : inCart ? (
                                                    <div className="flex items-center justify-center gap-0.5 bg-primary/10 dark:bg-primary/20 text-primary border border-primary/30 rounded-lg px-2 py-1">
                                                        <Check size={11} aria-hidden="true" />
                                                        <span className="text-2xs font-bold">Añadido ({inCart.quantity})</span>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleAddToCart(prod)}
                                                        className="w-full px-2 py-1 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <Plus size={12} className="font-bold" aria-hidden="true" />
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
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-subtle bg-slate-50/50 dark:bg-slate-900/30">
                            <div className="text-sm text-fg-muted">
                                Mostrando <span className="font-semibold text-fg">
                                    {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredProducts.length)}
                                </span> de <span className="font-semibold text-fg">{filteredProducts.length.toLocaleString()}</span> items encontrados
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => prev - 1)}
                                    className="flex items-center gap-1 px-3 py-1.5 border border-subtle rounded-lg text-sm font-medium text-fg-muted hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={16} aria-hidden="true" />
                                    Anterior
                                </button>
                                <span className="px-3 py-1.5 text-sm font-medium text-fg bg-surface border border-subtle rounded-lg">
                                    {currentPage} / {totalPages || 1}
                                </span>
                                <button
                                    disabled={currentPage >= totalPages}
                                    onClick={() => setCurrentPage(prev => prev + 1)}
                                    className="flex items-center gap-1 px-3 py-1.5 border border-subtle rounded-lg text-sm font-medium text-fg-muted hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Siguiente
                                    <ChevronRight size={16} aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══════ RIGHT PANEL: SHOPPING CART DRAWER ═══════ */}
            <div className="w-full lg:w-96 flex-shrink-0 flex flex-col bg-surface rounded-xl border border-subtle shadow-lg h-[calc(100vh-112px)] sticky top-24 overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-subtle bg-slate-50/50 dark:bg-slate-900/30 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <ShoppingBasket size={20} className="text-primary" aria-hidden="true" />
                        <h2 className="font-bold text-fg">Pedido de Abastecimiento</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleAutoSuggest}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-primary rounded transition-colors"
                            title="Auto-Pedir Repuestos Sourcing"
                        >
                            <Sparkles size={18} aria-hidden="true" />
                        </button>
                        <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                            {cartCount} piezas
                        </span>
                    </div>
                </div>

                {/* Drafts Selector & Actions */}
                <div className="px-4 py-2 border-b border-subtle bg-slate-100/30 dark:bg-slate-900/10 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="text-fg-subtle font-medium">Borrador:</span>
                        <select
                            value={activeDraftId}
                            onChange={(e) => handleSwitchDraft(e.target.value)}
                            className="bg-transparent border-none text-fg font-bold outline-none cursor-pointer p-0 pr-6 text-xs truncate max-w-[150px] focus:ring-0"
                        >
                            {drafts.map(d => (
                                <option key={d.id} value={d.id} className="bg-surface text-fg dark:text-slate-200 font-normal">
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => {
                                const active = drafts.find(d => d.id === activeDraftId);
                                if (active) handleRenameDraft(activeDraftId, active.name);
                            }}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-fg-muted rounded transition-colors"
                            title="Renombrar borrador activo"
                        >
                            <Pencil size={16} className="leading-none" aria-hidden="true" />
                        </button>
                        <button
                            onClick={handleCreateDraft}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-fg-muted rounded transition-colors"
                            title="Crear nuevo borrador"
                        >
                            <Plus size={16} className="leading-none" aria-hidden="true" />
                        </button>
                        <button
                            onClick={() => setIsManageDraftsOpen(true)}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-fg-muted rounded transition-colors"
                            title="Administrar borradores guardados"
                        >
                            <FolderOpen size={16} className="leading-none" aria-hidden="true" />
                        </button>
                    </div>
                </div>

                {/* Cart Items List */}
                <div className="flex-1 p-3 overflow-y-auto space-y-2">
                    {cartList.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-fg-subtle py-12 text-center">
                            <ShoppingCart size={48} className="text-fg-subtle mb-2" aria-hidden="true" />
                            <p className="text-sm font-semibold">El carrito está vacío</p>
                            <p className="text-xs mt-1">Busca y añade los productos del importador que deseas reabastecer.</p>
                        </div>
                    ) : (
                        cartList.map(item => (
                            <div key={item.codigo} className="bg-surface-2 p-2 rounded-lg border border-slate-100 dark:border-subtle flex items-center gap-2 relative group hover:border-slate-300 dark:hover:border-subtle transition-colors">
                                {/* Cart Item Image */}
                                {item.imagen ? (
                                    <div 
                                        onClick={() => handleOpenLightbox(item)}
                                        className="h-9 w-9 flex-shrink-0 rounded-lg overflow-hidden border border-subtle bg-white shadow-sm relative cursor-zoom-in group/cartimg"
                                    >
                                        <img src={item.imagen} alt="" className="h-full w-full object-cover group-hover/cartimg:scale-105 transition-transform" />
                                    </div>
                                ) : (
                                    <div className="h-9 w-9 flex-shrink-0 rounded-lg border border-dashed border-strong bg-surface-2 flex items-center justify-center relative">
                                        <ImageIcon size={14} className="text-fg-subtle" aria-hidden="true" />
                                    </div>
                                )}

                                {/* Item Info */}
                                <div className="flex-1 min-w-0 pr-2">
                                    <span className="text-[12px] font-mono font-semibold text-fg-subtle block leading-none">{item.codigo}</span>
                                    <h4 className="text-xs font-bold text-fg break-words whitespace-normal leading-tight mt-0.5">{item.nombre}</h4>
                                    
                                    <div className="flex items-center justify-between mt-1">
                                        <div className="flex flex-col">
                                            <span className="text-[12px] text-fg-subtle font-medium leading-none">Cost: ${(item.costo || 0).toFixed(2)}</span>
                                            <span className="text-2xs font-bold text-fg mt-0.5">Subt: ${((item.costo || 0) * item.quantity).toFixed(2)}</span>
                                        </div>

                                        {/* Counter */}
                                        <div className="flex items-center border border-subtle rounded-lg bg-surface overflow-hidden">
                                            <button
                                                onClick={() => handleUpdateQuantity(item.codigo, item.quantity - 1, item.cantidad)}
                                                className="px-1 py-0.5 text-fg-muted hover:bg-surface-hover transition-colors"
                                            >
                                                <Minus size={12} className="leading-none font-bold" aria-hidden="true" />
                                            </button>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => handleUpdateQuantity(item.codigo, parseInt(e.target.value) || 0, item.cantidad)}
                                                className="w-8 text-center text-2xs font-semibold bg-transparent border-none outline-none focus:ring-0 p-0"
                                            />
                                            <button
                                                onClick={() => handleUpdateQuantity(item.codigo, item.quantity + 1, item.cantidad)}
                                                className="px-1 py-0.5 text-fg-muted hover:bg-surface-hover transition-colors"
                                            >
                                                <Plus size={12} className="leading-none font-bold" aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Delete Button */}
                                <button
                                    onClick={() => handleRemoveFromCart(item.codigo)}
                                    className="absolute top-1.5 right-1.5 text-fg-subtle hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
                                    title="Quitar"
                                >
                                    <X size={14} aria-hidden="true" />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Controls */}
                {cartList.length > 0 && (
                    <div className="p-4 border-t border-subtle bg-surface-2 flex flex-col gap-2.5">
                        <div className="flex justify-between text-xs text-fg-muted font-medium">
                            <span>Total de Repuestos:</span>
                            <span className="font-bold text-fg">{cartList.length} SKU</span>
                        </div>
                        <div className="flex justify-between text-xs text-fg-muted font-medium">
                            <span>Total de Unidades:</span>
                            <span className="font-bold text-fg">{cartCount} piezas</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-950 dark:text-white font-bold pb-2 border-t border-dashed border-subtle pt-2">
                            <span>SUMA TOTAL:</span>
                            <span className="text-success text-base">${cartTotalAmount.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex gap-2">
                            <button
                                onClick={handleClearCart}
                                className="flex-1 px-4 py-2.5 border border-strong rounded-lg text-fg hover:bg-surface-hover text-xs font-bold transition-all"
                            >
                                Vaciar Lista
                            </button>
                            <button
                                onClick={handleExportExcel}
                                className="flex-[2] bg-success hover:bg-success text-white rounded-lg py-2.5 text-xs font-bold shadow-md shadow-success/10 flex items-center justify-center gap-1.5 transition-colors"
                            >
                                <Download size={16} className="font-bold" aria-hidden="true" />
                                Descargar Excel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══════ MODAL: MANAGE DRAFTS ═══════ */}
            {isManageDraftsOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsManageDraftsOpen(false)}></div>
                    <div className="relative bg-surface rounded-xl shadow-xl w-full max-w-2xl overflow-hidden border border-subtle flex flex-col max-h-[80vh]">
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-subtle flex justify-between items-center bg-surface-2">
                            <div className="flex items-center gap-2">
                                <FolderOpen size={20} className="text-primary" aria-hidden="true" />
                                <h3 className="font-bold text-fg">Pedidos Guardados (Borradores)</h3>
                            </div>
                            <button onClick={() => setIsManageDraftsOpen(false)} className="text-fg-subtle hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <X size={18} aria-hidden="true" />
                            </button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-3">
                            {drafts.map(d => {
                                const dItems = Object.values(d.cart || {});
                                const dCount = dItems.reduce((acc, item) => acc + item.quantity, 0);
                                const dTotal = dItems.reduce((acc, item) => acc + (item.costo * item.quantity), 0);
                                const isActive = d.id === activeDraftId;
                                
                                return (
                                    <div 
                                        key={d.id} 
                                        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${isActive ? 'bg-primary/5 border-primary dark:bg-primary/10' : 'bg-slate-50 dark:bg-slate-900/20 border-subtle hover:border-strong dark:hover:border-slate-655'}`}
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="font-bold text-fg text-sm">{d.name}</h4>
                                                {isActive && (
                                                    <span className="bg-primary/10 text-primary text-2xs font-bold px-2 py-0.5 rounded-full border border-primary/20">
                                                        Activo
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-fg-subtle text-xs">
                                                <span>📅 Creado: {new Date(d.createdAt).toLocaleDateString()}</span>
                                                <span>•</span>
                                                <span>📋 {dItems.length} SKU ({dCount} uds)</span>
                                                <span>•</span>
                                                <span className="font-semibold text-success">${dTotal.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 self-end sm:self-center">
                                            {!isActive && (
                                                <button
                                                    onClick={() => { handleSwitchDraft(d.id); setIsManageDraftsOpen(false); }}
                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-surface-3 text-fg rounded-lg text-xs font-bold transition-all border border-subtle"
                                                >
                                                    Cargar
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleRenameDraft(d.id, d.name)}
                                                className="p-2 hover:bg-surface-hover text-fg-subtle hover:text-fg-muted dark:hover:text-slate-300 rounded-lg transition-all"
                                                title="Renombrar"
                                            >
                                                <Pencil size={16} className="leading-none" aria-hidden="true" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteDraft(d.id)}
                                                disabled={drafts.length === 1}
                                                className="p-2 hover:bg-danger-soft text-fg-subtle hover:text-danger rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={16} className="leading-none" aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Media Lightbox */}
            <MediaLightbox
                isOpen={lightbox.isOpen}
                media={lightbox.media}
                initialIndex={lightbox.initialIndex}
                onClose={() => setLightbox(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
};

export default Replenishment;
