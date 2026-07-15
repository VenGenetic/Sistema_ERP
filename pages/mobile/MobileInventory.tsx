import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { getThumbnailUrl } from '../../utils/image';

const MobileInventory: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [product, setProduct] = useState<any>(null);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Fetch Warehouses
    useEffect(() => {
        const fetchWarehouses = async () => {
            const { data } = await supabase.from('warehouses').select('*').order('id');
            if (data && data.length > 0) {
                setWarehouses(data);
                setSelectedWarehouseId(data[0].id.toString());
            }
        };
        fetchWarehouses();
    }, []);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm.trim().length >= 3) {
                searchProduct(searchTerm.trim());
            } else if (searchTerm.trim().length === 0) {
                setProduct(null);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const searchProduct = async (term: string) => {
        setLoading(true);
        setMessage(null);
        try {
            const { data, error } = await supabase
                .from('products')
                .select(`
                    *,
                    inventory_levels (warehouse_id, current_stock)
                `)
                .or(`sku.ilike.%${term}%,name.ilike.%${term}%`)
                .eq('is_active', true)
                .limit(1);

            if (error) throw error;

            if (data && data.length > 0) {
                setProduct(data[0]);
            } else {
                setProduct(null);
                setMessage({ type: 'error', text: 'Producto no encontrado' });
            }
        } catch (err: any) {
            console.error(err);
            setMessage({ type: 'error', text: 'Error al buscar producto' });
        } finally {
            setLoading(false);
        }
    };

    const handleMovement = async (type: 'IN' | 'OUT') => {
        if (!product || !selectedWarehouseId) return;

        setProcessing(true);
        setMessage(null);
        try {
            const qtyChange = type === 'IN' ? 1 : -1;
            const { error } = await supabase.rpc('process_inventory_movement', {
                p_product_id: parseInt(product.id),
                p_warehouse_id: parseInt(selectedWarehouseId),
                p_quantity_change: qtyChange,
                p_reason: 'Ajuste Móvil',
                p_reference_type: 'manual_adjustment',
                p_reference_id: null
            });

            if (error) throw error;

            // Optimistic update of local state
            setProduct((prev: any) => {
                if (!prev) return prev;
                const levels = [...prev.inventory_levels];
                const wId = parseInt(selectedWarehouseId);
                const idx = levels.findIndex(l => l.warehouse_id === wId);
                if (idx >= 0) {
                    levels[idx].current_stock += qtyChange;
                } else {
                    levels.push({ warehouse_id: wId, current_stock: qtyChange > 0 ? qtyChange : 0 });
                }
                return { ...prev, inventory_levels: levels };
            });

            // Haptic feedback if available (mobile browsers)
            if (navigator.vibrate) {
                navigator.vibrate(type === 'IN' ? 50 : [50, 50, 50]);
            }

            setMessage({ type: 'success', text: `Stock actualizado (${type === 'IN' ? '+1' : '-1'})` });
            setTimeout(() => setMessage(null), 2000);
        } catch (err: any) {
            console.error(err);
            setMessage({ type: 'error', text: 'Error al actualizar stock' });
        } finally {
            setProcessing(false);
        }
    };

    const currentStockInSelectedWarehouse = product?.inventory_levels?.find((l: any) => l.warehouse_id === parseInt(selectedWarehouseId))?.current_stock || 0;
    const globalStock = product?.inventory_levels?.reduce((acc: number, level: any) => acc + (level.current_stock || 0), 0) || 0;
    const imageUrl = product?.image_url ? getThumbnailUrl(product.image_url, 300) : null;

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-br from-blue-700 to-blue-500 rounded-b-[40px] px-6 pt-10 pb-8 shadow-lg shadow-blue-500/20 mb-6 text-white relative overflow-hidden">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                <h1 className="text-3xl font-bold mb-2 relative z-10">Inventario</h1>
                <p className="text-blue-100 relative z-10">Ajuste rápido</p>
            </div>

            {/* Content */}
            <div className="flex-1 px-4 flex flex-col gap-6">
                
                {/* Scanner/Search Input */}
                <div className="relative">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-slate-400">qr_code_scanner</span>
                    </div>
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Escanea SKU o busca producto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-12 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700/50 rounded-2xl shadow-sm focus:ring-0 focus:border-blue-500 text-slate-900 dark:text-white font-medium"
                        autoComplete="off"
                        autoFocus
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => { setSearchTerm(''); searchInputRef.current?.focus(); }}
                            className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-600"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    )}
                </div>

                {loading && !product && (
                    <div className="flex justify-center mt-8">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}

                {/* Messages */}
                {message && (
                    <div className={`p-4 rounded-2xl flex items-center justify-center gap-2 font-medium animate-fade-in ${
                        message.type === 'success' 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                        <span className="material-symbols-outlined font-variation-fill-1">
                            {message.type === 'success' ? 'check_circle' : 'error'}
                        </span>
                        {message.text}
                    </div>
                )}

                {/* Product Card & Controls */}
                {product && (
                    <div className="flex flex-col gap-4 animate-fade-in pb-10">
                        {/* Warehouse Selector */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-2 border border-slate-100 dark:border-slate-700/50 shadow-sm">
                            <select
                                className="w-full bg-transparent p-2 text-slate-700 dark:text-slate-300 font-medium outline-none focus:ring-0 border-none"
                                value={selectedWarehouseId}
                                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                            >
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>📍 {w.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Card */}
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-slate-100 dark:border-slate-700/50 flex flex-col items-center relative overflow-hidden">
                            {/* Stock Badge */}
                            <div className="absolute top-4 right-4 flex flex-col items-end">
                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Stock Total</span>
                                <div className={`px-3 py-1 rounded-xl font-bold text-sm ${
                                    globalStock > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                    {globalStock}
                                </div>
                            </div>

                            <div className="w-32 h-32 rounded-2xl bg-slate-50 dark:bg-slate-700/50 mb-4 p-2">
                                {imageUrl ? (
                                    <img src={imageUrl} alt={product.name} className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                                        <span className="material-symbols-outlined text-4xl">image</span>
                                    </div>
                                )}
                            </div>
                            
                            <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-lg mb-2">
                                {product.sku}
                            </span>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white text-center leading-tight">
                                {product.name}
                            </h2>

                            {/* Stock Controls */}
                            <div className="w-full mt-8 bg-slate-50 dark:bg-slate-900 p-4 rounded-3xl flex items-center justify-between border border-slate-100 dark:border-slate-800">
                                <button 
                                    onClick={() => handleMovement('OUT')}
                                    disabled={processing || currentStockInSelectedWarehouse <= 0}
                                    className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center text-red-500 active:scale-90 transition-transform disabled:opacity-50 disabled:active:scale-100"
                                >
                                    <span className="material-symbols-outlined text-3xl">remove</span>
                                </button>

                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">En almacén</span>
                                    <span className="text-4xl font-black text-slate-800 dark:text-white">
                                        {currentStockInSelectedWarehouse}
                                    </span>
                                </div>

                                <button 
                                    onClick={() => handleMovement('IN')}
                                    disabled={processing}
                                    className="w-14 h-14 rounded-2xl bg-blue-600 dark:bg-blue-500 shadow-md shadow-blue-500/30 flex items-center justify-center text-white active:scale-90 transition-transform disabled:opacity-50 disabled:active:scale-100"
                                >
                                    <span className="material-symbols-outlined text-3xl font-bold">add</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default MobileInventory;
