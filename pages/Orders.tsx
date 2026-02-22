import React, { useState, useEffect } from 'react';
import { Plus, Search, X, MessageCircle, FileText, CheckCircle2, Camera, UploadCloud } from 'lucide-react';
import { supabase } from '../supabaseClient';

// Interfaces
interface Product { id: number; sku: string; name: string; price: number; }
interface OrderItem { id: string; product: Product; quantity: number; unitPrice: number; subtotal: number; }
interface Order {
    id: string;
    customerName: string;
    phone: string;
    status: 'draft' | 'pending_verification' | 'processing_fulfillment' | 'ready_for_pickup' | 'shipped' | 'completed' | 'cancelled';
    total: number;
    date: string;
    paymentReceiptUrl?: string;
    bankRef?: string;
    shippingAddress?: string;
    shippingCost?: number;
}

// Dummy Data
const dummyProducts: Product[] = [
    { id: 1, sku: 'PROD-001', name: 'Aceite de Motor 5W-30', price: 15.50 },
    { id: 2, sku: 'PROD-002', name: 'Filtro de Aire', price: 8.75 },
    { id: 3, sku: 'PROD-003', name: 'Bujía', price: 4.25 },
];

const mockOrders: Order[] = [
    { id: 'ORD-001', customerName: 'María García', phone: '0987654321', status: 'draft', total: 45.50, date: 'Hoy, 10:30 AM' },
    { id: 'ORD-002', customerName: 'Taller Los Amigos', phone: '0991122334', status: 'pending_verification', total: 120.00, date: 'Ayer, 16:45', bankRef: '123456789' },
    { id: 'ORD-003', customerName: 'Carlos López', phone: '0988887777', status: 'processing_fulfillment', total: 34.25, date: 'Ayer, 09:15 AM' },
    { id: 'ORD-004', customerName: 'Repuestos XYZ', phone: '0995554433', status: 'shipped', total: 550.00, date: '20 Feb, 14:00' },
];

// Kanban Column Config based on strict pipeline
const columns = [
    { id: 'draft', title: 'Borrador', color: 'bg-gray-100', borderColor: 'border-gray-300', icon: <FileText size={18} className="text-gray-500" /> },
    { id: 'pending_verification', title: 'Por Verificar Pago', color: 'bg-yellow-50', borderColor: 'border-yellow-300', icon: <MessageCircle size={18} className="text-yellow-500" /> },
    { id: 'processing_fulfillment', title: 'En Preparación', color: 'bg-purple-50', borderColor: 'border-purple-300', icon: <div className="w-4 h-4 rounded-full bg-purple-500"></div> },
    { id: 'ready_for_pickup', title: 'Bodega / Mostrador', color: 'bg-blue-50', borderColor: 'border-blue-300', icon: <CheckCircle2 size={18} className="text-blue-500" /> },
    { id: 'shipped', title: 'Completado', color: 'bg-green-50', borderColor: 'border-green-300', icon: <CheckCircle2 size={18} className="text-green-500" /> },
];

const Orders: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>(mockOrders);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // Modal Form State
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState<OrderItem[]>([]);
    const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });

    // Draft Conversion Pipeline fields
    const [bankRef, setBankRef] = useState('');
    const [shippingAddress, setShippingAddress] = useState('');
    const [shippingCost, setShippingCost] = useState(0);
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const isDraft = !selectedOrder || selectedOrder.status === 'draft';
    const canEdit = isDraft;

    // Load an order into modal
    const handleViewOrder = (order: Order) => {
        setSelectedOrder(order);
        setCustomerInfo({ name: order.customerName, phone: order.phone });
        setBankRef(order.bankRef || '');
        setShippingAddress(order.shippingAddress || '');
        setShippingCost(order.shippingCost || 0);
        setReceiptPreview(order.paymentReceiptUrl || null);
        // Map dummy items since backend connection is simplified for UI
        setCart([
            {
                id: crypto.randomUUID(),
                product: dummyProducts[0],
                quantity: 1,
                unitPrice: order.total,
                subtotal: order.total
            }
        ]);
        setIsModalOpen(true);
    };

    const handleNewOrder = () => {
        setSelectedOrder(null);
        setCustomerInfo({ name: '', phone: '' });
        setCart([]);
        setBankRef('');
        setShippingAddress('');
        setShippingCost(0);
        setReceiptPreview(null);
        setIsModalOpen(true);
    };

    // Product Search
    const handleProductSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim() || !canEdit) return;

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
        if (!canEdit) return;
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
        if (!canEdit || qty < 1) return;
        setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: qty, subtotal: qty * item.unitPrice } : item));
    };

    const handleRemove = (id: string) => {
        if (!canEdit) return;
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!canEdit || !e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setUploading(true);

        try {
            // Preview locally immediately for snappy UX
            setReceiptPreview(URL.createObjectURL(file));

            // Upload to Supabase Storage 'payment_receipts'
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const { data, error } = await supabase.storage.from('payment_receipts').upload(fileName, file);

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage.from('payment_receipts').getPublicUrl(fileName);
            // Replace preview with actual URL
            setReceiptPreview(publicUrl);
        } catch (error) {
            console.error('Error uploading receipt:', error);
            alert("Error al subir el comprobante");
            setReceiptPreview(null); // revert on error
        } finally {
            setUploading(false);
        }
    };

    const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
    const total = subtotal * 1.15; // 15% IVA

    const isSearchNotFound = searchQuery.trim() !== '' && !dummyProducts.some(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase() === searchQuery.toLowerCase()
    );

    // Save as Draft
    const handleSaveDraft = () => {
        if (selectedOrder) {
            setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, total, customerName: customerInfo.name, phone: customerInfo.phone } : o));
        } else {
            setOrders(prev => [{
                id: `ORD-${Math.floor(Math.random() * 1000)}`,
                customerName: customerInfo.name || 'Sin Nombre',
                phone: customerInfo.phone,
                status: 'draft',
                total: total,
                date: 'Justo ahora'
            }, ...prev]);
        }
        setIsModalOpen(false);
    };

    // Convert Draft to "Pending Verification" (Officially Process Sale)
    const handleProcessSale = () => {
        if (!bankRef || !receiptPreview) {
            alert("Debe proveer número de comprobante/banco y capturar/subir el recibo.");
            return;
        }

        if (selectedOrder) {
            setOrders(prev => prev.map(o => o.id === selectedOrder.id ? {
                ...o,
                status: 'pending_verification',
                total,
                customerName: customerInfo.name,
                phone: customerInfo.phone,
                bankRef,
                paymentReceiptUrl: receiptPreview,
                shippingAddress,
                shippingCost
            } : o));
        } else {
            setOrders(prev => [{
                id: `ORD-${Math.floor(Math.random() * 1000)}`,
                customerName: customerInfo.name || 'Sin Nombre',
                phone: customerInfo.phone,
                status: 'pending_verification',
                total: total,
                date: 'Justo ahora',
                bankRef,
                paymentReceiptUrl: receiptPreview,
                shippingAddress,
                shippingCost
            }, ...prev]);
        }
        setIsModalOpen(false);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] p-6 bg-slate-50 dark:bg-[#0d1117] overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 z-10">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Pipeline de Órdenes</h1>
                    <p className="text-slate-500 text-sm mt-1">Gestión asíncrona, cotizaciones y verificación de cobros</p>
                </div>
                <button
                    onClick={handleNewOrder}
                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-md font-medium shadow-sm transition-colors flex items-center gap-2"
                >
                    <Plus size={18} />
                    Nuevo Draft
                </button>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
                <div className="flex gap-6 h-full min-w-max">
                    {columns.map(col => (
                        <div key={col.id} className="w-80 flex flex-col bg-slate-100/50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm h-full">
                            <div className={`px-4 py-3 border-b border-t-4 border-t-transparent ${col.borderColor} bg-white dark:bg-[#0c1117] flex justify-between items-center`}>
                                <div className="flex items-center gap-2">
                                    {col.icon}
                                    <h2 className="font-semibold text-slate-800 dark:text-slate-200">{col.title}</h2>
                                </div>
                                <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold px-2 py-1 rounded-full">
                                    {orders.filter(o => o.status === col.id).length}
                                </span>
                            </div>

                            <div className="flex-1 p-3 overflow-y-auto space-y-3">
                                {orders.filter(o => o.status === col.id).map(order => (
                                    <div
                                        key={order.id}
                                        onClick={() => handleViewOrder(order)}
                                        className={`bg-white dark:bg-[#0c1117] p-4 rounded-lg shadow-sm border ${order.status === 'draft' ? 'border-slate-200 hover:border-blue-400' : 'border-slate-200/50 hover:border-slate-400 opacity-90'} dark:border-slate-800 cursor-pointer transition-colors group`}
                                    >
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

            {/* Editor Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative bg-white dark:bg-[#0c1117] rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-[#161b22]">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <FileText className={canEdit ? "text-blue-500" : "text-green-500"} />
                                {canEdit ? "Cotización (Draft)" : `Orden: ${selectedOrder?.id} (Solo Lectura)`}
                            </h2>
                            {!canEdit && (
                                <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1 rounded text-xs font-bold uppercase">
                                    {selectedOrder?.status.replace('_', ' ')}
                                </span>
                            )}
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors ml-auto">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
                            {/* Left Side: Order Items & Customer */}
                            <div className="flex-1 space-y-6">
                                {/* Customer Info */}
                                <div className="bg-slate-50 dark:bg-[#161b22] p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Responsable del Pedido</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <input
                                            type="text" placeholder="Nombre / Empresa"
                                            value={customerInfo.name} onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                            disabled={!canEdit}
                                            className="w-full bg-white dark:bg-[#0c1117] border border-slate-300 dark:border-slate-700 rounded p-2 text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-60 disabled:bg-slate-100"
                                        />
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-green-600"><MessageCircle size={16} /></span>
                                            <input
                                                type="text" placeholder="Teléfono / Celular (Clave Referido)"
                                                value={customerInfo.phone} onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                                                disabled={!canEdit}
                                                className="w-full bg-white dark:bg-[#0c1117] border border-slate-300 dark:border-slate-700 rounded p-2 pl-8 text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-60 disabled:bg-slate-100"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Cart Table */}
                                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                                    {canEdit && (
                                        <div className="p-3 bg-white dark:bg-[#0c1117] border-b border-slate-200 dark:border-slate-800">
                                            <form onSubmit={handleProductSearch} className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    placeholder="Buscar SKU o nombre para agregar..."
                                                    className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-[#161b22] shadow-sm text-sm"
                                                />
                                            </form>
                                        </div>
                                    )}
                                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                                        <thead className="bg-slate-50 dark:bg-[#161b22]">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Item</th>
                                                <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500 uppercase w-20">Cant</th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase w-24">Subtotal</th>
                                                {canEdit && <th className="px-2 py-2 w-10"></th>}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-[#0c1117] divide-y divide-slate-100 dark:divide-slate-800">
                                            {cart.length === 0 ? (
                                                <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400 text-sm">El draft está vacío.</td></tr>
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
                                                            disabled={!canEdit}
                                                            className="w-14 px-1 py-1 text-center border border-slate-300 dark:border-slate-700 rounded text-sm bg-transparent disabled:opacity-60"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-sm font-bold text-slate-900 dark:text-white">${item.subtotal.toFixed(2)}</td>
                                                    {canEdit && (
                                                        <td className="px-2 py-2 text-center">
                                                            <button onClick={() => handleRemove(item.id)} className="text-slate-400 hover:text-red-500"><X size={16} /></button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Right Side: Shipping, Payment & Convert */}
                            <div className="w-full md:w-80 flex flex-col gap-4">
                                {/* Envío y Entrega */}
                                <div className="bg-white dark:bg-[#0c1117] border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-sm">
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Logística</h3>
                                    <div className="space-y-3">
                                        <input
                                            type="text" placeholder="Dirección / Ciudad (Ej: Servientrega UIO)"
                                            value={shippingAddress} onChange={e => setShippingAddress(e.target.value)}
                                            disabled={!canEdit}
                                            className="w-full border border-slate-300 dark:border-slate-700 rounded p-2 text-sm disabled:bg-slate-100 disabled:opacity-60 bg-transparent"
                                        />
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-slate-500">Costo Envío:</span>
                                            <input
                                                type="number" step="1"
                                                value={shippingCost} onChange={e => setShippingCost(parseFloat(e.target.value) || 0)}
                                                disabled={!canEdit}
                                                className="w-24 border border-slate-300 dark:border-slate-700 rounded p-2 text-sm disabled:bg-slate-100 disabled:opacity-60 bg-transparent flex-1 text-right"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Evidencia del Pago */}
                                <div className="bg-white dark:bg-[#0c1117] border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-sm">
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Prueba de Pago</h3>
                                    <div className="space-y-3">
                                        <input
                                            type="text" placeholder="Código Vaucher / Referencia Banco"
                                            value={bankRef} onChange={e => setBankRef(e.target.value)}
                                            disabled={!canEdit}
                                            className="w-full border border-slate-300 dark:border-slate-700 rounded p-2 text-sm disabled:bg-slate-100 disabled:opacity-60 bg-transparent font-mono"
                                        />

                                        {/* Camera & Upload Button */}
                                        <div className="relative">
                                            {canEdit && (
                                                <label className="flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-slate-500 hover:text-blue-500 hover:border-blue-400 cursor-pointer transition-colors bg-slate-50 dark:bg-[#161b22]">
                                                    {uploading ? <UploadCloud className="animate-pulse" /> : <Camera size={20} />}
                                                    <span className="text-sm font-medium">{uploading ? 'Subiendo...' : 'Capturar ó Subir Recibo'}</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        capture="environment"
                                                        onChange={handleFileUpload}
                                                        className="hidden"
                                                    />
                                                </label>
                                            )}
                                        </div>

                                        {/* Visualización de la Captura */}
                                        {receiptPreview && (
                                            <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden relative">
                                                <img src={receiptPreview} alt="Comprobante" className="w-full h-auto object-contain max-h-40" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Finanzas Resumen */}
                                <div className="mt-auto bg-slate-100 dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                                    <div className="space-y-1 mb-4 text-sm">
                                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                            <span>Subtotal Items</span><span>${subtotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                            <span>Flete/Envío</span><span>${shippingCost.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between font-bold text-lg text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                                            <span>Monto Depositado</span><span>${(total + shippingCost).toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {canEdit && (
                                            <button
                                                onClick={handleSaveDraft}
                                                className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2 rounded font-semibold shadow-sm text-sm"
                                            >
                                                Guardar en Borradores
                                            </button>
                                        )}
                                        {canEdit && (
                                            <button
                                                onClick={handleProcessSale}
                                                disabled={cart.length === 0}
                                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-3 rounded-lg font-bold shadow-md flex items-center justify-center gap-2 transition-colors mt-2"
                                            >
                                                <span>🔒 Convertir a Verificación</span>
                                            </button>
                                        )}
                                        {!canEdit && (
                                            <button
                                                onClick={() => setIsModalOpen(false)}
                                                className="w-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-lg font-bold"
                                            >
                                                Cerrar Vista
                                            </button>
                                        )}
                                    </div>
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
