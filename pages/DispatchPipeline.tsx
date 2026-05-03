import React, { useState, useEffect } from 'react';
import { ShieldCheck, Eye, CheckCircle, Clock, PackageSearch, Truck, MessageCircle, Send, Phone } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import WhatsAppButton from '../components/WhatsAppButton';
import { STATUS_LABELS, STATUS_COLORS } from '../utils/orderStateMachine';
import type { OrderStatus } from '../utils/orderStateMachine';

// ============================================================
// Types
// ============================================================

interface PipelineOrder {
    id: number;
    customerName: string;
    phone: string;
    total: number;
    shippingCost: number;
    bankRef: string;
    paymentReceiptUrl?: string;
    date: string;
    closerName?: string;
    status: OrderStatus;
    trackingNumber?: string;
    carrierName?: string;
    shippingAddress?: string;
    items: Array<{
        name: string;
        sku: string;
        quantity: number;
        unitPrice: number;
    }>;
}

// ============================================================
// Tab definitions — which role sees which tabs
// ============================================================

type TabId = 'sourcing' | 'confirmed' | 'audit' | 'fulfillment' | 'shipping';

interface TabConfig {
    id: TabId;
    title: string;
    icon: React.ReactNode;
    accentColor: string;
    statusFilter: OrderStatus;
    visibleToRoles: number[]; // role_ids that can see this tab
}

const TAB_CONFIG: TabConfig[] = [
    {
        id: 'sourcing',
        title: 'Sourcing (Proveedores)',
        icon: <PackageSearch size={16} />,
        accentColor: 'orange',
        statusFilter: 'Sourcing_Pendiente',
        visibleToRoles: [1, 3], // Admin, Sourcing Manager
    },
    {
        id: 'confirmed',
        title: 'Confirmados (WhatsApp)',
        icon: <MessageCircle size={16} />,
        accentColor: 'green',
        statusFilter: 'Confirmado_Proveedor',
        visibleToRoles: [1, 2, 5], // Admin, Closer, Sales Monitor
    },
    {
        id: 'audit',
        title: 'Verificación Pagos',
        icon: <ShieldCheck size={16} />,
        accentColor: 'yellow',
        statusFilter: 'Pendiente_Pago',
        visibleToRoles: [1], // Admin only (Finance)
    },
    {
        id: 'fulfillment',
        title: 'Despacho (Bodega)',
        icon: <Truck size={16} />,
        accentColor: 'purple',
        statusFilter: 'Listo_Cumplimiento',
        visibleToRoles: [1, 4], // Admin, Warehouse
    },
    {
        id: 'shipping',
        title: 'En Tránsito',
        icon: <Send size={16} />,
        accentColor: 'blue',
        statusFilter: 'En_Transito',
        visibleToRoles: [1, 2, 5], // Admin, Closer, Sales Monitor
    },
];

// ============================================================
// Component
// ============================================================

const DispatchPipeline: React.FC = () => {
    const { userProfile, isAdmin } = useAuth();
    const roleId = userProfile?.role_id ?? 0;

    // Filter tabs visible to this role
    const visibleTabs = TAB_CONFIG.filter(tab => tab.visibleToRoles.includes(roleId));
    const [activeTab, setActiveTab] = useState<TabId>(visibleTabs[0]?.id || 'audit');

    // State
    const [orders, setOrders] = useState<PipelineOrder[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<PipelineOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // Fulfillment inputs
    const [trackingNumber, setTrackingNumber] = useState('');
    const [carrierName, setCarrierName] = useState('Servientrega');

    const activeTabConfig = TAB_CONFIG.find(t => t.id === activeTab);

    useEffect(() => {
        fetchOrders();
    }, [activeTab]);

    const fetchOrders = async () => {
        if (!activeTabConfig) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id, status, total_amount, shipping_cost, shipping_address, bank_reference_code, 
                    payment_receipt_url, created_at, tracking_number, carrier_name,
                    closer_id,
                    profiles!orders_closer_id_fkey (full_name),
                    customers (name, phone),
                    order_items (
                        id, quantity, unit_price,
                        products (name, sku)
                    )
                `)
                .eq('status', activeTabConfig.statusFilter)
                .order('created_at', { ascending: true });

            if (error) throw error;

            const mapped: PipelineOrder[] = (data || []).map((o: any) => ({
                id: o.id,
                customerName: o.customers?.name || 'Desconocido',
                phone: o.customers?.phone || '',
                total: o.total_amount || 0,
                shippingCost: o.shipping_cost || 0,
                bankRef: o.bank_reference_code || '',
                paymentReceiptUrl: o.payment_receipt_url,
                date: new Date(o.created_at).toLocaleString(),
                closerName: o.profiles?.full_name || 'Sin asignar',
                status: o.status,
                trackingNumber: o.tracking_number,
                carrierName: o.carrier_name,
                shippingAddress: o.shipping_address,
                items: (o.order_items || []).map((item: any) => ({
                    name: item.products?.name || 'Producto',
                    sku: item.products?.sku || 'N/A',
                    quantity: item.quantity,
                    unitPrice: item.unit_price,
                })),
            }));
            setOrders(mapped);
            if (mapped.length > 0 && !selectedOrder) setSelectedOrder(mapped[0]);
            else if (mapped.length === 0) setSelectedOrder(null);
        } catch (error) {
            console.error("Error fetching pipeline data:", error);
        } finally {
            setLoading(false);
        }
    };

    // ============================================================
    // Status transition handler (uses the guarded RPC)
    // ============================================================
    const handleStatusTransition = async (orderId: number, newStatus: OrderStatus, extraFields?: { tracking_number?: string; carrier_name?: string }) => {
        setIsProcessing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;

            const { data, error } = await supabase.rpc('update_order_status', {
                p_order_id: orderId,
                p_new_status: newStatus,
                p_user_id: userId || null,
                p_tracking_number: extraFields?.tracking_number || null,
                p_carrier_name: extraFields?.carrier_name || null,
            });

            if (error) throw error;

            const result = data as any;
            if (result?.success) {
                alert(`✅ Orden #${orderId}: ${result.previous_status} → ${result.new_status}`);
                setOrders(prev => prev.filter(o => o.id !== orderId));
                setSelectedOrder(null);
                setTrackingNumber('');
            }
        } catch (err: any) {
            console.error(err);
            alert(`❌ Error: ${err.message || 'No se pudo actualizar el estado.'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // ============================================================
    // Render: Empty State
    // ============================================================
    const renderEmptyState = () => (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center px-4">
            <CheckCircle size={32} className="mb-2 text-green-500/50" />
            <p className="font-medium">Pipeline Limpio</p>
            <p className="text-xs mt-1">No hay órdenes en estado "{activeTabConfig ? STATUS_LABELS[activeTabConfig.statusFilter] : ''}".</p>
        </div>
    );

    // ============================================================
    // Render: Order Card (left panel)
    // ============================================================
    const renderOrderCard = (order: PipelineOrder) => (
        <div
            key={order.id}
            onClick={() => { setSelectedOrder(order); setTrackingNumber(order.trackingNumber || ''); setCarrierName(order.carrierName || 'Servientrega'); }}
            className={`p-4 rounded-lg border cursor-pointer transition-colors ${selectedOrder?.id === order.id
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}
        >
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">ORD-{order.id}</span>
                <span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={12} /> {order.date.split(',')[0]}</span>
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">{order.customerName}</h3>
            {order.phone && (
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                    <Phone size={10} /> <span className="font-mono">{order.phone}</span>
                </div>
            )}
            <div className="mt-2 flex justify-between items-end border-t border-slate-100 dark:border-slate-800 pt-2">
                <div>
                    <p className="text-xs text-slate-500">{order.items.length} item(s)</p>
                </div>
                <div className="text-right">
                    <p className="font-bold text-slate-900 dark:text-white text-sm">${(order.total).toFixed(2)}</p>
                </div>
            </div>
        </div>
    );

    // ============================================================
    // Render: Detail Panel (right side) — varies by tab
    // ============================================================
    const renderDetailPanel = () => {
        if (!selectedOrder) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <ShieldCheck size={64} className="mb-4 text-slate-300 dark:text-slate-700" />
                    <h2 className="text-xl font-bold text-slate-500 dark:text-slate-400">Seleccione una Orden</h2>
                    <p className="mt-2 text-sm text-center max-w-sm">
                        Haga clic en una orden de la lista para ver los detalles y realizar acciones.
                    </p>
                </div>
            );
        }

        return (
            <>
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-[#0c1117]">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">ORD-{selectedOrder.id}</h2>
                        <p className="text-sm text-slate-500">Vendedor: <span className="font-medium text-slate-700 dark:text-slate-300">{selectedOrder.closerName}</span></p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-slate-500 uppercase tracking-wide text-xs">Total</p>
                        <p className="text-2xl font-black text-green-600 dark:text-green-500">${selectedOrder.total.toFixed(2)}</p>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 flex gap-6">
                    {/* Left: Customer + Items */}
                    <div className="flex-1 space-y-4">
                        {/* Customer Info */}
                        <div className="bg-slate-50 dark:bg-[#0c1117] p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Cliente</h3>
                            <p className="font-bold text-slate-900 dark:text-white">{selectedOrder.customerName}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 font-mono mt-1">{selectedOrder.phone || 'Sin teléfono'}</p>
                            {selectedOrder.shippingAddress && (
                                <p className="text-sm text-slate-500 mt-2">📍 {selectedOrder.shippingAddress}</p>
                            )}
                        </div>

                        {/* Items table */}
                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                            <div className="bg-slate-50 dark:bg-[#0c1117] px-4 py-2 border-b border-slate-200 dark:border-slate-800">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Productos ({selectedOrder.items.length})</h3>
                            </div>
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-[#0c1117]">
                                    <tr className="text-xs text-slate-500">
                                        <th className="px-4 py-2 text-left">Producto</th>
                                        <th className="px-4 py-2 text-center">Cant</th>
                                        <th className="px-4 py-2 text-right">Precio</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {selectedOrder.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="px-4 py-2">
                                                <span className="font-medium text-slate-900 dark:text-white">{item.name}</span>
                                                <div className="text-xs text-slate-500 font-mono">{item.sku}</div>
                                            </td>
                                            <td className="px-4 py-2 text-center font-bold">{item.quantity}</td>
                                            <td className="px-4 py-2 text-right font-bold">${item.unitPrice.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Payment receipt (audit tab) */}
                        {activeTab === 'audit' && (
                            <div className="bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800 relative min-h-[200px]">
                                {selectedOrder.paymentReceiptUrl ? (
                                    <img src={selectedOrder.paymentReceiptUrl} alt="Comprobante" className="w-full h-full object-contain max-h-80" />
                                ) : (
                                    <div className="text-slate-600 flex flex-col items-center py-10">
                                        <Eye size={48} className="mb-2 opacity-50" />
                                        <p>Sin imagen de comprobante</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Bank info (for audit) */}
                    {activeTab === 'audit' && (
                        <div className="w-64 space-y-4">
                            <div className="bg-slate-50 dark:bg-[#0c1117] p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Referencia Bancaria</h3>
                                <p className="font-mono font-bold text-lg text-slate-800 dark:text-slate-200">{selectedOrder.bankRef || 'Sin referencia'}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Bar */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c1117] flex justify-end gap-3 flex-wrap">
                    {/* ── SOURCING TAB: Confirm Provider ── */}
                    {activeTab === 'sourcing' && (
                        <>
                            <button
                                onClick={() => handleStatusTransition(selectedOrder.id, 'Cancelado')}
                                disabled={isProcessing}
                                className="px-6 py-2.5 rounded-lg border border-red-200 text-red-600 dark:border-red-900/50 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 font-medium transition-colors"
                            >
                                No Disponible (Cancelar)
                            </button>
                            <button
                                onClick={() => handleStatusTransition(selectedOrder.id, 'Confirmado_Proveedor')}
                                disabled={isProcessing}
                                className="px-6 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-md flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                                <PackageSearch size={18} />
                                <span>{isProcessing ? 'Procesando...' : 'Confirmar Proveedor'}</span>
                            </button>
                        </>
                    )}

                    {/* ── CONFIRMED TAB: WhatsApp + advance to Pendiente_Pago ── */}
                    {activeTab === 'confirmed' && (
                        <>
                            <WhatsAppButton
                                customerName={selectedOrder.customerName}
                                customerPhone={selectedOrder.phone}
                                orderId={selectedOrder.id}
                                items={selectedOrder.items}
                                totalAmount={selectedOrder.total}
                                shippingCost={selectedOrder.shippingCost}
                            />
                            <button
                                onClick={() => handleStatusTransition(selectedOrder.id, 'Pendiente_Pago')}
                                disabled={isProcessing}
                                className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                                <span>{isProcessing ? 'Procesando...' : 'Cliente Envió Comprobante →'}</span>
                            </button>
                        </>
                    )}

                    {/* ── AUDIT TAB: Verify or Reject payment ── */}
                    {activeTab === 'audit' && (
                        <>
                            <button
                                onClick={() => handleStatusTransition(selectedOrder.id, 'Borrador')}
                                disabled={isProcessing}
                                className="px-6 py-2.5 rounded-lg border border-red-200 text-red-600 dark:border-red-900/50 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 font-medium transition-colors"
                            >
                                Rechazar (Fondos no Vistos)
                            </button>
                            <button
                                onClick={() => handleStatusTransition(selectedOrder.id, 'Listo_Cumplimiento')}
                                disabled={isProcessing}
                                className="px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold shadow-md flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                                <ShieldCheck size={18} />
                                <span>{isProcessing ? 'Verificando...' : 'Aprobar → Enviar a Bodega'}</span>
                            </button>
                        </>
                    )}

                    {/* ── FULFILLMENT TAB: Enter tracking + ship ── */}
                    {activeTab === 'fulfillment' && (
                        <div className="flex items-center gap-3 w-full flex-wrap">
                            <input
                                type="text"
                                placeholder="Nro. de Rastreo / Guía"
                                value={trackingNumber}
                                onChange={e => setTrackingNumber(e.target.value)}
                                className="flex-1 min-w-[200px] border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono bg-transparent dark:text-white"
                            />
                            <select
                                value={carrierName}
                                onChange={e => setCarrierName(e.target.value)}
                                className="border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm bg-transparent dark:text-white"
                            >
                                <option value="Servientrega">Servientrega</option>
                                <option value="Tramaco">Tramaco</option>
                                <option value="Urbano">Urbano</option>
                                <option value="DHL">DHL</option>
                                <option value="Otro">Otro</option>
                            </select>
                            <button
                                onClick={() => handleStatusTransition(selectedOrder.id, 'En_Transito', { tracking_number: trackingNumber, carrier_name: carrierName })}
                                disabled={isProcessing || !trackingNumber.trim()}
                                className="px-6 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                                <Truck size={18} />
                                <span>{isProcessing ? 'Enviando...' : 'Marcar como Enviado'}</span>
                            </button>
                        </div>
                    )}

                    {/* ── SHIPPING TAB: Mark delivered ── */}
                    {activeTab === 'shipping' && (
                        <>
                            {selectedOrder.trackingNumber && (
                                <div className="flex items-center gap-2 mr-auto text-sm text-slate-500">
                                    <Truck size={14} />
                                    <span className="font-mono">{selectedOrder.carrierName}: {selectedOrder.trackingNumber}</span>
                                </div>
                            )}
                            <button
                                onClick={() => handleStatusTransition(selectedOrder.id, 'Entregado')}
                                disabled={isProcessing}
                                className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                                <CheckCircle size={18} />
                                <span>{isProcessing ? 'Procesando...' : 'Confirmar Entrega ✓'}</span>
                            </button>
                        </>
                    )}
                </div>
            </>
        );
    };

    // ============================================================
    // Main Render
    // ============================================================
    return (
        <div className="flex flex-col h-[calc(100vh-64px)] p-6 bg-slate-50 dark:bg-[#0d1117] overflow-hidden gap-4">
            {/* Header & Tabs */}
            <div className="flex justify-between items-center z-10 flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        Operaciones (Back-Office)
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Sourcing, Auditoría de Pagos, Despacho y Seguimiento</p>
                </div>

                <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg flex-wrap gap-1">
                    {visibleTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setSelectedOrder(null); }}
                            className={`px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                                ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                        >
                            {tab.icon} {tab.title}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content: List + Detail */}
            <div className="flex flex-1 gap-6 overflow-hidden">
                {/* Left: Order List */}
                <div className="w-1/3 flex flex-col bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c1117]">
                        <h2 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Clock size={16} /> {activeTabConfig?.title || 'Pipeline'}
                            <span className="ml-auto bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold px-2 py-0.5 rounded-full">
                                {orders.length}
                            </span>
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {loading ? (
                            <p className="p-4 text-center text-slate-400">Cargando...</p>
                        ) : orders.length === 0 ? (
                            renderEmptyState()
                        ) : (
                            orders.map(renderOrderCard)
                        )}
                    </div>
                </div>

                {/* Right: Detail Panel */}
                <div className="flex-1 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col overflow-hidden">
                    {renderDetailPanel()}
                </div>
            </div>
        </div>
    );
};

export default DispatchPipeline;
