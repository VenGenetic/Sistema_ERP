import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X, MessageCircle, FileText, CheckCircle2, Camera, UploadCloud, Edit } from 'lucide-react';
import { supabase } from '../supabaseClient';

// Interfaces
interface OrderItem { id: string; product: { name: string; sku: string }; quantity: number; unitPrice: number; subtotal: number; }
interface Order {
    id: number;
    customerName: string;
    phone: string;
    status: 'draft' | 'pending_verification' | 'processing_fulfillment' | 'ready_for_pickup' | 'shipped' | 'completed' | 'cancelled';
    total: number;
    date: string;
    paymentReceiptUrl?: string;
    bankRef?: string;
    shippingAddress?: string;
    shippingCost?: number;
    items: OrderItem[];
}

// Kanban Column Config based on strict pipeline
const columns = [
    { id: 'draft', title: 'Borrador', color: 'bg-gray-100', borderColor: 'border-gray-300', icon: <FileText size={18} className="text-gray-500" /> },
    { id: 'pending_verification', title: 'Por Verificar Pago', color: 'bg-yellow-50', borderColor: 'border-yellow-300', icon: <MessageCircle size={18} className="text-yellow-500" /> },
    { id: 'processing_fulfillment', title: 'En Preparación', color: 'bg-purple-50', borderColor: 'border-purple-300', icon: <div className="w-4 h-4 rounded-full bg-purple-500"></div> },
    { id: 'ready_for_pickup', title: 'Bodega / Mostrador', color: 'bg-blue-50', borderColor: 'border-blue-300', icon: <CheckCircle2 size={18} className="text-blue-500" /> },
    { id: 'shipped', title: 'Completado', color: 'bg-green-50', borderColor: 'border-green-300', icon: <CheckCircle2 size={18} className="text-green-500" /> },
];

const Orders: React.FC = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // Draft Conversion Pipeline fields
    const [bankRef, setBankRef] = useState('');
    const [shippingAddress, setShippingAddress] = useState('');
    const [shippingCost, setShippingCost] = useState(0);
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: profile } = await supabase.from('profiles').select('role_id').eq('id', session.user.id).single();
            const isAdmin = profile?.role_id === 1;

            // Fetch orders
            let query = supabase
                .from('orders')
                .select(`
                    id, status, total_amount, shipping_cost, shipping_address, bank_reference_code, payment_receipt_url, created_at,
                    customers (name, phone),
                    order_items (
                        id, quantity, unit_price,
                        products (name, sku)
                    )
                `)
                .neq('status', 'cancelled')
                .order('created_at', { ascending: false });

            // If not admin, only fetch their own drafts/orders
            if (!isAdmin) {
                query = query.eq('closer_id', session.user.id);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (data) {
                const mappedOrders: Order[] = data.map((o: any) => ({
                    id: o.id,
                    customerName: o.customers?.name || 'Cliente Desconocido',
                    phone: o.customers?.phone || '',
                    status: o.status,
                    total: o.total_amount,
                    shippingCost: o.shipping_cost || 0,
                    shippingAddress: o.shipping_address || '',
                    bankRef: o.bank_reference_code || '',
                    paymentReceiptUrl: o.payment_receipt_url || '',
                    date: new Date(o.created_at).toLocaleDateString(),
                    items: o.order_items?.map((item: any) => ({
                        id: item.id,
                        quantity: item.quantity,
                        unitPrice: item.unit_price,
                        subtotal: item.quantity * item.unit_price,
                        product: {
                            name: item.products?.name || 'Producto Eliminado',
                            sku: item.products?.sku || 'N/A'
                        }
                    })) || []
                }));
                setOrders(mappedOrders);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const isDraft = selectedOrder?.status === 'draft';
    const canConvert = isDraft; // Only drafts can be modified with shipment/payments

    // Load an order into modal
    const handleViewOrder = (order: Order) => {
        setSelectedOrder(order);
        setBankRef(order.bankRef || '');
        setShippingAddress(order.shippingAddress || '');
        setShippingCost(order.shippingCost || 0);
        setReceiptPreview(order.paymentReceiptUrl || null);
        setIsModalOpen(true);
    };

    const handleNewOrder = () => {
        // POS is now the master cart builder
        navigate('/pos');
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!canConvert || !e.target.files || e.target.files.length === 0 || !selectedOrder) return;
        const file = e.target.files[0];
        setUploading(true);

        try {
            setReceiptPreview(URL.createObjectURL(file));

            const fileExt = file.name.split('.').pop();
            const fileName = `order_${selectedOrder.id}_${Math.random()}.${fileExt}`;
            const { data, error } = await supabase.storage.from('payment_receipts').upload(fileName, file);

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage.from('payment_receipts').getPublicUrl(fileName);
            setReceiptPreview(publicUrl);
        } catch (error) {
            console.error('Error uploading receipt:', error);
            alert("Error al subir el comprobante");
            setReceiptPreview(null);
        } finally {
            setUploading(false);
        }
    };

    // Convert Draft to "Pending Verification" (Officially Submit)
    const handleProcessSale = async () => {
        if (!selectedOrder) return;
        if (!bankRef || !receiptPreview) {
            alert("Debe proveer número de comprobante/banco y capturar/subir el recibo.");
            return;
        }

        try {
            const { error } = await supabase
                .from('orders')
                .update({
                    status: 'pending_verification',
                    bank_reference_code: bankRef,
                    payment_receipt_url: receiptPreview,
                    shipping_address: shippingAddress,
                    shipping_cost: shippingCost
                })
                .eq('id', selectedOrder.id);

            if (error) throw error;

            alert("Orden enviada a verificación exitosamente.");
            setIsModalOpen(false);
            fetchOrders(); // Refresh board
        } catch (error: any) {
            console.error("Error submitting order:", error);
            alert("Error al enviar la orden: " + error.message);
        }
    };

    if (loading) {
        return <div className="p-6 text-slate-500">Cargando pipeline...</div>;
    }

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
                    Nuevo Draft (POS)
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
                                            <span className="text-xs font-mono text-slate-500 group-hover:text-blue-500 transition-colors">#{order.id}</span>
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
            {isModalOpen && selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative bg-white dark:bg-[#0c1117] rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-[#161b22]">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <FileText className={isDraft ? "text-blue-500" : "text-green-500"} />
                                Orden #{selectedOrder.id}
                            </h2>
                            <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1 rounded text-xs font-bold uppercase">
                                {selectedOrder.status.replace('_', ' ')}
                            </span>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors ml-auto">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
                            {/* Left Side: Order Items & Customer */}
                            <div className="flex-1 space-y-6">
                                {/* Customer Info */}
                                <div className="bg-slate-50 dark:bg-[#161b22] p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Cliente</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="w-full bg-white dark:bg-[#0c1117] border border-slate-300 dark:border-slate-700 rounded p-2 text-sm text-slate-800 dark:text-slate-200">
                                            {selectedOrder.customerName}
                                        </div>
                                        <div className="w-full bg-white dark:bg-[#0c1117] border border-slate-300 dark:border-slate-700 rounded p-2 text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                            <span className="text-green-600"><MessageCircle size={16} /></span>
                                            {selectedOrder.phone || 'Sin Teléfono'}
                                        </div>
                                    </div>
                                </div>

                                {/* Cart Table (Read Only) */}
                                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden flex flex-col">
                                    <div className="bg-slate-50 dark:bg-[#161b22] px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Productos Seleccionados</h3>
                                        {isDraft && (
                                            <button onClick={() => alert("Próximamente: Redirección al POS con ?draft_id=" + selectedOrder.id)} className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline">
                                                <Edit size={14} /> Editar en POS
                                            </button>
                                        )}
                                    </div>
                                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                                        <thead className="bg-slate-50 dark:bg-[#161b22]">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Item</th>
                                                <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500 uppercase w-20">Cant</th>
                                                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase w-24">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-[#0c1117] divide-y divide-slate-100 dark:divide-slate-800">
                                            {selectedOrder.items.length === 0 ? (
                                                <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-400 text-sm">El draft está vacío.</td></tr>
                                            ) : selectedOrder.items.map((item) => (
                                                <tr key={item.id}>
                                                    <td className="px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                                                        {item.product.name}
                                                        <div className="text-xs text-slate-500 font-mono">{item.product.sku}</div>
                                                    </td>
                                                    <td className="px-3 py-2 text-center">{item.quantity}</td>
                                                    <td className="px-3 py-2 text-right text-sm font-bold text-slate-900 dark:text-white">${item.subtotal.toFixed(2)}</td>
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
                                            disabled={!canConvert}
                                            className="w-full border border-slate-300 dark:border-slate-700 rounded p-2 text-sm disabled:bg-slate-100 disabled:opacity-60 bg-transparent"
                                        />
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-slate-500">Costo Envío:</span>
                                            <input
                                                type="number" step="0.01"
                                                value={shippingCost} onChange={e => setShippingCost(parseFloat(e.target.value) || 0)}
                                                disabled={!canConvert}
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
                                            disabled={!canConvert}
                                            className="w-full border border-slate-300 dark:border-slate-700 rounded p-2 text-sm disabled:bg-slate-100 disabled:opacity-60 bg-transparent font-mono"
                                        />

                                        {/* Camera & Upload Button */}
                                        <div className="relative">
                                            {canConvert && (
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
                                        <div className="flex justify-between font-bold text-lg text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                                            <span>Monto Depositado</span><span>${(selectedOrder.total + shippingCost).toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {canConvert && (
                                            <button
                                                onClick={handleProcessSale}
                                                disabled={selectedOrder.items.length === 0}
                                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-3 rounded-lg font-bold shadow-md flex items-center justify-center gap-2 transition-colors mt-2"
                                            >
                                                <span>🔒 Convertir a Verificación</span>
                                            </button>
                                        )}
                                        {!canConvert && (
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
