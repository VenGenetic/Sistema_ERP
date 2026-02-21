import React, { useState } from 'react';
import { Plus, Search, X, MessageCircle, FileText, CheckCircle2 } from 'lucide-react';

// Interfaces
interface Product { id: number; sku: string; name: string; price: number; }
interface OrderItem { id: string; product: Product; quantity: number; unitPrice: number; subtotal: number; }
interface Order {
    id: string;
    customerName: string;
    phone: string;
    status: 'draft' | 'pending_payment' | 'ready_to_ship' | 'shipped';
    total: number;
    date: string;
}

// Dummy Data
const dummyProducts: Product[] = [
    { id: 1, sku: 'PROD-001', name: 'Aceite de Motor 5W-30', price: 15.50 },
    { id: 2, sku: 'PROD-002', name: 'Filtro de Aire', price: 8.75 },
    { id: 3, sku: 'PROD-003', name: 'Bujía', price: 4.25 },
];

const mockOrders: Order[] = [
    { id: 'ORD-001', customerName: 'María García', phone: '0987654321', status: 'draft', total: 45.50, date: 'Hoy, 10:30 AM' },
    { id: 'ORD-002', customerName: 'Taller Los Amigos', phone: '0991122334', status: 'pending_payment', total: 120.00, date: 'Ayer, 16:45' },
    { id: 'ORD-003', customerName: 'Carlos López', phone: '0988887777', status: 'ready_to_ship', total: 34.25, date: 'Ayer, 09:15 AM' },
    { id: 'ORD-004', customerName: 'Repuestos XYZ', phone: '0995554433', status: 'shipped', total: 550.00, date: '20 Feb, 14:00' },
];

// Kanban Column Config
const columns = [
    { id: 'draft', title: 'Cotización', color: 'bg-gray-100', borderColor: 'border-gray-300', icon: <FileText size={18} className="text-gray-500" /> },
    { id: 'pending_payment', title: 'Por Pagar', color: 'bg-yellow-50', borderColor: 'border-yellow-300', icon: <MessageCircle size={18} className="text-yellow-500" /> },
    { id: 'ready_to_ship', title: 'Por Enviar', color: 'bg-blue-50', borderColor: 'border-blue-300', icon: <div className="w-4 h-4 rounded-full bg-blue-500"></div> },
    { id: 'shipped', title: 'Completado', color: 'bg-green-50', borderColor: 'border-green-300', icon: <CheckCircle2 size={18} className="text-green-500" /> },
];

const Orders: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>(mockOrders);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Modal State
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState<OrderItem[]>([]);
    const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });

    // Order Creation Logic
    const handleProductSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        const foundProduct = dummyProducts.find(p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.sku.toLowerCase() === searchQuery.toLowerCase()
        );

        if (foundProduct) {
            handleAddToCart(foundProduct);
            setSearchQuery('');
        }
    };

    const handleAddToCart = (product: Product) => {
        const newItemId = crypto.randomUUID();
        setCart(prev => [...prev, {
            id: newItemId,
            product,
            quantity: 1,
            unitPrice: product.price,
            subtotal: product.price,
        }]);
    };

    const handleUpdateQuantity = (id: string, qty: number) => {
        if (qty < 1) return;
        setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: qty, subtotal: qty * item.unitPrice } : item));
    };

    const handleRemove = (id: string) => setCart(prev => prev.filter(item => item.id !== id));

    const isSearchNotFound = searchQuery.trim() !== '' && !dummyProducts.some(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase() === searchQuery.toLowerCase()
    );

    const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
    const total = subtotal * 1.15; // 15% IVA

    const handleGenerateQuote = () => {
        const lines = cart.map(item => `${item.quantity}x ${item.product.name} - $${item.subtotal.toFixed(2)}`).join('\n');
        const quoteText = `*COTIZACIÓN*\nCliente: ${customerInfo.name || 'Sin Nombre'}\nWhatsApp: ${customerInfo.phone}\n--------------------\n${lines}\n--------------------\n*TOTAL: $${total.toFixed(2)}*`;

        // Copy to clipboard
        navigator.clipboard.writeText(quoteText).then(() => {
            alert("Cotización copiada al portapapeles. Lista para enviar por WhatsApp.");
            // Add to mock board
            setOrders(prev => [{
                id: `ORD-${Math.floor(Math.random() * 1000)}`,
                customerName: customerInfo.name || 'Sin Nombre',
                phone: customerInfo.phone,
                status: 'draft',
                total: total,
                date: 'Justo ahora'
            }, ...prev]);
            setIsModalOpen(false);
            setCart([]);
            setCustomerInfo({ name: '', phone: '' });
        });
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] p-6 bg-slate-50 dark:bg-[#0d1117] overflow-hidden">

            {/* Header */}
            <div className="flex justify-between items-center mb-6 z-10">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Órdenes (Online)</h1>
                    <p className="text-slate-500 text-sm mt-1">Gestión de pedidos asíncronos y cotizaciones WhatsApp</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-md font-medium shadow-sm transition-colors flex items-center gap-2"
                >
                    <Plus size={18} />
                    Nueva Cotización
                </button>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
                <div className="flex gap-6 h-full min-w-max">
                    {columns.map(col => (
                        <div key={col.id} className="w-80 flex flex-col bg-slate-100/50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm h-full">
                            {/* Column Header */}
                            <div className={`px-4 py-3 border-b border-t-4 border-t-transparent ${col.borderColor} bg-white dark:bg-[#0c1117] flex justify-between items-center`}>
                                <div className="flex items-center gap-2">
                                    {col.icon}
                                    <h2 className="font-semibold text-slate-800 dark:text-slate-200">{col.title}</h2>
                                </div>
                                <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold px-2 py-1 rounded-full">
                                    {orders.filter(o => o.status === col.id).length}
                                </span>
                            </div>

                            {/* Column Content */}
                            <div className="flex-1 p-3 overflow-y-auto space-y-3">
                                {orders.filter(o => o.status === col.id).map(order => (
                                    <div key={order.id} className="bg-white dark:bg-[#0c1117] p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 cursor-pointer transition-colors group">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-mono text-slate-500 group-hover:text-blue-500 transition-colors">{order.id}</span>
                                            <span className="text-xs font-medium text-slate-400">{order.date}</span>
                                        </div>
                                        <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{order.customerName}</h3>
                                        <div className="flex items-center gap-1 text-slate-500 mb-3">
                                            <MessageCircle size={12} />
                                            <span className="text-xs font-mono">{order.phone}</span>
                                        </div>
                                        <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-between items-center">
                                            <span className="text-xs text-slate-500 font-medium">Total:</span>
                                            <span className="font-bold text-slate-900 dark:text-white">${order.total.toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* New Order / Quote Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative bg-white dark:bg-[#0c1117] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">

                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-[#161b22]">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <FileText className="text-blue-500" />
                                Generar Cotización (Draft)
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">

                            {/* Left Side: Creation */}
                            <div className="flex-1 space-y-6">
                                {/* Customer Info */}
                                <div className="bg-slate-50 dark:bg-[#161b22] p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Datos del Cliente</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <input
                                            type="text" placeholder="Nombre completo"
                                            value={customerInfo.name} onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                            className="w-full bg-white dark:bg-[#0c1117] border border-slate-300 dark:border-slate-700 rounded p-2 text-sm focus:ring-1 focus:ring-blue-500"
                                        />
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-green-600"><MessageCircle size={16} /></span>
                                            <input
                                                type="text" placeholder="WhatsApp"
                                                value={customerInfo.phone} onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                                                className="w-full bg-white dark:bg-[#0c1117] border border-slate-300 dark:border-slate-700 rounded p-2 pl-8 text-sm focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Product Search */}
                                <div className="relative">
                                    <form onSubmit={handleProductSearch}>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Buscar producto a cotizar..."
                                                className="w-full pl-10 pr-3 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0c1117] shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    </form>

                                    {isSearchNotFound && (
                                        <div className="absolute -bottom-12 left-0 right-0 z-20 flex justify-center">
                                            <button className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-1.5 rounded-md shadow-md text-sm font-medium hover:bg-red-100 transition-colors flex items-center gap-1">
                                                <span>⚠️</span> Registrar Demanda: "{searchQuery}"
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Cart Table (Simple) */}
                                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden mt-4">
                                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                                        <thead className="bg-slate-50 dark:bg-[#161b22]">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Item</th>
                                                <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500 uppercase w-20">Cant</th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase w-24">Subtotal</th>
                                                <th className="px-2 py-2 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-[#0c1117] divide-y divide-slate-100 dark:divide-slate-800">
                                            {cart.length === 0 ? (
                                                <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400 text-sm">No hay items en la cotización</td></tr>
                                            ) : cart.map((item) => (
                                                <tr key={item.id}>
                                                    <td className="px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                                                        {item.product.name}
                                                        <div className="text-xs text-slate-500 font-mono">{item.product.sku}</div>
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <input
                                                            type="number" min="1" value={item.quantity}
                                                            onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                                                            className="w-14 px-1 py-1 text-center border border-slate-300 dark:border-slate-700 rounded text-sm bg-transparent"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-sm font-bold text-slate-900 dark:text-white">${item.subtotal.toFixed(2)}</td>
                                                    <td className="px-2 py-2 text-center">
                                                        <button onClick={() => handleRemove(item.id)} className="text-slate-400 hover:text-red-500"><X size={16} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Right Side: Resumen */}
                            <div className="w-full md:w-72 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-lg p-5 flex flex-col">
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">Resumen</h3>

                                <div className="space-y-2 mb-6 text-sm">
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>IVA (15%)</span><span>${(subtotal * 0.15).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-lg text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                                        <span>Total</span><span>${total.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="mt-auto space-y-3">
                                    <button
                                        onClick={handleGenerateQuote}
                                        disabled={cart.length === 0}
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-3 rounded-lg font-bold shadow-md flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <span>Copiar & Guardar</span>
                                    </button>
                                    <p className="text-xs text-center text-slate-500">El stock no se descuenta hasta confirmar pago.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Orders;
