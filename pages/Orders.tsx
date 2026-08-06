import React, { useState, useEffect } from 'react';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Plus, Search, X, MessageCircle, FileText, CheckCircle2, Camera, UploadCloud, Edit, PackageSearch, Phone, Truck, Lock, Unlock, Store, Printer } from 'lucide-react';
import { supabase } from '../supabaseClient';
import WhatsAppButton from '../components/WhatsAppButton';
import { isTransitionAllowed } from '../utils/orderStateMachine';
import { reprintOrderReceipt } from '../utils/thermalReceipt';
import { ThermalPrinterSelector } from '../components/ThermalPrinterSelector';
import OrderShipments from './OrderShipments';

// Interfaces
interface OrderItem { id: string; product: { name: string; sku: string }; quantity: number; unitPrice: number; subtotal: number; }
interface Order {
    id: number;
    customerName: string;
    phone: string;
    status: 'Borrador' | 'Sourcing_Pendiente' | 'Confirmado_Proveedor' | 'Pendiente_Pago' | 'Listo_Cumplimiento' | 'Alerta_Margen' | 'En_Transito' | 'Entregado' | 'RMA_Pendiente' | 'Cancelado' | 'Reembolsado';
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
    { id: 'Borrador', title: 'Borrador / Cotización', color: 'bg-gray-100', borderColor: 'border-gray-300', icon: <FileText size={18} className="text-gray-500" /> },
    { id: 'Listo_Cumplimiento', title: 'Listo para Despacho', color: 'bg-purple-50', borderColor: 'border-purple-300', icon: <div className="w-4 h-4 rounded-full bg-purple-500"></div> },
    { id: 'Entregado', title: 'Completado', color: 'bg-green-50', borderColor: 'border-green-300', icon: <CheckCircle2 size={18} className="text-green-500" /> },
];

const OrdersPipeline: React.FC = () => {
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
    
    // Drag & Drop / Transition state
    const [draggedOrderId, setDraggedOrderId] = useState<number | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [tillStatus, setTillStatus] = useState<'open' | 'closed' | 'none'>('none');

    useEffect(() => {
        fetchOrders();
        fetchTillStatus();
    }, []);

    const fetchTillStatus = async () => {
        try {
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
            const { data, error } = await supabase.from('daily_tills').select('status').eq('date', today).single();
            if (error) {
                if (error.code === 'PGRST116') {
                    setTillStatus('none');
                } else {
                    console.error('Error fetching till:', error);
                }
            } else {
                setTillStatus(data.status as 'open' | 'closed');
            }
        } catch (err) {
            console.error('Error fetching till:', err);
        }
    };

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: profile } = await supabase.from('profiles').select('role_id').eq('id', session.user.id).single();
            const isAdmin = true; // All users have admin access for orders

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
                .neq('status', 'Cancelado')
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
                    status: o.status as Order['status'],
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

    const isDraft = selectedOrder?.status === 'Borrador';
    const canConvert = isDraft; // Drafts and Quotes can be modified with shipment/payments

    // Convert Draft to "Quote Sent"
    const handleSendQuote = async () => {
        if (!selectedOrder) return;
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: 'Borrador' })
                .eq('id', selectedOrder.id);
            if (error) throw error;
            alert("Cotización marcada como enviada.");
            setIsModalOpen(false);
            fetchOrders();
        } catch (error: any) {
            console.error("Error updating quote:", error);
            alert("Error al actualizar estado: " + error.message);
        }
    };

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
                    status: 'Listo_Cumplimiento',
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

    // Generic status transition handler (uses RPC)
    const handleStatusTransition = async (orderId: number, newStatus: Order['status'], extraFields?: { tracking_number?: string; carrier_name?: string }) => {
        setIsProcessing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;

            const { data, error } = await supabase.rpc('update_order_status', {
                p_order_id: orderId,
                p_new_status: newStatus,
                p_user_id: userId || null,
                p_tracking_number: extraFields?.tracking_number || null,
                p_carrier_name: extraFields?.carrier_name || null
            });

            if (error) throw error;

            alert(`Orden actualizada a ${newStatus.replace('_', ' ')}`);
            if (isModalOpen) setIsModalOpen(false);
            fetchOrders();
        } catch (err: any) {
            console.error("Error updating status:", err);
            alert(`Error: ${err.message || 'No se pudo actualizar el estado.'}`);
        } finally {
            setIsProcessing(false);
            setDraggedOrderId(null);
        }
    };

    // Drag & Drop Handlers
    const handleDragStart = (e: React.DragEvent, orderId: number) => {
        setDraggedOrderId(orderId);
        e.dataTransfer.effectAllowed = 'move';
        // Some browsers require setting data
        e.dataTransfer.setData('text/plain', orderId.toString());
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetColumnId: Order['status']) => {
        e.preventDefault();
        if (!draggedOrderId) return;

        const order = orders.find(o => o.id === draggedOrderId);
        if (!order) return;

        if (order.status === targetColumnId) {
            setDraggedOrderId(null);
            return;
        }

        if (!isTransitionAllowed(order.status, targetColumnId)) {
            alert(`No puedes mover una orden de ${order.status.replace('_', ' ')} a ${targetColumnId.replace('_', ' ')} directamente.`);
            setDraggedOrderId(null);
            return;
        }

        if (targetColumnId === 'Entregado' && tillStatus !== 'open') {
            alert('No se puede completar la orden. La caja de hoy está cerrada o no ha sido abierta.');
            setDraggedOrderId(null);
            return;
        }

        let extraFields = undefined;

        await handleStatusTransition(draggedOrderId, targetColumnId, extraFields);
    };

    if (loading) {
        return <div className="p-6 text-slate-500">Cargando pipeline...</div>;
    }

    return (
        <div className="flex flex-col h-full p-6 bg-slate-50 dark:bg-[#0d1117] overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 z-10">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Pipeline de Órdenes</h1>
                        {tillStatus === 'open' ? (
                            <button onClick={() => navigate('/')} className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold shadow-sm hover:bg-green-200">
                                <Unlock size={14} /> Caja Abierta (Arqueo)
                            </button>
                        ) : (
                            <button onClick={() => navigate('/pos')} className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold shadow-sm hover:bg-red-200">
                                <Lock size={14} /> Abrir Caja en POS
                            </button>
                        )}
                    </div>
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
                        <div 
                            key={col.id} 
                            className="w-80 flex flex-col bg-slate-100/50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm h-full"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, col.id as Order['status'])}
                        >
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
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, order.id)}
                                        className={`bg-white dark:bg-[#0c1117] p-4 rounded-lg shadow-sm border ${order.status === 'Borrador' ? 'border-slate-200 hover:border-blue-400' : 'border-slate-200/50 hover:border-slate-400 opacity-90'} dark:border-slate-800 cursor-grab active:cursor-grabbing transition-colors group ${draggedOrderId === order.id ? 'opacity-50' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-mono text-slate-500 group-hover:text-blue-500 transition-colors">#{order.id}</span>
                                            <span className="text-xs font-medium text-slate-400">{order.date}</span>
                                        </div>
                                        <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{order.customerName}</h3>
                                        <div className="flex items-center gap-1 text-slate-500 mb-3">
                                            <MessageCircle size={12} />
                                            <span className="text-xs font-mono">{order.phone || 'Sin Teléfono'}</span>
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
                                            <button onClick={() => { setIsModalOpen(false); navigate('/pos?draft_id=' + selectedOrder.id); }} className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline">
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
                                        {selectedOrder?.status === 'Borrador' && (
                                            <>
                                                <button
                                                    onClick={handleSendQuote}
                                                    disabled={selectedOrder.items.length === 0 || isProcessing}
                                                    className="w-full bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white py-2 rounded-lg font-bold shadow-md transition-colors text-sm"
                                                >
                                                    Marcar como Cotización Enviada
                                                </button>
                                            </>
                                        )}
                                        {canConvert && (
                                            <button
                                                onClick={handleProcessSale}
                                                disabled={selectedOrder.items.length === 0 || !bankRef || !receiptPreview || isProcessing}
                                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-3 rounded-lg font-bold shadow-md flex items-center justify-center gap-2 transition-colors mt-2"
                                            >
                                                <span>🔒 Cliente Aprobó (A Despacho)</span>
                                            </button>
                                        )}
                                        {selectedOrder?.status === 'Listo_Cumplimiento' && (
                                            <button
                                                onClick={() => {
                                                    if (tillStatus !== 'open') {
                                                        alert('No se puede completar la orden. La caja del día está cerrada.');
                                                        return;
                                                    }
                                                    handleStatusTransition(selectedOrder.id, 'Entregado');
                                                }}
                                                disabled={isProcessing}
                                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-2 rounded-lg font-bold shadow-md flex items-center justify-center gap-2 transition-colors text-sm mt-2"
                                            >
                                                <Truck size={16} />
                                                <span>{isProcessing ? 'Enviando...' : 'Despachar y Completar'}</span>
                                            </button>
                                        )}
                                        {!canConvert && selectedOrder?.status !== 'Listo_Cumplimiento' && selectedOrder?.status !== 'Borrador' && (
                                            <>
                                                <div className="mb-2">
                                                    <ThermalPrinterSelector />
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            await reprintOrderReceipt(selectedOrder.id);
                                                            alert(`Recibo de la orden #${selectedOrder.id} enviado a la impresora (2 copias).`);
                                                        } catch (err: any) {
                                                            alert(`Error reimprimiendo recibo: ${err?.message || err}`);
                                                        }
                                                    }}
                                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-bold shadow-md flex items-center justify-center gap-2 transition-colors text-sm mt-2"
                                                >
                                                    <Printer size={16} />
                                                    <span>Reimprimir Recibo Térmico (2 copias)</span>
                                                </button>
                                                <button
                                                    onClick={() => setIsModalOpen(false)}
                                                    className="w-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-lg font-bold mt-2"
                                                >
                                                    Cerrar Vista
                                                </button>
                                            </>
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

const OrdersTabs: React.FC = () => {
    const location = useLocation();
    const isEnvios = location.pathname.includes('/orders/envios');

    return (
        <div className="print:hidden flex gap-1 px-6 pt-4 bg-slate-50 dark:bg-[#0d1117] border-b border-slate-200 dark:border-slate-800">
            <Link
                to="/orders"
                className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors ${!isEnvios ? 'border-primary text-slate-900 dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
                Pipeline
            </Link>
            <Link
                to="/orders/envios"
                className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors flex items-center gap-1.5 ${isEnvios ? 'border-primary text-slate-900 dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
                <Truck size={14} />
                Envíos
            </Link>
        </div>
    );
};

const Orders: React.FC = () => {
    const location = useLocation();
    const isEnvios = location.pathname.includes('/orders/envios');

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] print:h-auto">
            <OrdersTabs />
            <div className={`flex-1 print:overflow-visible ${isEnvios ? 'overflow-y-auto' : 'overflow-hidden'}`}>
                <Routes>
                    <Route index element={<OrdersPipeline />} />
                    <Route path="envios" element={<OrderShipments />} />
                </Routes>
            </div>
        </div>
    );
};

export default Orders;
