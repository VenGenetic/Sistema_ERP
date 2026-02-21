import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Trash2, ArrowLeft } from 'lucide-react';

interface Product {
    id: number;
    sku: string;
    name: string;
    price: number;
}

interface Customer {
    id: number;
    identification_number: string;
    name: string;
    is_final_consumer: boolean;
}

interface CartItem {
    id: string; // unique string for the table row
    product: Product;
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

// Dummy Data
const defaultConsumidorFinal: Customer = { id: 1, identification_number: '9999999999', name: 'CONSUMIDOR FINAL', is_final_consumer: true };

const dummyProducts: Product[] = [
    { id: 1, sku: 'PROD-001', name: 'Aceite de Motor 5W-30', price: 15.50 },
    { id: 2, sku: 'PROD-002', name: 'Filtro de Aire', price: 8.75 },
    { id: 3, sku: 'PROD-003', name: 'Bujía', price: 4.25 },
];

const POS: React.FC = () => {
    const navigate = useNavigate();
    const [cart, setCart] = useState<CartItem[]>([]);
    const [customer, setCustomer] = useState<Customer>(defaultConsumidorFinal);
    const [searchQuery, setSearchQuery] = useState('');

    const searchInputRef = useRef<HTMLInputElement>(null);
    const quantityInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

    // Refs for keyboard listeners to access latest state without stale closures
    const cartRef = useRef(cart);
    const searchQueryRef = useRef(searchQuery);

    useEffect(() => {
        cartRef.current = cart;
    }, [cart]);

    useEffect(() => {
        searchQueryRef.current = searchQuery;
    }, [searchQuery]);

    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F2') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
            if (e.key === 'F4') {
                e.preventDefault();
                const currentSearch = searchQueryRef.current;
                if (currentSearch.trim() !== '') {
                    handleRegistrarDemanda(currentSearch);
                }
            }
            if (e.key === 'F12') {
                e.preventDefault();
                handleCheckout();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                handleExit();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleExit = () => {
        if (cartRef.current.length > 0) {
            if (window.confirm("¿Estás seguro que deseas salir? El carrito no está vacío y se perderán los datos.")) {
                navigate('/');
            }
        } else {
            navigate('/');
        }
    };

    const handleRegistrarDemanda = (term: string) => {
        console.log("Registrando demanda para:", term);
        alert(`Demanda registrada: ${term}`);
        setSearchQuery('');
        searchInputRef.current?.focus();
    };

    const handleCheckout = () => {
        if (cartRef.current.length === 0) {
            alert("El carrito está vacío");
            return;
        }
        alert("Cobrando factura...");
        setCart([]);
        setSearchQuery('');
        setCustomer(defaultConsumidorFinal);
    };

    const handleAddToCart = (product: Product) => {
        const newItemId = crypto.randomUUID();
        const newItem: CartItem = {
            id: newItemId,
            product,
            quantity: 1,
            unitPrice: product.price,
            subtotal: product.price,
        };
        setCart(prev => [...prev, newItem]);
        setSearchQuery('');

        // Jump focus to the new quantity input in next tick
        setTimeout(() => {
            if (quantityInputRefs.current[newItemId]) {
                quantityInputRefs.current[newItemId]?.focus();
                quantityInputRefs.current[newItemId]?.select();
            }
        }, 50);
    };

    const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
        if (newQuantity < 0) return;
        setCart(prev => prev.map(item => {
            if (item.id === itemId) {
                return {
                    ...item,
                    quantity: newQuantity,
                    subtotal: newQuantity * item.unitPrice
                };
            }
            return item;
        }));
    };

    const handleRemoveFromCart = (itemId: string) => {
        setCart(prev => prev.filter(item => item.id !== itemId));
    };

    const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, itemId: string) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchInputRef.current?.focus();
        }
    }

    const handleProductSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        const foundProduct = dummyProducts.find(p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.sku.toLowerCase() === searchQuery.toLowerCase()
        );

        if (foundProduct) {
            handleAddToCart(foundProduct);
        } else {
            // Did not find anything, show button for F4
        }
    };

    const isSearchNotFound = searchQuery.trim() !== '' && !dummyProducts.some(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase() === searchQuery.toLowerCase()
    );

    const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
    const iva = subtotal * 0.15; // Assuming 15% IVA
    const total = subtotal + iva;

    return (
        <div className="flex flex-col h-screen bg-gray-100 overflow-hidden text-gray-800 font-sans">

            {/* Zone A: Header */}
            <header className="bg-white px-6 py-3 shadow-md flex justify-between items-center z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleExit}
                        className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors"
                        title="Volver al Dashboard (ESC)"
                    >
                        <ArrowLeft size={20} />
                        <span className="font-medium text-sm hidden sm:inline">Volver</span>
                    </button>
                    <div className="h-6 w-px bg-gray-300 mx-2"></div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-500 uppercase">Cliente:</span>
                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200">
                            <span className="font-bold text-gray-800">{customer.name}</span>
                            <span className="text-xs text-gray-500">[{customer.identification_number}]</span>
                        </div>
                    </div>

                    <button className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium">
                        <Plus size={16} />
                        <span>Cambiar/Nuevo</span>
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-500 uppercase">Cajero:</span>
                    <span className="font-bold text-gray-800">Admin</span>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden">

                {/* Left Side: Product Search & Cart Grid */}
                <div className="flex-1 flex flex-col pt-4 px-6 pb-4">

                    {/* Zone B: Product Search */}
                    <div className="mb-4 relative">
                        <form onSubmit={handleProductSearch} className="flex gap-2 w-full">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Buscar producto por código o nombre (F2)"
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-lg shadow-sm"
                                    autoFocus
                                />
                            </div>
                        </form>

                        {isSearchNotFound && (
                            <div className="absolute top-14 left-0 right-0 z-20 flex justify-center">
                                <button
                                    onClick={() => handleRegistrarDemanda(searchQuery)}
                                    className="bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded-md shadow-lg font-medium hover:bg-red-200 transition-colors flex items-center gap-2"
                                >
                                    <span className="text-xl">⚠️</span>
                                    Registrar Demanda: "{searchQuery}" <span className="text-sm font-bold ml-2">(F4)</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Zone B: The Grid */}
                    <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
                        <div className="overflow-x-auto flex-1">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                                    <tr>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">Código</th>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Descripción</th>
                                        <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">Precio Unit.</th>
                                        <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">Cantidad</th>
                                        <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">Subtotal</th>
                                        <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {cart.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                                <div className="flex flex-col items-center justify-center">
                                                    <Search className="h-10 w-10 text-gray-300 mb-2" />
                                                    <p className="text-lg">El carrito está vacío</p>
                                                    <p className="text-sm text-gray-400">Escanea o busca un producto para comenzar</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        cart.map((item) => (
                                            <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{item.product.sku}</td>
                                                <td className="px-4 py-3 text-sm text-gray-800 font-medium">{item.product.name}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-medium text-gray-600">${item.unitPrice.toFixed(2)}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                                    <input
                                                        ref={el => quantityInputRefs.current[item.id] = el}
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity || ''}
                                                        onChange={(e) => handleUpdateQuantity(item.id, parseFloat(e.target.value) || 0)}
                                                        onKeyDown={(e) => handleQuantityKeyDown(e, item.id)}
                                                        className="w-20 px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-gray-900">${item.subtotal.toFixed(2)}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                                                    <button
                                                        onClick={() => handleRemoveFromCart(item.id)}
                                                        className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded transition-colors"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Side / Sidebar: Total & Checkout (Zone C equivalent but placed on the side for wider screens, or could be bottom) 
            Let's put it on the right side for a true POS feel, taking up about 1/4 of the screen width */}
                <div className="w-80 bg-white border-l border-gray-200 shadow-sm flex flex-col z-10 items-stretch h-full">
                    <div className="p-6 bg-gray-50 border-b border-gray-200 flex-1">
                        <h2 className="text-lg font-bold text-gray-800 mb-6 uppercase tracking-winder">Resumen de Venta</h2>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">Subtotal</span>
                                <span className="text-gray-900 font-bold tracking-tight text-lg">${subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">Descuento</span>
                                <span className="text-gray-900 font-bold tracking-tight text-lg">$0.00</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">IVA (15%)</span>
                                <span className="text-gray-900 font-bold tracking-tight text-lg">${iva.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="mt-8 pt-4 border-t border-gray-300">
                            <div className="flex justify-between items-center">
                                <span className="text-xl font-bold text-gray-800 uppercase">Total</span>
                                <span className="text-4xl font-extrabold text-green-600 tracking-tighter">${total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-white">
                        <button
                            onClick={handleCheckout}
                            disabled={cart.length === 0}
                            className="w-full h-20 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-2xl uppercase rounded-lg shadow-md transition-colors flex flex-col items-center justify-center gap-1"
                        >
                            <span>Cobrar / Facturar</span>
                            <span className="text-sm font-semibold opacity-80">(F12)</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default POS;
