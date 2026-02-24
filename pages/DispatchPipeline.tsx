import React, { useState } from 'react';
import { ShieldCheck, Eye, Search, Printer, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface VerificationOrder {
    id: string;
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

const mockVerifications: VerificationOrder[] = [
    {
        id: 'ORD-005',
        customerName: 'Taller San José',
        phone: '0981122334',
        total: 104.50,
        shippingCost: 5.00,
        bankRef: 'PCH-998877',
        paymentReceiptUrl: 'https://via.placeholder.com/400x600?text=Vaucher+Banco',
        date: 'Hoy, 08:30 AM',
        closerName: 'Alex Closer',
        status: 'pending_verification'
    },
    {
        id: 'ORD-006',
        customerName: 'María Fernanda',
        phone: '0995551122',
        total: 55.00,
        shippingCost: 3.50,
        bankRef: 'PG-554433',
        paymentReceiptUrl: 'https://via.placeholder.com/400x600?text=Comprobante+Transferencia',
        date: 'Ayer, 18:45',
        closerName: 'Juan Pérez',
        status: 'pending_verification'
    }
];

const DispatchPipeline: React.FC = () => {
    const [orders, setOrders] = useState<VerificationOrder[]>(mockVerifications);
    const [selectedOrder, setSelectedOrder] = useState<VerificationOrder | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);

    const handleVerifyPayment = async () => {
        if (!selectedOrder) return;
        setIsVerifying(true);

        try {
            // In a real app, you would run an RPC or UPDATE orders SET status = 'processing_fulfillment'
            // await supabase.from('orders').update({ status: 'processing_fulfillment' }).eq('id', selectedOrder.id);

            // Mock delay
            await new Promise(r => setTimeout(r, 800));

            // Generate Print Ticket mock
            console.log("Printing Ticket for Warehouse Fulfillment...");
            alert(`✅ Pago Verificado: ${selectedOrder.bankRef}\nEstado de Orden actualizado a En Preparación.\nLa comisión del closer ha sido validada.`);

            // Remove from the pipeline
            setOrders(prev => prev.filter(o => o.id !== selectedOrder.id));
            setSelectedOrder(null);
        } catch (err) {
            console.error(err);
            alert("Error al verificar la orden.");
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] p-6 bg-slate-50 dark:bg-[#0d1117] overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <ShieldCheck className="text-blue-500" />
                        Verificación y Despacho
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Auditoría de Pagos y Liberación de Órdenes a Bodega</p>
                </div>
            </div>

            <div className="flex flex-1 gap-6 overflow-hidden">
                {/* Left: Pending Verifications List */}
                <div className="w-1/3 flex flex-col bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c1117]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Filtrar referencias..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-[#161b22]"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {orders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center px-4">
                                <CheckCircle size={32} className="mb-2 text-green-500/50" />
                                <p className="font-medium">Pipeline Limpio</p>
                                <p className="text-xs mt-1">Todas las órdenes han sido verificadas.</p>
                            </div>
                        ) : (
                            orders.map(order => (
                                <div
                                    key={order.id}
                                    onClick={() => setSelectedOrder(order)}
                                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${selectedOrder?.id === order.id ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{order.id}</span>
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
                    {selectedOrder ? (
                        <>
                            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-[#0c1117]">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Auditoría: {selectedOrder.id}</h2>
                                    <p className="text-sm text-slate-500">Vendedor: <span className="font-medium text-slate-700 dark:text-slate-300">{selectedOrder.closerName}</span></p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-slate-500 uppercase tracking-wide text-xs">Monto Esperado en Banco</p>
                                    <p className="text-2xl font-black text-green-600 dark:text-green-500">${(selectedOrder.total + selectedOrder.shippingCost).toFixed(2)}</p>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 flex gap-6">
                                {/* Details column */}
                                <div className="w-1/3 space-y-6">
                                    <div className="bg-slate-50 dark:bg-[#0c1117] p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Datos del Cliente</h3>
                                        <p className="font-bold text-slate-900 dark:text-white">{selectedOrder.customerName}</p>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 font-mono mt-1">{selectedOrder.phone}</p>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-[#0c1117] p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Información Bancaria</h3>
                                        <div className="space-y-2">
                                            <div>
                                                <p className="text-xs text-slate-500">Referencia / Vaucher</p>
                                                <p className="font-mono font-bold text-lg text-slate-800 dark:text-slate-200">{selectedOrder.bankRef}</p>
                                            </div>
                                            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-500">Subtotal</span>
                                                    <span className="font-medium text-slate-700 dark:text-slate-300">${selectedOrder.total.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm mt-1">
                                                    <span className="text-slate-500">Envío Adicional</span>
                                                    <span className="font-medium text-slate-700 dark:text-slate-300">${selectedOrder.shippingCost.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Image Viewer */}
                                <div className="flex-1 flex flex-col">
                                    <div className="flex-1 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800 relative group">
                                        {selectedOrder.paymentReceiptUrl ? (
                                            <img
                                                src={selectedOrder.paymentReceiptUrl}
                                                alt="Comprobante"
                                                className="w-full h-full object-contain"
                                            />
                                        ) : (
                                            <div className="text-slate-600 flex flex-col items-center">
                                                <Eye size={48} className="mb-2 opacity-50" />
                                                <p>Sin imagen adjunta</p>
                                            </div>
                                        )}

                                        {/* Tooltip Overlay */}
                                        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                            Verificando Depósito Múltiple
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Bar */}
                            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c1117] flex justify-end gap-3">
                                <button
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
                                            <Printer size={18} />
                                            <span>Pago Verificado - Imprimir Ticket</span>
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
                                Seleccione una orden del panel izquierdo para verificar el comprobante contra la cuenta bancaria.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DispatchPipeline;
