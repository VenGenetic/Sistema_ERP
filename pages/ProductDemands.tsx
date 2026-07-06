import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { buildWhatsAppDemandURL, buildWhatsAppDiscontinuedURL, openWhatsApp } from '../utils/whatsapp';
import { MediaLightbox } from '../components/MediaLightbox';
import { getThumbnailUrl } from '../utils/image';
import { EditDemandModal } from '../components/EditDemandModal';
import { ShareDemandModal } from '../components/ShareDemandModal';
import { ExportDemandsModal } from '../components/ExportDemandsModal';

interface ProductDemand {
    id: number;
    product_id: number;
    phone_number: string;
    customer_name: string | null;
    notes: string | null;
    status: 'pending_stock' | 'stock_available' | 'notified' | 'cancelled' | 'discontinued' | 'expired';
    created_at: string;
    stock_detected_at: string | null;
    created_by?: string | null;
    creator_name?: string;
    is_approved?: boolean;
    product: {
        id: number;
        name: string;
        sku: string;
        price?: number;
        importer_stock: number;
        local_stock: number;
        image_url?: string | null;
        is_discontinued?: boolean;
        discontinued_until?: string | null;
        cost_without_vat?: number | null;
        vat_percentage?: number | null;
        inventory_levels: { current_stock: number }[];
    } | null;
}

const ProductDemands: React.FC = () => {
    const { session } = useAuth();
    const user = session?.user;
    const [demands, setDemands] = useState<ProductDemand[]>([]);
    const [loading, setLoading] = useState(true);
    
    // View and Filters State
    const [viewType, setViewType] = useState<'table' | 'list' | 'kanban' | 'grouped'>('table');
    const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'product_asc' | 'customer_asc' | 'stock_desc'>('date_desc');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending_stock' | 'stock_available' | 'notified' | 'cancelled' | 'discontinued' | 'expired'>('active');
    const [stockFilter, setStockFilter] = useState<'all' | 'importer_only' | 'local_only' | 'no_stock' | 'approved_only'>('all');
    const [lightbox, setLightbox] = useState<{isOpen: boolean, media: any[], initialIndex: number}>({ isOpen: false, media: [], initialIndex: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedProducts, setExpandedProducts] = useState<Record<number, boolean>>({});
    const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);
    const [editingDemand, setEditingDemand] = useState<ProductDemand | null>(null);
    const [sharingDemand, setSharingDemand] = useState<ProductDemand | null>(null);
    const [discontinueProductId, setDiscontinueProductId] = useState<number | null>(null);
    const [showExportModal, setShowExportModal] = useState(false);
    const [discontinueDuration, setDiscontinueDuration] = useState<'3' | '6' | '12' | 'permanente'>('permanente');
    const [isDiscontinuing, setIsDiscontinuing] = useState(false);

    const fetchDemands = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('product_demands')
                .select(`
                    *,
                    product:products(id, name, sku, price, importer_stock, local_stock, image_url, is_discontinued, discontinued_until, cost_without_vat, vat_percentage, inventory_levels(current_stock))
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            let mappedData = data || [];

            // Client-side join with profiles to get creator name
            const createdByIds = Array.from(new Set(mappedData.map(d => d.created_by).filter(Boolean)));
            if (createdByIds.length > 0) {
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', createdByIds);

                if (!profilesError && profilesData) {
                    const profilesMap = new Map(profilesData.map(p => [p.id, p.full_name]));
                    mappedData = mappedData.map(d => ({
                        ...d,
                        creator_name: d.created_by ? (profilesMap.get(d.created_by) || 'Desconocido') : 'Sistema/Desconocido'
                    }));
                } else {
                    mappedData = mappedData.map(d => ({
                        ...d,
                        creator_name: 'Desconocido'
                    }));
                }
            } else {
                mappedData = mappedData.map(d => ({
                    ...d,
                    creator_name: 'Sistema/Desconocido'
                }));
            }

            setDemands(mappedData);
        } catch (error: any) {
            console.error('Error fetching demands:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDemands();
    }, []);

    // Helper functions
    const getStockValue = (prod: any) => {
        if (!prod) return 0;
        const local = prod.inventory_levels ? prod.inventory_levels.reduce((acc: number, lvl: any) => acc + (lvl.current_stock || 0), 0) : 0;
        return local + (prod.importer_stock || 0);
    };

    const handleCopyPhone = (phone: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(phone);
        // Optional: you could add a local state for a tiny copied tooltip, but for simplicity we just copy.
    };

    const toggleProductExpand = (productId: number) => {
        setExpandedProducts(prev => ({ ...prev, [productId]: !prev[productId] }));
    };

    const ExpirationDisplay = ({ createdAt, status }: { createdAt: string, status: string }) => {
        if (status === 'cancelled' || status === 'notified' || status === 'discontinued') return null;
        const expirationDate = new Date(new Date(createdAt).getTime() + 60 * 24 * 60 * 60 * 1000);
        const daysLeft = Math.ceil((expirationDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 0) {
            return <span className="text-red-500 font-medium text-xs ml-1">(Vencido)</span>;
        }
        return <span className={`font-medium text-xs ml-1 ${daysLeft <= 10 ? 'text-amber-500' : 'text-blue-500'}`}>(Vence en {daysLeft} días)</span>;
    };

    // Actions
    const handleNotify = async (demand: ProductDemand, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!demand.product) return;
        
        const url = buildWhatsAppDemandURL({
            customerPhone: demand.phone_number,
            customerName: demand.customer_name || undefined,
            productSku: demand.product.sku,
            productName: demand.product.name
        });

        openWhatsApp(url);

        if (window.confirm(`¿Se envió el mensaje a ${demand.customer_name || demand.phone_number} correctamente?`)) {
            try {
                const { error } = await supabase
                    .from('product_demands')
                    .update({
                        status: 'notified',
                        notified_at: new Date().toISOString(),
                        notified_by: user?.id
                    })
                    .eq('id', demand.id);

                if (error) throw error;
                fetchDemands();
            } catch (error: any) {
                alert(`Error al marcar como notificado: ${error.message}`);
            }
        }
    };

    const handleNotifyDiscontinued = async (demand: ProductDemand, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!demand.product) return;

        const url = buildWhatsAppDiscontinuedURL({
            customerPhone: demand.phone_number,
            customerName: demand.customer_name || undefined,
            productSku: demand.product.sku,
            productName: demand.product.name
        });

        openWhatsApp(url);

        if (window.confirm(`¿Se envió el mensaje notificando la descontinuación a ${demand.customer_name || demand.phone_number} correctamente? Esto archivará la solicitud.`)) {
            try {
                const { error } = await supabase
                    .from('product_demands')
                    .update({
                        status: 'notified',
                        notified_at: new Date().toISOString(),
                        notified_by: user?.id
                    })
                    .eq('id', demand.id);

                if (error) throw error;
                fetchDemands();
            } catch (error: any) {
                alert(`Error al marcar como notificado: ${error.message}`);
            }
        }
    };

    const handleMarkAvailable = async (demand: ProductDemand, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (window.confirm(`¿Marcar como disponible manualmente? (Útil cuando llega un producto equivalente)`)) {
            try {
                const { error } = await supabase
                    .from('product_demands')
                    .update({
                        status: 'stock_available',
                        stock_detected_at: new Date().toISOString()
                    })
                    .eq('id', demand.id);

                if (error) throw error;
                fetchDemands();
            } catch (error: any) {
                alert(`Error: ${error.message}`);
            }
        }
    };

    const handleCancel = async (demand: ProductDemand, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (window.confirm('¿Estás seguro de cancelar esta solicitud?')) {
            try {
                const { error } = await supabase
                    .from('product_demands')
                    .update({ status: 'cancelled' })
                    .eq('id', demand.id);

                if (error) throw error;
                fetchDemands();
            } catch (error: any) {
                alert(`Error: ${error.message}`);
            }
        }
    };

    const handleDelete = async (demand: ProductDemand, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (window.confirm('¿Eliminar permanentemente del historial?')) {
            try {
                const { error } = await supabase
                    .from('product_demands')
                    .delete()
                    .eq('id', demand.id);

                if (error) throw error;
                fetchDemands();
            } catch (error: any) {
                alert(`Error: ${error.message}`);
            }
        }
    };

    const handleMarkNotifiedDirectly = async (demand: ProductDemand, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (window.confirm(`¿Marcar como notificado a ${demand.customer_name || demand.phone_number} sin enviar WhatsApp?`)) {
            try {
                const { error } = await supabase
                    .from('product_demands')
                    .update({
                        status: 'notified',
                        notified_at: new Date().toISOString(),
                        notified_by: user?.id
                    })
                    .eq('id', demand.id);

                if (error) throw error;
                fetchDemands();
            } catch (error: any) {
                alert(`Error al marcar como notificado: ${error.message}`);
            }
        }
    };

    const handleConfirmDiscontinue = async () => {
        if (!discontinueProductId) return;
        setIsDiscontinuing(true);
        try {
            let discontinuedUntil: string | null = null;
            if (discontinueDuration !== 'permanente') {
                const months = parseInt(discontinueDuration, 10);
                const date = new Date();
                date.setMonth(date.getMonth() + months);
                discontinuedUntil = date.toISOString();
            }

            // Update product
            const { error: productError } = await supabase
                .from('products')
                .update({
                    is_discontinued: true,
                    discontinued_until: discontinuedUntil
                })
                .eq('id', discontinueProductId);

            if (productError) throw productError;

            // Automatically update active demands for this product to discontinued
            const { error: demandError } = await supabase
                .from('product_demands')
                .update({ status: 'discontinued' })
                .eq('product_id', discontinueProductId)
                .in('status', ['pending_stock', 'stock_available']);

            if (demandError) throw demandError;

            // Also update customer_requests (POS waitlist)
            await supabase
                .from('customer_requests')
                .update({ status: 'cancelled' }) // or you could map to cancelled
                .eq('product_id', discontinueProductId)
                .eq('status', 'pending');

            alert('Producto marcado como descontinuado exitosamente. Las solicitudes han sido actualizadas.');
            setDiscontinueProductId(null);
            fetchDemands();
        } catch (error: any) {
            alert(`Error al descontinuar producto: ${error.message}`);
        } finally {
            setIsDiscontinuing(false);
        }
    };

    // Open Lightbox for demand product image
    const handleOpenLightboxDemand = (demand: ProductDemand) => {
        if (!demand.product?.image_url) return;
        const media = [{ type: 'image', url: demand.product.image_url, title: `${demand.product.sku} - ${demand.product.name}` }];
        setLightbox({ isOpen: true, media, initialIndex: 0 });
    };

    const handleStatusChange = async (demandId: number, newStatus: 'pending_stock' | 'stock_available' | 'notified' | 'cancelled' | 'discontinued' | 'expired') => {
        try {
            const updates: any = { status: newStatus };
            if (newStatus === 'notified') {
                updates.notified_at = new Date().toISOString();
                updates.notified_by = user?.id;
            } else if (newStatus === 'stock_available') {
                updates.stock_detected_at = new Date().toISOString();
            }
            
            const { error } = await supabase
                .from('product_demands')
                .update(updates)
                .eq('id', demandId);

            if (error) throw error;
            fetchDemands();
        } catch (error: any) {
            alert(`Error al cambiar el estado: ${error.message}`);
        }
    };

    const handleToggleApproved = async (demand: ProductDemand, e: React.MouseEvent) => {
        e.stopPropagation();
        const importerStock = getStockValue(demand.product, 'importer');
        
        if (importerStock <= 0 && !demand.is_approved) {
            alert("No se puede aprobar: No hay stock en la importadora.\n\nDisclaimer: Si ya hay stock porque han revisado aparte, se debe solicitar a la administración la actualización del sistema con el stock visible en la importadora para poder aprobar este pedido.");
            return;
        }

        try {
            const { error } = await supabase
                .from('product_demands')
                .update({ is_approved: !demand.is_approved })
                .eq('id', demand.id);

            if (error) throw error;
            fetchDemands();
        } catch (error: any) {
            alert(`Error al cambiar estado de aprobación: ${error.message}`);
        }
    };

    // Derived Data
    const stats = useMemo(() => {
        const total = demands.length;
        const active = demands.filter(d => d.status === 'pending_stock' || d.status === 'stock_available').length;
        const inactive = demands.filter(d => d.status === 'notified' || d.status === 'cancelled' || d.status === 'expired').length;
        const readyToNotify = demands.filter(d => (d.status === 'pending_stock' || d.status === 'stock_available') && getStockValue(d.product) > 0).length;
        return { total, active, inactive, readyToNotify };
    }, [demands]);

    const filteredAndSortedDemands = useMemo(() => {
        let filtered = demands.filter(d => {
            // Status Filter (Kanban view shows all statuses by design to allow dragging)
            if (viewType !== 'kanban') {
                if (statusFilter === 'active') {
                    if (d.status !== 'pending_stock' && d.status !== 'stock_available') return false;
                } else if (statusFilter === 'inactive') {
                    if (d.status !== 'notified' && d.status !== 'cancelled' && d.status !== 'expired') return false;
                } else if (statusFilter !== 'all') {
                    if (d.status !== statusFilter) return false;
                }
            }

            // Stock filter
            if (stockFilter !== 'all') {
                const hasImporterStock = (d.product?.importer_stock || 0) > 0;
                const localStock = d.product?.inventory_levels ? d.product.inventory_levels.reduce((acc: number, lvl: any) => acc + (lvl.current_stock || 0), 0) : 0;
                const hasLocalStock = localStock > 0;

                if (stockFilter === 'importer_only' && (!hasImporterStock || hasLocalStock)) return false;
                if (stockFilter === 'local_only' && (!hasLocalStock || hasImporterStock)) return false;
                if (stockFilter === 'no_stock' && (hasImporterStock || hasLocalStock)) return false;
                if (stockFilter === 'approved_only' && !d.is_approved) return false;
            }
            return true;
        });

        // Search Term
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(d => 
                (d.phone_number && d.phone_number.includes(lowerTerm)) ||
                (d.customer_name && d.customer_name.toLowerCase().includes(lowerTerm)) ||
                (d.product?.name && d.product.name.toLowerCase().includes(lowerTerm)) ||
                (d.product?.sku && d.product.sku.toLowerCase().includes(lowerTerm))
            );
        }

        // Sort
        filtered.sort((a, b) => {
            if (sortBy === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            if (sortBy === 'date_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            if (sortBy === 'product_asc') return (a.product?.name || '').localeCompare(b.product?.name || '');
            if (sortBy === 'customer_asc') return (a.customer_name || '').localeCompare(b.customer_name || '');
            if (sortBy === 'stock_desc') return getStockValue(b.product) - getStockValue(a.product);
            return 0;
        });

        return filtered;
    }, [demands, statusFilter, stockFilter, searchTerm, sortBy, viewType]);

    const grouped = useMemo(() => {
        const map = new Map<number, { productId: number; product: any; demands: ProductDemand[] }>();
        filteredAndSortedDemands.forEach(d => {
            const pId = d.product_id;
            if (!map.has(pId)) map.set(pId, { productId: pId, product: d.product, demands: [] });
            map.get(pId)!.demands.push(d);
        });
        // Sort groups by number of demands descending
        return Array.from(map.values()).sort((a, b) => b.demands.length - a.demands.length);
    }, [filteredAndSortedDemands]);

    // Components
    const StatusBadge = ({ status }: { status: string }) => {
        if (status === 'pending_stock') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800"><span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>Esperando Stock</span>;
        if (status === 'stock_available') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"><span className="material-symbols-outlined text-[14px]">check_circle</span>Listo para Notificar</span>;
        if (status === 'notified') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800"><span className="material-symbols-outlined text-[14px]">done_all</span>Notificado</span>;
        if (status === 'discontinued') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800"><span className="material-symbols-outlined text-[14px]">warning</span>Descontinuado</span>;
        if (status === 'expired') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800"><span className="material-symbols-outlined text-[14px]">timer_off</span>Vencido</span>;
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"><span className="material-symbols-outlined text-[14px]">cancel</span>Cancelado</span>;
    };

    const ApprovedToggle = ({ demand }: { demand: ProductDemand }) => {
        return (
            <div className="flex items-center gap-2 mt-2">
                <button
                    onClick={(e) => handleToggleApproved(demand, e)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        demand.is_approved ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                    role="switch"
                    aria-checked={demand.is_approved}
                >
                    <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            demand.is_approved ? 'translate-x-4' : 'translate-x-0'
                        }`}
                    />
                </button>
                <span className={`text-xs font-medium ${demand.is_approved ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                    {demand.is_approved ? 'Aprobado en espera' : 'No aprobado'}
                </span>
            </div>
        );
    };

    const PhoneDisplay = ({ phone }: { phone: string }) => (
        <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">{phone}</span>
            <button onClick={(e) => handleCopyPhone(phone, e)} className="p-1 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors" title="Copiar Teléfono">
                <span className="material-symbols-outlined text-[14px]">content_copy</span>
            </button>
        </div>
    );

    const StockDisplay = ({ prod }: { prod: any }) => {
        if (!prod) return <span className="text-xs text-slate-400 italic">Sin Stock</span>;
        
        const localStock = prod.inventory_levels ? prod.inventory_levels.reduce((acc: number, lvl: any) => acc + (lvl.current_stock || 0), 0) : 0;
        const importerStock = prod.importer_stock || 0;
        
        return (
            <div className="flex flex-col gap-0.5 text-[11px] mt-1 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-left min-w-[120px]">
                <span className="flex items-center gap-1.5 justify-between">
                    <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                        <span className="text-slate-500 dark:text-slate-400">Local:</span>
                    </span>
                    <span className={`font-bold ${localStock > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                        {localStock}
                    </span>
                </span>
                <span className="flex items-center gap-1.5 justify-between">
                    <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span className="text-slate-500 dark:text-slate-400">Impo:</span>
                    </span>
                    <span className={`font-bold ${importerStock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                        {importerStock}
                    </span>
                </span>
            </div>
        );
    };

    const PriceDisplay = ({ prod }: { prod: any }) => {
        if (!prod) return null;
        const pvp = prod.price;
        const costWithVat =
            prod.cost_without_vat != null && prod.vat_percentage != null
                ? prod.cost_without_vat * (1 + prod.vat_percentage / 100)
                : null;
        if (pvp == null && costWithVat == null) return null;
        return (
            <div className="flex flex-col gap-0.5 text-[11px] mt-1 bg-blue-50 dark:bg-blue-900/10 p-2 rounded-lg border border-blue-100 dark:border-blue-900/40 text-left min-w-[120px]">
                {costWithVat != null && (
                    <span className="flex items-center gap-1.5 justify-between">
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                            <span className="text-slate-500 dark:text-slate-400">Costo c/IVA:</span>
                        </span>
                        <span className="font-bold text-orange-600 dark:text-orange-400">
                            ${costWithVat.toFixed(2)}
                        </span>
                    </span>
                )}
                {pvp != null && (
                    <span className="flex items-center gap-1.5 justify-between">
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            <span className="text-slate-500 dark:text-slate-400">PVP:</span>
                        </span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                            ${pvp.toFixed(2)}
                        </span>
                    </span>
                )}
            </div>
        );
    };

    const ActionButtons = ({ demand }: { demand: ProductDemand }) => {
        const isReady = demand.status === 'stock_available';
        const isActive = demand.status === 'pending_stock' || demand.status === 'stock_available';
        const isDiscontinued = demand.status === 'discontinued';
        const isExpired = demand.status === 'expired';
        
        return (
            <div className="flex flex-col gap-2">
                {isActive ? (
                    <>
                        <button onClick={(e) => handleNotify(demand, e)} className={`flex items-center gap-1.5 px-3 py-1.5 justify-center rounded-lg text-sm font-semibold text-white transition-colors shadow-sm ${isReady ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-blue-500 hover:bg-blue-600'}`}>
                            <span className="material-symbols-outlined text-[16px]">chat</span> Notificar
                        </button>
                        <div className="flex items-center justify-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); setEditingDemand(demand); }} className="text-xs text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1" title="Editar">
                                <span className="material-symbols-outlined text-[14px]">edit</span> Editar
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setSharingDemand(demand); }} className="text-xs text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1" title="Compartir">
                                <span className="material-symbols-outlined text-[14px]">share</span> Compartir
                            </button>
                            {!isReady && (
                                <button onClick={(e) => handleMarkAvailable(demand, e)} className="text-xs text-slate-500 hover:text-emerald-600 transition-colors">Marcar Disp.</button>
                            )}
                        </div>
                        <button onClick={(e) => handleMarkNotifiedDirectly(demand, e)} className="text-xs text-slate-500 hover:text-blue-600 transition-colors">Marcar Notificado</button>
                        <button onClick={(e) => handleStatusChange(demand.id, 'expired')} className="text-xs text-red-500 hover:text-red-700 transition-colors">Marcar Vencido</button>
                        <button onClick={(e) => handleCancel(demand, e)} className="text-xs text-rose-500 hover:text-rose-700 transition-colors">Cancelar</button>
                    </>
                ) : isDiscontinued ? (
                    <>
                        <button onClick={(e) => handleNotifyDiscontinued(demand, e)} className="flex items-center gap-1.5 px-3 py-1.5 justify-center rounded-lg text-sm font-semibold text-white transition-colors shadow-sm bg-rose-500 hover:bg-rose-600">
                            <span className="material-symbols-outlined text-[16px]">chat</span> Notificar Descontinuado
                        </button>
                        <div className="flex items-center justify-center gap-2">
                            <button onClick={(e) => handleMarkNotifiedDirectly(demand, e)} className="text-xs text-slate-500 hover:text-blue-600 transition-colors">Archivar/Notificado</button>
                            <button onClick={(e) => handleCancel(demand, e)} className="text-xs text-rose-500 hover:text-rose-700 transition-colors">Cancelar</button>
                        </div>
                    </>
                ) : isExpired ? (
                    <>
                        <div className="flex flex-col gap-2 justify-center items-center">
                            <span className="text-xs text-slate-400">Expiró sin stock</span>
                            <button onClick={(e) => handleDelete(demand, e)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors mx-auto" title="Eliminar registro">
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                        </div>
                    </>
                ) : (
                    <button onClick={(e) => handleDelete(demand, e)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors mx-auto" title="Eliminar registro">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                )}
            </div>
        );
    };

    // Render Views
    const renderTableView = () => (
        <div className="bg-white dark:bg-[#0c1117] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-[#161b22] border-b border-slate-200 dark:border-slate-800">
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cliente / Teléfono</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Producto (SKU)</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fecha / Stock</th>
                            <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredAndSortedDemands.map(demand => {
                            const totalStock = getStockValue(demand.product);
                            const isReady = demand.status === 'stock_available';
                            return (
                                <tr key={demand.id} className={`transition-colors ${isReady ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                    <td className="px-6 py-4 align-top">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-slate-900 dark:text-white">{demand.customer_name || 'Sin Nombre'}</span>
                                            <PhoneDisplay phone={demand.phone_number} />
                                            {demand.notes && <span className="text-xs text-slate-400 mt-1 italic max-w-[200px] truncate" title={demand.notes}>{demand.notes}</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top max-w-[250px]">
                                        {demand.product ? (
                                            <div className="flex items-start gap-2">
                                                {demand.product?.image_url && (
                                                    <img
                                                        src={getThumbnailUrl(demand.product.image_url, 60, 60)}
                                                        alt=""
                                                        className="h-12 w-12 object-cover rounded cursor-pointer"
                                                        onClick={() => handleOpenLightboxDemand(demand)}
                                                    />
                                                )}
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-900 dark:text-slate-200 line-clamp-2" title={demand.product.name}>{demand.product.name}</span>
                                                    <span className="text-sm text-slate-500 dark:text-slate-400 font-mono">{demand.product.sku}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 italic">Producto no encontrado</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="flex flex-col gap-2">
                                            <StatusBadge status={demand.status} />
                                            {demand.status === 'pending_stock' && <ApprovedToggle demand={demand} />}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="flex flex-col gap-1.5 text-sm">
                                            <span className="text-slate-500 dark:text-slate-400 font-medium">
                                                Reg: {new Date(demand.created_at).toLocaleDateString()} {new Date(demand.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                                                <ExpirationDisplay createdAt={demand.created_at} status={demand.status} />
                                            </span>
                                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[14px]">person</span>
                                                {demand.creator_name || 'Desconocido'}
                                            </span>
                                            <StockDisplay prod={demand.product} />
                                            <PriceDisplay prod={demand.product} />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center align-top">
                                        <ActionButtons demand={demand} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filteredAndSortedDemands.length === 0 && (
                    <div className="p-12 text-center text-slate-500">No se encontraron solicitudes.</div>
                )}
            </div>
        </div>
    );

    const renderListView = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAndSortedDemands.map(demand => {
                const totalStock = getStockValue(demand.product);
                const isReady = demand.status === 'stock_available';
                return (
                    <div key={demand.id} className={`bg-white dark:bg-[#0c1117] p-5 rounded-xl border ${isReady ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/20' : 'border-slate-200 dark:border-slate-800'} shadow-sm flex flex-col gap-4`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">{demand.customer_name || 'Cliente Sin Nombre'}</h3>
                                <PhoneDisplay phone={demand.phone_number} />
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <StatusBadge status={demand.status} />
                                {demand.status === 'pending_stock' && <ApprovedToggle demand={demand} />}
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-[#161b22] p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex items-start gap-3">
                            {demand.product?.image_url && (
                                <img
                                    src={getThumbnailUrl(demand.product.image_url, 60, 60)}
                                    alt=""
                                    className="h-12 w-12 object-cover rounded cursor-pointer mt-1 flex-shrink-0"
                                    onClick={() => handleOpenLightboxDemand(demand)}
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Producto Requerido:</span>
                                <span className="font-medium text-sm text-slate-900 dark:text-slate-200 line-clamp-2" title={demand.product?.name}>{demand.product?.name || 'Producto Desconocido'}</span>
                                <div className="flex justify-between items-start mt-2">
                                    <span className="text-xs font-mono text-slate-500">{demand.product?.sku}</span>
                                    <StockDisplay prod={demand.product} />
                                </div>
                                <PriceDisplay prod={demand.product} />
                            </div>
                        </div>
                        <div className="flex justify-between items-end mt-auto pt-2">
                            <div className="flex flex-col gap-0.5 text-xs text-slate-400">
                                <span>
                                    Reg: {new Date(demand.created_at).toLocaleDateString()} {new Date(demand.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                                    <ExpirationDisplay createdAt={demand.created_at} status={demand.status} />
                                </span>
                                <span className="flex items-center gap-1 font-medium text-slate-500 dark:text-slate-400">
                                    <span className="material-symbols-outlined text-[13px]">person</span>
                                    {demand.creator_name || 'Desconocido'}
                                </span>
                            </div>
                            <div className="w-32"><ActionButtons demand={demand} /></div>
                        </div>
                    </div>
                );
            })}
            {filteredAndSortedDemands.length === 0 && (
                <div className="col-span-full p-12 text-center text-slate-500">No se encontraron solicitudes.</div>
            )}
        </div>
    );

    const renderKanbanView = () => {
        const columns = [
            { id: 'pending_stock', title: 'Esperando Stock', color: 'bg-amber-50 dark:bg-amber-900/10', hoverColor: 'bg-amber-100/80 dark:bg-amber-900/20', header: 'border-amber-300 dark:border-amber-600', text: 'text-amber-700 dark:text-amber-400' },
            { id: 'stock_available', title: 'Stock Disponible', color: 'bg-emerald-50 dark:bg-emerald-900/10', hoverColor: 'bg-emerald-100/80 dark:bg-emerald-900/20', header: 'border-emerald-300 dark:border-emerald-600', text: 'text-emerald-700 dark:text-emerald-400' },
            { id: 'discontinued', title: 'Descontinuados por Notificar', color: 'bg-rose-50 dark:bg-rose-900/10', hoverColor: 'bg-rose-100/80 dark:bg-rose-900/20', header: 'border-rose-300 dark:border-rose-600', text: 'text-rose-700 dark:text-rose-400' },
            { id: 'expired', title: 'Vencidos', color: 'bg-red-50 dark:bg-red-900/10', hoverColor: 'bg-red-100/80 dark:bg-red-900/20', header: 'border-red-300 dark:border-red-600', text: 'text-red-700 dark:text-red-400' },
            { id: 'notified', title: 'Notificados', color: 'bg-blue-50 dark:bg-blue-900/10', hoverColor: 'bg-blue-100/80 dark:bg-blue-900/20', header: 'border-blue-300 dark:border-blue-600', text: 'text-blue-700 dark:text-blue-400' },
            { id: 'cancelled', title: 'Cancelados', color: 'bg-slate-50 dark:bg-slate-900/10', hoverColor: 'bg-slate-100/80 dark:bg-slate-900/20', header: 'border-slate-300 dark:border-slate-600', text: 'text-slate-700 dark:text-slate-300' }
        ];

        return (
            <div className="flex gap-6 overflow-x-auto pb-4 items-start">
                {columns.map(col => {
                    const colItems = filteredAndSortedDemands.filter(d => d.status === col.id);
                    const isOver = draggedOverColumn === col.id;
                    return (
                        <div
                            key={col.id}
                            onDragOver={(e) => e.preventDefault()}
                            onDragEnter={() => setDraggedOverColumn(col.id)}
                            onDragLeave={() => setDraggedOverColumn(null)}
                            onDrop={(e) => {
                                e.preventDefault();
                                const demandIdStr = e.dataTransfer.getData('text/plain');
                                const demandId = parseInt(demandIdStr);
                                setDraggedOverColumn(null);
                                if (!isNaN(demandId)) {
                                    handleStatusChange(demandId, col.id as any);
                                }
                            }}
                            className={`flex flex-col w-80 min-w-[320px] rounded-xl border transition-all duration-200 overflow-hidden ${isOver ? `${col.hoverColor} border-dashed border-indigo-400 scale-[1.01] shadow-md` : `${col.color} border-slate-200 dark:border-slate-750`}`}
                        >
                            <div className={`p-4 border-b-2 bg-white/50 dark:bg-black/20 ${col.header}`}>
                                <h3 className={`font-bold text-sm uppercase tracking-wider flex items-center justify-between ${col.text}`}>
                                    {col.title}
                                    <span className="bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded-full text-xs">{colItems.length}</span>
                                </h3>
                            </div>
                            <div className="p-3 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
                                {colItems.map(demand => (
                                    <div
                                        key={demand.id}
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('text/plain', String(demand.id));
                                            e.dataTransfer.effectAllowed = 'move';
                                        }}
                                        className="bg-white dark:bg-[#0c1117] p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col gap-3 cursor-grab active:cursor-grabbing hover:border-slate-400 dark:hover:border-slate-500 transition-all"
                                    >
                                        <div className="flex justify-between items-start gap-1">
                                            <div>
                                                <span className="font-semibold text-slate-900 dark:text-white block">{demand.customer_name || 'Sin Nombre'}</span>
                                                <PhoneDisplay phone={demand.phone_number} />
                                            </div>
                                            <div className="p-1 text-slate-300 dark:text-slate-600">
                                                <span className="material-symbols-outlined text-[18px]">drag_indicator</span>
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
                                            {demand.product?.image_url && (
                                                <img
                                                    src={getThumbnailUrl(demand.product.image_url, 48, 48)}
                                                    alt=""
                                                    className="h-10 w-10 object-cover rounded cursor-pointer flex-shrink-0"
                                                    onClick={() => handleOpenLightboxDemand(demand)}
                                                />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <span className="line-clamp-2 font-medium">{demand.product?.name}</span>
                                                <span className="font-mono mt-1 block">{demand.product?.sku}</span>
                                                <PriceDisplay prod={demand.product} />
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-slate-400 flex flex-col gap-0.5 mt-1 border-t border-slate-100 dark:border-slate-800 pt-1">
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[11px]">calendar_today</span>
                                                {new Date(demand.created_at).toLocaleDateString()} {new Date(demand.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                                                <ExpirationDisplay createdAt={demand.created_at} status={demand.status} />
                                            </span>
                                            <span className="flex items-center gap-1 font-medium text-slate-500 dark:text-slate-400">
                                                <span className="material-symbols-outlined text-[11px]">person</span>
                                                {demand.creator_name || 'Desconocido'}
                                            </span>
                                        </div>
                                        {demand.status === 'pending_stock' && (
                                            <div className="mt-1">
                                                <ApprovedToggle demand={demand} />
                                            </div>
                                        )}
                                        <div className="mt-1"><ActionButtons demand={demand} /></div>
                                    </div>
                                ))}
                                {colItems.length === 0 && (
                                    <div className="py-8 text-center text-slate-400 text-xs">Arrastra aquí una solicitud</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderGroupedView = () => {
        return (
            <div className="flex flex-col gap-4">
                {grouped.map(group => {
                    const isExpanded = expandedProducts[group.productId];
                    const prodName = group.product?.name || 'Producto Desconocido';
                    const prodSku = group.product?.sku || `ID: ${group.productId}`;
                    return (
                        <div key={group.productId} className="bg-white dark:bg-[#0c1117] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                            <div onClick={() => toggleProductExpand(group.productId)} className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <span className={`material-symbols-outlined transition-transform ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                                    {group.product?.image_url && (
                                        <img
                                            src={getThumbnailUrl(group.product.image_url, 60, 60)}
                                            alt=""
                                            className="h-12 w-12 object-cover rounded cursor-pointer flex-shrink-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenLightboxDemand({ product: group.product } as any);
                                            }}
                                        />
                                    )}
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">{prodName}</h3>
                                        <span className="text-sm font-mono text-slate-500">{prodSku}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 md:gap-6">
                                    <div className="text-right hidden md:block">
                                        <StockDisplay prod={group.product} />
                                    </div>
                                    <div className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 px-3 py-1.5 rounded-lg flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px]">group</span>
                                        <span className="font-bold hidden sm:inline">{group.demands.length} en espera</span>
                                        <span className="font-bold sm:hidden">{group.demands.length}</span>
                                    </div>
                                    {!group.product?.is_discontinued ? (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDiscontinueProductId(group.productId);
                                            }}
                                            className="bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-colors border border-rose-200 dark:border-rose-800"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">warning</span>
                                            <span className="hidden sm:inline">Descontinuar</span>
                                        </button>
                                    ) : (
                                        <div className="bg-rose-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold text-xs shadow-sm">
                                            <span className="material-symbols-outlined text-[16px]">warning</span>
                                            Descontinuado
                                        </div>
                                    )}
                                </div>
                            </div>
                            {isExpanded && (
                                <div className="bg-slate-50 dark:bg-[#161b22] border-t border-slate-200 dark:border-slate-800 p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {group.demands.map(demand => (
                                            <div key={demand.id} className="bg-white dark:bg-[#0c1117] p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-3">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <span className="font-semibold text-slate-900 dark:text-white block">{demand.customer_name || 'Sin Nombre'}</span>
                                                        <PhoneDisplay phone={demand.phone_number} />
                                                    </div>
                                                    <StatusBadge status={demand.status} />
                                                </div>
                                                <div className="text-xs text-slate-400 flex flex-col gap-0.5">
                                                    <span>Reg: {new Date(demand.created_at).toLocaleDateString()} {new Date(demand.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}</span>
                                                    <span className="flex items-center gap-1 font-medium text-slate-500 dark:text-slate-300">
                                                        <span className="material-symbols-outlined text-[13px]">person</span>
                                                        {demand.creator_name || 'Desconocido'}
                                                    </span>
                                                    <PriceDisplay prod={demand.product} />
                                                </div>
                                                <div className="mt-auto pt-2"><ActionButtons demand={demand} /></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                {grouped.length === 0 && (
                    <div className="p-12 text-center text-slate-500 bg-white dark:bg-[#0c1117] rounded-xl border border-slate-200 dark:border-slate-800">No se encontraron productos en la vista agrupada.</div>
                )}
            </div>
        );
    };

    return (
        <div className="p-6 md:p-8 max-w-[1600px] mx-auto flex flex-col gap-6">
            {/* Header & Title */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold dark:text-white tracking-tight">Demanda de Stock</h1>
                    <p className="text-slate-500 mt-1">Gestión de la lista de espera de clientes para productos agotados.</p>
                </div>
                <button
                    onClick={fetchDemands}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                >
                    <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
                    Actualizar
                </button>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div onClick={() => { setStatusFilter('all'); }} className={`p-4 rounded-xl border cursor-pointer transition-all ${statusFilter === 'all' ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-700' : 'bg-white dark:bg-[#0c1117] border-slate-200 dark:border-slate-800 hover:border-indigo-300'}`}>
                    <div className="flex items-center gap-3 text-indigo-500 mb-2">
                        <span className="material-symbols-outlined text-[24px]">list_alt</span>
                        <span className="font-semibold text-sm">Total Solicitudes</span>
                    </div>
                    <span className="text-3xl font-bold text-slate-900 dark:text-white">{stats.total}</span>
                </div>
                
                <div onClick={() => { setStatusFilter('active'); }} className={`p-4 rounded-xl border cursor-pointer transition-all ${statusFilter === 'active' ? 'bg-amber-50 border-amber-300 dark:bg-amber-900/20 dark:border-amber-700' : 'bg-white dark:bg-[#0c1117] border-slate-200 dark:border-slate-800 hover:border-amber-300'}`}>
                    <div className="flex items-center gap-3 text-amber-500 mb-2">
                        <span className="material-symbols-outlined text-[24px]">pending_actions</span>
                        <span className="font-semibold text-sm">Cola Activa</span>
                    </div>
                    <span className="text-3xl font-bold text-slate-900 dark:text-white">{stats.active}</span>
                </div>

                <div onClick={() => { setStatusFilter('inactive'); }} className={`p-4 rounded-xl border cursor-pointer transition-all ${statusFilter === 'inactive' ? 'bg-slate-100 border-slate-400 dark:bg-slate-800 dark:border-slate-600' : 'bg-white dark:bg-[#0c1117] border-slate-200 dark:border-slate-800 hover:border-slate-400'}`}>
                    <div className="flex items-center gap-3 text-slate-500 mb-2">
                        <span className="material-symbols-outlined text-[24px]">history</span>
                        <span className="font-semibold text-sm">Historial</span>
                    </div>
                    <span className="text-3xl font-bold text-slate-900 dark:text-white">{stats.inactive}</span>
                </div>

                <div onClick={() => { setStatusFilter('stock_available'); }} className={`p-4 rounded-xl border cursor-pointer transition-all ${statusFilter === 'stock_available' ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-700' : 'bg-white dark:bg-[#0c1117] border-slate-200 dark:border-slate-800 hover:border-emerald-300'}`}>
                    <div className="flex items-center gap-3 text-emerald-500 mb-2">
                        <span className="material-symbols-outlined text-[24px]">inventory_2</span>
                        <span className="font-semibold text-sm">Listos para Notificar</span>
                    </div>
                    <span className="text-3xl font-bold text-slate-900 dark:text-white">{stats.readyToNotify}</span>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col 2xl:flex-row justify-between items-start 2xl:items-center gap-4 bg-white dark:bg-[#0c1117] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                
                {/* Vistas */}
                <div className="flex items-center gap-3 w-full 2xl:w-auto">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg overflow-x-auto flex-1 2xl:flex-none">
                        <button onClick={() => setViewType('table')} className={`flex-1 2xl:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewType === 'table' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'}`}>
                            <span className="material-symbols-outlined text-[18px]">table_rows</span> Tabla
                        </button>
                        <button onClick={() => setViewType('list')} className={`flex-1 2xl:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewType === 'list' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'}`}>
                            <span className="material-symbols-outlined text-[18px]">view_list</span> Lista
                        </button>
                        <button onClick={() => setViewType('kanban')} className={`flex-1 2xl:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewType === 'kanban' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'}`}>
                            <span className="material-symbols-outlined text-[18px]">view_kanban</span> Kanban
                        </button>
                        <button onClick={() => setViewType('grouped')} className={`flex-1 2xl:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewType === 'grouped' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'}`}>
                            <span className="material-symbols-outlined text-[18px]">category</span> Agrupado
                        </button>
                    </div>

                    <button
                        onClick={() => setShowExportModal(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        title="Exportar demandas a CSV con filtros"
                    >
                        <span className="material-symbols-outlined text-[18px] text-emerald-600">download</span>
                        <span className="hidden sm:inline">Exportar CSV</span>
                    </button>
                </div>

                {/* Filtros, Ordenar y Buscar */}
                <div className="flex flex-col md:flex-row items-center gap-3 w-full 2xl:w-auto">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="w-full md:w-auto bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                    >
                        <option value="all">Filtro: Todos los estados</option>
                        <option value="active">Activas (Cola)</option>
                        <option value="inactive">Inactivas (Historial)</option>
                        <option value="pending_stock">Esperando Stock</option>
                        <option value="stock_available">Stock Disponible</option>
                        <option value="notified">Notificados</option>
                        <option value="cancelled">Cancelados</option>
                    </select>

                    <select
                        value={stockFilter}
                        onChange={(e) => setStockFilter(e.target.value as any)}
                        className="w-full md:w-auto bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                    >
                        <option value="all">Stock: Todos</option>
                        <option value="importer_only">Con stock en la importadora y no en local</option>
                        <option value="local_only">Con stock en local y no importadora</option>
                        <option value="no_stock">Sin stock completamente</option>
                        <option value="approved_only">Solo pedidos aprobados en espera</option>
                    </select>

                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="w-full md:w-auto bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                    >
                        <option value="date_desc">Ordenar: Más reciente</option>
                        <option value="date_asc">Ordenar: Más antiguo</option>
                        <option value="product_asc">Producto (A-Z)</option>
                        <option value="customer_asc">Cliente (A-Z)</option>
                        <option value="stock_desc">Stock (Mayor a menor)</option>
                    </select>

                    <div className="relative w-full md:w-64">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                        <input
                            type="text"
                            placeholder="Buscar cliente, teléfono..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Views Renderer */}
            {viewType === 'table' && renderTableView()}
            {viewType === 'list' && renderListView()}
            {viewType === 'kanban' && renderKanbanView()}
            {viewType === 'grouped' && renderGroupedView()}

            <ExportDemandsModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                demands={demands}
                initialStatusFilter={statusFilter}
                initialStockFilter={stockFilter}
                initialSearchTerm={searchTerm}
            />

            <EditDemandModal
                isOpen={!!editingDemand}
                onClose={() => setEditingDemand(null)}
                demand={editingDemand}
                onSuccess={fetchDemands}
            />

            {sharingDemand && (
                <ShareDemandModal
                    isOpen={true}
                    onClose={() => setSharingDemand(null)}
                    demand={sharingDemand}
                />
            )}

            {discontinueProductId && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-rose-50 dark:bg-rose-900/20 flex items-center gap-3">
                            <span className="material-symbols-outlined text-rose-500">warning</span>
                            <h3 className="font-bold text-slate-900 dark:text-white">Descontinuar Producto</h3>
                        </div>
                        <div className="p-6 flex flex-col gap-4">
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                Las solicitudes en espera pasarán automáticamente al estado de "Descontinuado" para que procedas a notificarlas.
                            </p>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-2">Duración (Bloqueo)</label>
                                <select
                                    value={discontinueDuration}
                                    onChange={(e) => setDiscontinueDuration(e.target.value as any)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-rose-500"
                                >
                                    <option value="permanente">Permanente (Nunca más)</option>
                                    <option value="3">Temporal: 3 meses</option>
                                    <option value="6">Temporal: 6 meses</option>
                                    <option value="12">Temporal: 1 año</option>
                                </select>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                            <button
                                onClick={() => setDiscontinueProductId(null)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmDiscontinue}
                                disabled={isDiscontinuing}
                                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                            >
                                {isDiscontinuing ? 'Procesando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {lightbox.isOpen && (
                <MediaLightbox
                    isOpen={lightbox.isOpen}
                    media={lightbox.media}
                    initialIndex={lightbox.initialIndex}
                    onClose={() => setLightbox({ ...lightbox, isOpen: false })}
                />
            )}
        </div>
    );
};

export default ProductDemands;
