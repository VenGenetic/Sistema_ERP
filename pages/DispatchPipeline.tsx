import React, { useState, useEffect } from 'react';
import { ShieldCheck, Eye, Search, Printer, CheckCircle, Clock, PackageSearch, Truck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useCartStore } from '../store/cartStore';

interface VerificationOrder {
    id: number;
    customerName: string;
    phone: string;
    total: number;
    shippingCost: number;
    bankRef: string;
    paymentReceiptUrl?: string;
    date: string;
    closerName?: string;
    status: string;
}

interface SourcingItem {
    order_item_id: number;
    order_id: number;
    product_name: string;
    sku: string;
    quantity: number;
    unit_price: number;
    demand_count: number;
    status: string;
    date: string;
}

const DispatchPipeline: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'audit' | 'sourcing' | 'fulfillment'>('audit');

    // Audit State
    const [auditOrders, setAuditOrders] = useState<VerificationOrder[]>([]);
    const [selectedAuditOrder, setSelectedAuditOrder] = useState<VerificationOrder | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);

    // Sourcing State
    const [sourcingItems, setSourcingItems] = useState<SourcingItem[]>([]);

    // Fulfillment State (Orders ready for pickup/shipping)
    const [fulfillmentOrders, setFulfillmentOrders] = useState<VerificationOrder[]>([]);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'audit') {
                const { data, error } = await supabase
                    .from('orders')
                    .select(`
                        id, status, total_amount, shipping_cost, bank_reference_code, payment_receipt_url, created_at,
                        closer_id,
                        profiles!orders_closer_id_fkey (full_name),
                        customers (name, phone)
                    `)
                    .eq('status', 'pending_verification')
                    .order('created_at', { ascending: true });

                if (error) throw error;

                const mapped: VerificationOrder[] = data.map((o: any) => ({
                    id: o.id,
                    customerName: o.customers?.name || 'Desconocido',
                    phone: o.customers?.phone || '',
                    total: o.total_amount,
                    shippingCost: o.shipping_cost || 0,
                    bankRef: o.bank_reference_code || '',
                    paymentReceiptUrl: o.payment_receipt_url,
                    date: new Date(o.created_at).toLocaleString(),
                    closerName: o.profiles?.full_name || 'Desconocido',
                    status: o.status
                }));
                setAuditOrders(mapped);
                if (mapped.length > 0 && !selectedAuditOrder) setSelectedAuditOrder(mapped[0]);
            }
            else if (activeTab === 'sourcing') {
                // Fetch line items that need sourcing (e.g., drafts ordered by clients)
                // For simplicity, we fetch order_items where product status is 'draft' OR item status is 'sourcing'
                const { data, error } = await supabase
                    .from('order_items')
                    .select(`
                        id, quantity, unit_price, status, created_at, order_id,
                        products (name, sku, demand_count, status)
                    `)
                    .or('status.eq.sourcing,products.status.eq.draft')
                    .order('created_at', { ascending: false });

                if (error) throw error;

                const mapped: SourcingItem[] = data.map((item: any) => ({
                    order_item_id: item.id,
                    order_id: item.order_id,
                    product_name: item.products?.name || 'Desconocido',
                    sku: item.products?.sku || '',
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    demand_count: item.products?.demand_count || 0,
                    status: item.products?.status === 'draft' ? 'draft_product' : item.status,
                    date: new Date(item.created_at).toLocaleDateString()
                })).sort((a, b) => b.demand_count - a.demand_count); // Sort by highest demand

                setSourcingItems(mapped);
            }
            else if (activeTab === 'fulfillment') {
                // Orders that are 'processing_fulfillment'
                const { data, error } = await supabase
                    .from('orders')
                    .select(`
                        id, status, total_amount, shipping_cost, bank_reference_code, created_at,
                        customers (name, phone)
                    `)
                    .eq('status', 'processing_fulfillment')
                    .order('created_at', { ascending: true });

                if (error) throw error;

                const mapped: VerificationOrder[] = data.map((o: any) => ({
                    id: o.id,
                    customerName: o.customers?.name || 'Desconocido',
                    phone: o.customers?.phone || '',
                    total: o.total_amount,
                    shippingCost: o.shipping_cost || 0,
                    bankRef: o.bank_reference_code || '',
                    date: new Date(o.created_at).toLocaleString(),
                    status: o.status
                }));
                setFulfillmentOrders(mapped);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyPayment = async () => {
        if (!selectedAuditOrder) return;
        setIsVerifying(true);

        try {
            // Update order status, triggering M4 (via future logic or manually handling it)
            const { error } = await supabase
                .from('orders')
                .update({ status: 'processing_fulfillment' })
                .eq('id', selectedAuditOrder.id);

            if (error) throw error;

            console.log("Printing Ticket for Warehouse Fulfillment...");
            alert(`✅ Pago Verificado: ${selectedAuditOrder.bankRef}\nEstado de Orden actualizado a En Preparación.\nPuntos M4 Asegurados para Finanzas.`);

            setAuditOrders(prev => prev.filter(o => o.id !== selectedAuditOrder.id));
            setSelectedAuditOrder(null);
        } catch (err) {
            console.error(err);
            alert("Error al verificar la orden.");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleRejectPayment = async () => {
        if (!selectedAuditOrder) return;
        if (!window.confirm("¿Seguro que desea rechazar \ este pago? La orden volverá a borrador.")) return;

        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: 'draft', bank_reference_code: null, payment_receipt_url: null })
                .eq('id', selectedAuditOrder.id);

            if (error) throw error;
            alert("Pago rechazado. Orden devuelta a Borrador.");
            setAuditOrders(prev => prev.filter(o => o.id !== selectedAuditOrder.id));
            setSelectedAuditOrder(null);
        } catch (e) {
            console.error(e);
        }
    };

    const handleMarkShipped = async (orderId: number) => {
        try {
            const { error } = await supabase.from('orders').update({ status: 'shipped' }).eq('id', orderId);
            if (error) throw error;
            alert("Orden marcada como enviada/entregada!");
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] p-6 bg-slate-50 dark:bg-[#0d1117] overflow-hidden gap-4">
            {/* Header & Tabs */}
            <div className="flex justify-between items-center z-10">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        Operaciones (Back-Office)
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Sourcing, Auditoría de Pagos y Logística</p>
                </div>

                <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('audit')}
                        className={`px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === 'audit' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                    >
                        <ShieldCheck size={16} /> Verificación Pagos
                    </button>
                    <button
                        onClick={() => setActiveTab('sourcing')}
                        className={`px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === 'sourcing' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                    >
                        <PackageSearch size={16} /> Sourcing (M2)
                    </button>
                    <button
                        onClick={() => setActiveTab('fulfillment')}
                        className={`px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === 'fulfillment' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                    >
                        <Truck size={16} /> Despacho
                    </button>
                </div>
            </div>

            {/* TAB CONTENT: AUDIT */}
            {activeTab === 'audit' && (
                <div className="flex flex-1 gap-6 overflow-hidden">
                    {/* Left: Pending Verifications List */}
                    <div className="w-1/3 flex flex-col bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c1117]">
                            <h2 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><Clock size={16} /> Pendientes de Validar</h2>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {loading ? <p className="p-4 text-center text-slate-400">Cargando...</p> :
                                auditOrders.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center px-4">
                                        <CheckCircle size={32} className="mb-2 text-green-500/50" />
                                        <p className="font-medium">Pipeline Limpio</p>
                                        <p className="text-xs mt-1">Todas las órdenes han sido verificadas.</p>
                                    </div>
                                ) : (
                                    auditOrders.map(order => (
                                        <div
                                            key={order.id}
                                            onClick={() => setSelectedAuditOrder(order)}
                                            className={`p-4 rounded-lg border cursor-pointer transition-colors ${selectedAuditOrder?.id === order.id ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">ORD-{order.id}</span>
                                                <span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={12} /> {order.date.split(',')[0]}</span>
                                            </div>
                                            <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">{order.customerName}</h3>

                                            <div className="mt-2 flex justify-between items-end border-t border-slate-100 dark:border-slate-800 pt-2">
                                                <div>
                                                    <p className="text-xs text-slate-500">Ref: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{order.bankRef}</span></p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-slate-500">Total a validar</p>
                                                    <p className="font-bold text-slate-900 dark:text-white text-sm">${(order.total + order.shippingCost).toFixed(2)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                        </div>
                    </div>

                    {/* Right: Validation Detail Viewer */}
                    <div className="flex-1 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col overflow-hidden">
                        {selectedAuditOrder ? (
                            <>
                                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-[#0c1117]">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Auditoría: ORD-{selectedAuditOrder.id}</h2>
                                        <p className="text-sm text-slate-500">Vendedor: <span className="font-medium text-slate-700 dark:text-slate-300">{selectedAuditOrder.closerName}</span></p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-slate-500 uppercase tracking-wide text-xs">Monto Esperado en Banco</p>
                                        <p className="text-2xl font-black text-green-600 dark:text-green-500">${(selectedAuditOrder.total + selectedAuditOrder.shippingCost).toFixed(2)}</p>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 flex gap-6">
                                    <div className="w-1/3 space-y-6">
                                        <div className="bg-slate-50 dark:bg-[#0c1117] p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Datos del Cliente</h3>
                                            <p className="font-bold text-slate-900 dark:text-white">{selectedAuditOrder.customerName}</p>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 font-mono mt-1">{selectedAuditOrder.phone}</p>
                                        </div>

                                        <div className="bg-slate-50 dark:bg-[#0c1117] p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Información Bancaria</h3>
                                            <div className="space-y-2">
                                                <div>
                                                    <p className="text-xs text-slate-500">Referencia / Vaucher</p>
                                                    <p className="font-mono font-bold text-lg text-slate-800 dark:text-slate-200">{selectedAuditOrder.bankRef}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 flex flex-col">
                                        <div className="flex-1 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800 relative group">
                                            {selectedAuditOrder.paymentReceiptUrl ? (
                                                <img
                                                    src={selectedAuditOrder.paymentReceiptUrl}
                                                    alt="Comprobante"
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <div className="text-slate-600 flex flex-col items-center">
                                                    <Eye size={48} className="mb-2 opacity-50" />
                                                    <p>Sin imagen adjunta</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c1117] flex justify-end gap-3">
                                    <button
                                        onClick={handleRejectPayment}
                                        className="px-6 py-2.5 rounded-lg border border-red-200 text-red-600 dark:border-red-900/50 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 font-medium transition-colors"
                                    >
                                        Rechazar (Fondos no Vistos)
                                    </button>
                                    <button
                                        onClick={handleVerifyPayment}
                                        disabled={isVerifying}
                                        className="px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold shadow-md flex items-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        {isVerifying ? (
                                            <span className="flex items-center gap-2">Verificando...</span>
                                        ) : (
                                            <>
                                                <ShieldCheck size={18} />
                                                <span>Aprobar y Enviar a Bodega (Desbloquea M4)</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <ShieldCheck size={64} className="mb-4 text-slate-300 dark:text-slate-700" />
                                <h2 className="text-xl font-bold text-slate-500 dark:text-slate-400">Seleccione una Auditoría</h2>
                                <p className="mt-2 text-sm text-center max-w-sm">
                                    Verifique el comprobante contra la cuenta bancaria.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: SOURCING */}
            {activeTab === 'sourcing' && (
                <div className="flex-1 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-purple-50 dark:bg-purple-900/10">
                        <h2 className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-2"><PackageSearch size={18} /> Tablero de Sourcing (Drop-Shipping / Búsqueda)</h2>
                        <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">Productos en estado "Draft" o líneas en estado "Sourcing". Priorizados por Demanda.</p>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto">
                        {loading ? <p className="text-slate-500">Cargando...</p> :
                            sourcingItems.length === 0 ? <p className="text-slate-500">No hay items pendientes de sourcing.</p> :
                                (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {sourcingItems.map(item => (
                                            <div key={item.order_item_id} className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50 dark:bg-[#0c1117] flex flex-col">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded">Demanda: {item.demand_count}</span>
                                                    <span className="text-xs text-slate-500 font-mono">ORD-{item.order_id}</span>
                                                </div>
                                                <h3 className="font-bold text-slate-900 dark:text-white">{item.product_name}</h3>
                                                <p className="text-xs text-slate-500 font-mono my-1">{item.sku}</p>
                                                <div className="mt-auto pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-sm">
                                                    <span>Cant: <strong className="text-slate-900 dark:text-white">{item.quantity}</strong></span>
                                                    <span>Precio Cotiz: <strong className="text-slate-900 dark:text-white">${item.unit_price.toFixed(2)}</strong></span>
                                                </div>
                                                <button className="w-full mt-3 bg-white border border-slate-300 hover:border-purple-400 text-slate-700 hover:text-purple-700 font-medium py-2 rounded transition-colors text-sm">
                                                    Gestionar Compra / PO
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )
                        }
                    </div>
                </div>
            )}

            {/* TAB CONTENT: FULFILLMENT */}
            {activeTab === 'fulfillment' && (
                <div className="flex-1 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-emerald-50 dark:bg-emerald-900/10">
                        <h2 className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-2"><Truck size={18} /> Bodega y Despacho</h2>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">Órdenes cuyo pago ha sido verificado y están listas para preparar.</p>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto">
                        {loading ? <p className="text-slate-500">Cargando...</p> :
                            fulfillmentOrders.length === 0 ? <p className="text-slate-500 text-center py-10">No hay órdenes en preparación.</p> :
                                (
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500">
                                                <th className="pb-2 font-medium">Orden</th>
                                                <th className="pb-2 font-medium">Cliente</th>
                                                <th className="pb-2 font-medium">Fecha Aprobación</th>
                                                <th className="pb-2 font-medium text-right">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fulfillmentOrders.map(order => (
                                                <tr key={order.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-[#0c1117] transition-colors">
                                                    <td className="py-3 font-mono font-bold text-slate-700 dark:text-slate-300">ORD-{order.id}</td>
                                                    <td className="py-3 font-medium text-slate-900 dark:text-white">{order.customerName}</td>
                                                    <td className="py-3 text-sm text-slate-500">{order.date}</td>
                                                    <td className="py-3 text-right">
                                                        <button
                                                            onClick={() => handleMarkShipped(order.id)}
                                                            className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-3 py-1.5 rounded text-xs font-bold transition-colors"
                                                        >
                                                            Marcar Enviado/Entregado
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )
                        }
                    </div>
                </div>
            )}
        </div>
    );
};

export default DispatchPipeline;
