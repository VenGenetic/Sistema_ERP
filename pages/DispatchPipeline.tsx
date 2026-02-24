import React, { useState, useEffect } from 'react';
import { Package, Truck, Search, CheckCircle, Clock, AlertTriangle, Printer, Layout, ArrowRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import DispatchImpactModal from '../components/pos/DispatchImpactModal';

interface DispatchOrder {
    id: number;
    customer_name: string;
    phone: string;
    total_amount: number;
    status: string;
    created_at: string;
    items: {
        id: string;
        product_name: string;
        warehouse_name: string;
        quantity: number;
        status: string;
    }[];
}

const DispatchPipeline: React.FC = () => {
    const [orders, setOrders] = useState<DispatchOrder[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<DispatchOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // Split fulfillment state
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewData, setPreviewData] = useState<any>(null);

    useEffect(() => {
        fetchPendingDispatch();
    }, []);

    const fetchPendingDispatch = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('orders')
            .select(`
                id, total_amount, status, created_at,
                customer:customers (name, phone),
                items:order_items (
                    id, quantity, status,
                    product:products (name),
                    warehouse:warehouses (name)
                )
            `)
            .in('status', ['processing', 'partially_fulfilled'])
            .order('created_at', { ascending: true });

        if (!error && data) {
            const mapped: DispatchOrder[] = data.map((o: any) => ({
                id: o.id,
                customer_name: o.customer?.name || 'Cliente Desconocido',
                phone: o.customer?.phone || '',
                total_amount: o.total_amount,
                status: o.status,
                created_at: o.created_at,
                items: o.items.map((i: any) => ({
                    id: i.id,
                    product_name: i.product?.name || 'Producto Desconocido',
                    warehouse_name: i.warehouse?.name || 'Sin Bodega',
                    quantity: i.quantity,
                    status: i.status
                }))
            }));
            setOrders(mapped);
        }
        setLoading(false);
    };

    const toggleItemSelection = (itemId: string) => {
        const newSelection = new Set(selectedItemIds);
        if (newSelection.has(itemId)) {
            newSelection.delete(itemId);
        } else {
            newSelection.add(itemId);
        }
        setSelectedItemIds(newSelection);
    };

    const handlePrepareDispatch = () => {
        if (!selectedOrder || selectedItemIds.size === 0) return;

        const itemsToDispatch = selectedOrder.items.filter(i => selectedItemIds.has(i.id));

        setPreviewData({
            customerName: selectedOrder.customer_name,
            items: itemsToDispatch.map(i => ({
                productName: i.product_name,
                quantity: i.quantity,
                warehouseName: i.warehouse_name
            }))
        });

        setIsPreviewOpen(true);
    };

    const handleConfirmDispatch = async () => {
        if (!selectedOrder) return;
        setIsProcessing(true);

        try {
            const { error } = await supabase.rpc('ship_order_items', {
                p_order_id: selectedOrder.id,
                p_item_ids: Array.from(selectedItemIds)
            });

            if (error) {
                alert(`Error al registrar despacho: ${error.message}`);
                throw error;
            }

            alert("Despacho registrado con éxito.");
            setIsPreviewOpen(false);
            setSelectedItemIds(new Set());
            setSelectedOrder(null);
            fetchPendingDispatch();
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] p-6 bg-slate-50 overflow-hidden">
            <header className="mb-6 shrink-0">
                <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                    <Truck className="text-blue-600" />
                    Warehouse Dispatch
                </h1>
                <p className="text-slate-500 text-sm">Gestión de picking, packing y despacho de órdenes.</p>
            </header>

            <div className="flex flex-1 gap-6 overflow-hidden">
                {/* Orders List */}
                <div className="w-1/3 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50/50 border-b border-slate-100 italic text-[10px] uppercase font-black text-slate-400 tracking-widest">
                        Órdenes en Cola
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {loading ? (
                            <div className="p-8 text-center animate-pulse">Cargando...</div>
                        ) : orders.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                <CheckCircle className="mx-auto mb-2 opacity-20" size={48} />
                                <p className="font-bold">Sin despachos pendientes</p>
                            </div>
                        ) : (
                            orders.map(o => (
                                <div
                                    key={o.id}
                                    onClick={() => {
                                        setSelectedOrder(o);
                                        setSelectedItemIds(new Set());
                                    }}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedOrder?.id === o.id ? 'border-blue-500 bg-blue-50/50 shadow-md' : 'border-slate-100 hover:border-slate-300 bg-white'}`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-black text-slate-400">ORDEN #{o.id}</span>
                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${o.status === 'partially_fulfilled' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {o.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-slate-800 text-sm">{o.customer_name}</h3>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-[10px] text-slate-400">{new Date(o.created_at).toLocaleDateString()}</span>
                                        <ArrowRight size={14} className="text-slate-300" />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Dispatch Detail */}
                <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden relative">
                    {selectedOrder ? (
                        <>
                            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Detalle de Picking</div>
                                    <h2 className="text-xl font-bold text-slate-800">{selectedOrder.customer_name}</h2>
                                    <p className="text-xs text-slate-500">{selectedOrder.phone}</p>
                                </div>
                                <div className="text-right">
                                    <button className="flex items-center gap-2 text-blue-600 font-bold text-sm hover:underline">
                                        <Printer size={16} /> Imprimir Packing List
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Layout size={14} /> Ítems en esta orden
                                </h3>

                                <div className="divide-y divide-slate-100 border rounded-xl overflow-hidden">
                                    {selectedOrder.items.map(item => {
                                        const canDispatch = item.status === 'in_stock' || item.status === 'sourced';
                                        const isShipped = item.status === 'shipped';

                                        return (
                                            <div
                                                key={item.id}
                                                className={`p-4 flex items-center justify-between group transition-colors ${canDispatch ? 'hover:bg-blue-50/30' : 'opacity-50 grayscale'}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    {canDispatch && !isShipped && (
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedItemIds.has(item.id)}
                                                            onChange={() => toggleItemSelection(item.id)}
                                                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                    )}
                                                    {isShipped && <CheckCircle size={20} className="text-emerald-500 shrink-0" />}

                                                    <div>
                                                        <p className="text-sm font-bold text-slate-800">{item.product_name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase">Bodega: {item.warehouse_name}</span>
                                                            <span className="text-[10px] font-bold text-slate-400">Cant: {item.quantity}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end">
                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${item.status === 'shipped' ? 'bg-emerald-100 text-emerald-700' :
                                                        item.status === 'pending_sourcing' ? 'bg-amber-100 text-amber-700' :
                                                            'bg-blue-100 text-blue-700'
                                                        }`}>
                                                        {item.status.replace('_', ' ')}
                                                    </span>
                                                    {!canDispatch && !isShipped && (
                                                        <span className="text-[8px] text-amber-600 font-bold mt-1 uppercase italic">Falta Sourcing</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                                <div className="text-xs text-slate-500">
                                    <span className="font-bold">{selectedItemIds.size}</span> ítems seleccionados para despacho.
                                </div>
                                <button
                                    onClick={handlePrepareDispatch}
                                    disabled={selectedItemIds.size === 0}
                                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-black uppercase rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                                >
                                    <Truck size={18} />
                                    Preparar Despacho
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center">
                            <Truck size={64} className="mb-4 opacity-10" />
                            <h2 className="text-xl font-bold text-slate-500">Seleccione una Orden</h2>
                            <p className="text-sm max-w-xs mt-2">Elija una orden de la lista para ver los ítems pendientes de despacho físico.</p>
                        </div>
                    )}
                </div>
            </div>

            <DispatchImpactModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                onConfirm={handleConfirmDispatch}
                isProcessing={isProcessing}
                data={previewData}
            />
        </div>
    );
};

export default DispatchPipeline;
