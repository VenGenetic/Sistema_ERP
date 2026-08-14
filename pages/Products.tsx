import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ProductModal } from '../components/ProductModal';
import { ProductGroupModal } from '../components/ProductGroupModal';
import { CatalogImportWizard } from '../components/CatalogImportWizard';
import { BulkEditModal } from '../components/BulkEditModal';
import { BulkMediaUploadModal } from '../components/BulkMediaUploadModal';
import { VideoThumbnail } from '../components/VideoThumbnail';
import { MediaLightbox } from '../components/MediaLightbox';
import { QuickTagAssignModal } from '../components/QuickTagAssignModal';
import { getThumbnailUrl } from '../utils/image';
import { ProductDemandModal } from '../components/ProductDemandModal';
import { SourcingQuickEditModal } from '../components/SourcingQuickEditModal';
import { isProductDiscontinued } from '../utils/discontinuedHelper';
import { ProductLabelModal } from '../components/ProductLabelModal';
import { InventoryGroupSelectModal } from '../components/InventoryGroupSelectModal';
import { PrintQueuePreviewModal } from '../components/PrintQueuePreviewModal';
import { addToQueue, getPrintQueue, clearQueue, removeFromQueue, updateQueueItemQty, getQueueTotalLabels, getQueuePageCount, downloadQueuePDF, PrintQueueItem } from '../utils/mobilePrintQueue';
import { shareProductCard } from '../utils/productShareCard';
import { ProformaPanel } from '../components/ProformaPanel';
import { useProformaStore } from '../store/useProformaStore';
import { cn, badge, button, input, focusRing, skeleton } from '../components/ui/styles';
import {
  ArrowDown,
  ArrowUp,
  Ban,
  BellRing,
  Boxes,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CirclePlay,
  Copy,
  EllipsisVertical,
  Eye,
  FilePen,
  FileText,
  FilterX,
  FolderArchive,
  FolderUp,
  Hourglass,
  Image as ImageIcon,
  ImageDown,
  ImageOff,
  LayoutGrid,
  Link as LinkIcon,
  ListChecks,
  ListPlus,
  Loader2,
  Package,
  Pencil,
  Play,
  Plus,
  Printer,
  RefreshCw,
  Rows3,
  ScanBarcode,
  Search,
  SearchX,
  Sparkles,
  Telescope,
  Trash,
  Trash2,
  TriangleAlert,
  Video,
  X,
} from 'lucide-react';

/**
 * Marcador para imágenes que fallan al cargar.
 *
 * Se inyecta con innerHTML desde el `onError` del <img>, así que no puede ser
 * JSX. Es el mismo trazo que Lucide (2px, extremos redondeados) y hereda el
 * color del contenedor vía `currentColor`, de modo que respeta el tema.
 */
const PLACEHOLDER_IMAGE_SVG = (size: number) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;

/**
 * Formato de moneda del catálogo.
 *
 * `toFixed(2)` dejaba "1234.50" sin separador de miles: en costos de repuestos
 * importados eso se lee mal de un vistazo. `Intl` agrupa y coloca el símbolo
 * según la configuración regional del negocio (Ecuador, USD).
 */
const currencyFormatter = new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const money = (value: number | null | undefined) => currencyFormatter.format(value || 0);

/** Escapa un término del usuario para poder meterlo en un RegExp sin romperlo. */
const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Marca dentro del nombre los fragmentos que coinciden con la búsqueda.
 *
 * Las descripciones de repuestos son largas —medidas, años de aplicación,
 * códigos OEM, compatibilidades— así que sin esta marca hay que leer el
 * renglón entero para entender por qué apareció en los resultados. Con ella,
 * el ojo salta directo a la coincidencia.
 *
 * Se ignoran los términos de exclusión (los que empiezan con "-") y los de una
 * sola letra, que marcarían medio texto y añadirían ruido en vez de quitarlo.
 */
const highlightMatches = (text: string, terms: string[]): React.ReactNode => {
    if (!text) return text;

    const needles = Array.from(new Set(
        terms
            .map(t => (t || '').trim())
            .filter(t => t.length > 1 && !t.startsWith('-'))
            .map(escapeRegExp)
    ));

    if (needles.length === 0) return text;

    // Un solo grupo de captura ⇒ en el array resultante los fragmentos
    // coincidentes quedan siempre en los índices impares.
    const parts = text.split(new RegExp(`(${needles.join('|')})`, 'gi'));
    if (parts.length === 1) return text;

    return parts.map((part, i) =>
        i % 2 === 1
            ? <mark key={i} className="bg-warning-soft text-warning-soft-fg rounded-sm px-0.5 font-semibold">{part}</mark>
            : <React.Fragment key={i}>{part}</React.Fragment>
    );
};

/**
 * Insignias de estado de un repuesto.
 *
 * Antes estaban duplicadas —y con estilos ligeramente distintos— entre la fila
 * de tabla y la tarjeta de galería. Aquí van todas con el mismo token de
 * `badge`, y las dos que llevan conteo (grupo de equivalentes y demanda) son
 * botones: al mostrar ya el número, sirven de acceso directo a su modal y
 * dejan de necesitar un botón de icono aparte en la barra de acciones.
 */
const ProductBadges: React.FC<{
    prod: any;
    groupCounts: { [key: string]: number };
    onOpenGroup: () => void;
    onOpenDemand: () => void;
}> = ({ prod, groupCounts, onOpenGroup, onOpenDemand }) => {
    const discontinued = isProductDiscontinued(prod);
    const equivalents = prod.group_id ? (groupCounts[prod.group_id] || 0) - 1 : 0;
    const hasAny = discontinued || prod.group_id || prod.demand_count > 0
        || prod.investigation_status === 'en_consulta'
        || prod.investigation_status === 'no_encontrado';

    if (!hasAny) return null;

    return (
        <div className="flex flex-wrap items-center gap-1">
            {discontinued && (
                <span
                    className={cn(badge.base, badge.size.sm, prod.discontinued_until ? badge.tone.warning : badge.tone.danger)}
                    title={prod.discontinued_until
                        ? `Descontinuado temporalmente hasta ${new Date(prod.discontinued_until).toLocaleDateString()}`
                        : 'Descontinuado permanentemente'}
                >
                    {prod.discontinued_until
                        ? <Hourglass size={11} aria-hidden="true" />
                        : <TriangleAlert size={11} aria-hidden="true" />}
                    {prod.discontinued_until ? 'Desc. temporal' : 'Descontinuado'}
                </span>
            )}
            {prod.group_id && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpenGroup(); }}
                    className={cn(badge.base, badge.size.sm, badge.tone.info, 'hover:brightness-95 transition-[filter]', focusRing)}
                    title={equivalents > 0
                        ? `${equivalents} repuesto(s) equivalente(s) — clic para verlos`
                        : 'Clic para ver el grupo de equivalentes'}
                >
                    <LinkIcon size={11} aria-hidden="true" />
                    {equivalents > 0 ? `${equivalents} equivalente${equivalents > 1 ? 's' : ''}` : 'Equivalente'}
                </button>
            )}
            {prod.demand_count > 0 && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpenDemand(); }}
                    className={cn(badge.base, badge.size.sm, badge.tone.warning, 'hover:brightness-95 transition-[filter]', focusRing)}
                    title={`${prod.demand_count} registro(s) de demanda activos — clic para verlos`}
                >
                    <BellRing size={11} aria-hidden="true" />
                    {prod.demand_count} demanda{prod.demand_count > 1 ? 's' : ''}
                </button>
            )}
            {prod.investigation_status === 'en_consulta' && (
                <span className={cn(badge.base, badge.size.sm, badge.tone.warning)} title="En consulta de sourcing">
                    <Telescope size={11} aria-hidden="true" />
                    En consulta
                </span>
            )}
            {prod.investigation_status === 'no_encontrado' && (
                <span className={cn(badge.base, badge.size.sm, badge.tone.danger)} title="No se encontró el repuesto">
                    <SearchX size={11} aria-hidden="true" />
                    No encontrado
                </span>
            )}
        </div>
    );
};

/**
 * Bloque de precios.
 *
 * El PVP es el dato que se consulta a diario; costo y costo con IVA son
 * referencia interna. Antes los tres iban al mismo tamaño y peso, así que
 * había que leer las etiquetas para saber cuál era cuál. Aquí el PVP domina
 * y los costos quedan como línea secundaria.
 */
const PriceBlock: React.FC<{ prod: any; align?: 'left' | 'row' }> = ({ prod, align = 'left' }) => {
    const cost = prod.cost_without_vat || 0;
    const costWithVat = cost * (1 + (prod.vat_percentage || 15.0) / 100);

    return (
        <div className={cn('flex flex-col gap-0.5', align === 'row' && 'items-end')}>
            <span className="font-mono font-bold text-base text-fg tnum leading-none">{money(prod.price)}</span>
            <span className="text-2xs text-fg-subtle">PVP</span>
            <span className="font-mono text-2xs text-fg-subtle tnum mt-1" title="Costo sin IVA / con IVA">
                {money(cost)} · {money(costWithVat)} c/IVA
            </span>
        </div>
    );
};

/**
 * Stock local + stock en importadora.
 *
 * El dato importante es si HAY o NO HAY, así que el "agotado" se marca con
 * tono de peligro en vez de con un gris que se confundía con "sin datos".
 */
const StockBlock: React.FC<{ prod: any; totalStock: number }> = ({ prod, totalStock }) => (
    <div className="flex flex-col items-center gap-1">
        <span className={cn('font-mono font-bold text-base tnum leading-none', totalStock > 0 ? 'text-fg' : 'text-fg-subtle')}>
            {totalStock}
        </span>
        <span className="text-2xs text-fg-subtle">local</span>
        {prod.importer_stock > 0 ? (
            <span className={cn(badge.base, badge.size.sm, badge.tone.success)} title="Disponible en importadora">
                <span className={badge.dot} aria-hidden="true" />
                {prod.importer_stock} imp.
            </span>
        ) : (
            <span className={cn(badge.base, badge.size.sm, badge.tone.neutral)} title="Agotado en importadora">
                Agotado imp.
            </span>
        )}
    </div>
);

/**
 * Barra de acciones de un repuesto (fila de tabla y tarjeta de galería).
 *
 * Tres acciones directas —las que se usan a diario— y el resto detrás de "⋯".
 * Antes eran nueve iconos idénticos sin etiqueta: en galería envolvían a dos
 * renglones y pesaban visualmente más que el precio.
 */
const ProductActions: React.FC<{
    prod: any;
    onQueue: (prod: any) => void;
    onEdit: (prod: any) => void;
    onMore: (prod: any, e: React.MouseEvent) => void;
    isMenuOpen: boolean;
    size?: number;
}> = ({ prod, onQueue, onEdit, onMore, isMenuOpen, size = 17 }) => {
    const iconBtn = cn(
        'p-1.5 rounded-md transition-colors text-fg-subtle',
        'hover:text-primary hover:bg-primary-soft',
        focusRing
    );

    return (
        <div className="flex items-center justify-center gap-0.5">
            <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(prod); }} className={iconBtn} title="Editar producto">
                <Pencil size={size} aria-hidden="true" />
            </button>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onQueue(prod); }}
                className={cn(iconBtn, 'hover:text-warning hover:bg-warning-soft')}
                title="Agregar 1 etiqueta a la cola de impresión"
            >
                <ListPlus size={size} aria-hidden="true" />
            </button>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    useProformaStore.getState().addItem({ id: prod.id, sku: prod.sku, name: prod.name, price: prod.price }, 1);
                }}
                className={cn(iconBtn, 'hover:text-success hover:bg-success-soft')}
                title="Agregar a proforma"
            >
                <FileText size={size} aria-hidden="true" />
            </button>
            <button
                type="button"
                onClick={(e) => onMore(prod, e)}
                className={cn(iconBtn, isMenuOpen && 'text-primary bg-primary-soft')}
                title="Más acciones"
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
            >
                <EllipsisVertical size={size} aria-hidden="true" />
            </button>
        </div>
    );
};

/**
 * Estado vacío.
 *
 * Distingue "no hay resultados para ESTA búsqueda" de "no hay nada": en el
 * primer caso ofrece la salida (limpiar filtros), que es lo que el usuario
 * necesita y antes tenía que descubrir por su cuenta.
 */
const EmptyState: React.FC<{ onClear?: () => void }> = ({ onClear }) => (
    <div className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-full bg-surface-2 p-3 text-fg-subtle">
            <SearchX size={28} aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-fg">
                {onClear ? 'Ningún repuesto coincide con los filtros' : 'Todavía no hay repuestos en el catálogo'}
            </span>
            <span className="text-xs text-fg-muted">
                {onClear
                    ? 'Prueba con menos palabras clave o quita alguno de los filtros activos.'
                    : 'Crea el primero con “Nuevo Producto” o impórtalos desde el menú Acciones.'}
            </span>
        </div>
        {onClear && (
            <button onClick={onClear} className={cn(button.base, button.variant.secondary, button.size.sm)}>
                <FilterX size={14} aria-hidden="true" />
                Limpiar filtros
            </button>
        )}
    </div>
);

// Helper to parse query parameters from the hash or query string
const getInitialParams = () => {
    let searchStr = '';
    if (window.location.hash && window.location.hash.includes('?')) {
        searchStr = window.location.hash.split('?')[1];
    } else if (window.location.search) {
        searchStr = window.location.search;
    }
    return new URLSearchParams(searchStr);
};

const Products: React.FC = () => {
    // ──────────────────────────────────────────────
    // 1. DATA STATES
    // ──────────────────────────────────────────────
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<any>(null);

    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    
    // Product Grouping states
    const [groupCounts, setGroupCounts] = useState<{ [key: string]: number }>({});
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [groupModalProduct, setGroupModalProduct] = useState<any>(null);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
    const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
    const [isBulkMediaOpen, setIsBulkMediaOpen] = useState(false);
    const [isDemandModalOpen, setIsDemandModalOpen] = useState(false);
    const [demandProduct, setDemandProduct] = useState<any>(null);

    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
    const [labelProduct, setLabelProduct] = useState<any>(null);
    const [isInventoryGroupSelectOpen, setIsInventoryGroupSelectOpen] = useState(false);

    const [isSourcingModalOpen, setIsSourcingModalOpen] = useState(false);
    const [sourcingProduct, setSourcingProduct] = useState<any>(null);

    // Print Queue States
    const [queueToast, setQueueToast] = useState<string | null>(null);
    const [isQueuePanelOpen, setIsQueuePanelOpen] = useState(false);
    const [isQueuePreviewOpen, setIsQueuePreviewOpen] = useState(false);
    const [printQueue, setPrintQueue] = useState<PrintQueueItem[]>([]);
    const [isQueueGenerating, setIsQueueGenerating] = useState(false);
    const [showQueueClearConfirm, setShowQueueClearConfirm] = useState(false);

    // Compartir ficha del repuesto (imagen para WhatsApp)
    const [shareToast, setShareToast] = useState<string | null>(null);
    const [sharingSku, setSharingSku] = useState<string | null>(null);

    // Menú "Acciones" de la cabecera: agrupa importar / multimedia / exportar
    // para que sólo quede un botón primario visible en la pantalla.
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);

    /*
        Menú de acciones secundarias por producto.
        Se renderiza `fixed` a nivel de página (no dentro de la fila) porque el
        contenedor de la tabla tiene `overflow-hidden`/`overflow-x-auto` y un
        popover anidado quedaría recortado. Guardamos las coordenadas del botón
        que lo abrió para posicionarlo.
    */
    const [actionMenu, setActionMenu] = useState<{ prod: any; x: number; y: number } | null>(null);

    const openActionMenu = useCallback((prod: any, e: React.MouseEvent) => {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setActionMenu(prev =>
            prev?.prod?.id === prod.id
                ? null
                : { prod, x: rect.right, y: rect.bottom + 6 }
        );
    }, []);

    // Cierra los menús flotantes al hacer scroll, al pulsar Escape o al
    // redimensionar: sus coordenadas quedarían obsoletas.
    useEffect(() => {
        if (!actionMenu && !isHeaderMenuOpen) return;
        const close = () => { setActionMenu(null); setIsHeaderMenuOpen(false); };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
            window.removeEventListener('keydown', onKey);
        };
    }, [actionMenu, isHeaderMenuOpen]);

    const loadQueue = useCallback(async () => {
        const q = await getPrintQueue();
        setPrintQueue(q);
    }, []);

    useEffect(() => {
        loadQueue();
    }, [loadQueue]);

    // La cola se arma casi siempre desde el teléfono; Realtime avisa acá para
    // no tener que recargar el catálogo antes de imprimir.
    useEffect(() => {
        window.addEventListener('print-queue-changed', loadQueue);
        return () => window.removeEventListener('print-queue-changed', loadQueue);
    }, [loadQueue]);


    // Export ZIP
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

    // Lightbox State
    const [lightbox, setLightbox] = useState<{isOpen: boolean, media: any[], initialIndex: number, product?: any}>({ isOpen: false, media: [], initialIndex: 0 });
    const [selectedProductForTags, setSelectedProductForTags] = useState<any | null>(null);
    const [copiedSku, setCopiedSku] = useState<string | null>(null);

    // Catalog view mode: gallery (big thumbnails, default) vs. dense table.
    const [viewMode, setViewMode] = useState<'table' | 'gallery'>(() => {
        try {
            const saved = localStorage.getItem('products_view_mode');
            return saved === 'table' || saved === 'gallery' ? saved : 'gallery';
        } catch {
            return 'gallery';
        }
    });
    useEffect(() => {
        try { localStorage.setItem('products_view_mode', viewMode); } catch {}
    }, [viewMode]);

    const handleCopySku = (sku: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(sku).then(() => {
            setCopiedSku(sku);
            setTimeout(() => {
                setCopiedSku(prev => prev === sku ? null : prev);
            }, 2000);
        }).catch(err => {
            console.error('Error al copiar SKU: ', err);
        });
    };

    // Deja la ficha del repuesto en el portapapeles para pegarla en WhatsApp,
    // con la misma tarjeta que ve el cliente en el catálogo público.
    const handleShareCard = async (prod: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setSharingSku(prod.sku);
        setShareToast(`Generando ficha de ${prod.sku}...`);
        try {
            const outcome = await shareProductCard(prod);
            if (outcome === 'cancelled') {
                setShareToast(null);
                return;
            }
            setShareToast(
                outcome === 'copied' ? 'Ficha copiada: pégala en WhatsApp'
                : outcome === 'shared' ? 'Ficha compartida'
                : 'Ficha descargada'
            );
            setTimeout(() => setShareToast(null), 2600);
        } catch (err: any) {
            setShareToast('No se pudo generar la ficha: ' + (err?.message || 'error'));
            setTimeout(() => setShareToast(null), 3200);
        } finally {
            setSharingSku(null);
        }
    };

    const navigate = useNavigate();
    const location = useLocation();

    // ──────────────────────────────────────────────
    // 2. FILTER, SORT, PAGINATION STATES
    // ──────────────────────────────────────────────
    const [searchTerms, setSearchTerms] = useState<string[]>(() => {
        const params = getInitialParams();
        const q = params.get('search');
        const k = params.getAll('k');
        
        if (q !== null || k.length > 0) {
            return [q || '', ...k];
        }
        
        try {
            const saved = localStorage.getItem('last_erp_products_queries');
            const savedTime = localStorage.getItem('last_erp_products_queries_time');
            if (saved && savedTime) {
                const ageMs = Date.now() - parseInt(savedTime, 10);
                if (ageMs < 24 * 60 * 60 * 1000) {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        return parsed;
                    }
                }
            }
        } catch (e) {
            console.error('Error al leer queries de catálogo de productos del ERP desde localStorage', e);
        }
        
        return [''];
    });

    const [expanded, setExpanded] = useState<boolean[]>(() => {
        return [true, ...Array(Math.max(0, searchTerms.length - 1)).fill(false)];
    });

    // Guardar en localStorage
    useEffect(() => {
        const hasAnyQuery = searchTerms.some(b => b.trim().length > 0);
        if (hasAnyQuery) {
            localStorage.setItem('last_erp_products_queries', JSON.stringify(searchTerms));
            localStorage.setItem('last_erp_products_queries_time', Date.now().toString());
        } else {
            localStorage.removeItem('last_erp_products_queries');
            localStorage.removeItem('last_erp_products_queries_time');
        }
    }, [searchTerms]);

    const [filters, setFilters] = useState<{ [key: string]: string }>(() => {
        const params = getInitialParams();
        const initialFilters: { [key: string]: string } = {};
        const filterKeys = ['sku', 'name', 'category', 'brand', 'imageStatus', 'videoStatus', 'stockStatus', 'discontinuedStatus'];
        filterKeys.forEach(key => {
            const val = params.get(key);
            if (val) initialFilters[key] = val;
        });
        return initialFilters;
    });
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>(() => {
        const params = getInitialParams();
        return {
            key: params.get('sortKey') || 'name',
            direction: (params.get('sortDir') as 'asc' | 'desc') || 'asc'
        };
    });
    const [pagination, setPagination] = useState(() => {
        const params = getInitialParams();
        const pageVal = params.get('page');
        const page = pageVal ? parseInt(pageVal, 10) : 1;
        return {
            page: isNaN(page) ? 1 : page,
            pageSize: 20,
            totalRecords: 0
        };
    });

    // Funciones para gestionar filtros dinámicos múltiples
    const addSearchFilter = () => {
        setSearchTerms(prev => [...prev, '']);
        setExpanded(prev => [...prev, true]);
    };

    const removeSearchFilter = (index: number) => {
        setSearchTerms(prev => prev.filter((_, i) => i !== index));
        setExpanded(prev => prev.filter((_, i) => i !== index));
    };

    const toggleExpandFilter = (index: number) => {
        setExpanded(prev => prev.map((exp, i) => i === index ? !exp : exp));
    };

    const updateSearchTerm = (index: number, value: string) => {
        setSearchTerms(prev => prev.map((val, i) => i === index ? value : val));
    };

    const collapseAllFilters = () => {
        setExpanded(prev => prev.map((_, i) => i === 0 ? true : false));
    };

    const clearAllAdditionalFilters = () => {
        setSearchTerms([searchTerms[0]]);
        setExpanded([true]);
    };

    const handleBlurContainer = (event: React.FocusEvent<HTMLDivElement>, index: number) => {
        const currentTarget = event.currentTarget;
        setTimeout(() => {
            if (!currentTarget.contains(document.activeElement)) {
                const query = searchTerms[index];
                if (!query || !query.trim()) {
                    removeSearchFilter(index);
                }
            }
        }, 250);
    };

    // ──────────────────────────────────────────────
    // 3. DEBOUNCED SEARCH, FILTER, AND PAGINATION EFFECT
    // ──────────────────────────────────────────────
    const searchTermsString = useMemo(() => JSON.stringify(searchTerms), [searchTerms]);
    const [debouncedSearchTermsString, setDebouncedSearchTermsString] = useState(searchTermsString);
    const [debouncedFilters, setDebouncedFilters] = useState(filters);

    // Debounce search term and column filters by 300ms
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            setDebouncedSearchTermsString(searchTermsString);
            setDebouncedFilters(filters);
            setPagination(prev => {
                if (prev.page === 1) return prev;
                return { ...prev, page: 1 };
            });
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTermsString, filters]);

    const debouncedSearchTerms = useMemo(() => JSON.parse(debouncedSearchTermsString) as string[], [debouncedSearchTermsString]);

    // Sync state changes to the URL (using replace navigation to avoid polluting history on typing)
    useEffect(() => {
        if (location.pathname !== '/products') return;

        const params = new URLSearchParams();
        
        const q = searchTerms[0] || '';
        const k = searchTerms.slice(1).map(s => s.trim()).filter(s => s.length > 0);

        if (q) params.set('search', q);
        k.forEach(keyword => {
            params.append('k', keyword);
        });
        
        Object.entries(filters).forEach(([key, val]) => {
            if (val) params.set(key, val);
        });
        
        if (sortConfig.key !== 'name') params.set('sortKey', sortConfig.key);
        if (sortConfig.direction !== 'asc') params.set('sortDir', sortConfig.direction);
        if (pagination.page > 1) params.set('page', String(pagination.page));
        
        const queryString = params.toString();
        const targetHash = `/products${queryString ? '?' + queryString : ''}`;
        
        const currentHash = window.location.hash.replace(/^#/, '');
        if (currentHash !== targetHash) {
            navigate(targetHash, { replace: true });
        }
    }, [searchTerms, filters, sortConfig.key, sortConfig.direction, pagination.page, navigate, location.pathname]);

    // Sync URL changes back to state (essential for browser history back/forward navigation)
    useEffect(() => {
        if (location.pathname !== '/products') return;

        const params = getInitialParams();
        
        const urlSearch = params.get('search') || '';
        const urlK = params.getAll('k');

        const currentQ = searchTerms[0] || '';
        const currentK = searchTerms.slice(1);

        const qChanged = urlSearch !== currentQ;
        const kChanged = urlK.length !== currentK.length || urlK.some((val, idx) => val !== currentK[idx]);

        if (qChanged || kChanged) {
            setSearchTerms([urlSearch, ...urlK]);
            setExpanded(prev => {
                const nextExpanded = [true];
                for (let i = 0; i < urlK.length; i++) {
                    nextExpanded.push(prev[i + 1] !== undefined ? prev[i + 1] : false);
                }
                return nextExpanded;
            });
        }
        
        const urlFilters: { [key: string]: string } = {};
        const filterKeys = ['sku', 'name', 'category', 'brand', 'imageStatus', 'videoStatus', 'stockStatus', 'discontinuedStatus'];
        filterKeys.forEach(key => {
            const val = params.get(key);
            if (val) urlFilters[key] = val;
        });
        const filtersChanged = JSON.stringify(urlFilters) !== JSON.stringify(filters);
        if (filtersChanged) {
            setFilters(urlFilters);
        }
        
        const urlSortKey = params.get('sortKey') || 'name';
        const urlSortDir = (params.get('sortDir') as 'asc' | 'desc') || 'asc';
        if (urlSortKey !== sortConfig.key || urlSortDir !== sortConfig.direction) {
            setSortConfig({ key: urlSortKey, direction: urlSortDir });
        }
        
        const pageVal = params.get('page');
        const urlPage = pageVal ? parseInt(pageVal, 10) : 1;
        const validPage = isNaN(urlPage) ? 1 : urlPage;
        if (validPage !== pagination.page) {
            setPagination(prev => ({ ...prev, page: validPage }));
        }
    }, [location]);

    useEffect(() => {
        fetchCatalogData(pagination.page);
    }, [debouncedSearchTermsString, debouncedFilters, pagination.page, pagination.pageSize, sortConfig]);

    // ──────────────────────────────────────────────
    // 4. SUPABASE QUERY ENGINE
    // ──────────────────────────────────────────────
    const fetchCatalogData = useCallback(async (page?: number) => {
        setLoading(true);
        try {
            const currentPage = page || pagination.page;

            // Start query with exact count
            let query = supabase
                .from('products')
                .select(`
                    *,
                    brands (name),
                    inventory_levels (current_stock),
                    profiles (full_name),
                    product_tags ( tags (*) )
                `, { count: 'exact' })
                .eq('is_active', true);

            // Global Search (OR across name and sku for each active search term, support exclusions with '-')
            const activeSearchTerms = debouncedSearchTerms.map(s => s.trim()).filter(Boolean);
            for (const term of activeSearchTerms) {
                if (term.startsWith('-')) {
                    const cleanTerm = term.slice(1).trim();
                    if (cleanTerm) {
                        query = query.not('name', 'ilike', `%${cleanTerm}%`);
                        query = query.not('sku', 'ilike', `%${cleanTerm}%`);
                    }
                } else {
                    query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
                }
            }

            // Column Filters (AND logic)
            if (debouncedFilters.sku) {
                query = query.ilike('sku', `%${debouncedFilters.sku}%`);
            }
            if (debouncedFilters.name) {
                query = query.ilike('name', `%${debouncedFilters.name}%`);
            }
            if (debouncedFilters.category) {
                query = query.ilike('category', `%${debouncedFilters.category}%`);
            }
            
            // Image Status Filter
            if (debouncedFilters.imageStatus === 'con_imagen') {
                query = query.not('image_url', 'is', null);
            } else if (debouncedFilters.imageStatus === 'sin_imagen') {
                query = query.is('image_url', null);
            }

            // Video Status Filter (Checking if gallery contains video)
            if (debouncedFilters.videoStatus === 'con_video') {
                query = query.contains('gallery', '[{"type": "video"}]');
            } else if (debouncedFilters.videoStatus === 'sin_video') {
                query = query.or('gallery.is.null,gallery.not.cs.[{"type": "video"}]');
            }

            // Stock Status Filter
            if (debouncedFilters.stockStatus === 'disponibles_importadora') {
                query = query.gt('importer_stock', 0);
            } else if (debouncedFilters.stockStatus === 'solo_local') {
                query = query.gt('local_stock', 0).or('importer_stock.eq.0,importer_stock.is.null');
            } else if (debouncedFilters.stockStatus === 'disponibles_local') {
                query = query.gt('local_stock', 0);
            } else if (debouncedFilters.stockStatus === 'solo_importadora') {
                query = query.or('local_stock.eq.0,local_stock.is.null').gt('importer_stock', 0);
            } else if (debouncedFilters.stockStatus === 'disponibles_cualquiera') {
                query = query.or('local_stock.gt.0,importer_stock.gt.0');
            } else if (debouncedFilters.stockStatus === 'agotados') {
                query = query.or('local_stock.eq.0,local_stock.is.null').or('importer_stock.eq.0,importer_stock.is.null');
            }

            // Discontinued Status Filter
            if (debouncedFilters.discontinuedStatus === 'descontinuados') {
                query = query.eq('is_discontinued', true);
            } else if (debouncedFilters.discontinuedStatus === 'activos') {
                query = query.or('is_discontinued.is.null,is_discontinued.eq.false');
            }

            // Sorting
            const isAscending = sortConfig.direction === 'asc';
            if (sortConfig.key === 'brand') {
                query = query.order('name', { referencedTable: 'brands', ascending: isAscending });
            } else {
                query = query.order(sortConfig.key, { ascending: isAscending });
            }

            // Pagination (range is 0-indexed)
            const from = (currentPage - 1) * pagination.pageSize;
            const to = from + pagination.pageSize - 1;
            query = query.range(from, to);

            // Execute
            const { data, error, count } = await query;

            if (error) throw error;

            setProducts(data || []);
            if (count !== null) {
                setPagination(prev => ({ ...prev, totalRecords: count }));
            }

            // Fetch group counts for the products on this page
            if (data && data.length > 0) {
                const groupIds = data.map((p: any) => p.group_id).filter(Boolean);
                if (groupIds.length > 0) {
                    const { data: countData, error: countError } = await supabase
                        .from('products')
                        .select('group_id')
                        .in('group_id', groupIds);
                    
                    if (!countError && countData) {
                        const counts: { [key: string]: number } = {};
                        countData.forEach((row: any) => {
                            if (row.group_id) {
                                counts[row.group_id] = (counts[row.group_id] || 0) + 1;
                            }
                        });
                        setGroupCounts(counts);
                    }
                } else {
                    setGroupCounts({});
                }
            } else {
                setGroupCounts({});
            }
        } catch (error) {
            console.error('Error fetching catalog:', error);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearchTermsString, debouncedFilters, sortConfig, pagination.page, pagination.pageSize]);

    // ──────────────────────────────────────────────
    // HANDLERS
    // ──────────────────────────────────────────────
    const handleOpenModal = (product: any = null) => {
        setProductToEdit(product);
        setIsModalOpen(true);
    };

    const handleOpenGroupModal = (groupId: string, product: any) => {
        setSelectedGroupId(groupId);
        setGroupModalProduct(product);
        setIsGroupModalOpen(true);
    };

    const handleEditFromGroupModal = (product: any) => {
        setIsGroupModalOpen(false);
        setGroupModalProduct(null);
        setSelectedGroupId(null);
        handleOpenModal(product);
    };

    const handleOpenLightbox = (prod: any, clickedType: 'video' | 'image' | 'gallery', index = 0) => {
        const mediaArray: any[] = [];
        if (prod.image_url) mediaArray.push({ type: 'image', url: prod.image_url, title: prod.sku + ' - ' + prod.name });
        
        if (prod.gallery && Array.isArray(prod.gallery)) {
            prod.gallery.forEach((item: any) => {
                mediaArray.push({ type: item.type, url: item.url, title: prod.sku + ' - ' + prod.name });
            });
        }

        setLightbox({
            isOpen: true,
            media: mediaArray,
            initialIndex: index,
            product: prod
        });
    };

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleRefresh = () => {
        fetchCatalogData(pagination.page);
    };

    const handleDeleteProduct = async (product: any) => {
        const globalStock = product.inventory_levels?.reduce((acc: number, level: any) => acc + (level.current_stock || 0), 0) || 0;
        
        if (globalStock > 0) {
            alert(`No se puede eliminar el producto "${product.name}" porque tiene stock disponible (${globalStock} unidades). Debe vaciar el inventario primero.`);
            return;
        }

        const confirmed = window.confirm(`¿Estás seguro de que deseas eliminar permanentemente el producto "${product.sku} - ${product.name}"? Esta acción no se puede deshacer.`);
        
        if (!confirmed) return;

        setLoading(true);
        try {
            // Intento 1: Hard Delete (Borrado físico)
            // Usamos .select() para recibir las filas borradas y confirmar que realmente se borró algo
            const { data: deletedData, error: deleteError } = await supabase
                .from('products')
                .delete()
                .eq('id', product.id)
                .select();

            if (deleteError) {
                // Si falla por Foreign Key (historial), ofrecemos Soft Delete
                if (deleteError.code === '23503') {
                    const softConfirm = window.confirm(
                        "Este producto tiene historial comercial (ventas o movimientos) y no puede ser borrado permanentemente.\n\n" +
                        "¿Deseas ocultarlo definitivamente del catálogo?"
                    );
                    
                    if (softConfirm) {
                        const { data: updatedData, error: updateError } = await supabase
                            .from('products')
                            .update({ is_active: false })
                            .eq('id', product.id)
                            .select();
                        
                        if (updateError) throw updateError;
                        
                        // Verificar si el update realmente afectó filas
                        if (!updatedData || updatedData.length === 0) {
                            throw new Error("No se pudo ocultar el producto. Verifica tus permisos en la base de datos.");
                        }
                        
                        alert("Producto ocultado correctamente.");
                    }
                } else {
                    throw deleteError;
                }
            } else {
                // Verificar si el delete realmente afectó filas
                if (!deletedData || deletedData.length === 0) {
                    throw new Error("La base de datos rechazó la eliminación (es posible que falten permisos DELETE en RLS).");
                }
                alert("Producto eliminado permanentemente.");
            }
            
            fetchCatalogData(pagination.page);
        } catch (error: any) {
            console.error('Error deleting product:', error);
            alert('Error al intentar eliminar el producto: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDuplicateProduct = async (prod: any) => {
        const confirmed = window.confirm(`¿Estás seguro de que deseas duplicar este producto (${prod.sku})? Se generará un nuevo código SKU automáticamente.`);
        if (!confirmed) return;

        setLoading(true);
        try {
            // Parse SKU using strict regex
            const match = prod.sku.match(/^(.*)-([A-Z]{1,2})$/);
            const baseSku = match ? match[1] : prod.sku;

            // Find existing SKUs
            const { data: existing, error: fetchError } = await supabase
                .from('products')
                .select('sku')
                .eq('is_active', true)
                .ilike('sku', `${baseSku}%`);
            
            if (fetchError) throw fetchError;

            // Generate unique suffix
            const getSuffix = (index: number): string => {
                let suffix = '';
                let temp = index;
                while (temp >= 0) {
                    suffix = String.fromCharCode((temp % 26) + 65) + suffix;
                    temp = Math.floor(temp / 26) - 1;
                }
                return suffix;
            };

            let nextSku = '';
            let index = 0;
            while (true) {
                const candidate = `${baseSku}-${getSuffix(index)}`;
                if (!existing?.some(p => p.sku.toLowerCase() === candidate.toLowerCase())) {
                    nextSku = candidate;
                    break;
                }
                index++;
            }

            const { data: { user } } = await supabase.auth.getUser();

            // Construct sanitized payload
            const payload = {
                sku: nextSku,
                name: prod.name,
                brand_id: prod.brand_id,
                category: prod.category,
                price: prod.price,
                cost_without_vat: prod.cost_without_vat,
                vat_percentage: prod.vat_percentage,
                profit_margin: prod.profit_margin,
                min_stock_threshold: prod.min_stock_threshold,
                image_url: prod.image_url,
                gallery: prod.gallery,
                is_active: true,
                is_discontinued: prod.is_discontinued || false,
                discontinued_until: prod.discontinued_until || null,
                last_edited_by: user?.id || null,
                last_edited_at: new Date().toISOString()
            };

            const { data: newProd, error: insertError } = await supabase
                .from('products')
                .insert([payload])
                .select('id')
                .single();

            if (insertError) throw insertError;

            // Duplicate tags
            if (newProd && prod.product_tags && prod.product_tags.length > 0) {
                const tagInserts = prod.product_tags
                    .map((pt: any) => pt.tags?.id)
                    .filter(Boolean)
                    .map((tagId: any) => ({
                        product_id: newProd.id,
                        tag_id: tagId
                    }));
                
                if (tagInserts.length > 0) {
                    const { error: tagError } = await supabase.from('product_tags').insert(tagInserts);
                    if (tagError) console.error('Error duplicando etiquetas:', tagError);
                }
            }

            alert(`Producto duplicado exitosamente. Nuevo SKU: ${nextSku}`);
            fetchCatalogData(pagination.page);
        } catch (error: any) {
            console.error('Error al duplicar producto:', error);
            alert('Error al duplicar producto: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        // Verificar stock de todos los seleccionados
        const hasStock = selectedProducts.some(p => {
            const stock = p.inventory_levels?.reduce((acc: number, level: any) => acc + (level.current_stock || 0), 0) || 0;
            return stock > 0;
        });

        if (hasStock) {
            alert('No se puede eliminar el lote: Al menos uno de los productos seleccionados tiene stock. Debes vaciar sus inventarios primero.');
            return;
        }

        const confirmed = window.confirm(`¿Estás súper seguro de que deseas ELIMINAR PERMANENTEMENTE los ${selectedProducts.length} productos seleccionados?\nEsta acción no se puede deshacer.`);
        if (!confirmed) return;

        setLoading(true);
        let deleted = 0;
        let hidden = 0;
        let failed = 0;

        for (const prod of selectedProducts) {
            try {
                const { data, error } = await supabase.from('products').delete().eq('id', prod.id).select();
                
                if (error) {
                    if (error.code === '23503') { // Foreign Key constraint (historial)
                        const { error: softError } = await supabase.from('products').update({ is_active: false }).eq('id', prod.id);
                        if (softError) failed++;
                        else hidden++;
                    } else {
                        failed++;
                    }
                } else if (data && data.length > 0) {
                    deleted++;
                } else {
                    failed++;
                }
            } catch (err) {
                failed++;
            }
        }

        setLoading(false);
        setSelectedIds(new Set());
        fetchCatalogData(pagination.page);
        
        alert(`Resultado del Lote:\n✅ ${deleted} eliminados permanentemente\n👀 ${hidden} ocultados (tenían historial comercial)\n❌ ${failed} fallidos`);
    };

    // ── Export ZIP handler ──
    const handleExportZip = async () => {
        setIsExporting(true);
        setExportProgress({ current: 0, total: 0 });
        try {
            // 1. Obtener TODOS los productos con imagen enlazada (sin límite de página)
            let allProducts: any[] = [];
            let from = 0;
            const batchSize = 1000;
            while (true) {
                const { data, error } = await supabase
                    .from('products')
                    .select('sku, image_url')
                    .not('image_url', 'is', null)
                    .range(from, from + batchSize - 1);
                if (error) throw error;
                if (!data || data.length === 0) break;
                allProducts = allProducts.concat(data);
                if (data.length < batchSize) break;
                from += batchSize;
            }

            if (allProducts.length === 0) {
                alert('No se encontraron productos con imágenes enlazadas.');
                return;
            }

            setExportProgress({ current: 0, total: allProducts.length });

            // 2. Crear el ZIP (jszip se carga solo al exportar, para no inflar el bundle inicial)
            const { default: JSZip } = await import('jszip');
            const zip = new JSZip();
            let success = 0;
            let failed = 0;

            for (let i = 0; i < allProducts.length; i++) {
                const { sku, image_url } = allProducts[i];
                setExportProgress({ current: i + 1, total: allProducts.length });
                try {
                    const response = await fetch(image_url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const blob = await response.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    zip.file(`${sku}.webp`, arrayBuffer);
                    success++;
                } catch {
                    failed++;
                }
            }

            // 3. Generar y descargar el ZIP
            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `imagenes_productos_${new Date().toISOString().slice(0, 10)}.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            alert(`✅ Exportación completa\n\n📦 ${success} imágenes exportadas\n❌ ${failed} fallidas`);
        } catch (err: any) {
            alert(`Error durante la exportación: ${err.message}`);
        } finally {
            setIsExporting(false);
            setExportProgress({ current: 0, total: 0 });
        }
    };

    // ── Selection handlers ──
    const toggleSelectAll = () => {
        const currentPageIds = products.map(p => p.id);
        const allSelectedOnPage = currentPageIds.length > 0 && currentPageIds.every(id => selectedIds.has(id));

        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allSelectedOnPage) {
                currentPageIds.forEach(id => next.delete(id));
            } else {
                currentPageIds.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const toggleSelectRow = async (id: number) => {
        const targetProd = products.find(p => p.id === id);
        if (!targetProd) return;

        if (!targetProd.group_id) {
            setSelectedIds(prev => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
            });
            return;
        }

        // Determine intended state based on current selection
        const willBeSelected = !selectedIds.has(id);

        // 1. Synchronously update the UI for visible items instantly
        setSelectedIds(prev => {
            const next = new Set(prev);
            products.forEach(p => {
                if (p.group_id === targetProd.group_id) {
                    if (willBeSelected) next.add(p.id);
                    else next.delete(p.id);
                }
            });
            return next;
        });

        // 2. Asynchronously fetch and select all other group members across pages
        try {
            const { data } = await supabase.from('products').select('id').eq('group_id', targetProd.group_id);
            if (data) {
                const groupIds = data.map(d => d.id);
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    groupIds.forEach(gid => {
                        if (willBeSelected) next.add(gid);
                        else next.delete(gid);
                    });
                    return next;
                });
            }
        } catch (error) {
            console.error("Error fetching group ids for selection", error);
        }
    };

    const selectedProducts = products.filter(p => selectedIds.has(p.id));

    const handleBulkEditSuccess = () => {
        setSelectedIds(new Set());
        fetchCatalogData(pagination.page);
    };



    // ──────────────────────────────────────────────
    // PAGINATION HELPERS
    // ──────────────────────────────────────────────
    const totalPages = Math.ceil(pagination.totalRecords / pagination.pageSize);
    const showingFrom = pagination.totalRecords === 0 ? 0 : ((pagination.page - 1) * pagination.pageSize) + 1;
    const showingTo = Math.min(pagination.page * pagination.pageSize, pagination.totalRecords);

    /*
        Definición de columnas.

        `width` alimenta un <colgroup> con `table-fixed`. Sin anchos declarados,
        el navegador reparte el espacio según el contenido, así que el ancho de
        la columna "Nombre" cambiaba en cada página según cuál fuera el repuesto
        de descripción más larga: las columnas bailaban al paginar. Con anchos
        fijos la descripción envuelve dentro de una medida de línea estable.

        `filterable` sustituye a los `col.key !== 'brand' && col.key !== 'price'`
        que estaban repetidos en tres sitios.
    */
    const columns = [
        { key: 'sku', label: 'SKU', width: '190px', filterable: true },
        { key: 'name', label: 'Repuesto', width: 'auto', filterable: true },
        { key: 'brand', label: 'Marca', width: '130px', filterable: false },
        { key: 'price', label: 'Precios', width: '170px', filterable: false },
    ];

    // Términos activos para resaltar dentro del nombre (búsqueda + filtro de columna).
    const highlightTerms = useMemo(
        () => [...debouncedSearchTerms, debouncedFilters.name || ''].filter(Boolean),
        [debouncedSearchTerms, debouncedFilters.name]
    );

    /*
        Acciones secundarias por producto.

        Antes había nueve botones de icono idénticos en cada fila y en cada
        tarjeta: sin etiqueta, todos del mismo peso, y en galería envolvían a
        dos renglones ocupando más sitio que el precio. Ahora quedan tres
        directas (editar / cola de etiquetas / proforma) y el resto vive aquí,
        con su nombre escrito. Grupo y demanda no se pierden de vista: siguen
        accesibles desde sus propias insignias, que ya muestran el conteo.
    */
    const secondaryActions = (prod: any) => [
        {
            key: 'group',
            label: prod.group_id ? 'Ver repuestos equivalentes' : 'Agrupar como equivalente',
            icon: LinkIcon,
            onClick: () => handleOpenGroupModal(prod.group_id, prod),
        },
        {
            key: 'sourcing',
            label: 'Estudio de repuesto (sourcing)',
            icon: Telescope,
            onClick: () => { setSourcingProduct(prod); setIsSourcingModalOpen(true); },
        },
        {
            key: 'demand',
            label: prod.demand_count > 0 ? `Ver demanda (${prod.demand_count})` : 'Registrar demanda',
            icon: BellRing,
            onClick: () => { setDemandProduct(prod); setIsDemandModalOpen(true); },
        },
        {
            key: 'label',
            label: 'Generar etiqueta (código de barras)',
            icon: ScanBarcode,
            onClick: () => { setLabelProduct(prod); setIsLabelModalOpen(true); },
        },
        {
            key: 'duplicate',
            label: 'Duplicar producto',
            icon: Copy,
            onClick: () => handleDuplicateProduct(prod),
        },
        {
            key: 'delete',
            label: 'Eliminar producto',
            icon: Trash2,
            onClick: () => handleDeleteProduct(prod),
            danger: true,
        },
    ];

    /** Añade una etiqueta del producto a la cola de impresión. */
    const handleQueueOne = useCallback(async (prod: any) => {
        await addToQueue({ id: prod.id, sku: prod.sku, name: prod.name, image_url: prod.image_url }, 1);
        await loadQueue();
        setQueueToast(`1 etiqueta de ${prod.sku} agregada a la cola`);
        setTimeout(() => setQueueToast(null), 2000);
    }, [loadQueue]);

    // Memoize the catalog table rows to eliminate typing lag when searching
    const renderedRows = useMemo(() => {
        return products.map(prod => (
            <tr
                key={prod.id}
                className={cn(
                    'group transition-colors duration-100',
                    selectedIds.has(prod.id) ? 'bg-primary-soft/60' : 'hover:bg-surface-hover'
                )}
            >
                <td className="px-4 py-3 align-top">
                    <input
                        type="checkbox"
                        checked={selectedIds.has(prod.id)}
                        onChange={() => toggleSelectRow(prod.id)}
                        className={cn(input.checkbox, 'mt-1')}
                        aria-label={`Seleccionar ${prod.sku}`}
                    />
                </td>
                {/*
                    `font-mono` explícito: la página ya no es monoespaciada
                    entera, sólo los datos donde la alineación de caracteres
                    importa (SKU, cifras). Ver el contenedor raíz.
                */}
                <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <span className="font-mono text-sm text-fg-muted tracking-tight">{prod.sku}</span>
                        <button
                            type="button"
                            onClick={(e) => handleCopySku(prod.sku, e)}
                            className={cn(
                                'p-1.5 rounded-md flex items-center justify-center transition-colors',
                                focusRing,
                                copiedSku === prod.sku
                                    ? 'text-success bg-success-soft'
                                    : 'text-fg-subtle hover:text-primary hover:bg-primary-soft'
                            )}
                            title={copiedSku === prod.sku ? '¡Copiado!' : 'Copiar código'}
                        >
                            {copiedSku === prod.sku ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                        </button>
                        <button
                            type="button"
                            onClick={(e) => handleShareCard(prod, e)}
                            disabled={sharingSku === prod.sku}
                            className={cn(
                                'p-1.5 rounded-md flex items-center justify-center transition-colors',
                                'text-fg-subtle hover:text-primary hover:bg-primary-soft disabled:opacity-60',
                                focusRing
                            )}
                            title="Copiar ficha del repuesto (imagen para WhatsApp)"
                        >
                            {sharingSku === prod.sku
                                ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                                : <ImageDown size={15} aria-hidden="true" />}
                        </button>
                    </div>
                </td>
                <td className="px-4 py-3 align-top">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-start gap-3">
                        {/* Image Thumbnail with Hover Gallery Preview */}
                        <div className="relative group">
                            {prod.image_url ? (
                                <button
                                    type="button"
                                    onClick={() => handleOpenLightbox(prod, 'image', 0)}
                                    className={cn('h-11 w-11 flex-shrink-0 rounded-lg overflow-hidden border border-subtle bg-surface-2 shadow-xs relative', focusRing)}
                                    title="Ver imágenes"
                                >
                                    <ImageIcon size={18} className="text-fg-subtle absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0" aria-hidden="true" />
                                    <img
                                       src={getThumbnailUrl(prod.image_url, 96, 96)}
                                       alt=""
                                       loading="lazy"
                                       decoding="async"
                                       className="h-full w-full object-contain transition-opacity duration-300 relative z-10"
                                       onError={(e) => {
                                           const target = e.currentTarget;
                                           if (target.src.includes('render/image')) {
                                               try {
                                                   localStorage.setItem('supabase_transform_unsupported', 'true');
                                               } catch (err) {}
                                               target.src = prod.image_url || '';
                                           } else {
                                               target.style.display = 'none';
                                               if (target.parentElement) {
                                                   // SVG inline (mismo trazo que Lucide) en vez de la webfont de iconos
                                                   target.parentElement.innerHTML = PLACEHOLDER_IMAGE_SVG(18);
                                                   target.parentElement.className = "h-11 w-11 flex-shrink-0 rounded-lg border border-dashed border-strong bg-surface-2 relative flex items-center justify-center text-fg-subtle";
                                               }
                                           }
                                       }}
                                    />
                                    <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors"></div>
                                    {prod.gallery && prod.gallery.some((item: any) => item.type === 'video') && (
                                        <div className="absolute bottom-0.5 right-0.5 bg-slate-900/70 rounded p-0.5 flex items-center justify-center" title="Tiene video">
                                            <Play size={10} className="text-white" aria-hidden="true" />
                                        </div>
                                    )}
                                </button>
                            ) : (
                                <div
                                    title="Sin imagen"
                                    className="h-11 w-11 flex-shrink-0 rounded-lg border border-dashed border-strong bg-surface-2 flex items-center justify-center"
                                >
                                    <ImageOff size={18} className="text-fg-subtle" aria-hidden="true" />
                                </div>
                            )}

                            {/* Hover Gallery Preview */}
                            {(prod.gallery && prod.gallery.length > 0) && (
                                <div className="absolute left-12 top-0 z-50 hidden group-hover:flex flex-wrap gap-1 p-2 bg-surface border border-subtle rounded-lg shadow-lg w-max max-w-[200px]">
                                    {prod.gallery.map((item: any, idx: number) => (
                                        <div 
                                            key={idx} 
                                            onClick={(e) => { e.stopPropagation(); handleOpenLightbox(prod, 'gallery', idx + 1); }}
                                            className="w-10 h-10 rounded overflow-hidden border border-subtle bg-surface-3 flex items-center justify-center relative cursor-pointer hover:opacity-80 transition-opacity"
                                        >
                                            {item.type === 'video' ? (
                                                <CirclePlay size={18} className="text-success" aria-hidden="true" />
                                            ) : (
                                                <img src={getThumbnailUrl(item.url, 80, 80)} alt="" className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div className="flex flex-col gap-1.5 min-w-0">
                            {/*
                                Nombre completo, sin recortes, en tipografía sans.

                                `max-w-[62ch]` acota la medida de línea: una descripción que
                                cruza toda la pantalla obliga al ojo a saltar de renglón y se
                                vuelve incómoda de leer (regla clásica de 45-75 caracteres
                                por línea). Peso `semibold` en vez de `bold`: seis renglones
                                en negrita se leen como un bloque sólido.
                            */}
                            <span
                                className="font-sans font-semibold text-sm text-fg break-words whitespace-normal leading-snug max-w-[62ch] hyphens-auto"
                                lang="es"
                            >
                                {highlightMatches(prod.name, highlightTerms)}
                            </span>
                            <ProductBadges
                                prod={prod}
                                groupCounts={groupCounts}
                                onOpenGroup={() => handleOpenGroupModal(prod.group_id, prod)}
                                onOpenDemand={() => { setDemandProduct(prod); setIsDemandModalOpen(true); }}
                            />
                        </div>
                    </div>
                    {/* Tags Rendering */}
                    <div className="flex flex-wrap gap-1 mt-2 items-center">
                        {prod.product_tags && prod.product_tags.length > 0 && prod.product_tags.map((pt: any) => {
                            const tag = pt.tags;
                            if (!tag) return null;
                            return (
                                <span 
                                    key={tag.id} 
                                    className="px-2 py-0.5 text-2xs font-bold rounded cursor-pointer hover:opacity-80 transition-opacity"
                                    style={{ backgroundColor: tag.color + '20', color: tag.color, border: `1px solid ${tag.color}40` }}
                                    onClick={(e) => { e.stopPropagation(); setSelectedProductForTags(prod); }}
                                    title="Clic para editar etiquetas"
                                >
                                    {tag.name}
                                </span>
                            );
                        })}
                        <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedProductForTags(prod); }}
                            className="px-1.5 py-0.5 rounded text-2xs font-semibold text-fg-subtle border border-dashed border-strong hover:text-primary hover:border-primary transition-colors flex items-center gap-0.5 bg-surface-2"
                            title="Asignar etiquetas"
                        >
                            <Plus size={12} aria-hidden="true" />
                            Etiqueta
                        </button>
                    </div>
                    </div>
                </td>
                <td className="px-4 py-3 text-sm text-fg-muted align-top break-words">{prod.brands?.name || '—'}</td>

                {/* Precios y Costos */}
                <td className="px-4 py-3 align-top">
                    <PriceBlock prod={prod} />
                </td>

                <td className="px-4 py-3 text-center align-top">
                    <StockBlock
                        prod={prod}
                        totalStock={prod.inventory_levels ? prod.inventory_levels.reduce((acc: number, level: any) => acc + (level.current_stock || 0), 0) : 0}
                    />
                </td>
                <td className="px-4 py-3 text-center align-top">
                    <ProductActions prod={prod} onQueue={handleQueueOne} onEdit={handleOpenModal} onMore={openActionMenu} isMenuOpen={actionMenu?.prod?.id === prod.id} />
                </td>
            </tr>
        ));
    }, [products, selectedIds, groupCounts, copiedSku, highlightTerms, actionMenu]);

    // Gallery view: same data + same handlers as the table rows above, just
    // laid out as cards with a large image so parts can be told apart at a
    // glance instead of having to open each one to check a 40px thumbnail.
    const renderedCards = useMemo(() => {
        return products.map(prod => {
            const totalStock = prod.inventory_levels ? prod.inventory_levels.reduce((acc: number, level: any) => acc + (level.current_stock || 0), 0) : 0;
            const isSelected = selectedIds.has(prod.id);
            const galleryCount = prod.gallery?.length || 0;
            const hasVideo = prod.gallery?.some((item: any) => item.type === 'video');

            return (
                <div
                    key={prod.id}
                    /*
                        Hover contenido: la sombra sube un solo escalón (sm -> md) y el
                        borde se define. Un salto a `shadow-lg` en una rejilla de 4-5
                        columnas produce parpadeo al mover el ratón.
                        Selección: borde + anillo fino, sin desplazar el contenido.
                        `focus-within` para que la tarjeta también se resalte al llegar
                        con el teclado, no sólo con el ratón.
                    */
                    className={cn(
                        'relative flex flex-col rounded-xl border overflow-hidden bg-surface shadow-sm',
                        'transition-[box-shadow,border-color] duration-200 hover:shadow-md',
                        'focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40',
                        isSelected ? 'border-primary ring-1 ring-primary/40' : 'border-subtle hover:border-strong'
                    )}
                >
                    {/* Selection checkbox */}
                    <div className="absolute top-2 left-2 z-20">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(prod.id)}
                            className={cn(input.checkbox, 'shadow-sm')}
                            aria-label={`Seleccionar ${prod.sku}`}
                        />
                    </div>

                    {/* Discontinued badge */}
                    {isProductDiscontinued(prod) && (
                        <span
                            className={cn(
                                badge.base, badge.size.sm, 'absolute top-2 right-2 z-20 shadow-sm',
                                prod.discontinued_until ? badge.tone.warning : badge.tone.danger
                            )}
                            title={prod.discontinued_until
                                ? `Descontinuado temporalmente hasta ${new Date(prod.discontinued_until).toLocaleDateString()}`
                                : 'Descontinuado permanentemente'}
                        >
                            {prod.discontinued_until
                                ? <Hourglass size={11} aria-hidden="true" />
                                : <TriangleAlert size={11} aria-hidden="true" />}
                            {prod.discontinued_until ? 'Temporal' : 'Descontinuado'}
                        </span>
                    )}

                    {/*
                        Miniatura grande.

                        `object-contain` sobre fondo neutro en vez de `object-cover`: un
                        repuesto suelto fotografiado sobre mesa se identifica por su
                        silueta completa, y el recorte cuadrado le cortaba justamente los
                        extremos (roscas, bridas, terminales) que lo distinguen de un
                        equivalente parecido.
                    */}
                    <button
                        type="button"
                        onClick={() => handleOpenLightbox(prod, 'image', 0)}
                        className={cn(
                            'relative aspect-[4/3] w-full bg-surface-2 group border-b border-subtle overflow-hidden',
                            focusRing
                        )}
                        title="Ver imágenes"
                    >
                        {prod.image_url ? (
                            <img
                                src={getThumbnailUrl(prod.image_url, 500, 375)}
                                alt={prod.name}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-contain p-2 transition-transform duration-200 group-hover:scale-[1.04]"
                                onError={(e) => {
                                    const target = e.currentTarget;
                                    if (target.src.includes('render/image')) {
                                        try { localStorage.setItem('supabase_transform_unsupported', 'true'); } catch (err) {}
                                        target.src = prod.image_url || '';
                                    } else {
                                        target.style.display = 'none';
                                        if (target.parentElement) {
                                            target.parentElement.innerHTML = PLACEHOLDER_IMAGE_SVG(40);
                                        }
                                    }
                                }}
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-fg-subtle">
                                <ImageOff size={32} aria-hidden="true" />
                                <span className="text-2xs font-medium">Sin imagen</span>
                            </div>
                        )}
                        {hasVideo && (
                            <span className="absolute bottom-2 right-2 bg-slate-900/70 text-white rounded-full p-1 flex items-center justify-center" title="Tiene video">
                                <Play size={14} aria-hidden="true" />
                            </span>
                        )}
                        {galleryCount > 0 && (
                            <span
                                className="absolute bottom-2 left-2 bg-slate-900/70 text-white text-2xs font-semibold px-1.5 py-0.5 rounded-full"
                                title={`${galleryCount + (prod.image_url ? 1 : 0)} archivos multimedia`}
                            >
                                {galleryCount + (prod.image_url ? 1 : 0)}
                            </span>
                        )}
                    </button>

                    {/* Body */}
                    <div className="flex flex-col gap-2 p-3 flex-1">
                        {/* SKU row */}
                        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                            <span className="font-mono text-xs text-fg-muted truncate flex-1 tracking-tight" title={prod.sku}>{prod.sku}</span>
                            <button
                                type="button"
                                onClick={(e) => handleCopySku(prod.sku, e)}
                                className={cn(
                                    'p-1 rounded-md transition-colors flex items-center justify-center shrink-0',
                                    focusRing,
                                    copiedSku === prod.sku
                                        ? 'text-success bg-success-soft'
                                        : 'text-fg-subtle hover:text-primary hover:bg-primary-soft'
                                )}
                                title={copiedSku === prod.sku ? '¡Copiado!' : 'Copiar código'}
                            >
                                {copiedSku === prod.sku ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                            </button>
                            <button
                                type="button"
                                onClick={(e) => handleShareCard(prod, e)}
                                disabled={sharingSku === prod.sku}
                                className={cn(
                                    'p-1 rounded-md transition-colors flex items-center justify-center shrink-0',
                                    'text-fg-subtle hover:text-primary hover:bg-primary-soft disabled:opacity-60',
                                    focusRing
                                )}
                                title="Copiar ficha del repuesto (imagen para WhatsApp)"
                            >
                                {sharingSku === prod.sku
                                    ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                                    : <ImageDown size={14} aria-hidden="true" />}
                            </button>
                        </div>

                        {/*
                            Nombre completo, sin recortes.

                            Va en tipografía sans (no monoespaciada): a igual ancho de
                            tarjeta entran ~15% más caracteres por línea, que en
                            descripciones de repuesto —medidas, años, compatibilidades—
                            se traduce en uno o dos renglones menos. La rejilla usa
                            alturas naturales, así que una descripción larga ya no estira
                            a las otras cuatro tarjetas de su fila.
                        */}
                        <h3
                            className="font-sans font-semibold text-sm text-fg leading-snug break-words hyphens-auto"
                            lang="es"
                        >
                            {highlightMatches(prod.name, highlightTerms)}
                        </h3>

                        <ProductBadges
                            prod={prod}
                            groupCounts={groupCounts}
                            onOpenGroup={() => handleOpenGroupModal(prod.group_id, prod)}
                            onOpenDemand={() => { setDemandProduct(prod); setIsDemandModalOpen(true); }}
                        />

                        {/* Brand */}
                        <div className="text-xs text-fg-muted">
                            {prod.brands?.name || '—'}
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1 items-center">
                            {prod.product_tags && prod.product_tags.length > 0 && prod.product_tags.map((pt: any) => {
                                const tag = pt.tags;
                                if (!tag) return null;
                                return (
                                    <button
                                        type="button"
                                        key={tag.id}
                                        className={cn(badge.base, badge.size.sm, 'hover:brightness-95 transition-[filter]', focusRing)}
                                        style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }}
                                        onClick={() => setSelectedProductForTags(prod)}
                                        title="Clic para editar etiquetas"
                                    >
                                        {tag.name}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setSelectedProductForTags(prod)}
                                className={cn(
                                    badge.base, badge.size.sm,
                                    'border-dashed border-strong text-fg-subtle bg-surface-2',
                                    'hover:text-primary hover:border-primary transition-colors',
                                    focusRing
                                )}
                                title="Asignar etiquetas"
                            >
                                <Plus size={11} aria-hidden="true" />
                                Etiqueta
                            </button>
                        </div>

                        {/* Precio + stock: el bloque de decisión de la tarjeta */}
                        <div className="flex items-end justify-between gap-2 mt-auto pt-2 bg-surface-2 -mx-3 px-3 py-2 border-t border-subtle">
                            <PriceBlock prod={prod} />
                            <StockBlock prod={prod} totalStock={totalStock} />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-center pt-1">
                            <ProductActions
                                prod={prod}
                                onQueue={handleQueueOne}
                                onEdit={handleOpenModal}
                                onMore={openActionMenu}
                                isMenuOpen={actionMenu?.prod?.id === prod.id}
                                size={16}
                            />
                        </div>
                    </div>
                </div>
            );
        });
    }, [products, selectedIds, groupCounts, copiedSku, highlightTerms, actionMenu]);

    /*
        Filtros rápidos declarados como datos, no como cuatro <select> copiados.

        Se acabaron los emoji dentro de los <option> (📸 ✅ 🟢 ✈️): el resto del
        sistema ya usa lucide-react, y un emoji se dibuja distinto en cada SO.
        Cada filtro lleva su icono lucide al lado del control, y el `label` sirve
        además para nombrarlo en el resumen de filtros activos.
    */
    const quickFilters = [
        {
            key: 'imageStatus', icon: ImageIcon, label: 'Imagen',
            options: [
                { value: '', label: 'Todas las imágenes' },
                { value: 'con_imagen', label: 'Con imagen' },
                { value: 'sin_imagen', label: 'Falta imagen' },
            ],
        },
        {
            key: 'videoStatus', icon: Video, label: 'Video',
            options: [
                { value: '', label: 'Todos los videos' },
                { value: 'con_video', label: 'Con video' },
                { value: 'sin_video', label: 'Falta video' },
            ],
        },
        {
            key: 'stockStatus', icon: Package, label: 'Stock',
            options: [
                { value: '', label: 'Todos los repuestos' },
                { value: 'disponibles_importadora', label: 'En importadora' },
                { value: 'solo_local', label: 'Solo local (agotado imp.)' },
                { value: 'disponibles_local', label: 'Con stock local' },
                { value: 'solo_importadora', label: 'Solo importadora (agotado local)' },
                { value: 'disponibles_cualquiera', label: 'Disponible (local o imp.)' },
                { value: 'agotados', label: 'Agotado en ambos' },
            ],
        },
        {
            key: 'discontinuedStatus', icon: Ban, label: 'Estado',
            options: [
                { value: '', label: 'Todos (general)' },
                { value: 'activos', label: 'Solo activos' },
                { value: 'descontinuados', label: 'Descontinuados' },
            ],
        },
    ];

    /*
        Resumen de lo que está filtrando ahora mismo.

        Antes había que bajar hasta el pie de página para saber cuántos resultados
        había, y no existía forma de ver de un vistazo qué combinación de filtros
        estaba aplicada — sobre todo con las palabras clave adicionales colapsadas
        en chips.
    */
    const activeFilterChips = [
        ...quickFilters.flatMap(f => {
            const value = filters[f.key];
            if (!value) return [];
            const opt = f.options.find(o => o.value === value);
            return [{ key: f.key, label: `${f.label}: ${opt?.label ?? value}`, clear: () => handleFilterChange(f.key, '') }];
        }),
        ...columns.filter(c => c.filterable && filters[c.key]).map(c => ({
            key: `col-${c.key}`,
            label: `${c.label}: ${filters[c.key]}`,
            clear: () => handleFilterChange(c.key, ''),
        })),
    ];

    const hasAnyFilter = activeFilterChips.length > 0 || searchTerms.some(t => t.trim().length > 0);

    const clearEverything = () => {
        setFilters({});
        setSearchTerms(['']);
        setExpanded([true]);
    };

    return (
        /*
            Tipografía híbrida.

            Antes toda la página iba en JetBrains Mono. La monoespaciada es
            excelente para SKU y cifras —caracteres alineados en columna, cero
            ambigüedad entre O/0 o l/1— pero para texto corrido ocupa ~15% más
            ancho por línea sin aportar nada: en descripciones largas de repuestos
            eso costaba uno o dos renglones extra por producto. Ahora la página es
            sans (Inter) y el `font-mono` se aplica sólo donde importa: SKU,
            precios, stock. Ver `fontFamily` en index.html.
        */
        <div className="p-6 md:p-8 max-w-[1400px] mx-auto flex flex-col gap-5">
            {/* ═══════ HEADER ═══════ */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-fg tracking-tight">Catálogo de Productos</h1>
                    <p className="text-sm text-fg-muted mt-0.5">Información maestra de repuestos: códigos, descripciones, precios y multimedia.</p>
                </div>

                {/*
                    Una sola acción primaria en pantalla.

                    Había cinco botones compitiendo, tres de ellos con fondo de color
                    (verde, azul, azul): sin jerarquía, el ojo no sabía cuál era la
                    acción esperada. Importar / multimedia / exportar son operaciones
                    ocasionales de mantenimiento, así que se agrupan tras "Acciones".
                */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleRefresh}
                        disabled={loading}
                        className={cn(button.base, button.variant.secondary, button.size.lg)}
                        title="Recargar el catálogo"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
                        Actualizar
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setIsHeaderMenuOpen(o => !o)}
                            className={cn(button.base, button.variant.secondary, button.size.lg)}
                            aria-haspopup="menu"
                            aria-expanded={isHeaderMenuOpen}
                        >
                            {isExporting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
                            {isExporting
                                ? (exportProgress.total > 0 ? `${exportProgress.current}/${exportProgress.total}…` : 'Preparando…')
                                : 'Acciones'}
                            <ChevronDown size={15} aria-hidden="true" />
                        </button>

                        {isHeaderMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsHeaderMenuOpen(false)} aria-hidden="true" />
                                <div
                                    role="menu"
                                    className="absolute right-0 top-full mt-1.5 z-50 w-64 bg-surface border border-subtle rounded-xl shadow-lg py-1.5 animate-in fade-in slide-in-from-top-1"
                                >
                                    <button
                                        role="menuitem"
                                        onClick={() => { setIsHeaderMenuOpen(false); setIsImportWizardOpen(true); }}
                                        className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-sm text-fg hover:bg-surface-hover transition-colors', focusRing)}
                                    >
                                        <Sparkles size={16} className="text-fg-subtle shrink-0" aria-hidden="true" />
                                        <span className="flex flex-col items-start">
                                            Importar catálogo
                                            <span className="text-2xs text-fg-subtle">Master data override</span>
                                        </span>
                                    </button>
                                    <button
                                        role="menuitem"
                                        onClick={() => { setIsHeaderMenuOpen(false); setIsBulkMediaOpen(true); }}
                                        className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-sm text-fg hover:bg-surface-hover transition-colors', focusRing)}
                                    >
                                        <FolderUp size={16} className="text-fg-subtle shrink-0" aria-hidden="true" />
                                        <span className="flex flex-col items-start">
                                            Subir multimedia
                                            <span className="text-2xs text-fg-subtle">Fotos y videos en lote</span>
                                        </span>
                                    </button>
                                    <button
                                        role="menuitem"
                                        onClick={() => { setIsHeaderMenuOpen(false); handleExportZip(); }}
                                        disabled={isExporting}
                                        className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-sm text-fg hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:pointer-events-none', focusRing)}
                                    >
                                        <FolderArchive size={16} className="text-fg-subtle shrink-0" aria-hidden="true" />
                                        <span className="flex flex-col items-start">
                                            Exportar ZIP
                                            <span className="text-2xs text-fg-subtle">Todas las imágenes enlazadas</span>
                                        </span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        onClick={() => handleOpenModal()}
                        className={cn(button.base, button.variant.primary, button.size.lg)}
                    >
                        <Plus size={16} aria-hidden="true" />
                        Nuevo Producto
                    </button>
                </div>
            </div>

            {/* ═══════ GLOBAL SEARCH & FILTERS ═══════ */}
            <div className="flex flex-col gap-3">
                {/* 1. Búsqueda principal + vista */}
                <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                        <Search size={17} className={cn(input.leadingIcon)} aria-hidden="true" />
                        <input
                            type="text"
                            placeholder="Buscar por descripción o SKU…"
                            value={searchTerms[0] || ''}
                            onChange={(e) => updateSearchTerm(0, e.target.value)}
                            className={cn(input.base, input.withLeadingIcon, 'h-11 px-3.5 pr-20 text-sm')}
                            aria-label="Buscar en el catálogo"
                        />
                        {/*
                            Indicador de "escribiendo/cargando" dentro del propio campo.
                            Antes el único aviso era que la tabla entera se atenuaba, lo
                            que no dejaba claro si los resultados visibles ya eran los
                            nuevos o todavía los anteriores.
                        */}
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            {loading && <Loader2 size={16} className="animate-spin text-primary" aria-hidden="true" />}
                            {(searchTerms[0] || '') && (
                                <button
                                    onClick={() => updateSearchTerm(0, '')}
                                    className={cn('p-1 rounded-md text-fg-subtle hover:text-fg hover:bg-surface-hover transition-colors', focusRing)}
                                    title="Limpiar búsqueda"
                                >
                                    <X size={16} aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={addSearchFilter}
                        title="Agregar palabra clave"
                        className={cn(button.base, button.variant.secondary, 'h-11 px-3 gap-1.5 shrink-0')}
                    >
                        <Plus size={16} aria-hidden="true" />
                        <span className="hidden sm:inline">Palabra clave</span>
                    </button>

                    {/* View mode toggle: gallery (big thumbnails) vs. dense table */}
                    <div className="flex bg-surface-2 border border-subtle rounded-lg p-0.5 shrink-0 h-11 items-center" role="group" aria-label="Modo de vista">
                        <button
                            type="button"
                            onClick={() => setViewMode('gallery')}
                            className={cn(
                                'flex items-center gap-1.5 px-3 h-9 rounded-md text-sm font-medium transition-colors',
                                focusRing,
                                viewMode === 'gallery' ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted hover:text-fg'
                            )}
                            aria-pressed={viewMode === 'gallery'}
                            title="Vista de galería (miniaturas grandes)"
                        >
                            <LayoutGrid size={17} aria-hidden="true" />
                            <span className="hidden lg:inline">Galería</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={cn(
                                'flex items-center gap-1.5 px-3 h-9 rounded-md text-sm font-medium transition-colors',
                                focusRing,
                                viewMode === 'table' ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted hover:text-fg'
                            )}
                            aria-pressed={viewMode === 'table'}
                            title="Vista de tabla (detallada)"
                        >
                            <Rows3 size={17} aria-hidden="true" />
                            <span className="hidden lg:inline">Tabla</span>
                        </button>
                    </div>
                </div>

                {/* 2. Filtros rápidos */}
                <div className="flex flex-wrap items-center gap-2">
                    {quickFilters.map(f => {
                        const Icon = f.icon;
                        const isActive = Boolean(filters[f.key]);
                        return (
                            /*
                                El ancho lo pone el contenedor, no el <select>:
                                `input.base` trae `w-full` y una clase `w-auto` en el
                                propio control no lo vence (en Tailwind gana el orden de
                                la hoja de estilos, no el del atributo class).
                            */
                            <div key={f.key} className="relative w-[172px]">
                                <Icon
                                    size={15}
                                    className={cn('absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10', isActive ? 'text-primary' : 'text-fg-subtle')}
                                    aria-hidden="true"
                                />
                                <select
                                    value={filters[f.key] || ''}
                                    onChange={(e) => handleFilterChange(f.key, e.target.value)}
                                    aria-label={`Filtrar por ${f.label}`}
                                    className={cn(input.select, input.size.md, 'pl-8', isActive && 'border-primary text-primary font-medium')}
                                >
                                    {f.options.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                        );
                    })}

                    {hasAnyFilter && (
                        <button
                            onClick={clearEverything}
                            className={cn(button.base, button.variant.ghost, button.size.md, 'text-danger hover:bg-danger-soft hover:text-danger')}
                            title="Quitar búsqueda y todos los filtros"
                        >
                            <FilterX size={15} aria-hidden="true" />
                            Limpiar todo
                        </button>
                    )}

                    {/*
                        Contador de resultados junto a los filtros, no sólo en el pie.
                        Es la respuesta a "¿mi filtro sirvió de algo?" y estaba a un
                        scroll de distancia de donde se toma esa decisión.
                    */}
                    <span className="ml-auto text-sm text-fg-muted tabular-nums">
                        {loading
                            ? 'Buscando…'
                            : <><span className="font-semibold text-fg">{pagination.totalRecords.toLocaleString('es-EC')}</span> repuesto{pagination.totalRecords === 1 ? '' : 's'}</>}
                    </span>
                </div>

                {/* 3. Resumen de filtros activos (chips) */}
                {activeFilterChips.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-2xs font-semibold uppercase tracking-wider text-fg-subtle">Filtros activos</span>
                        {activeFilterChips.map(chip => (
                            <span key={chip.key} className={cn(badge.base, badge.size.md, badge.tone.info)}>
                                {chip.label}
                                <button
                                    onClick={chip.clear}
                                    className={cn('ml-0.5 rounded-full p-0.5 hover:bg-primary/20 transition-colors', focusRing)}
                                    title="Quitar este filtro"
                                >
                                    <X size={12} aria-hidden="true" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                {/* 4. Palabras clave adicionales */}
                {searchTerms.length > 1 && (
                    <div className="flex flex-col gap-2 p-3 bg-surface-2 rounded-xl border border-subtle">
                        <div className="flex items-center justify-between text-2xs font-semibold text-fg-subtle uppercase tracking-wider px-1">
                            <span>Palabras clave adicionales</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={collapseAllFilters}
                                    className={cn('text-primary hover:underline transition-all text-2xs font-semibold rounded', focusRing)}
                                >
                                    Contraer todos
                                </button>
                                <span aria-hidden="true">·</span>
                                <button
                                    onClick={clearAllAdditionalFilters}
                                    className={cn('text-fg-muted hover:text-fg hover:underline transition-all text-2xs font-semibold rounded', focusRing)}
                                >
                                    Borrar palabras
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 items-center mt-1">
                            {searchTerms.slice(1).map((term, idx) => {
                                const actualIdx = idx + 1;
                                const isCollapsed = !expanded[actualIdx];
                                const isExclude = term.trim().startsWith('-');
                                const cleanTerm = isExclude ? term.trim().slice(1).trim() : term.trim();

                                const toggleExclude = (e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    if (isExclude) {
                                        updateSearchTerm(actualIdx, cleanTerm);
                                    } else {
                                        updateSearchTerm(actualIdx, `-${cleanTerm || ''}`);
                                    }
                                };

                                return (
                                    <div
                                        key={actualIdx}
                                        className="transition-all duration-300"
                                        onBlur={(e) => handleBlurContainer(e, actualIdx)}
                                    >
                                        {isCollapsed ? (
                                            <div
                                                onClick={() => toggleExpandFilter(actualIdx)}
                                                className={cn(
                                                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium text-xs border shadow-xs',
                                                    'cursor-pointer transition-colors',
                                                    isExclude
                                                        ? 'bg-danger-soft text-danger-soft-fg border-danger/20 hover:brightness-95'
                                                        : 'bg-surface text-fg border-strong hover:bg-surface-hover'
                                                )}
                                            >
                                                {isExclude
                                                    ? <Ban size={13} className="text-danger shrink-0" aria-hidden="true" />
                                                    : <Search size={13} className="text-primary shrink-0" aria-hidden="true" />}
                                                <span className="truncate max-w-[140px]">{cleanTerm || `Filtro ${actualIdx}`}</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeSearchFilter(actualIdx);
                                                    }}
                                                    className={cn('ml-0.5 p-0.5 rounded-full transition-colors text-fg-subtle hover:text-danger hover:bg-danger-soft', focusRing)}
                                                    title="Eliminar filtro"
                                                >
                                                    <X size={13} aria-hidden="true" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className={cn(
                                                'flex gap-1 items-center min-w-[280px] sm:min-w-[320px] p-1 rounded-lg border shadow-xs',
                                                isExclude ? 'bg-danger-soft border-danger/20' : 'bg-surface border-strong'
                                            )}>
                                                <div className="relative flex-1">
                                                    {isExclude
                                                        ? <Ban size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-danger" aria-hidden="true" />
                                                        : <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />}
                                                    <input
                                                        type="text"
                                                        placeholder={isExclude ? `Palabra a excluir ${actualIdx}…` : `Palabra clave ${actualIdx}…`}
                                                        value={term}
                                                        onChange={(e) => updateSearchTerm(actualIdx, e.target.value)}
                                                        className={cn(
                                                            'w-full pl-8 pr-24 py-2 bg-transparent text-sm outline-none',
                                                            isExclude ? 'text-danger-soft-fg placeholder:text-danger/50' : 'text-fg placeholder:text-fg-subtle'
                                                        )}
                                                        autoFocus
                                                    />
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                        <button
                                                            onClick={toggleExclude}
                                                            className={cn(
                                                                'px-1.5 py-0.5 rounded transition-colors text-2xs font-semibold uppercase tracking-wider',
                                                                focusRing,
                                                                isExclude
                                                                    ? 'bg-danger text-danger-fg hover:brightness-110'
                                                                    : 'bg-surface-3 text-fg-muted hover:text-fg'
                                                            )}
                                                            title={isExclude ? 'Cambiar a incluir' : 'Cambiar a excluir'}
                                                        >
                                                            {isExclude ? 'Excluir' : 'Incluir'}
                                                        </button>
                                                        {term && (
                                                            <button
                                                                onClick={() => updateSearchTerm(actualIdx, '')}
                                                                className={cn('p-0.5 rounded transition-colors text-fg-subtle hover:text-fg', focusRing)}
                                                                title="Limpiar"
                                                            >
                                                                <X size={14} aria-hidden="true" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => toggleExpandFilter(actualIdx)}
                                                    className={cn('px-2 py-1.5 rounded-md text-2xs font-semibold transition-colors shrink-0 text-fg-muted hover:text-fg hover:bg-surface-hover', focusRing)}
                                                    title="Contraer"
                                                >
                                                    Contraer
                                                </button>
                                                <button
                                                    onClick={() => removeSearchFilter(actualIdx)}
                                                    className={cn('p-1.5 rounded-md text-danger hover:bg-danger-soft flex items-center justify-center transition-colors shrink-0', focusRing)}
                                                    title="Eliminar"
                                                >
                                                    <X size={15} aria-hidden="true" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══════ TABLE / GALLERY ═══════ */}
            <div className="bg-surface border border-subtle rounded-xl shadow-sm overflow-hidden">
                {viewMode === 'table' ? (
                    /*
                        `max-h-[70dvh]` + `overflow-auto` habilitan la cabecera pegajosa:
                        con 100 productos por página se perdía de vista qué columna era
                        cuál a mitad de scroll.
                    */
                    <div className="overflow-auto max-h-[70dvh]">
                        <table className="w-full text-left border-collapse table-fixed">
                            {/*
                                Anchos declarados. Sin esto el navegador reparte según el
                                contenido y la columna "Repuesto" cambiaba de ancho en
                                cada página, según cuál fuera la descripción más larga.
                            */}
                            <colgroup>
                                <col style={{ width: '44px' }} />
                                {columns.map(col => (
                                    <col key={col.key} style={{ width: col.width }} />
                                ))}
                                <col style={{ width: '120px' }} />
                                <col style={{ width: '150px' }} />
                            </colgroup>
                            <thead className="bg-surface-2 border-b border-subtle sticky top-0 z-10">
                                <tr>
                                    <th scope="col" className="px-4 py-2.5">
                                        <input
                                            type="checkbox"
                                            checked={products.length > 0 && products.every(p => selectedIds.has(p.id))}
                                            onChange={toggleSelectAll}
                                            className={input.checkbox}
                                            aria-label="Seleccionar todos los productos de esta página"
                                        />
                                    </th>
                                    {columns.map(col => {
                                        const isSorted = sortConfig.key === col.key;
                                        return (
                                            <th
                                                key={col.key}
                                                scope="col"
                                                className="px-4 py-2.5 align-top"
                                                aria-sort={isSorted ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                                            >
                                                <div className="flex flex-col gap-1.5">
                                                    {/*
                                                        El <th> entero era clicable pero no alcanzable con
                                                        teclado. Ahora el disparador del orden es un <button>
                                                        real, y las flechas sí reflejan el estado: antes el
                                                        `className` llevaba una interpolación dentro de
                                                        comillas normales, así que se imprimía literal y
                                                        nunca se coloreaban.
                                                    */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSort(col.key)}
                                                        className={cn(
                                                            'flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider transition-colors rounded',
                                                            focusRing,
                                                            isSorted ? 'text-primary' : 'text-fg-muted hover:text-fg'
                                                        )}
                                                        title={`Ordenar por ${col.label}`}
                                                    >
                                                        {col.label}
                                                        <span className="flex flex-col leading-none" aria-hidden="true">
                                                            <ChevronUp size={10} className={isSorted && sortConfig.direction === 'asc' ? 'text-primary' : 'text-fg-subtle/50'} />
                                                            <ChevronDown size={10} className={isSorted && sortConfig.direction === 'desc' ? 'text-primary' : 'text-fg-subtle/50'} />
                                                        </span>
                                                    </button>
                                                    {col.filterable && (
                                                        <input
                                                            type="text"
                                                            placeholder="Filtrar…"
                                                            value={filters[col.key] || ''}
                                                            onChange={(e) => handleFilterChange(col.key, e.target.value)}
                                                            className={cn(input.base, input.size.sm, 'font-normal normal-case tracking-normal')}
                                                            aria-label={`Filtrar por ${col.label}`}
                                                        />
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    })}
                                    <th scope="col" className="px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-fg-muted text-center align-top">
                                        Stock
                                    </th>
                                    <th scope="col" className="px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-fg-muted text-center align-top">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                {loading && products.length === 0
                                    ? Array.from({ length: 6 }).map((_, i) => (
                                        /*
                                            Esqueleto en vez de un spinner suelto: mantiene el
                                            alto de la tabla, así que la página no da un salto
                                            cuando llegan los datos.
                                        */
                                        <tr key={`sk-${i}`}>
                                            <td className="px-4 py-3"><div className={cn(skeleton, 'h-4 w-4')} /></td>
                                            <td className="px-4 py-3"><div className={cn(skeleton, 'h-4 w-28')} /></td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-3">
                                                    <div className={cn(skeleton, 'h-10 w-10 shrink-0')} />
                                                    <div className="flex flex-col gap-1.5 flex-1">
                                                        <div className={cn(skeleton, 'h-3.5 w-full')} />
                                                        <div className={cn(skeleton, 'h-3.5 w-2/3')} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3"><div className={cn(skeleton, 'h-4 w-16')} /></td>
                                            <td className="px-4 py-3"><div className={cn(skeleton, 'h-8 w-24')} /></td>
                                            <td className="px-4 py-3"><div className={cn(skeleton, 'h-8 w-16 mx-auto')} /></td>
                                            <td className="px-4 py-3"><div className={cn(skeleton, 'h-7 w-28 mx-auto')} /></td>
                                        </tr>
                                    ))
                                    : renderedRows}
                                {products.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={columns.length + 3} className="px-4 py-14">
                                            <EmptyState onClear={hasAnyFilter ? clearEverything : undefined} />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-4">
                        {/* Barra de la galería: sustituye a la cabecera de tabla (orden, filtros, selección) */}
                        <div className="flex flex-wrap items-end gap-3 mb-4 pb-4 border-b border-subtle">
                            <label className="flex items-center gap-2 h-9 px-2 text-xs font-medium text-fg-muted cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={products.length > 0 && products.every(p => selectedIds.has(p.id))}
                                    onChange={toggleSelectAll}
                                    className={input.checkbox}
                                />
                                Seleccionar todo
                            </label>
                            <div className="w-px h-9 bg-subtle hidden sm:block" aria-hidden="true" />

                            {/* Etiquetas visibles: los inputs sueltos sin nombre obligaban a adivinar qué filtraba cada uno */}
                            <div className="flex flex-col gap-1">
                                <span className="text-2xs font-semibold text-fg-muted">Ordenar por</span>
                                <div className="flex gap-1 w-[186px]">
                                    <select
                                        value={sortConfig.key}
                                        onChange={(e) => handleSort(e.target.value)}
                                        className={cn(input.select, input.size.sm, 'flex-1')}
                                        aria-label="Ordenar por"
                                    >
                                        {columns.map(col => (
                                            <option key={col.key} value={col.key}>{col.label}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))}
                                        className={cn(button.base, button.variant.secondary, button.icon.sm)}
                                        title={sortConfig.direction === 'asc' ? 'Ascendente — clic para invertir' : 'Descendente — clic para invertir'}
                                        aria-label={sortConfig.direction === 'asc' ? 'Orden ascendente' : 'Orden descendente'}
                                    >
                                        {sortConfig.direction === 'asc' ? <ArrowUp size={15} aria-hidden="true" /> : <ArrowDown size={15} aria-hidden="true" />}
                                    </button>
                                </div>
                            </div>

                            {columns.filter(col => col.filterable).map(col => (
                                <div key={col.key} className="flex flex-col gap-1 w-40">
                                    <span className="text-2xs font-semibold text-fg-muted">Filtrar {col.label}</span>
                                    <input
                                        type="text"
                                        placeholder={`${col.label}…`}
                                        value={filters[col.key] || ''}
                                        onChange={(e) => handleFilterChange(col.key, e.target.value)}
                                        className={cn(input.base, input.size.sm)}
                                    />
                                </div>
                            ))}
                        </div>

                        {/*
                            Rejilla de alturas naturales.

                            `auto-rows-fr` igualaba el alto de toda la fila al de su
                            tarjeta más alta: un solo repuesto con seis renglones de
                            descripción estiraba las otras cuatro y dejaba huecos
                            enormes. Al quitarlo, cada tarjeta ocupa lo que necesita y
                            los nombres siguen mostrándose completos.
                            El tope de 4 columnas hasta 2xl mantiene una medida de línea
                            legible; a 5 columnas las descripciones largas quedaban en
                            columnas de tres palabras.
                        */}
                        {loading && products.length === 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 items-start">
                                {Array.from({ length: 10 }).map((_, i) => (
                                    <div key={`skc-${i}`} className="flex flex-col rounded-xl border border-subtle overflow-hidden bg-surface">
                                        <div className={cn(skeleton, 'aspect-[4/3] w-full rounded-none')} />
                                        <div className="flex flex-col gap-2 p-3">
                                            <div className={cn(skeleton, 'h-3 w-24')} />
                                            <div className={cn(skeleton, 'h-3.5 w-full')} />
                                            <div className={cn(skeleton, 'h-3.5 w-4/5')} />
                                            <div className={cn(skeleton, 'h-10 w-full mt-1')} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : products.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 items-start">
                                {renderedCards}
                            </div>
                        ) : (
                            <div className="py-10">
                                <EmptyState onClear={hasAnyFilter ? clearEverything : undefined} />
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════ PAGINATION FOOTER ═══════ */}
                {pagination.totalRecords > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-subtle bg-surface-2">
                        <div className="text-sm text-fg-muted tabular-nums">
                            Mostrando <span className="font-semibold text-fg">{showingFrom}–{showingTo}</span> de <span className="font-semibold text-fg">{pagination.totalRecords.toLocaleString('es-EC')}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Page size selector */}
                            <div className="w-[106px]">
                                <select
                                    value={pagination.pageSize}
                                    onChange={(e) => setPagination(prev => ({ ...prev, pageSize: parseInt(e.target.value), page: 1 }))}
                                    className={cn(input.select, input.size.sm)}
                                    aria-label="Productos por página"
                                >
                                    <option value={20}>20 / pág</option>
                                    <option value={50}>50 / pág</option>
                                    <option value={100}>100 / pág</option>
                                </select>
                            </div>

                            <button
                                disabled={pagination.page === 1}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                className={cn(button.base, button.variant.secondary, button.size.sm)}
                            >
                                <ChevronLeft size={15} aria-hidden="true" />
                                <span className="hidden sm:inline">Anterior</span>
                            </button>

                            <span className="px-3 h-8 flex items-center text-sm font-medium text-fg-muted tabular-nums">
                                {pagination.page} / {totalPages || 1}
                            </span>

                            <button
                                disabled={pagination.page >= totalPages || totalPages === 0}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                className={cn(button.base, button.variant.secondary, button.size.sm)}
                            >
                                <span className="hidden sm:inline">Siguiente</span>
                                <ChevronRight size={15} aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══════ MODALS ═══════ */}
            <ProductModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => fetchCatalogData(pagination.page)}
                productToEdit={productToEdit}
            />

            <CatalogImportWizard
                isOpen={isImportWizardOpen}
                onClose={() => setIsImportWizardOpen(false)}
                onSuccess={() => fetchCatalogData(1)}
            />

            <BulkEditModal
                isOpen={isBulkEditOpen}
                onClose={() => setIsBulkEditOpen(false)}
                onSuccess={handleBulkEditSuccess}
                selectedProducts={selectedProducts}
            />

            <ProductDemandModal
                isOpen={isDemandModalOpen}
                onClose={() => { setIsDemandModalOpen(false); setDemandProduct(null); }}
                product={demandProduct}
            />

            <SourcingQuickEditModal
                isOpen={isSourcingModalOpen}
                onClose={() => { setIsSourcingModalOpen(false); setSourcingProduct(null); }}
                product={sourcingProduct}
                onSuccess={() => fetchCatalogData(pagination.page)}
            />

            <BulkMediaUploadModal
                isOpen={isBulkMediaOpen}
                onClose={() => setIsBulkMediaOpen(false)}
                onSuccess={() => fetchCatalogData(pagination.page)}
            />

            <MediaLightbox
                isOpen={lightbox.isOpen}
                media={lightbox.media}
                initialIndex={lightbox.initialIndex}
                onClose={() => setLightbox(prev => ({ ...prev, isOpen: false }))}
                onAddMedia={() => {
                    setLightbox(prev => ({ ...prev, isOpen: false }));
                    if (lightbox.product) {
                        handleOpenModal(lightbox.product);
                    }
                }}
            />

            <QuickTagAssignModal 
                isOpen={!!selectedProductForTags}
                onClose={() => setSelectedProductForTags(null)}
                onSuccess={() => fetchCatalogData(pagination.page)}
                productId={selectedProductForTags?.id}
                productName={selectedProductForTags?.name || ''}
            />

            {isGroupModalOpen && groupModalProduct && (
                <ProductGroupModal
                    isOpen={isGroupModalOpen}
                    onClose={() => { setIsGroupModalOpen(false); setSelectedGroupId(null); setGroupModalProduct(null); }}
                    groupId={selectedGroupId}
                    initialProduct={groupModalProduct}
                    onEditProduct={(prod) => {
                        setIsGroupModalOpen(false);
                        handleOpenModal(prod);
                    }}
                    onSuccess={() => fetchCatalogData(pagination.page)}
                />
            )}

            {/* ═══════ FLOATING ACTION BAR ═══════ */}
            {selectedIds.size > 0 && (
                /*
                    Barra de selección múltiple.

                    Cinco botones de colores sólidos (verde, ámbar, azul, verde,
                    rojo) sobre fondo oscuro competían entre sí y ninguno destacaba;
                    además todos tenían `hover:` igual a su fondo, así que no había
                    respuesta al ratón. Ahora son secundarios sobre la superficie
                    oscura y sólo "Eliminar" conserva color, por ser la destructiva.

                    `left-1/2 -translate-x-1/2` se cambió por un centrado con
                    márgenes: a la derecha vive el FAB de la cola de impresión y en
                    pantallas medianas se solapaban.
                */
                <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-6 pointer-events-none">
                    <div className="pointer-events-auto max-w-full overflow-x-auto bg-slate-900 dark:bg-slate-800 text-white rounded-xl shadow-xl border border-white/10 px-4 py-2.5 flex items-center gap-2 animate-in slide-in-from-bottom-4">
                        <div className="flex items-center gap-2 text-sm pr-2 shrink-0">
                            <span className="bg-primary text-primary-fg font-semibold px-2 py-0.5 rounded-full text-xs tabular-nums">{selectedIds.size}</span>
                            <span className="text-slate-300 hidden sm:inline">seleccionado{selectedIds.size !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="w-px h-6 bg-white/15 shrink-0" aria-hidden="true" />

                        {[
                            { label: 'Grupo inventario', icon: Boxes, onClick: () => setIsInventoryGroupSelectOpen(true) },
                            { label: 'Edición rápida', icon: FilePen, onClick: () => setIsBulkEditOpen(true) },
                            {
                                label: 'Cola de impresión', icon: ListPlus, onClick: async () => {
                                    const selectedProds = products.filter(p => selectedIds.has(p.id));
                                    for (const prod of selectedProds) {
                                        await addToQueue({ id: prod.id, sku: prod.sku, name: prod.name, image_url: prod.image_url }, 1);
                                    }
                                    await loadQueue();
                                    setQueueToast(`${selectedProds.length} repuesto(s) agregados a la cola`);
                                    setTimeout(() => setQueueToast(null), 2200);
                                    setSelectedIds(new Set());
                                }
                            },
                            {
                                label: 'Proforma', icon: FileText, onClick: () => {
                                    const selectedProds = products.filter(p => selectedIds.has(p.id));
                                    selectedProds.forEach(prod => {
                                        useProformaStore.getState().addItem({ id: prod.id, sku: prod.sku, name: prod.name, price: prod.price }, 1);
                                    });
                                    setSelectedIds(new Set());
                                }
                            },
                        ].map(action => (
                            <button
                                key={action.label}
                                onClick={action.onClick}
                                className={cn(
                                    'flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium shrink-0 whitespace-nowrap',
                                    'bg-white/10 text-white hover:bg-white/20 transition-colors',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70'
                                )}
                            >
                                <action.icon size={16} aria-hidden="true" />
                                {action.label}
                            </button>
                        ))}

                        <button
                            onClick={handleBulkDelete}
                            className={cn(
                                'flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium shrink-0 whitespace-nowrap ml-1',
                                'bg-danger text-danger-fg hover:brightness-110 transition-[filter]',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70'
                            )}
                        >
                            <Trash size={16} aria-hidden="true" />
                            Eliminar
                        </button>
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 transition-colors rounded-lg shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                            title="Deseleccionar todo"
                        >
                            <X size={16} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            )}
            {isLabelModalOpen && (
                <ProductLabelModal
                    isOpen={isLabelModalOpen}
                    onClose={() => {
                        setIsLabelModalOpen(false);
                        setLabelProduct(null);
                    }}
                    product={labelProduct}
                />
            )}
            {isInventoryGroupSelectOpen && (
                <InventoryGroupSelectModal
                    isOpen={isInventoryGroupSelectOpen}
                    onClose={() => setIsInventoryGroupSelectOpen(false)}
                    onSuccess={() => setSelectedIds(new Set())}
                    selectedIds={selectedIds}
                />
            )}

            {/* ═══════ QUEUE TOAST ═══════ */}
            {queueToast && (
                <div role="status" className="fixed top-6 right-6 z-50 bg-warning text-warning-fg py-3 px-5 rounded-xl shadow-xl flex items-center gap-2 font-semibold text-sm animate-in slide-in-from-top-2">
                    <ListChecks size={18} aria-hidden="true" />
                    {queueToast}
                </div>
            )}

            {/* ═══════ SHARE CARD TOAST ═══════ */}
            {shareToast && (
                <div role="status" className="fixed top-6 right-6 z-50 bg-primary text-white py-3 px-5 rounded-xl shadow-xl flex items-center gap-2 font-semibold text-sm animate-in slide-in-from-top-2">
                    <ImageDown size={18} aria-hidden="true" />
                    {shareToast}
                </div>
            )}

            {/* ═══════ PRINT QUEUE FLOATING INDICATOR ═══════ */}
            {(() => {
                const q = printQueue;
                if (q.length === 0) return null;
                const totalLabels = getQueueTotalLabels(q);
                const totalPages = getQueuePageCount(q);
                return (
                    <>
                        {/* Collapsed FAB */}
                        {!isQueuePanelOpen && (
                            <button
                                onClick={() => { loadQueue(); setIsQueuePanelOpen(true); }}
                                className={cn(
                                    'fixed bottom-6 right-6 z-40 bg-warning text-warning-fg w-14 h-14 rounded-full',
                                    'shadow-xl shadow-warning/40 flex items-center justify-center',
                                    'transition-[transform,filter] hover:brightness-110 hover:scale-105 active:scale-95',
                                    focusRing
                                )}
                                title="Ver cola de impresión"
                            >
                                <Printer size={24} aria-hidden="true" />
                                <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] flex items-center justify-center bg-surface text-warning text-[11px] font-bold rounded-full shadow-md border-2 border-warning tabular-nums">
                                    {q.length}
                                </span>
                            </button>
                        )}

                        {/* Expanded Queue Panel */}
                        {isQueuePanelOpen && (
                            <div className="fixed bottom-6 right-6 z-40 w-[380px] max-h-[70dvh] bg-surface rounded-2xl shadow-xl border border-subtle flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
                                {/* Panel Header */}
                                <div className="flex items-center justify-between p-4 border-b border-subtle bg-warning-soft">
                                    <div className="flex items-center gap-2">
                                        <Printer size={18} className="text-warning" aria-hidden="true" />
                                        <h3 className="font-bold text-fg text-sm">Cola de Impresión</h3>
                                        {/* `bg-warning text-warning` dejaba el texto invisible sobre su propio fondo. */}
                                        <span className={cn(badge.base, badge.size.sm, badge.tone.warning)}>
                                            {totalLabels} etiq · {totalPages} hoja{totalPages !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <button onClick={() => setIsQueuePanelOpen(false)} className={cn('p-1 text-fg-subtle hover:text-fg rounded-lg hover:bg-surface-hover transition-colors', focusRing)}>
                                        <X size={18} aria-hidden="true" />
                                    </button>
                                </div>

                                {/* Queue Items */}
                                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 max-h-[45dvh]">
                                    {printQueue.map((item) => (
                                        <div key={item.sku} className="flex items-center gap-2.5 p-2.5 bg-surface-2 rounded-xl border border-subtle">
                                            <div className="flex-1 min-w-0">
                                                <span className="text-[11px] font-mono font-bold text-primary">{item.sku}</span>
                                                <p className="text-xs font-semibold text-fg truncate" title={item.name}>{item.name}</p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button onClick={async () => { const updated = await updateQueueItemQty(item.id, item.quantity - 1); setPrintQueue(updated); }} className={cn('w-6 h-6 rounded bg-surface-3 text-fg-muted flex items-center justify-center text-xs font-bold hover:bg-surface-hover hover:text-fg transition-colors', focusRing)} aria-label="Quitar una etiqueta">−</button>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={async (e) => { const updated = await updateQueueItemQty(item.id, parseInt(e.target.value) || 1); setPrintQueue(updated); }}
                                                    className="w-10 h-6 text-center bg-surface border border-subtle rounded text-xs font-bold text-fg p-0 focus:ring-0"
                                                />
                                                <button onClick={async () => { const updated = await updateQueueItemQty(item.id, item.quantity + 1); setPrintQueue(updated); }} className={cn('w-6 h-6 rounded bg-surface-3 text-fg-muted flex items-center justify-center text-xs font-bold hover:bg-surface-hover hover:text-fg transition-colors', focusRing)} aria-label="Agregar una etiqueta">+</button>
                                            </div>
                                            <button onClick={async () => { const updated = await removeFromQueue(item.id); setPrintQueue(updated); }} className={cn('p-1 text-fg-subtle hover:text-danger hover:bg-danger-soft rounded-lg transition-colors', focusRing)} title="Quitar de la cola">
                                                <X size={16} aria-hidden="true" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Panel Footer */}
                                <div className="p-3 border-t border-subtle flex gap-2">
                                    {!showQueueClearConfirm ? (
                                        <button
                                            onClick={() => setShowQueueClearConfirm(true)}
                                            className="px-3 py-2 text-xs font-semibold text-danger hover:bg-danger-soft rounded-lg transition-colors flex items-center gap-1"
                                        >
                                            <Trash size={16} aria-hidden="true" />
                                            Vaciar
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[11px] text-danger font-bold">¿Seguro?</span>
                                            <button onClick={async () => { await clearQueue(); setPrintQueue([]); setShowQueueClearConfirm(false); setIsQueuePanelOpen(false); }} className={cn('text-2xs font-bold text-danger-fg bg-danger px-2 py-1 rounded hover:brightness-110 transition-[filter]', focusRing)}>Sí</button>
                                            <button onClick={() => setShowQueueClearConfirm(false)} className={cn('text-2xs font-bold text-fg-muted bg-surface-3 px-2 py-1 rounded hover:bg-surface-hover transition-colors', focusRing)}>No</button>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => {
                                            setIsQueuePanelOpen(false);
                                            setIsQueuePreviewOpen(true);
                                        }}
                                        className={cn(button.base, button.variant.success, button.size.lg, 'flex-1')}
                                    >
                                        <Eye size={17} aria-hidden="true" />
                                        Vista previa e imprimir ({totalLabels})
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                );
            })()}

            {/* Print Queue Preview Interactive Modal */}
            <PrintQueuePreviewModal
                isOpen={isQueuePreviewOpen}
                onClose={() => setIsQueuePreviewOpen(false)}
                onQueueUpdated={(updatedQueue) => setPrintQueue(updatedQueue)}
                isMobile={false}
            />

            {/*
                ═══════ MENÚ DE ACCIONES SECUNDARIAS ═══════

                Se renderiza aquí, a nivel de página y con posición `fixed`, en
                lugar de dentro de la fila: el contenedor de la tabla tiene
                `overflow-auto` (necesario para la cabecera pegajosa) y un popover
                anidado quedaría recortado por el borde de la tabla.
            */}
            {actionMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setActionMenu(null)} aria-hidden="true" />
                    <div
                        role="menu"
                        aria-label={`Acciones para ${actionMenu.prod.sku}`}
                        className="fixed z-50 w-64 bg-surface border border-subtle rounded-xl shadow-lg py-1.5 animate-in fade-in zoom-in-95"
                        style={{
                            // Se ancla por la derecha del botón y se sube si no cabe abajo.
                            left: Math.max(8, Math.min(actionMenu.x - 256, window.innerWidth - 264)),
                            top: Math.min(actionMenu.y, window.innerHeight - 300),
                        }}
                    >
                        <div className="px-3 pb-1.5 mb-1 border-b border-subtle">
                            <p className="font-mono text-2xs text-fg-subtle truncate">{actionMenu.prod.sku}</p>
                        </div>
                        {secondaryActions(actionMenu.prod).map(action => (
                            <button
                                key={action.key}
                                role="menuitem"
                                onClick={() => { setActionMenu(null); action.onClick(); }}
                                className={cn(
                                    'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                                    focusRing,
                                    action.danger
                                        ? 'text-danger hover:bg-danger-soft'
                                        : 'text-fg hover:bg-surface-hover'
                                )}
                            >
                                <action.icon size={16} className={cn('shrink-0', !action.danger && 'text-fg-subtle')} aria-hidden="true" />
                                <span className="text-left">{action.label}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}

            {/* Proformas floating panel */}
            <ProformaPanel />
        </div>
    );
};

export default Products;
