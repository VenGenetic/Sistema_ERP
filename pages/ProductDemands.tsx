import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { buildWhatsAppDemandURL, buildWhatsAppDiscontinuedURL, openWhatsApp } from '../utils/whatsapp';
import { MediaLightbox } from '../components/MediaLightbox';
import { getThumbnailUrl } from '../utils/image';
import { EditDemandModal } from '../components/EditDemandModal';
import { ShareDemandModal } from '../components/ShareDemandModal';
import { ExportDemandsModal } from '../components/ExportDemandsModal';
import {
  BadgeCheck,
  Calendar,
  CheckCheck,
  ChevronDown,
  CircleCheck,
  CircleX,
  ClipboardList,
  Columns3,
  Copy,
  Download,
  Flag,
  GripVertical,
  History,
  LayoutGrid,
  List,
  MessageSquare,
  Package,
  Pencil,
  RefreshCw,
  Rows3,
  Search,
  Share2,
  Tag,
  TimerOff,
  Trash2,
  TriangleAlert,
  User,
  Users,
  X,
} from 'lucide-react';

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
    approved_by?: string | null;
    approver_name?: string;
    approved_at?: string | null;
    notified_at?: string | null;
    order_flag?: string | null;
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
    const [flagFilter, setFlagFilter] = useState<string>('all');
    const [lightbox, setLightbox] = useState<{isOpen: boolean, media: any[], initialIndex: number}>({ isOpen: false, media: [], initialIndex: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [ticketSearchTerm, setTicketSearchTerm] = useState('');
    const [expandedProducts, setExpandedProducts] = useState<Record<number, boolean>>({});
    const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);
    const [editingDemand, setEditingDemand] = useState<ProductDemand | null>(null);
    const [sharingDemand, setSharingDemand] = useState<ProductDemand | null>(null);
    const [discontinueProductId, setDiscontinueProductId] = useState<number | null>(null);
    const [showExportModal, setShowExportModal] = useState(false);
    const [discontinueDuration, setDiscontinueDuration] = useState<'3' | '6' | '12' | 'permanente'>('permanente');
    const [isDiscontinuing, setIsDiscontinuing] = useState(false);

    // Order Flag State
    const [availableOrderFlags, setAvailableOrderFlags] = useState<string[]>([]);
    const [flagActionDemand, setFlagActionDemand] = useState<ProductDemand | null>(null);
    const [flagInputValue, setFlagInputValue] = useState('');

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

            // Client-side join with profiles to get creator and approver name
            const userIdsToFetch = Array.from(new Set([
                ...mappedData.map(d => d.created_by),
                ...mappedData.map(d => d.approved_by)
            ].filter(Boolean)));

            if (userIdsToFetch.length > 0) {
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', userIdsToFetch);

                if (!profilesError && profilesData) {
                    const profilesMap = new Map(profilesData.map(p => [p.id, p.full_name]));
                    mappedData = mappedData.map(d => ({
                        ...d,
                        creator_name: d.created_by ? (profilesMap.get(d.created_by) || 'Desconocido') : 'Sistema/Desconocido',
                        approver_name: d.approved_by ? (profilesMap.get(d.approved_by) || 'Desconocido') : undefined
                    }));
                } else {
                    mappedData = mappedData.map(d => ({
                        ...d,
                        creator_name: 'Desconocido',
                        approver_name: undefined
                    }));
                }
            } else {
                mappedData = mappedData.map(d => ({
                    ...d,
                    creator_name: 'Sistema/Desconocido',
                    approver_name: undefined
                }));
            }

            const uniqueFlags = Array.from(new Set(
                mappedData
                    .map((d: any) => d.order_flag)
                    .filter((f: any) => f && typeof f === 'string' && f.trim() !== '')
            )) as string[];
            setAvailableOrderFlags(uniqueFlags.sort());

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
    const getStockValue = (prod: any, type?: 'local' | 'importer' | 'total') => {
        if (!prod) return 0;
        const local = prod.inventory_levels ? prod.inventory_levels.reduce((acc: number, lvl: any) => acc + (lvl.current_stock || 0), 0) : 0;
        const importer = prod.importer_stock || 0;
        if (type === 'local') return local;
        if (type === 'importer') return importer;
        return local + importer;
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
            return <span className="text-danger font-medium text-xs ml-1">(Vencido)</span>;
        }
        return <span className={`font-medium text-xs ml-1 ${daysLeft <= 10 ? 'text-warning' : 'text-primary'}`}>(Vence en {daysLeft} días)</span>;
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

    const handleOpenFlagPopover = (demand: ProductDemand, e: React.MouseEvent) => {
        e.stopPropagation();
        setFlagActionDemand(demand);
        setFlagInputValue(demand.order_flag || '');
    };

    const handleSaveFlag = async () => {
        if (!flagActionDemand) return;
        const valueToSave = flagInputValue.trim();
        try {
            const { error } = await supabase
                .from('product_demands')
                .update({ order_flag: valueToSave || null })
                .eq('id', flagActionDemand.id);
            if (error) throw error;
            fetchDemands();
        } catch (error: any) {
            alert(`Error al guardar la bandera: ${error.message}`);
        } finally {
            setFlagActionDemand(null);
            setFlagInputValue('');
        }
    };

    const handleDeleteFlag = async () => {
        if (!flagActionDemand) return;
        try {
            const { error } = await supabase
                .from('product_demands')
                .update({ order_flag: null })
                .eq('id', flagActionDemand.id);
            if (error) throw error;
            fetchDemands();
        } catch (error: any) {
            alert(`Error al eliminar la bandera: ${error.message}`);
        } finally {
            setFlagActionDemand(null);
            setFlagInputValue('');
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
                .update({ 
                    is_approved: !demand.is_approved,
                    approved_by: !demand.is_approved ? user?.id : null,
                    approved_at: !demand.is_approved ? new Date().toISOString() : null
                })
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

            // Flag filter
            if (flagFilter !== 'all') {
                const hasFlag = d.order_flag && d.order_flag.trim() !== '';
                if (flagFilter === 'with_flag' && !hasFlag) return false;
                if (flagFilter === 'without_flag' && hasFlag) return false;
                if (flagFilter !== 'with_flag' && flagFilter !== 'without_flag') {
                    if (d.order_flag !== flagFilter) return false;
                }
            }

            return true;
        });

        // Ticket Search Term
        if (ticketSearchTerm) {
            const ticketId = parseInt(ticketSearchTerm.trim(), 10);
            if (!isNaN(ticketId)) {
                filtered = filtered.filter(d => d.id === ticketId);
            }
        }

        // Search Term
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            const normalizePhone = (num: string) => {
                let cleaned = num.replace(/\D/g, '');
                if (cleaned.startsWith('593')) cleaned = cleaned.substring(3);
                if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
                return cleaned;
            };
            const normalizedTerm = normalizePhone(searchTerm);

            filtered = filtered.filter(d => {
                if (d.phone_number) {
                    if (d.phone_number.toLowerCase().includes(lowerTerm)) return true;
                    if (normalizedTerm.length > 0) {
                        const normalizedDb = normalizePhone(d.phone_number);
                        if (normalizedDb.includes(normalizedTerm)) return true;
                    }
                }
                return (
                    (d.customer_name && d.customer_name.toLowerCase().includes(lowerTerm)) ||
                    (d.product?.name && d.product.name.toLowerCase().includes(lowerTerm)) ||
                    (d.product?.sku && d.product.sku.toLowerCase().includes(lowerTerm))
                );
            });
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
    }, [demands, statusFilter, stockFilter, flagFilter, searchTerm, ticketSearchTerm, sortBy, viewType]);

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
    const OrderFlag = ({ demand }: { demand: ProductDemand }) => (
        <button
            onClick={(e) => handleOpenFlagPopover(demand, e)}
            className={`flex items-center justify-center px-1.5 py-0.5 rounded-lg transition-colors border ${ demand.order_flag ? 'border-primary/20 text-primary-soft-fg bg-primary-soft hover:bg-primary-soft dark:hover:bg-primary/50' : 'border-transparent text-fg-subtle hover:text-slate-600 hover:bg-surface-hover dark:hover:text-slate-300 dark:hover:bg-slate-800' }`}
            title={demand.order_flag ? `Orden: ${demand.order_flag}` : 'Agregar Bandera/Orden'}
        >
            <Flag size={14} aria-hidden="true" />
            {demand.order_flag && <span className="text-2xs font-bold ml-1">{demand.order_flag}</span>}
        </button>
    );

    const StatusBadge = ({ status }: { status: string }) => {
        if (status === 'pending_stock') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-warning-soft text-warning-soft-fg border border-warning/20"><span className="w-1.5 h-1.5 bg-warning rounded-full"></span>Esperando Stock</span>;
        if (status === 'stock_available') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-success-soft text-success-soft-fg border border-success/20"><CircleCheck size={14} aria-hidden="true" />Listo para Notificar</span>;
        if (status === 'notified') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-soft text-primary-soft-fg border border-primary/20"><CheckCheck size={14} aria-hidden="true" />Notificado</span>;
        if (status === 'discontinued') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-danger-soft text-danger-soft-fg border border-danger/20"><TriangleAlert size={14} aria-hidden="true" />Descontinuado</span>;
        if (status === 'expired') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-danger-soft text-danger-soft-fg border border-danger/20"><TimerOff size={14} aria-hidden="true" />Vencido</span>;
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-fg dark:bg-slate-800 border border-subtle"><CircleX size={14} aria-hidden="true" />Cancelado</span>;
    };

    const ApprovedToggle = ({ demand }: { demand: ProductDemand }) => {
        return (
            <div className="flex items-center gap-2 mt-2">
                <button
                    onClick={(e) => handleToggleApproved(demand, e)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${ demand.is_approved ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700' }`}
                    role="switch"
                    aria-checked={demand.is_approved}
                >
                    <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${ demand.is_approved ? 'translate-x-4' : 'translate-x-0' }`}
                    />
                </button>
                <span className={`text-xs font-medium ${demand.is_approved ? 'text-primary dark:text-primary' : 'text-slate-500'}`}>
                    {demand.is_approved ? 'Aprobado en espera' : 'No aprobado'}
                </span>
            </div>
        );
    };

    const PhoneDisplay = ({ phone }: { phone: string }) => (
        <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-mono font-bold text-fg">{phone}</span>
            <button onClick={(e) => handleCopyPhone(phone, e)} className="p-1 text-fg-subtle hover:text-primary hover:bg-primary-soft rounded transition-colors" title="Copiar Teléfono">
                <Copy size={14} aria-hidden="true" />
            </button>
        </div>
    );

    const StockDisplay = ({ prod }: { prod: any }) => {
        if (!prod) return <span className="text-xs text-fg-subtle italic">Sin Stock</span>;
        
        const localStock = prod.inventory_levels ? prod.inventory_levels.reduce((acc: number, lvl: any) => acc + (lvl.current_stock || 0), 0) : 0;
        const importerStock = prod.importer_stock || 0;
        
        return (
            <div className="flex flex-col gap-0.5 text-[11px] mt-1 bg-surface-2 p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-left min-w-[120px]">
                <span className="flex items-center gap-1.5 justify-between">
                    <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                        <span className="text-fg-muted">Local:</span>
                    </span>
                    <span className={`font-bold ${localStock > 0 ? 'text-primary dark:text-primary' : 'text-slate-400'}`}>
                        {localStock}
                    </span>
                </span>
                <span className="flex items-center gap-1.5 justify-between">
                    <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                        <span className="text-fg-muted">Impo:</span>
                    </span>
                    <span className={`font-bold ${importerStock > 0 ? 'text-success dark:text-success' : 'text-slate-400'}`}>
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
            <div className="flex flex-col gap-0.5 text-[11px] mt-1 bg-primary-soft p-2 rounded-lg border border-primary/20 text-left min-w-[120px]">
                {costWithVat != null && (
                    <span className="flex items-center gap-1.5 justify-between">
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-warning"></span>
                            <span className="text-fg-muted">Costo c/IVA:</span>
                        </span>
                        <span className="font-bold text-warning">
                            ${costWithVat.toFixed(2)}
                        </span>
                    </span>
                )}
                {pvp != null && (
                    <span className="flex items-center gap-1.5 justify-between">
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                            <span className="text-fg-muted">PVP:</span>
                        </span>
                        <span className="font-bold text-primary">
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
                        <button onClick={(e) => handleNotify(demand, e)} className={`flex items-center gap-1.5 px-3 py-1.5 justify-center rounded-lg text-sm font-semibold text-white transition-colors shadow-sm ${isReady ? 'bg-success hover:bg-success' : 'bg-primary hover:bg-primary'}`}>
                            <MessageSquare size={16} aria-hidden="true" /> Notificar
                        </button>
                        <div className="flex items-center justify-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); setEditingDemand(demand); }} className="text-xs text-fg-muted hover:text-primary transition-colors flex items-center gap-1" title="Editar">
                                <Pencil size={14} aria-hidden="true" /> Editar
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setSharingDemand(demand); }} className="text-xs text-fg-muted hover:text-primary transition-colors flex items-center gap-1" title="Compartir">
                                <Share2 size={14} aria-hidden="true" /> Compartir
                            </button>
                            {!isReady && (
                                <button onClick={(e) => handleMarkAvailable(demand, e)} className="text-xs text-fg-muted hover:text-success transition-colors">Marcar Disp.</button>
                            )}
                        </div>
                        <button onClick={(e) => handleMarkNotifiedDirectly(demand, e)} className="text-xs text-fg-muted hover:text-primary transition-colors">Marcar Notificado</button>
                        <button onClick={(e) => handleStatusChange(demand.id, 'expired')} className="text-xs text-danger hover:text-danger transition-colors">Marcar Vencido</button>
                        <button onClick={(e) => handleCancel(demand, e)} className="text-xs text-danger hover:text-danger transition-colors">Cancelar</button>
                    </>
                ) : isDiscontinued ? (
                    <>
                        <button onClick={(e) => handleNotifyDiscontinued(demand, e)} className="flex items-center gap-1.5 px-3 py-1.5 justify-center rounded-lg text-sm font-semibold text-white transition-colors shadow-sm bg-danger hover:bg-danger">
                            <MessageSquare size={16} aria-hidden="true" /> Notificar Descontinuado
                        </button>
                        <div className="flex items-center justify-center gap-2">
                            <button onClick={(e) => handleMarkNotifiedDirectly(demand, e)} className="text-xs text-fg-muted hover:text-primary transition-colors">Archivar/Notificado</button>
                            <button onClick={(e) => handleCancel(demand, e)} className="text-xs text-danger hover:text-danger transition-colors">Cancelar</button>
                        </div>
                    </>
                ) : isExpired ? (
                    <>
                        <div className="flex flex-col gap-2 justify-center items-center">
                            <span className="text-xs text-fg-subtle">Expiró sin stock</span>
                            <button onClick={(e) => handleDelete(demand, e)} className="p-1.5 text-fg-subtle hover:text-danger hover:bg-danger-soft rounded-lg transition-colors mx-auto" title="Eliminar registro">
                                <Trash2 size={18} aria-hidden="true" />
                            </button>
                        </div>
                    </>
                ) : (
                    <button onClick={(e) => handleDelete(demand, e)} className="p-1.5 text-fg-subtle hover:text-danger hover:bg-danger-soft rounded-lg transition-colors mx-auto" title="Eliminar registro">
                        <Trash2 size={18} aria-hidden="true" />
                    </button>
                )}
            </div>
        );
    };

    // Render Views
    const renderTableView = () => (
        <div className="bg-surface border border-subtle rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-surface-2 border-b border-subtle">
                            <th className="px-4 py-2.5 text-xs font-semibold text-fg-muted uppercase tracking-wider">Cliente / Teléfono</th>
                            <th className="px-4 py-2.5 text-xs font-semibold text-fg-muted uppercase tracking-wider">Producto (SKU)</th>
                            <th className="px-4 py-2.5 text-xs font-semibold text-fg-muted uppercase tracking-wider">Estado</th>
                            <th className="px-4 py-2.5 text-xs font-semibold text-fg-muted uppercase tracking-wider">Fecha / Stock</th>
                            <th className="px-4 py-2.5 text-center text-xs font-semibold text-fg-muted uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                        {filteredAndSortedDemands.map(demand => {
                            const totalStock = getStockValue(demand.product);
                            const isReady = demand.status === 'stock_available';
                            return (
                                <tr key={demand.id} className={`transition-colors ${isReady ? 'bg-success-soft/30 dark:bg-success/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                    <td className="px-4 py-3 align-top">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-fg">{demand.customer_name || 'Sin Nombre'}</span>
                                            <div className="flex items-center gap-2 mt-1 mb-1">
                                                <span className="text-2xs font-mono bg-primary-soft text-primary-soft-fg px-2 py-0.5 rounded-full font-bold w-fit">Ticket #{demand.id}</span>
                                                <OrderFlag demand={demand} />
                                            </div>
                                            <PhoneDisplay phone={demand.phone_number} />
                                            {demand.notes && <span className="text-xs text-fg-subtle mt-1 italic max-w-[200px] truncate" title={demand.notes}>{demand.notes}</span>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-top max-w-[250px]">
                                        {demand.product ? (
                                            <div className="flex items-start gap-2">
                                                {demand.product?.image_url && (
                                                    <img
                                                        src={getThumbnailUrl(demand.product.image_url, 60, 60)}
                                                        alt=""
                                                        loading="lazy"
                                                        className="h-12 w-12 object-cover rounded cursor-pointer"
                                                        onClick={() => handleOpenLightboxDemand(demand)}
                                                    />
                                                )}
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-fg line-clamp-2" title={demand.product.name}>{demand.product.name}</span>
                                                    <span className="text-sm text-fg-muted font-mono">{demand.product.sku}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-fg-subtle italic">Producto no encontrado</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="flex flex-col gap-2">
                                            <StatusBadge status={demand.status} />
                                            {demand.status === 'pending_stock' && <ApprovedToggle demand={demand} />}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="flex flex-col gap-1.5 text-sm">
                                            <span className="text-fg-muted font-medium">
                                                Reg: {new Date(demand.created_at).toLocaleDateString()} {new Date(demand.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                                                <ExpirationDisplay createdAt={demand.created_at} status={demand.status} />
                                            </span>
                                            <span className="text-xs text-fg-subtle flex flex-col gap-1 mt-1">
                                                <span className="flex items-center gap-1">
                                                    <User size={14} aria-hidden="true" />
                                                    Creado por {demand.creator_name || 'Desconocido'}
                                                </span>
                                                {demand.is_approved && (
                                                    <span className="flex items-center gap-1 text-primary">
                                                        <BadgeCheck size={14} aria-hidden="true" />
                                                        Aprobado por {demand.approver_name || 'Desconocido'} {demand.approved_at && `el ${new Date(demand.approved_at).toLocaleDateString()}`}
                                                    </span>
                                                )}
                                            </span>
                                            <StockDisplay prod={demand.product} />
                                            <PriceDisplay prod={demand.product} />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center align-top">
                                        <ActionButtons demand={demand} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filteredAndSortedDemands.length === 0 && (
                    <div className="p-12 text-center text-fg-muted">No se encontraron solicitudes.</div>
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
                    <div key={demand.id} className={`bg-surface p-5 rounded-xl border ${isReady ? 'border-success/20 bg-success-soft/20' : 'border-slate-200 dark:border-slate-800'} shadow-sm flex flex-col gap-4`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-fg">{demand.customer_name || 'Cliente Sin Nombre'}</h3>
                                <div className="flex items-center gap-2 mt-1 mb-1">
                                    <span className="text-2xs font-mono bg-primary-soft text-primary-soft-fg px-2 py-0.5 rounded-full font-bold w-fit inline-block">Ticket #{demand.id}</span>
                                    <OrderFlag demand={demand} />
                                </div>
                                <PhoneDisplay phone={demand.phone_number} />
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <StatusBadge status={demand.status} />
                                {demand.status === 'pending_stock' && <ApprovedToggle demand={demand} />}
                            </div>
                        </div>
                        <div className="bg-surface-2 p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex items-start gap-3">
                            {demand.product?.image_url && (
                                <img
                                    src={getThumbnailUrl(demand.product.image_url, 60, 60)}
                                    alt=""
                                    loading="lazy"
                                    className="h-12 w-12 object-cover rounded cursor-pointer mt-1 flex-shrink-0"
                                    onClick={() => handleOpenLightboxDemand(demand)}
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <span className="block text-xs text-fg-muted mb-1">Producto Requerido:</span>
                                <span className="font-medium text-sm text-fg line-clamp-2" title={demand.product?.name}>{demand.product?.name || 'Producto Desconocido'}</span>
                                <div className="flex justify-between items-start mt-2">
                                    <span className="text-xs font-mono text-fg-muted">{demand.product?.sku}</span>
                                    <StockDisplay prod={demand.product} />
                                </div>
                                <PriceDisplay prod={demand.product} />
                            </div>
                        </div>
                        <div className="flex justify-between items-end mt-auto pt-2">
                            <div className="flex flex-col gap-0.5 text-xs text-fg-subtle">
                                <span>
                                    Reg: {new Date(demand.created_at).toLocaleDateString()} {new Date(demand.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                                    <ExpirationDisplay createdAt={demand.created_at} status={demand.status} />
                                </span>
                                <div className="flex flex-col gap-1 mt-1">
                                    <span className="flex items-center gap-1 font-medium text-fg-muted">
                                        <User size={14} aria-hidden="true" />
                                        Creado por {demand.creator_name || 'Desconocido'}
                                    </span>
                                    {demand.is_approved && (
                                        <span className="flex items-center gap-1 font-medium text-primary">
                                            <BadgeCheck size={14} aria-hidden="true" />
                                            Aprobado por {demand.approver_name || 'Desconocido'} {demand.approved_at && `el ${new Date(demand.approved_at).toLocaleDateString()}`}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="w-32"><ActionButtons demand={demand} /></div>
                        </div>
                    </div>
                );
            })}
            {filteredAndSortedDemands.length === 0 && (
                <div className="col-span-full p-12 text-center text-fg-muted">No se encontraron solicitudes.</div>
            )}
        </div>
    );

    const renderKanbanView = () => {
        const columns = [
            { id: 'pending_stock', title: 'Esperando Stock', color: 'bg-warning-soft dark:bg-warning/10', hoverColor: 'bg-warning-soft/80 dark:bg-warning/20', header: 'border-warning/20 dark:border-warning', text: 'text-warning dark:text-warning' },
            { id: 'stock_available', title: 'Stock Disponible', color: 'bg-success-soft dark:bg-success/10', hoverColor: 'bg-success-soft/80 dark:bg-success/20', header: 'border-success/20 dark:border-success', text: 'text-success dark:text-success' },
            { id: 'discontinued', title: 'Descontinuados por Notificar', color: 'bg-danger-soft dark:bg-danger/10', hoverColor: 'bg-danger-soft/80 dark:bg-danger/20', header: 'border-danger/20 dark:border-danger', text: 'text-danger dark:text-danger' },
            { id: 'expired', title: 'Vencidos', color: 'bg-danger-soft dark:bg-danger/10', hoverColor: 'bg-danger-soft/80 dark:bg-danger/20', header: 'border-danger/20 dark:border-danger', text: 'text-danger dark:text-danger' },
            { id: 'notified', title: 'Notificados', color: 'bg-primary-soft dark:bg-primary/10', hoverColor: 'bg-primary-soft/80 dark:bg-primary/20', header: 'border-primary/20 dark:border-primary', text: 'text-primary dark:text-primary' },
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
                            className={`flex flex-col w-80 min-w-[320px] rounded-xl border transition-all duration-200 overflow-hidden ${isOver ? `${col.hoverColor} border-dashed border-primary scale-[1.01] shadow-md` : `${col.color} border-slate-200 dark:border-subtle`}`}
                        >
                            <div className={`p-4 border-b-2 bg-white/50 dark:bg-black/20 ${col.header}`}>
                                <h3 className={`font-bold text-sm flex items-center justify-between ${col.text}`}>
                                    {col.title}
                                    <span className="bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded-full text-xs">{colItems.length}</span>
                                </h3>
                            </div>
                            <div className="p-3 flex flex-col gap-3 max-h-[70dvh] overflow-y-auto">
                                {colItems.map(demand => (
                                    <div
                                        key={demand.id}
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('text/plain', String(demand.id));
                                            e.dataTransfer.effectAllowed = 'move';
                                        }}
                                        className="bg-surface p-4 rounded-lg shadow-sm border border-subtle flex flex-col gap-3 cursor-grab active:cursor-grabbing hover:border-slate-400 dark:hover:border-slate-500 transition-all"
                                    >
                                        <div className="flex justify-between items-start gap-1">
                                            <div>
                                                <span className="font-semibold text-fg block">{demand.customer_name || 'Sin Nombre'}</span>
                                                <div className="flex items-center gap-2 mt-1 mb-1">
                                                    <span className="text-2xs font-mono bg-primary-soft text-primary-soft-fg px-2 py-0.5 rounded-full font-bold w-fit inline-block">Ticket #{demand.id}</span>
                                                    <OrderFlag demand={demand} />
                                                </div>
                                                <PhoneDisplay phone={demand.phone_number} />
                                            </div>
                                            <div className="p-1 text-fg-subtle">
                                                <GripVertical size={18} aria-hidden="true" />
                                            </div>
                                        </div>
                                        <div className="text-xs text-fg-muted flex items-start gap-2">
                                            {demand.product?.image_url && (
                                                <img
                                                    src={getThumbnailUrl(demand.product.image_url, 48, 48)}
                                                    alt=""
                                                    loading="lazy"
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
                                        <div className="text-2xs text-fg-subtle flex flex-col gap-0.5 mt-1 border-t border-slate-100 dark:border-slate-800 pt-1">
                                            <span className="flex items-center gap-1">
                                                <Calendar size={11} aria-hidden="true" />
                                                {new Date(demand.created_at).toLocaleDateString()} {new Date(demand.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                                                <ExpirationDisplay createdAt={demand.created_at} status={demand.status} />
                                            </span>
                                            <div className="flex flex-col gap-0.5 mt-0.5">
                                                <span className="flex items-center gap-1 font-medium text-fg-muted">
                                                    <User size={11} aria-hidden="true" />
                                                    Creado por {demand.creator_name || 'Desconocido'}
                                                </span>
                                                {demand.is_approved && (
                                                    <span className="flex items-center gap-1 font-medium text-primary">
                                                        <BadgeCheck size={11} aria-hidden="true" />
                                                        Aprobado por {demand.approver_name || 'Desconocido'} {demand.approved_at && `el ${new Date(demand.approved_at).toLocaleDateString()}`}
                                                    </span>
                                                )}
                                            </div>
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
                                    <div className="py-8 text-center text-fg-subtle text-xs">Arrastra aquí una solicitud</div>
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
                        <div key={group.productId} className="bg-surface rounded-xl border border-subtle overflow-hidden shadow-sm">
                            <div onClick={() => toggleProductExpand(group.productId)} className="p-4 flex items-center justify-between cursor-pointer hover:bg-surface-hover transition-colors">
                                <div className="flex items-center gap-4">
                                    <ChevronDown size={18} className="transition-transform ${isExpanded ? 'rotate-180' : ''}" aria-hidden="true" />
                                    {group.product?.image_url && (
                                        <img
                                            src={getThumbnailUrl(group.product.image_url, 60, 60)}
                                            alt=""
                                            loading="lazy"
                                            className="h-12 w-12 object-cover rounded cursor-pointer flex-shrink-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenLightboxDemand({ product: group.product } as any);
                                            }}
                                        />
                                    )}
                                    <div>
                                        <h3 className="font-bold text-fg">{prodName}</h3>
                                        <span className="text-sm font-mono text-fg-muted">{prodSku}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 md:gap-6">
                                    <div className="text-right hidden md:block">
                                        <StockDisplay prod={group.product} />
                                    </div>
                                    <div className="bg-primary-soft text-primary-soft-fg px-3 py-1.5 rounded-lg flex items-center gap-2">
                                        <Users size={18} aria-hidden="true" />
                                        <span className="font-bold hidden sm:inline">{group.demands.length} en espera</span>
                                        <span className="font-bold sm:hidden">{group.demands.length}</span>
                                    </div>
                                    {!group.product?.is_discontinued ? (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDiscontinueProductId(group.productId);
                                            }}
                                            className="bg-danger-soft text-danger-soft-fg hover:bg-danger px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-colors border border-danger/20"
                                        >
                                            <TriangleAlert size={16} aria-hidden="true" />
                                            <span className="hidden sm:inline">Descontinuar</span>
                                        </button>
                                    ) : (
                                        <div className="bg-danger text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold text-xs shadow-sm">
                                            <TriangleAlert size={16} aria-hidden="true" />
                                            Descontinuado
                                        </div>
                                    )}
                                </div>
                            </div>
                            {isExpanded && (
                                <div className="bg-surface-2 border-t border-subtle p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {group.demands.map(demand => (
                                            <div key={demand.id} className="bg-surface p-4 rounded-lg border border-subtle shadow-sm flex flex-col gap-3">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <span className="font-semibold text-fg block">{demand.customer_name || 'Sin Nombre'}</span>
                                                        <div className="flex items-center gap-2 mt-1 mb-1">
                                                            <span className="text-2xs font-mono bg-primary-soft text-primary-soft-fg px-2 py-0.5 rounded-full font-bold w-fit inline-block">Ticket #{demand.id}</span>
                                                            <OrderFlag demand={demand} />
                                                        </div>
                                                        <PhoneDisplay phone={demand.phone_number} />
                                                    </div>
                                                    <StatusBadge status={demand.status} />
                                                </div>
                                                <div className="text-xs text-fg-subtle flex flex-col gap-0.5">
                                                    <span>Reg: {new Date(demand.created_at).toLocaleDateString()} {new Date(demand.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}</span>
                                                    <div className="flex flex-col gap-0.5 mt-0.5">
                                                        <span className="flex items-center gap-1 font-medium text-fg-muted">
                                                            <User size={14} aria-hidden="true" />
                                                            Creado por {demand.creator_name || 'Desconocido'}
                                                        </span>
                                                        {demand.is_approved && (
                                                            <span className="flex items-center gap-1 font-medium text-primary">
                                                                <BadgeCheck size={14} aria-hidden="true" />
                                                                Aprobado por {demand.approver_name || 'Desconocido'} {demand.approved_at && `el ${new Date(demand.approved_at).toLocaleDateString()}`}
                                                            </span>
                                                        )}
                                                    </div>
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
                    <div className="p-12 text-center text-fg-muted bg-surface rounded-xl border border-subtle">No se encontraron productos en la vista agrupada.</div>
                )}
            </div>
        );
    };

    return (
        <div className="p-6 md:p-8 max-w-[1600px] mx-auto flex flex-col gap-6">
            {/* Header & Title */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold dark:text-white tracking-tight">Demanda de Stock</h1>
                    <p className="text-fg-muted mt-1">Gestión de la lista de espera de clientes para productos agotados.</p>
                </div>
                <button
                    onClick={fetchDemands}
                    className="flex items-center gap-2 px-4 py-2 bg-surface border border-subtle rounded-lg hover:bg-surface-hover transition-colors shadow-sm"
                >
                    <RefreshCw size={18} className="${loading ? 'animate-spin' : ''}" aria-hidden="true" />
                    Actualizar
                </button>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div onClick={() => { setStatusFilter('all'); }} className={`p-4 rounded-xl border cursor-pointer transition-all ${statusFilter === 'all' ? 'bg-primary-soft border-primary/20 dark:border-primary' : 'bg-white dark:bg-[#0c1117] border-subtle hover:border-primary/20'}`}>
                    <div className="flex items-center gap-3 text-primary mb-2">
                        <ClipboardList size={24} aria-hidden="true" />
                        <span className="font-semibold text-sm">Total Solicitudes</span>
                    </div>
                    <span className="text-3xl font-bold text-fg">{stats.total}</span>
                </div>
                
                <div onClick={() => { setStatusFilter('active'); }} className={`p-4 rounded-xl border cursor-pointer transition-all ${statusFilter === 'active' ? 'bg-warning-soft border-warning/20 dark:border-warning' : 'bg-white dark:bg-[#0c1117] border-subtle hover:border-warning/20'}`}>
                    <div className="flex items-center gap-3 text-warning mb-2">
                        <ClipboardList size={24} aria-hidden="true" />
                        <span className="font-semibold text-sm">Cola Activa</span>
                    </div>
                    <span className="text-3xl font-bold text-fg">{stats.active}</span>
                </div>

                <div onClick={() => { setStatusFilter('inactive'); }} className={`p-4 rounded-xl border cursor-pointer transition-all ${statusFilter === 'inactive' ? 'bg-slate-100 border-slate-400 dark:bg-slate-800 dark:border-slate-600' : 'bg-white dark:bg-[#0c1117] border-subtle hover:border-slate-400'}`}>
                    <div className="flex items-center gap-3 text-fg-muted mb-2">
                        <History size={24} aria-hidden="true" />
                        <span className="font-semibold text-sm">Historial</span>
                    </div>
                    <span className="text-3xl font-bold text-fg">{stats.inactive}</span>
                </div>

                <div onClick={() => { setStatusFilter('stock_available'); }} className={`p-4 rounded-xl border cursor-pointer transition-all ${statusFilter === 'stock_available' ? 'bg-success-soft border-success/20 dark:border-success' : 'bg-white dark:bg-[#0c1117] border-subtle hover:border-success/20'}`}>
                    <div className="flex items-center gap-3 text-success mb-2">
                        <Package size={24} aria-hidden="true" />
                        <span className="font-semibold text-sm">Listos para Notificar</span>
                    </div>
                    <span className="text-3xl font-bold text-fg">{stats.readyToNotify}</span>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col 2xl:flex-row justify-between items-start 2xl:items-center gap-4 bg-surface p-4 rounded-xl border border-subtle shadow-sm">
                
                {/* Vistas */}
                <div className="flex items-center gap-3 w-full 2xl:w-auto">
                    <div className="flex bg-surface-3 p-1 rounded-lg overflow-x-auto flex-1 2xl:flex-none">
                        <button onClick={() => setViewType('table')} className={`flex-1 2xl:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewType === 'table' ? 'bg-white dark:bg-slate-600 text-fg shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}>
                            <Rows3 size={18} aria-hidden="true" /> Tabla
                        </button>
                        <button onClick={() => setViewType('list')} className={`flex-1 2xl:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewType === 'list' ? 'bg-white dark:bg-slate-600 text-fg shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}>
                            <List size={18} aria-hidden="true" /> Lista
                        </button>
                        <button onClick={() => setViewType('kanban')} className={`flex-1 2xl:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewType === 'kanban' ? 'bg-white dark:bg-slate-600 text-fg shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}>
                            <Columns3 size={18} aria-hidden="true" /> Kanban
                        </button>
                        <button onClick={() => setViewType('grouped')} className={`flex-1 2xl:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewType === 'grouped' ? 'bg-white dark:bg-slate-600 text-fg shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}>
                            <LayoutGrid size={18} aria-hidden="true" /> Agrupado
                        </button>
                    </div>

                    <button
                        onClick={() => setShowExportModal(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-surface border border-subtle rounded-lg text-fg text-sm font-medium hover:bg-surface-hover transition-colors shadow-sm"
                        title="Exportar demandas a CSV con filtros"
                    >
                        <Download size={18} className="text-success" aria-hidden="true" />
                        <span className="hidden sm:inline">Exportar CSV</span>
                    </button>
                </div>

                {/* Filtros, Ordenar y Buscar */}
                <div className="flex flex-col md:flex-row items-center gap-3 w-full 2xl:w-auto">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="w-full md:w-auto bg-surface-2 border border-subtle rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
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
                        className="w-full md:w-auto bg-surface-2 border border-subtle rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                    >
                        <option value="all">Stock: Todos</option>
                        <option value="importer_only">Con stock en la importadora y no en local</option>
                        <option value="local_only">Con stock en local y no importadora</option>
                        <option value="no_stock">Sin stock completamente</option>
                        <option value="approved_only">Solo pedidos aprobados en espera</option>
                    </select>

                    <select
                        value={flagFilter}
                        onChange={(e) => setFlagFilter(e.target.value)}
                        className="w-full md:w-auto bg-surface-2 border border-subtle rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                    >
                        <option value="all">Bandera: Todas</option>
                        <option value="with_flag">Con bandera</option>
                        <option value="without_flag">Sin bandera</option>
                        {availableOrderFlags.length > 0 && <optgroup label="Órdenes Específicas">
                            {availableOrderFlags.map(f => (
                                <option key={f} value={f}>Orden: {f}</option>
                            ))}
                        </optgroup>}
                    </select>

                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="w-full md:w-auto bg-surface-2 border border-subtle rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                    >
                        <option value="date_desc">Ordenar: Más reciente</option>
                        <option value="date_asc">Ordenar: Más antiguo</option>
                        <option value="product_asc">Producto (A-Z)</option>
                        <option value="customer_asc">Cliente (A-Z)</option>
                        <option value="stock_desc">Stock (Mayor a menor)</option>
                    </select>

                    <div className="relative w-full md:w-48">
                        <Tag size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
                        <input
                            type="text"
                            placeholder="N° Ticket..."
                            value={ticketSearchTerm}
                            onChange={(e) => setTicketSearchTerm(e.target.value)}
                            className="w-full bg-surface-2 border border-subtle rounded-lg py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white transition-all"
                        />
                    </div>

                    <div className="relative w-full md:w-64">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
                        <input
                            type="text"
                            placeholder="Buscar cliente, teléfono..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-surface-2 border border-subtle rounded-lg py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white transition-all"
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

            {flagActionDemand && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-surface rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-subtle flex items-center justify-between">
                            <h3 className="font-bold text-fg flex items-center gap-2">
                                <Flag size={18} className="text-primary" aria-hidden="true" />
                                Asignar Orden
                            </h3>
                            <button onClick={() => setFlagActionDemand(null)} className="text-fg-subtle hover:text-slate-600 transition-colors">
                                <X size={20} aria-hidden="true" />
                            </button>
                        </div>
                        <div className="p-6 flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-fg-muted mb-2">Ingresar Número de Orden</label>
                                <input
                                    type="text"
                                    value={flagInputValue}
                                    onChange={(e) => setFlagInputValue(e.target.value)}
                                    placeholder="Ej: ORD-12345"
                                    className="w-full px-3 py-2 bg-surface-2 border border-strong rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary text-fg"
                                />
                            </div>
                            
                            {availableOrderFlags.length > 0 && (
                                <div>
                                    <label className="block text-xs font-semibold text-fg-muted mb-2">O seleccionar existente:</label>
                                    <select
                                        onChange={(e) => {
                                            if (e.target.value) setFlagInputValue(e.target.value);
                                        }}
                                        value=""
                                        className="w-full px-3 py-2 bg-surface-2 border border-strong rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary text-fg"
                                    >
                                        <option value="">Seleccionar una orden...</option>
                                        {availableOrderFlags.map(flag => (
                                            <option key={flag} value={flag}>{flag}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-subtle bg-surface-2 flex justify-between gap-3">
                            <button
                                onClick={handleDeleteFlag}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-danger hover:bg-danger-soft transition-colors"
                            >
                                Eliminar Bandera
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setFlagActionDemand(null)}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-fg-muted hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveFlag}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary text-white rounded-lg text-sm font-bold transition-colors"
                                >
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {discontinueProductId && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-surface rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-subtle bg-danger-soft flex items-center gap-3">
                            <TriangleAlert size={18} className="text-danger" aria-hidden="true" />
                            <h3 className="font-bold text-fg">Descontinuar Producto</h3>
                        </div>
                        <div className="p-6 flex flex-col gap-4">
                            <p className="text-sm text-fg-muted">
                                Las solicitudes en espera pasarán automáticamente al estado de "Descontinuado" para que procedas a notificarlas.
                            </p>
                            <div>
                                <label className="block text-xs font-semibold text-fg-muted mb-2">Duración (Bloqueo)</label>
                                <select
                                    value={discontinueDuration}
                                    onChange={(e) => setDiscontinueDuration(e.target.value as any)}
                                    className="w-full px-3 py-2 bg-surface-2 border border-strong rounded-lg text-sm outline-none focus:ring-2 focus:ring-danger"
                                >
                                    <option value="permanente">Permanente (Nunca más)</option>
                                    <option value="3">Temporal: 3 meses</option>
                                    <option value="6">Temporal: 6 meses</option>
                                    <option value="12">Temporal: 1 año</option>
                                </select>
                            </div>
                        </div>
                        <div className="p-4 border-t border-subtle bg-surface-2 flex justify-end gap-3">
                            <button
                                onClick={() => setDiscontinueProductId(null)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-fg-muted hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmDiscontinue}
                                disabled={isDiscontinuing}
                                className="flex items-center gap-2 px-4 py-2 bg-danger hover:bg-danger text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
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
