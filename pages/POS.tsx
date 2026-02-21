import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, DollarSign, AlertTriangle, ArrowLeft, LogOut, Package, Search, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useCartStore, defaultConsumidorFinal, InventoryResult, CartItem, Product, Customer } from '../store/cartStore';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { PaymentModal } from '../components/pos/PaymentModal';

const POS: React.FC = () => {
    const navigate = useNavigate();

    // Global State
    const {
        cart, customer, shippingCost,
        setCustomer, setShippingCost, addToCart,
        updateQuantity, removeFromCart, clearCart,
        getSubtotal, getTotal
    } = useCartStore();

    // Local UI State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<InventoryResult[]>([]);
    const [isCashier, setIsCashier] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [paymentAccounts, setPaymentAccounts] = useState<{ id: number, name: string }[]>([]);
    const [selectedPaymentAccount, setSelectedPaymentAccount] = useState<number | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);

    const [isLostDemandModalOpen, setIsLostDemandModalOpen] = useState(false);
    const [lostDemandBikeModel, setLostDemandBikeModel] = useState('');
    const [lostDemandBrand, setLostDemandBrand] = useState('');

    // Refs
    const searchInputRef = useRef<HTMLInputElement>(null);
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
    const cartRef = useRef(cart);

    useEffect(() => { cartRef.current = cart; }, [cart]);

    // Initial Load
    useEffect(() => {
        const fetchInitialData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role_id')
                    .eq('id', session.user.id)
                    .single();
                if (profile?.role_id === 2) setIsCashier(true);
            }

            // Fetch payment accounts (assets)
            const { data: accounts } = await supabase
                .from('accounts')
                .select('id, name')
                .eq('category', 'asset')
                .order('position');

            if (accounts && accounts.length > 0) {
                setPaymentAccounts(accounts);
                setSelectedPaymentAccount(accounts[0].id);
            }
        };
        fetchInitialData();
    }, []);

    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F2') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
            if (e.key === 'F12') {
                e.preventDefault();
                handleCheckoutClick();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Barcode Scanner Integration
    // When a barcode is fired, look it up instantly and add
    const handleBarcodeScan = useCallback(async (barcode: string) => {
        setIsSearching(true);
        const { data, error } = await supabase
            .from('products')
            .select(`
                id, sku, name, price, cost_without_vat, vat_percentage,
                inventory_levels (
                    current_stock,
                    warehouse_id,
                    warehouses (name)
                )
            `)
            .eq('sku', barcode)
            .limit(1);

        setIsSearching(false);

        if (!error && data && data.length > 0) {
            const p = data[0];
            const stockLevel = p.inventory_levels?.find((il: any) => il.current_stock > 0);

            if (stockLevel) {
                // Safely handle if warehouses is array or object
                const whName = Array.isArray(stockLevel.warehouses)
                    ? (stockLevel.warehouses as any)[0]?.name
                    : (stockLevel.warehouses as any)?.name;

                const mappedItem: InventoryResult = {
                    product: {
                        id: p.id,
                        sku: p.sku,
                        name: p.name,
                        price: p.price,
                        cost_without_vat: p.cost_without_vat || 0,
                        vat_percentage: p.vat_percentage || 0,
                        final_cost_with_vat: (p.cost_without_vat || 0) * (1 + (p.vat_percentage || 0) / 100)
                    },
                    warehouse_id: stockLevel.warehouse_id,
                    warehouse_name: whName || 'Desconocido',
                    current_stock: stockLevel.current_stock
                };
                // Instantly add to Zustand store
                addToCart(mappedItem);
            } else {
                alert(`¡Producto escaneado (${barcode}) no tiene stock en ninguna bodega!`);
            }
        } else {
            alert(`Producto no encontrado para el SKU escaneado: ${barcode}`);
        }
    }, [addToCart]);

    useBarcodeScanner(handleBarcodeScan);

    // Debounced Search
    useEffect(() => {
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

        const query = searchQuery.trim();
        if (!query) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        debounceTimeout.current = setTimeout(async () => {
            // Search logic
            // We need to fetch products that match and unnest their inventory levels
            const { data, error } = await supabase
                .from('products')
                .select(`
                    id, sku, name, price, cost_without_vat, vat_percentage,
                    inventory_levels (
                        current_stock,
                        warehouse_id,
                        warehouses (name)
                    )
                `)
                .or(`sku.ilike.%${query}%,name.ilike.%${query}%`)
                .limit(20);

            if (error) {
                console.error("Search error:", error);
                setSearchResults([]);
                setIsSearching(false);
                return;
            }

            let results: InventoryResult[] = [];
            data?.forEach((p: any) => {
                const cost = p.cost_without_vat || 0;
                const vat = p.vat_percentage || 0;
                const finalCost = cost * (1 + vat / 100);

                const mappedProduct: Product = {
                    id: p.id,
                    sku: p.sku,
                    name: p.name,
                    price: p.price,
                    cost_without_vat: cost,
                    vat_percentage: vat,
                    final_cost_with_vat: finalCost
                };

                p.inventory_levels?.forEach((il: any) => {
                    if (il.current_stock > 0) {
                        // In some queries, joined relation is an object, in others an array. Safely handle both:
                        const whName = Array.isArray(il.warehouses)
                            ? il.warehouses[0]?.name
                            : il.warehouses?.name;

                        results.push({
                            product: mappedProduct,
                            warehouse_id: il.warehouse_id,
                            warehouse_name: whName || 'Desconocido',
                            current_stock: il.current_stock
                        });
                    }
                });
            });

            setSearchResults(results);
            setIsSearching(false);

            // Lost demand tracking
            if (results.length === 0) {
                await handleRegistrarDemanda(query, 'out_of_stock');
            }

        }, 300);

        return () => {
            if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        };
    }, [searchQuery]);

    // Watch for customer search query changes
    useEffect(() => {
        if (customerSearchQuery.length < 3) {
            setCustomerSearchResults([]);
            return;
        }

        const fetchCustomers = async () => {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .or(`name.ilike.%${customerSearchQuery}%,identification_number.ilike.%${customerSearchQuery}%`)
                .limit(5);

            if (!error && data) {
                setCustomerSearchResults(data as Customer[]);
            }
        };

        const timeout = setTimeout(fetchCustomers, 300);
        return () => clearTimeout(timeout);
    }, [customerSearchQuery]);


    const handleExit = () => {
        if (cartRef.current.length > 0) {
            if (window.confirm("¿Estás seguro que deseas salir? El carrito no está vacío y se perderán los datos.")) {
                navigate(-1);
            }
        } else {
            navigate(-1);
        }
    };

    const handleLogout = async () => {
        if (cartRef.current.length > 0 && !window.confirm("¿Estás seguro que deseas salir? El carrito no está vacío y se perderán los datos.")) {
            return;
        }
        await supabase.auth.signOut();
        navigate('/login');
    };

    const handleRegistrarDemanda = async (term: string, reason: string, customData?: any) => {
        try {
            await supabase.from('lost_demand').insert([{
                search_term: term,
                reason: reason,
                channel: 'POS',
                ...customData
            }]);
            console.log("Lost demand logged:", term);
        } catch (e) {
            console.error(e);
        }
    };

    const handleManualLostDemandSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await handleRegistrarDemanda(searchQuery, 'not_in_catalog');
        // If we expand the DB to hold brand/model for lost demand, we'd pass it in customData
        alert('Demanda registrada exitosamente.');
        setIsLostDemandModalOpen(false);
        setLostDemandBrand('');
        setLostDemandBikeModel('');
        setSearchQuery('');
    };

    const handleAddToCart = (item: InventoryResult) => {
        addToCart(item);
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
        updateQuantity(itemId, newQuantity);
    };

    const handleRemoveFromCart = (itemId: string) => {
        removeFromCart(itemId);
    };

    const handleCheckoutClick = () => {
        if (cartRef.current.length === 0) {
            alert("El carrito está vacío");
            return;
        }
        setIsPaymentModalOpen(true);
    };

    const processCheckout = async (paymentAccountId: number) => {
        if (cartRef.current.length === 0) return;

        try {
            const itemsPayload = cartRef.current.map(c => ({
                product_id: c.product.id,
                warehouse_id: c.warehouse_id,
                quantity: c.quantity,
                unit_price: c.unitPrice,
                unit_cost: c.unitCost
            }));

            const { data, error } = await supabase.rpc('process_pos_sale', {
                p_customer_id: customer.id,
                p_payment_account_id: paymentAccountId,
                p_shipping_cost: shippingCost,
                p_items: itemsPayload
            });

            if (error) {
                alert(`Error procesando la venta: ${error.message}`);
                throw error;
            }

            alert("¡Venta completada con éxito!");
            clearCart();
            setSearchQuery('');
        } catch (err) {
            console.error("Checkout failed", err);
            throw err; // Re-throw for PaymentModal to handle
        }
    };

    // Derived State from Zustand
    const subtotal = getSubtotal();
    const orderTotal = getTotal();

    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden text-slate-800 font-sans">
            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                paymentAccounts={paymentAccounts}
                onProcess={processCheckout}
            />

            {/* Header */}
            <header className="bg-white px-4 md:px-6 py-3 shadow-md flex justify-between items-center z-20">
                <div className="flex items-center gap-2 md:gap-4">
                    {!isCashier ? (
                        <button onClick={handleExit} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors">
                            <ArrowLeft size={20} />
                            <span className="font-medium text-sm hidden sm:inline">Volver</span>
                        </button>
                    ) : (
                        <button onClick={handleLogout} className="flex items-center gap-2 text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 md:px-3 md:py-1.5 rounded-md">
                            <LogOut size={18} />
                            <span className="font-medium text-sm hidden sm:inline">Salir</span>
                        </button>
                    )}
                    <div className="h-6 w-px bg-slate-300 mx-1 md:mx-2"></div>

                    <div className="flex flex-col md:flex-row items-start md:items-center gap-1 md:gap-2">
                        <span className="text-[10px] md:text-sm font-semibold text-slate-500 uppercase hidden md:inline">Cliente:</span>
                        <div className="flex items-center gap-2 bg-slate-50 px-2 py-1 md:px-3 md:py-1.5 rounded-md border border-slate-200">
                            <span className="font-bold text-slate-800 text-xs md:text-sm truncate max-w-[120px] md:max-w-xs">{customer.name}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[10px] md:text-sm font-semibold text-slate-500 uppercase hidden md:inline">Cajero_POS</span>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

                {/* Left Side: Product Search & Cart */}
                <div className="flex-1 flex flex-col p-4 md:p-6 pb-2 md:pb-4 overflow-y-auto">

                    {/* Search Bar */}
                    <div className="mb-4 relative z-10">
                        <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                {isSearching ? (
                                    <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                                ) : (
                                    <Search className="h-5 w-5 text-slate-400" />
                                )}
                            </div>
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar producto (F2)"
                                className="block w-full pl-10 pr-3 py-3 md:py-4 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-lg shadow-sm"
                                autoFocus
                            />
                        </div>

                        {/* Search Results Dropdown */}
                        {searchQuery.trim().length > 0 && (
                            <div className="absolute top-full mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-96 overflow-y-auto">
                                {searchResults.length > 0 ? (
                                    <ul className="divide-y divide-slate-100">
                                        {searchResults.map((result, idx) => (
                                            <li
                                                key={idx}
                                                className="p-3 hover:bg-blue-50 cursor-pointer transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-2"
                                                onClick={() => handleAddToCart(result)}
                                            >
                                                <div>
                                                    <div className="font-bold text-slate-800">{result.product.name}</div>
                                                    <div className="text-xs font-mono text-slate-500">{result.product.sku}</div>
                                                    <div className="flex items-center gap-3 mt-1.5">
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                                            <MapPin size={10} /> {result.warehouse_name}
                                                        </span>
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${result.current_stock > 5 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                            <Package size={10} /> {result.current_stock} u.
                                                        </span>
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                                                            <DollarSign size={10} /> Costo: ${(result.product.final_cost_with_vat || 0).toFixed(2)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="font-bold text-blue-600 text-lg">
                                                    ${result.product.price.toFixed(2)}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : !isSearching ? (
                                    <div className="p-6 text-center text-slate-500">
                                        <AlertTriangle className="mx-auto h-8 w-8 text-amber-500 mb-2" />
                                        <p>No se encontraron resultados.</p>
                                        <p className="text-xs text-slate-400 mt-1">Se ha registrado esta demanda.</p>
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>

                    {/* Cart Items (Mobile Stack / Desktop Table) */}
                    <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">

                        {/* Desktop Table Header */}
                        <div className="hidden md:flex bg-slate-50 border-b border-slate-200 px-4 py-3 sticky top-0">
                            <div className="flex-1 text-xs font-bold text-slate-500 uppercase tracking-wider">Producto</div>
                            <div className="w-24 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Precio</div>
                            <div className="w-28 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Cant</div>
                            <div className="w-28 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Subtotal</div>
                            <div className="w-12 text-center text-xs font-bold text-slate-500 uppercase tracking-wider"></div>
                        </div>

                        <div className="flex-1 overflow-y-auto w-full">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center p-6 text-slate-400">
                                    <Search className="h-12 w-12 text-slate-200 mb-3" />
                                    <p className="text-lg font-medium text-slate-500">El carrito está vacío</p>
                                    <p className="text-sm">Busca y selecciona productos para agregarlos</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {cart.map((item) => (
                                        <div key={item.id} className="p-3 md:px-4 md:py-3 hover:bg-slate-50 flex flex-col md:flex-row md:items-center gap-3">
                                            {/* Mobile & Desktop Info Layer */}
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-slate-900">{item.product.name}</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded">{item.product.sku}</span>
                                                    <span className="text-[10px] text-slate-400">{item.warehouse_name}</span>
                                                </div>
                                            </div>

                                            {/* Responsive Pricing/Qty Layer */}
                                            <div className="flex items-center justify-between md:gap-4 mt-2 md:mt-0">
                                                <div className="text-sm font-medium text-slate-500 md:w-24 md:text-center">
                                                    <span className="md:hidden text-xs text-slate-400 mr-1">Pu:</span>
                                                    ${item.unitPrice.toFixed(2)}
                                                </div>

                                                <div className="md:w-28 flex justify-center">
                                                    <div className="flex items-center border border-slate-300 rounded overflow-hidden">
                                                        <button
                                                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                                            className="px-2 py-1 bg-slate-50 text-slate-600 hover:bg-slate-200"
                                                        >-</button>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={item.quantity || ''}
                                                            onChange={(e) => handleUpdateQuantity(item.id, parseFloat(e.target.value) || 0)}
                                                            className="w-12 px-1 py-1 text-center text-sm font-bold outline-none"
                                                        />
                                                        <button
                                                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                                            className="px-2 py-1 bg-slate-50 text-slate-600 hover:bg-slate-200"
                                                        >+</button>
                                                    </div>
                                                </div>

                                                <div className="text-base font-bold text-slate-900 md:w-28 md:text-right">
                                                    ${item.subtotal.toFixed(2)}
                                                </div>

                                                <button
                                                    onClick={() => handleRemoveFromCart(item.id)}
                                                    className="md:w-12 flex justify-center text-red-400 hover:text-red-600 p-2 ml-2"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Side / Bottom: Total & Checkout */}
                <div className="md:w-96 bg-white border-t md:border-t-0 md:border-l border-slate-200 shadow-lg md:shadow-none flex flex-col z-20 shrink-0">
                    <div className="p-5 flex-1 bg-slate-50/50">
                        <h2 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider flex items-center justify-between">
                            Resumen de Venta
                        </h2>

                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between items-center text-slate-500 font-medium">
                                <span>Subtotal</span>
                                <span>${subtotal.toFixed(2)}</span>
                            </div>

                            {customer.discount_percentage && customer.discount_percentage > 0 ? (
                                <div className="flex justify-between items-center text-emerald-600 font-semibold text-sm">
                                    <span>Descuento ({customer.discount_percentage}%)</span>
                                    <span>-${(subtotal * (customer.discount_percentage / 100)).toFixed(2)}</span>
                                </div>
                            ) : null}

                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-600 font-medium whitespace-nowrap mr-2">Costo de Envío</span>
                                <div className="relative">
                                    <span className="absolute left-2 top-1.5 text-slate-400 text-xs">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={shippingCost || ''}
                                        onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                                        className="w-24 pl-5 pr-2 py-1 text-right text-sm border border-slate-300 rounded focus:border-blue-500 outline-none font-bold"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-black text-slate-800 uppercase">Total</span>
                                <span className="text-4xl font-black text-blue-600 tracking-tighter">${orderTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Removed duplicate payment selector here since it is now in the modal */}

                    </div>

                    <div className="p-4 bg-white border-t border-slate-200">
                        <button
                            onClick={handleCheckoutClick}
                            disabled={cart.length === 0}
                            className="w-full h-16 md:h-20 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black text-xl md:text-2xl uppercase rounded-xl shadow-lg transition-transform active:scale-95 flex flex-col items-center justify-center gap-0.5"
                        >
                            <span>Facturar</span>
                            <span className="text-[10px] md:text-xs font-semibold opacity-70 tracking-wider hidden md:inline">(F12)</span>
                        </button>
                    </div>
                </div>

            </div>
            {/* Customer Lookup Modal */}
            {isCustomerModalOpen && (
                <div className="fixed inset-0 z-[150] bg-slate-900/50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h2 className="font-bold text-slate-800 uppercase tracking-tight">Vincular Cliente al Carrito</h2>
                            <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-500 hover:text-slate-800 font-bold px-2 py-1 rounded hover:bg-slate-200 transition-colors">
                                ✕
                            </button>
                        </div>
                        <div className="p-4">
                            <input
                                autoFocus
                                type="text"
                                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-sm focus:border-blue-500 outline-none mb-4"
                                placeholder="Escribe el nombre o documento..."
                                value={customerSearchQuery}
                                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                            />

                            <div className="space-y-2 max-h-60 overflow-y-auto w-full">
                                {customerSearchResults.map(c => (
                                    <div
                                        key={c.id}
                                        onClick={() => {
                                            setCustomer(c);
                                            setIsCustomerModalOpen(false);
                                            setCustomerSearchQuery('');
                                            setCustomerSearchResults([]);
                                        }}
                                        className="p-3 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
                                    >
                                        <div className="font-bold text-slate-800">{c.name}</div>
                                        <div className="text-xs text-slate-500 flex justify-between mt-1">
                                            <span>{c.identification_number}</span>
                                            {c.customer_type && <span className="uppercase text-[10px] font-bold text-blue-500">{c.customer_type}</span>}
                                        </div>
                                    </div>
                                ))}
                                {customerSearchQuery.length >= 3 && customerSearchResults.length === 0 && (
                                    <div className="p-4 text-center text-sm text-slate-500 font-medium">
                                        No se encontró ningún cliente.
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 text-center">
                            <span className="text-xs text-slate-400">Consejo: Si no lo encuentras, créalo primero en <b>Directorio</b>.</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Lost Demand Modal */}
            {isLostDemandModalOpen && (
                <div className="fixed inset-0 z-[160] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-amber-50">
                            <h2 className="font-bold text-amber-800 uppercase tracking-tight flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" />
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
                                    disabled
                                    className="w-full bg-slate-100 border border-slate-200 rounded-lg p-3 text-sm font-medium text-slate-600 outline-none"
                                    value={searchQuery}
                                />
                            </div>

                            {/* Potential Future DB expansions below. For now UI only. */}
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

export default POS;
