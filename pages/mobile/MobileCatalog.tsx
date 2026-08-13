import React, { useState, useEffect, useCallback, useMemo, useRef, useDeferredValue } from 'react';
import { supabase } from '../../supabaseClient';
import { getThumbnailUrl } from '../../utils/image';
import { isProductDiscontinued } from '../../utils/discontinuedHelper';
import { useMobileProducts, searchProducts } from '../../utils/mobileSearchEngine';
import MobileSearchBar from '../../components/mobile/MobileSearchBar';
import { useBackDismiss } from '../../hooks/useBackDismiss';

// Modals
import { ProductModal } from '../../components/ProductModal';
import { ProductGroupModal } from '../../components/ProductGroupModal';
import { MediaLightbox } from '../../components/MediaLightbox';
import { QuickTagAssignModal } from '../../components/QuickTagAssignModal';
import { ProductLabelModal } from '../../components/ProductLabelModal';
import { ProductDemandModal } from '../../components/ProductDemandModal';
import { SourcingQuickEditModal } from '../../components/SourcingQuickEditModal';
import { BulkEditModal } from '../../components/BulkEditModal';
import { InventoryGroupSelectModal } from '../../components/InventoryGroupSelectModal';

import { printLabelsQuick, addToPrintHistory } from '../../utils/mobileLabelPrinter';
import { addToQueue } from '../../utils/mobilePrintQueue';
import { useProformaStore } from '../../store/useProformaStore';

import {
    ArrowUp,
    ArrowUpDown,
    Ban,
    BellRing,
    Boxes,
    Camera,
    Check,
    ChevronDown,
    Copy,
    ExternalLink,
    FilePen,
    FileText,
    Hourglass,
    Image as ImageIcon,
    ImageOff,
    Link as LinkIcon,
    ListPlus,
    Loader2,
    Package,
    Pencil,
    Plus,
    Printer,
    RefreshCw,
    ScanBarcode,
    SearchX,
    SlidersHorizontal,
    Tag,
    Telescope,
    Trash2,
    TriangleAlert,
    Video,
    X,
} from 'lucide-react';

/* ────────────────────────────────────────────────────────────────────────────
   CONSTANTES
   ──────────────────────────────────────────────────────────────────────── */

/** Alto mínimo de cualquier zona táctil. Por debajo de esto se falla el toque. */
const TAP = 'min-h-[44px] min-w-[44px]';

/**
 * Ordenamientos disponibles.
 *
 * El catálogo móvil no tenía ninguno: la lista siempre llegaba alfabética, así
 * que para saber qué repuesto es el más caro o cuál tiene más stock había que
 * abrir el escritorio.
 */
const SORT_OPTIONS = [
    { key: 'name-asc', label: 'Nombre (A → Z)' },
    { key: 'name-desc', label: 'Nombre (Z → A)' },
    { key: 'price-desc', label: 'Precio: mayor primero' },
    { key: 'price-asc', label: 'Precio: menor primero' },
    { key: 'stock-desc', label: 'Más stock primero' },
    { key: 'stock-asc', label: 'Menos stock primero' },
] as const;

type SortKey = typeof SORT_OPTIONS[number]['key'];

/**
 * Filtros rápidos como grupos de fichas, no como <select> nativos.
 *
 * En el móvil un <select> abre la rueda del sistema operativo: tres gestos
 * (abrir, girar, aceptar) para elegir una de tres opciones. Con fichas es un
 * solo toque y además se ve de un vistazo cuál está activa.
 *
 * Los emoji que hacían de icono (📸 🎬 📦 ⚙️ ✅ 🟢 ✈️ …) están prohibidos
 * explícitamente en design-system/modo-movil-industrial/MASTER.md: cada sistema
 * operativo los dibuja distinto y no combinan con el resto de la interfaz.
 */
const FILTER_GROUPS = [
    {
        key: 'imageStatus',
        label: 'Imagen',
        icon: ImageIcon,
        options: [
            { value: '', label: 'Todas' },
            { value: 'con_imagen', label: 'Con imagen' },
            { value: 'sin_imagen', label: 'Falta imagen' },
        ],
    },
    {
        key: 'videoStatus',
        label: 'Video',
        icon: Video,
        options: [
            { value: '', label: 'Todos' },
            { value: 'con_video', label: 'Con video' },
            { value: 'sin_video', label: 'Falta video' },
        ],
    },
    {
        key: 'stockStatus',
        label: 'Stock',
        icon: Package,
        options: [
            { value: '', label: 'Todos' },
            { value: 'disponibles_cualquiera', label: 'Disponible' },
            { value: 'disponibles_local', label: 'Con stock local' },
            { value: 'disponibles_importadora', label: 'En importadora' },
            { value: 'solo_local', label: 'Solo local' },
            { value: 'solo_importadora', label: 'Solo importadora' },
            { value: 'agotados', label: 'Agotados' },
        ],
    },
    {
        key: 'discontinuedStatus',
        label: 'Estado',
        icon: Ban,
        options: [
            { value: '', label: 'Todos' },
            { value: 'activos', label: 'Solo activos' },
            { value: 'descontinuados', label: 'Descontinuados' },
        ],
    },
] as const;

const money = (v: number | null | undefined) =>
    `$${(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ────────────────────────────────────────────────────────────────────────────
   SUB-COMPONENTES
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Congela el scroll del modo móvil mientras haya hojas abiertas.
 *
 * El scroll no vive en <body> sino en el <main> del layout, así que el truco
 * habitual (`document.body.style.overflow`) no hacía nada: la lista de repuestos
 * seguía corriendo bajo el dedo con la hoja encima. Se cuenta cuántas hojas hay
 * abiertas para no descongelar de más al cerrar una sobre otra.
 */
let openSheetCount = 0;

const useMobileScrollLock = (active: boolean) => {
    useEffect(() => {
        if (!active) return;

        const scroller = document.querySelector<HTMLElement>('[data-mobile-scroll]');
        const previousOverflow = scroller?.style.overflow ?? '';

        openSheetCount += 1;
        if (scroller) scroller.style.overflow = 'hidden';

        return () => {
            openSheetCount -= 1;
            if (openSheetCount === 0 && scroller) scroller.style.overflow = previousOverflow;
        };
    }, [active]);
};

/** Recorrido del dedo, hacia abajo, que baja la hoja del todo. */
const SHEET_DISMISS_DISTANCE = 96;

/** Hoja inferior. Toda ventana del móvil entra por abajo, al alcance del pulgar. */
const Sheet: React.FC<{ open: boolean; onClose: () => void; title: string; icon?: React.ElementType; children: React.ReactNode }> =
({ open, onClose, title, icon: Icon, children }) => {
    // El «atrás» del teléfono baja la hoja; antes se llevaba por delante la pantalla entera.
    useBackDismiss(open, onClose);
    useMobileScrollLock(open);

    // Arrastre desde la cabecera: el asa era decorativa, ahora tira de verdad.
    const dragStartRef = useRef<number | null>(null);
    const [dragY, setDragY] = useState(0);

    useEffect(() => {
        if (!open) setDragY(0);
    }, [open]);

    const onDragStart = (e: React.TouchEvent) => {
        dragStartRef.current = e.touches[0].clientY;
    };

    const onDragMove = (e: React.TouchEvent) => {
        if (dragStartRef.current === null) return;
        // Solo hacia abajo: tirar hacia arriba no debe despegar la hoja del borde.
        setDragY(Math.max(0, e.touches[0].clientY - dragStartRef.current));
    };

    const onDragEnd = () => {
        if (dragStartRef.current === null) return;
        dragStartRef.current = null;
        if (dragY >= SHEET_DISMISS_DISTANCE) onClose();
        else setDragY(0);
    };

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div
                className="relative bg-slate-900 rounded-t-3xl shadow-2xl animate-slide-up border-t border-slate-700 max-h-[85dvh] flex flex-col"
                style={{
                    transform: dragY ? `translateY(${dragY}px)` : undefined,
                    transition: dragY ? 'none' : 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1)',
                }}
            >
                <div
                    className="shrink-0 px-5 pt-3 pb-2 touch-none cursor-grab active:cursor-grabbing"
                    onTouchStart={onDragStart}
                    onTouchMove={onDragMove}
                    onTouchEnd={onDragEnd}
                    onTouchCancel={onDragEnd}
                >
                    <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-4" />
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            {Icon && <Icon size={20} className="text-amber-400" aria-hidden="true" />}
                            {title}
                        </h2>
                        <button onClick={onClose} className={`${TAP} flex items-center justify-center text-slate-400 rounded-xl active:bg-slate-800`} aria-label="Cerrar">
                            <X size={22} aria-hidden="true" />
                        </button>
                    </div>
                </div>
                <div className="overflow-y-auto px-5 pt-2" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
                    {children}
                </div>
            </div>
        </div>
    );
};

/** Ficha de opción — botón grande, sin rueda del sistema operativo. */
const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`min-h-[44px] px-4 rounded-xl text-sm font-semibold border transition-colors ${
            active
                ? 'bg-amber-500 border-amber-400 text-slate-950'
                : 'bg-slate-800 border-slate-700 text-slate-300 active:bg-slate-700'
        }`}
    >
        {children}
    </button>
);

/** Acción dentro de la tarjeta desplegada: icono + NOMBRE. */
const CardAction: React.FC<{ icon: React.ElementType; label: string; onClick: () => void; tone?: 'default' | 'danger' | 'accent' }> =
({ icon: Icon, label, onClick, tone = 'default' }) => (
    <button
        type="button"
        onClick={onClick}
        className={`min-h-[52px] px-3 rounded-xl flex items-center gap-2.5 text-sm font-semibold border transition-colors text-left ${
            tone === 'danger'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 active:bg-rose-500/20'
                : tone === 'accent'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 active:bg-amber-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-200 active:bg-slate-700'
        }`}
    >
        <Icon size={18} className="shrink-0" aria-hidden="true" />
        <span className="leading-tight">{label}</span>
    </button>
);

/* ────────────────────────────────────────────────────────────────────────────
   TARJETA DE REPUESTO
   ──────────────────────────────────────────────────────────────────────── */

type CardActionDef = { key: string; label: string; icon: React.ElementType; onClick: () => void; tone?: 'default' | 'danger' | 'accent' };

interface CardProps {
    prod: any;
    isSelected: boolean;
    isExpanded: boolean;
    copiedSku: string | null;
    equivalents: number;
    onToggleExpand: () => void;
    onToggleSelect: () => void;
    onOpenLightbox: () => void;
    onCopySku: (e: React.MouseEvent) => void;
    onQuickPrint: (e: React.MouseEvent) => void;
    onQueue: () => void;
    /**
     * Constructor de acciones, no el array ya construido.
     *
     * Si el padre pasara el array, su identidad cambiaría en cada render y
     * `React.memo` no serviría de nada: las ~200 tarjetas que llegan a existir
     * tras varias páginas de scroll se repintarían con cada pulsación.
     */
    buildActions: (prod: any) => CardActionDef[];
}

/** Umbral y ancho del cajón que se descubre al deslizar la tarjeta. */
const SWIPE_MAX = 152;
const SWIPE_SNAP = 60;

const ProductCard: React.FC<CardProps> = React.memo(({
    prod, isSelected, isExpanded, copiedSku, equivalents,
    onToggleExpand, onToggleSelect, onOpenLightbox, onCopySku, onQuickPrint, onQueue, buildActions,
}) => {
    const actions = useMemo(() => buildActions(prod), [buildActions, prod]);
    const globalStock = prod.inventory_levels?.reduce((acc: number, l: any) => acc + (l.current_stock || 0), 0) || 0;
    const importer = prod.importer_stock || 0;
    const thumb = prod.image_url ? getThumbnailUrl(prod.image_url, 128, 128) : null;
    const discontinued = isProductDiscontinued(prod);
    const cost = prod.cost_without_vat || 0;
    const costWithVat = cost * (1 + (prod.vat_percentage || 15.0) / 100);

    /*
        Deslizar para descubrir acciones rápidas.

        Sólo se engancha el arrastre si el gesto es claramente horizontal
        (|dx| > |dy| * 1.4). Sin esa comprobación el cajón se abriría solo al
        recorrer la lista con el pulgar, que es el fallo típico de este patrón.
    */
    const [dragX, setDragX] = useState(0);
    const [open, setOpen] = useState(false);
    const touch = useRef<{ x: number; y: number; locked: boolean | null }>({ x: 0, y: 0, locked: null });

    const onTouchStart = (e: React.TouchEvent) => {
        touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, locked: null };
    };

    const onTouchMove = (e: React.TouchEvent) => {
        const dx = e.touches[0].clientX - touch.current.x;
        const dy = e.touches[0].clientY - touch.current.y;

        if (touch.current.locked === null) {
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
            touch.current.locked = Math.abs(dx) > Math.abs(dy) * 1.4;
        }
        if (!touch.current.locked) return;

        const base = open ? -SWIPE_MAX : 0;
        setDragX(Math.max(-SWIPE_MAX, Math.min(0, base + dx)));
    };

    const onTouchEnd = () => {
        if (!touch.current.locked) return;
        const shouldOpen = dragX < -SWIPE_SNAP;
        setOpen(shouldOpen);
        setDragX(shouldOpen ? -SWIPE_MAX : 0);
        touch.current.locked = null;
    };

    const closeDrawer = () => { setOpen(false); setDragX(0); };

    return (
        <div className="relative rounded-2xl overflow-hidden">
            {/* Cajón de acciones rápidas, debajo de la tarjeta */}
            <div className="absolute inset-y-0 right-0 flex" aria-hidden={!open}>
                <button
                    type="button"
                    onClick={() => { closeDrawer(); onQueue(); }}
                    tabIndex={open ? 0 : -1}
                    className="w-[76px] bg-amber-500 text-slate-950 flex flex-col items-center justify-center gap-1 font-bold text-xs active:bg-amber-600"
                >
                    <ListPlus size={20} aria-hidden="true" />
                    Cola
                </button>
                <button
                    type="button"
                    onClick={(e) => { closeDrawer(); onQuickPrint(e); }}
                    tabIndex={open ? 0 : -1}
                    className="w-[76px] bg-emerald-600 text-white flex flex-col items-center justify-center gap-1 font-bold text-xs active:bg-emerald-700"
                >
                    <Printer size={20} aria-hidden="true" />
                    Imprimir
                </button>
            </div>

            <div
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{ transform: `translateX(${dragX}px)` }}
                className={`relative bg-slate-900 rounded-2xl border transition-[border-color,background-color] ${
                    touch.current.locked ? '' : 'duration-200'
                } ${isSelected ? 'border-amber-500 bg-amber-500/5' : 'border-slate-800'}`}
            >
                {/* ── Estado plegado ── */}
                <div className="flex items-stretch">
                    {/*
                        Zona táctil de selección de 44px. Antes el cuadro medía 24px
                        (`w-6 h-6`), por debajo del mínimo recomendado: se fallaba el
                        toque y se acababa desplegando la tarjeta sin querer.
                    */}
                    <button
                        type="button"
                        onClick={onToggleSelect}
                        className={`${TAP} shrink-0 pl-3 pr-1 flex items-center justify-center`}
                        aria-pressed={isSelected}
                        aria-label={`Seleccionar ${prod.sku}`}
                    >
                        <span className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-amber-500 border-amber-500' : 'border-slate-600 bg-slate-800'
                        }`}>
                            {isSelected && <Check size={15} className="text-slate-950" strokeWidth={3} aria-hidden="true" />}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={onOpenLightbox}
                        className="shrink-0 self-center w-16 h-16 rounded-xl bg-slate-800 relative overflow-hidden flex items-center justify-center border border-slate-700"
                        aria-label="Ver imágenes"
                    >
                        {thumb ? (
                            <img src={thumb} alt="" className="w-full h-full object-contain" loading="lazy" decoding="async" />
                        ) : (
                            <ImageOff size={22} className="text-slate-600" aria-hidden="true" />
                        )}
                        {globalStock <= 0 && importer <= 0 && (
                            <span className="absolute inset-x-0 bottom-0 bg-rose-600 text-white text-[10px] uppercase font-bold tracking-wide text-center py-0.5">
                                Agotado
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={onToggleExpand}
                        className="flex-1 min-w-0 text-left py-3 px-3"
                        aria-expanded={isExpanded}
                    >
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="text-xs font-mono font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                {prod.sku}
                            </span>
                            <span className="text-xs font-semibold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Package size={12} className={globalStock > 0 ? 'text-emerald-400' : 'text-slate-500'} aria-hidden="true" />
                                {globalStock}
                            </span>
                            {importer > 0 && (
                                <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                    {importer} imp.
                                </span>
                            )}
                            {discontinued && (
                                <span className="text-xs font-semibold text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20 flex items-center gap-1">
                                    {prod.discontinued_until
                                        ? <Hourglass size={11} aria-hidden="true" />
                                        : <TriangleAlert size={11} aria-hidden="true" />}
                                    Desc.
                                </span>
                            )}
                        </div>

                        {/*
                            Descripción completa, sin recortar.

                            Antes iba con `line-clamp-2`: en repuestos con medidas, años
                            de aplicación y códigos OEM, las dos primeras líneas suelen
                            ser justo la parte que se repite entre productos parecidos,
                            así que había que desplegar cada tarjeta para distinguirlos.
                        */}
                        <h3 className="text-[15px] font-semibold text-white leading-snug break-words" lang="es">
                            {prod.name}
                        </h3>

                        <div className="flex items-center justify-between gap-2 mt-1">
                            <span className="text-xs text-slate-400 truncate">{prod.brands?.name || 'Sin marca'}</span>
                            <span className="text-sm font-bold text-amber-400 shrink-0 tabular-nums">{money(prod.price)}</span>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={onToggleExpand}
                        className={`${TAP} shrink-0 flex items-center justify-center text-slate-500 pr-1`}
                        aria-label={isExpanded ? 'Contraer' : 'Desplegar'}
                    >
                        <ChevronDown size={20} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                </div>

                {/* ── Estado desplegado ── */}
                {isExpanded && (
                    <div className="border-t border-slate-800 p-3 flex flex-col gap-3 animate-fade-in">
                        {/* Precios: el escritorio muestra costo y costo c/IVA; el móvil sólo
                            enseñaba el PVP, así que no se podía valorar un descuento en el
                            mostrador sin abrir el ordenador. */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-950/60 rounded-xl p-3 border border-slate-800">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs text-slate-500">Costo</span>
                                <span className="text-sm font-semibold text-slate-200 tabular-nums">{money(cost)}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs text-slate-500">c/IVA</span>
                                <span className="text-sm font-semibold text-slate-200 tabular-nums">{money(costWithVat)}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 items-end">
                                <span className="text-xs text-slate-500">PVP</span>
                                <span className="text-base font-bold text-amber-400 tabular-nums">{money(prod.price)}</span>
                            </div>
                        </div>

                        {/* Stock */}
                        <div className="flex items-center gap-3 bg-slate-950/60 rounded-xl p-3 border border-slate-800 text-sm">
                            <span className="text-slate-500">Local</span>
                            <span className="font-semibold text-slate-200 tabular-nums">{globalStock}</span>
                            <span className="w-px h-4 bg-slate-800" aria-hidden="true" />
                            <span className="text-slate-500">Importadora</span>
                            <span className={`font-semibold tabular-nums ${importer > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>{importer}</span>
                            <button
                                type="button"
                                onClick={onCopySku}
                                className="ml-auto min-h-[36px] px-3 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 active:bg-slate-700"
                            >
                                {copiedSku === prod.sku ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                                {copiedSku === prod.sku ? 'Copiado' : 'Copiar SKU'}
                            </button>
                        </div>

                        {/* Insignias y etiquetas */}
                        <div className="flex flex-wrap gap-1.5">
                            {equivalents > 0 && (
                                <span className="px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center gap-1">
                                    <LinkIcon size={12} aria-hidden="true" />
                                    {equivalents} equivalente{equivalents > 1 ? 's' : ''}
                                </span>
                            )}
                            {prod.demand_count > 0 && (
                                <span className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1">
                                    <BellRing size={12} aria-hidden="true" />
                                    {prod.demand_count} demanda{prod.demand_count > 1 ? 's' : ''}
                                </span>
                            )}
                            {prod.investigation_status === 'en_consulta' && (
                                <span className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">En consulta</span>
                            )}
                            {prod.investigation_status === 'no_encontrado' && (
                                <span className="px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">No encontrado</span>
                            )}
                            {prod.product_tags?.map((pt: any) => pt.tags && (
                                <span
                                    key={pt.tags.id}
                                    className="px-2 py-1 text-xs font-semibold rounded-lg"
                                    style={{ backgroundColor: pt.tags.color + '20', color: pt.tags.color, border: `1px solid ${pt.tags.color}50` }}
                                >
                                    {pt.tags.name}
                                </span>
                            ))}
                        </div>

                        {/*
                            Acciones CON NOMBRE, en dos columnas.

                            Antes eran cinco iconos sueltos en una fila. En una pantalla
                            táctil no existe el `hover`, así que el atributo `title` nunca
                            llega a verse: había que memorizar qué hacía cada dibujo o
                            probar a ver qué pasaba.
                        */}
                        <div className="grid grid-cols-2 gap-2">
                            {actions.map(a => (
                                <CardAction key={a.key} icon={a.icon} label={a.label} onClick={a.onClick} tone={a.tone} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}, (prev, next) =>
    /*
        Comparador explícito: sólo miran los datos.

        Las funciones que llegan por props (`onToggleExpand`, `onCopySku`…) se
        recrean en cada render del padre, así que la comparación superficial por
        defecto siempre daría "cambió" y `React.memo` no ahorraría nada. Todas
        ellas reciben el producto por argumento o usan actualizaciones
        funcionales de estado, de modo que ignorar su identidad no las deja
        obsoletas.
    */
    prev.prod === next.prod &&
    prev.isSelected === next.isSelected &&
    prev.isExpanded === next.isExpanded &&
    prev.equivalents === next.equivalents &&
    prev.buildActions === next.buildActions &&
    (prev.copiedSku === next.copiedSku ||
        (prev.copiedSku !== prev.prod.sku && next.copiedSku !== next.prod.sku))
);
ProductCard.displayName = 'ProductCard';

/* ────────────────────────────────────────────────────────────────────────────
   PÁGINA
   ──────────────────────────────────────────────────────────────────────── */

const MobileCatalog: React.FC = () => {
    const { products: allProducts, loading: catalogLoading, refresh: refreshCatalog } = useMobileProducts();
    const [page, setPage] = useState(1);
    const observer = useRef<IntersectionObserver | null>(null);
    const pageSize = 20;

    // Búsqueda, filtros y orden
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<{ [key: string]: string }>({});
    const [sortKey, setSortKey] = useState<SortKey>(() => {
        try {
            const saved = localStorage.getItem('mobile_catalog_sort');
            return (SORT_OPTIONS.some(o => o.key === saved) ? saved : 'name-asc') as SortKey;
        } catch { return 'name-asc'; }
    });
    useEffect(() => {
        try { localStorage.setItem('mobile_catalog_sort', sortKey); } catch {}
    }, [sortKey]);

    /*
        `useDeferredValue`: el filtrado recorre el catálogo entero en memoria.
        La barra de búsqueda ya trae su propio retardo de 250ms, pero con varios
        miles de repuestos ese único recálculo aún bloquea el hilo. Al diferirlo,
        React mantiene la lista anterior en pantalla mientras calcula la nueva,
        de modo que el teclado nunca se traba.
    */
    const deferredSearch = useDeferredValue(searchTerm);
    const deferredFilters = useDeferredValue(filters);
    const isStale = deferredSearch !== searchTerm;

    // Estados de interfaz
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isSortOpen, setIsSortOpen] = useState(false);
    const [isBulkSheetOpen, setIsBulkSheetOpen] = useState(false);
    const [copiedSku, setCopiedSku] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [headerCompact, setHeaderCompact] = useState(false);

    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Modales
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<any>(null);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [groupModalProduct, setGroupModalProduct] = useState<any>(null);
    const [lightbox, setLightbox] = useState<{ isOpen: boolean; media: any[]; initialIndex: number; product?: any }>({ isOpen: false, media: [], initialIndex: 0 });
    const [selectedProductForTags, setSelectedProductForTags] = useState<any | null>(null);
    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
    const [labelProduct, setLabelProduct] = useState<any>(null);
    const [demandProduct, setDemandProduct] = useState<any>(null);
    const [sourcingProduct, setSourcingProduct] = useState<any>(null);
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
    const [isInventoryGroupOpen, setIsInventoryGroupOpen] = useState(false);

    // Cola de impresión
    const [queueSheetProduct, setQueueSheetProduct] = useState<any>(null);
    const [queueSheetQty, setQueueSheetQty] = useState(1);

    // Cámara
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const cameraProductRef = useRef<any>(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [loadingEdit, setLoadingEdit] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);

    const notify = useCallback((msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2400);
    }, []);

    const buzz = (ms = 40) => { if (navigator.vibrate) navigator.vibrate(ms); };

    /* ── Filtrado, búsqueda y orden ── */
    const filteredAllProducts = useMemo(() => {
        let list = allProducts;

        const term = deferredSearch.trim();
        if (term) list = searchProducts(list, term, 2);

        const f = deferredFilters;
        if (f.imageStatus === 'con_imagen') list = list.filter(p => !!p.image_url);
        else if (f.imageStatus === 'sin_imagen') list = list.filter(p => !p.image_url);

        if (f.videoStatus === 'con_video') {
            list = list.filter(p => Array.isArray(p.gallery) && p.gallery.some((g: any) => g.type === 'video'));
        } else if (f.videoStatus === 'sin_video') {
            list = list.filter(p => !p.gallery || !Array.isArray(p.gallery) || !p.gallery.some((g: any) => g.type === 'video'));
        }

        if (f.stockStatus) {
            list = list.filter(p => {
                const lStock = parseInt(p.local_stock || 0);
                const iStock = parseInt(p.importer_stock || 0);
                const gStock = p.inventory_levels?.reduce((acc: number, l: any) => acc + (l.current_stock || 0), 0) || 0;
                if (f.stockStatus === 'disponibles_importadora') return iStock > 0;
                if (f.stockStatus === 'solo_local') return (lStock > 0 || gStock > 0) && iStock <= 0;
                if (f.stockStatus === 'disponibles_local') return lStock > 0 || gStock > 0;
                if (f.stockStatus === 'solo_importadora') return iStock > 0 && lStock <= 0 && gStock <= 0;
                if (f.stockStatus === 'disponibles_cualquiera') return lStock > 0 || iStock > 0 || gStock > 0;
                if (f.stockStatus === 'agotados') return lStock <= 0 && iStock <= 0 && gStock <= 0;
                return true;
            });
        }

        if (f.discontinuedStatus === 'descontinuados') list = list.filter(p => p.is_discontinued === true);
        else if (f.discontinuedStatus === 'activos') list = list.filter(p => !p.is_discontinued);

        // El orden por relevancia del buscador manda: reordenar por nombre
        // destruiría el ranking del motor de búsqueda.
        if (sortKey !== 'name-asc' || !term) {
            const stockOf = (p: any) => p.inventory_levels?.reduce((a: number, l: any) => a + (l.current_stock || 0), 0) || 0;
            const sorted = [...list];
            switch (sortKey) {
                case 'name-desc': sorted.sort((a, b) => (b.name || '').localeCompare(a.name || '', 'es')); break;
                case 'price-asc': sorted.sort((a, b) => (a.price || 0) - (b.price || 0)); break;
                case 'price-desc': sorted.sort((a, b) => (b.price || 0) - (a.price || 0)); break;
                case 'stock-asc': sorted.sort((a, b) => stockOf(a) - stockOf(b)); break;
                case 'stock-desc': sorted.sort((a, b) => stockOf(b) - stockOf(a)); break;
                default: if (!term) sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
            }
            list = sorted;
        }

        return list;
    }, [allProducts, deferredSearch, deferredFilters, sortKey]);

    const visibleProducts = useMemo(
        () => filteredAllProducts.slice(0, page * pageSize),
        [filteredAllProducts, page]
    );
    const hasMore = visibleProducts.length < filteredAllProducts.length;

    useEffect(() => { setPage(1); }, [deferredSearch, deferredFilters, sortKey]);

    const groupCounts = useMemo(() => {
        const counts: { [key: string]: number } = {};
        allProducts.forEach(p => { if (p.group_id) counts[p.group_id] = (counts[p.group_id] || 0) + 1; });
        return counts;
    }, [allProducts]);

    const lastElementRef = useCallback((node: HTMLDivElement | null) => {
        if (catalogLoading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) setPage(prev => prev + 1);
        }, { rootMargin: '400px' });
        if (node) observer.current.observe(node);
    }, [catalogLoading, hasMore]);

    /* ── Scroll: cabecera compacta + volver arriba ── */
    const handleScroll = useCallback(() => {
        const top = scrollRef.current?.scrollTop ?? 0;
        setHeaderCompact(top > 56);
        setShowScrollTop(top > 900);
    }, []);

    const scrollToTop = () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

    /* ── Tirar para actualizar ── */
    const [pullY, setPullY] = useState(0);
    const pullStart = useRef<number | null>(null);
    const PULL_TRIGGER = 72;

    const onPullStart = (e: React.TouchEvent) => {
        pullStart.current = (scrollRef.current?.scrollTop ?? 0) <= 0 ? e.touches[0].clientY : null;
    };
    const onPullMove = (e: React.TouchEvent) => {
        if (pullStart.current === null) return;
        const dy = e.touches[0].clientY - pullStart.current;
        // Resistencia: el recorrido del dedo se divide para que el gesto
        // tenga tacto elástico y no se dispare por accidente.
        if (dy > 0) setPullY(Math.min(96, dy / 2.2));
    };
    const onPullEnd = async () => {
        if (pullY >= PULL_TRIGGER) { buzz(30); await handleRefresh(); }
        pullStart.current = null;
        setPullY(0);
    };

    /* ── Acciones ── */

    /** Recarga volviendo al principio. Solo para gestos que ya parten de arriba:
     *  tirar para actualizar y el botón de reintentar. */
    const handleRefresh = async () => {
        setPage(1);
        await refreshCatalog();
    };

    /** Recarga sin mover al usuario de sitio. Tras editar, eliminar o subir una foto
     *  la lista se refresca pero se mantienen las páginas ya cargadas: antes se volvía
     *  a la primera y el usuario perdía su posición después de cada operación. */
    const refreshInPlace = async () => {
        await refreshCatalog();
    };

    const handleCopySku = (sku: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(sku).then(() => {
            buzz(50);
            setCopiedSku(sku);
            setTimeout(() => setCopiedSku(prev => (prev === sku ? null : prev)), 2000);
        });
    };

    /**
     * La lista solo trae las columnas que usa la tarjeta (ver useMobileProducts).
     * ProductModal necesita la fila completa: si le faltan margen, stock mínimo,
     * marca, etc., los inicializa con sus valores por defecto y el guardado los
     * sobreescribe en la base de datos. Se pide la fila entera justo antes de
     * abrir el editor — una sola fila, no pesa nada — en vez de arrastrar esos
     * campos en cada carga del catálogo completo.
     */
    const handleEditProduct = async (prod: any) => {
        if (loadingEdit) return;
        setLoadingEdit(true);
        try {
            const { data, error } = await supabase.from('products').select('*').eq('id', prod.id).single();
            setProductToEdit(error || !data ? prod : data);
        } finally {
            setLoadingEdit(false);
            setIsModalOpen(true);
        }
    };

    const handleOpenLightbox = (prod: any) => {
        const media: any[] = [];
        if (prod.image_url) media.push({ type: 'image', url: prod.image_url, title: `${prod.sku} - ${prod.name}` });
        if (Array.isArray(prod.gallery)) {
            prod.gallery.forEach((item: any) => media.push({ type: item.type, url: item.url, title: `${prod.sku} - ${prod.name}` }));
        }
        setLightbox({ isOpen: true, media, initialIndex: 0, product: prod });
    };

    const handleDeleteProduct = async (product: any) => {
        const globalStock = product.inventory_levels?.reduce((acc: number, l: any) => acc + (l.current_stock || 0), 0) || 0;
        if (globalStock > 0) {
            alert(`No se puede eliminar "${product.name}" porque tiene stock (${globalStock} unidades). Vacía el inventario primero.`);
            return;
        }
        if (!window.confirm(`¿Eliminar permanentemente "${product.sku}"? Esta acción no se puede deshacer.`)) return;

        try {
            const { data, error } = await supabase.from('products').delete().eq('id', product.id).select();
            if (error) {
                if (error.code === '23503') {
                    if (window.confirm('Tiene historial. ¿Ocultarlo definitivamente?')) {
                        await supabase.from('products').update({ is_active: false }).eq('id', product.id);
                        notify('Repuesto ocultado');
                    }
                } else throw error;
            } else if (!data || data.length === 0) {
                throw new Error('Sin permisos para eliminar.');
            } else {
                notify('Repuesto eliminado');
            }
            refreshInPlace();
        } catch (error: any) {
            alert('Error: ' + error.message);
        }
    };

    const handleDuplicateProduct = async (prod: any) => {
        const newSku = window.prompt(`Nuevo SKU para la copia de "${prod.sku}":`, `${prod.sku}-COPIA`);
        if (!newSku || !newSku.trim()) return;
        try {
            const { id, created_at, brands, inventory_levels, product_tags, profiles, ...rest } = prod;
            const { error } = await supabase.from('products').insert([{ ...rest, sku: newSku.trim(), is_active: true }]);
            if (error) throw error;
            notify(`Creado ${newSku.trim()}`);
            refreshInPlace();
        } catch (error: any) {
            alert('No se pudo duplicar: ' + error.message);
        }
    };

    /*
        Selección. Al marcar un repuesto que pertenece a un grupo de
        equivalentes se marcan todos sus hermanos.

        Todo se decide dentro del actualizador funcional: leer `selectedIds`
        desde el cierre haría que la tarjeta memoizada, si no se ha repintado,
        consultara un conjunto ya caducado y alternara la selección al revés.
    */
    const toggleSelectRow = (id: number) => {
        buzz(30);
        const target = allProducts.find(p => p.id === id);
        if (!target) return;

        setSelectedIds(prev => {
            const next = new Set(prev);
            const willSelect = !prev.has(id);

            if (!target.group_id) {
                willSelect ? next.add(id) : next.delete(id);
                return next;
            }
            allProducts.forEach(p => {
                if (p.group_id === target.group_id) willSelect ? next.add(p.id) : next.delete(p.id);
            });
            return next;
        });
    };

    const handleQuickPrint = (prod: any, e: React.MouseEvent) => {
        e.stopPropagation();
        buzz(50);
        printLabelsQuick({ sku: prod.sku, name: prod.name }, 3);
        addToPrintHistory({ id: prod.id, sku: prod.sku, name: prod.name, image_url: prod.image_url }, 3);
        notify(`3 etiquetas de ${prod.sku} enviadas`);
    };

    const handleAddToQueueConfirm = () => {
        if (!queueSheetProduct) return;
        addToQueue(
            { id: queueSheetProduct.id, sku: queueSheetProduct.sku, name: queueSheetProduct.name, image_url: queueSheetProduct.image_url },
            queueSheetQty
        );
        buzz(50);
        notify(`${queueSheetQty} etiqueta(s) de ${queueSheetProduct.sku} en la cola`);
        setQueueSheetProduct(null);
    };

    const handleAddToProforma = (prod: any) => {
        useProformaStore.getState().addItem({ id: prod.id, sku: prod.sku, name: prod.name, price: prod.price }, 1);
        buzz(40);
        notify(`${prod.sku} agregado a la proforma`);
    };

    /* ── Foto desde la cámara ──
       El teléfono es lo único que tienes en la mano junto al repuesto, así que
       el filtro "Falta imagen" deja de ser un callejón sin salida: se resuelve
       ahí mismo. `capture="environment"` abre la cámara trasera directamente. */
    const handlePickPhoto = (prod: any) => {
        cameraProductRef.current = prod;
        cameraInputRef.current?.click();
    };

    const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        const prod = cameraProductRef.current;
        if (!file || !prod) return;

        setUploadingPhoto(true);
        try {
            const ext = file.name?.split('.').pop() || 'jpg';
            const path = `products/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const { error: upErr } = await supabase.storage
                .from('product_images')
                .upload(path, file, { cacheControl: '31536000', upsert: true });
            if (upErr) throw upErr;

            const { data } = supabase.storage.from('product_images').getPublicUrl(path);
            const { error: dbErr } = await supabase.from('products').update({ image_url: data.publicUrl }).eq('id', prod.id);
            if (dbErr) throw dbErr;

            buzz(60);
            notify(`Foto actualizada en ${prod.sku}`);
            await refreshInPlace();
        } catch (err: any) {
            alert('No se pudo subir la foto: ' + err.message);
        } finally {
            setUploadingPhoto(false);
            cameraProductRef.current = null;
        }
    };

    /* ── Acciones en lote ── */
    const selectedProducts = useMemo(
        () => allProducts.filter(p => selectedIds.has(p.id)),
        [allProducts, selectedIds]
    );

    const handleBulkPrint = () => {
        selectedProducts.forEach(prod => {
            printLabelsQuick({ sku: prod.sku, name: prod.name }, 3);
            addToPrintHistory({ id: prod.id, sku: prod.sku, name: prod.name, image_url: prod.image_url }, 3);
        });
        notify(`Etiquetas de ${selectedProducts.length} repuestos enviadas`);
        setSelectedIds(new Set());
        setIsBulkSheetOpen(false);
    };

    const handleBulkQueue = async () => {
        for (const prod of selectedProducts) {
            await addToQueue({ id: prod.id, sku: prod.sku, name: prod.name, image_url: prod.image_url }, 1);
        }
        notify(`${selectedProducts.length} repuestos en la cola`);
        setSelectedIds(new Set());
        setIsBulkSheetOpen(false);
    };

    const handleBulkProforma = () => {
        selectedProducts.forEach(prod => {
            useProformaStore.getState().addItem({ id: prod.id, sku: prod.sku, name: prod.name, price: prod.price }, 1);
        });
        notify(`${selectedProducts.length} repuestos en la proforma`);
        setSelectedIds(new Set());
        setIsBulkSheetOpen(false);
    };

    const handleBulkDelete = async () => {
        const blocked = selectedProducts.filter(p =>
            (p.inventory_levels?.reduce((a: number, l: any) => a + (l.current_stock || 0), 0) || 0) > 0
        );
        if (blocked.length > 0) {
            alert(`${blocked.length} repuesto(s) tienen stock y no se pueden eliminar. Vacía su inventario primero.`);
            return;
        }
        if (!window.confirm(`¿Eliminar permanentemente ${selectedProducts.length} repuesto(s)? No se puede deshacer.`)) return;
        try {
            const { error } = await supabase.from('products').delete().in('id', selectedProducts.map(p => p.id));
            if (error) throw error;
            notify(`${selectedProducts.length} repuestos eliminados`);
            setSelectedIds(new Set());
            setIsBulkSheetOpen(false);
            refreshInPlace();
        } catch (error: any) {
            alert('Error: ' + error.message);
        }
    };

    const activeFilterCount = Object.values(filters).filter(Boolean).length;
    const hasAnyFilter = activeFilterCount > 0 || searchTerm.trim().length > 0;

    const clearEverything = () => {
        setFilters({});
        setSearchTerm('');
    };

    /*
        Acciones de la tarjeta desplegada — aquí vive toda la paridad con el
        escritorio, en un solo sitio.

        `buildActions` tiene que ser estable de por vida (deps `[]`) para que
        `React.memo` funcione en la lista. Como los manejadores sí se recrean en
        cada render, se leen a través de una ref que se refresca en cada pasada:
        así la función es estable pero nunca invoca una versión caducada.
    */
    const handlersRef = useRef<Record<string, (prod: any) => void>>({});
    handlersRef.current = {
        edit: (prod) => handleEditProduct(prod),
        proforma: handleAddToProforma,
        queue: (prod) => { setQueueSheetProduct(prod); setQueueSheetQty(1); },
        print: (prod) => handleQuickPrint(prod, { stopPropagation() {} } as any),
        photo: handlePickPhoto,
        tags: (prod) => setSelectedProductForTags(prod),
        demand: (prod) => setDemandProduct(prod),
        sourcing: (prod) => setSourcingProduct(prod),
        group: (prod) => { setGroupModalProduct(prod); setSelectedGroupId(prod.group_id); setIsGroupModalOpen(true); },
        label: (prod) => { setLabelProduct(prod); setIsLabelModalOpen(true); },
        duplicate: handleDuplicateProduct,
        lv: (prod) => window.open(`https://www.lvparts.ec/catalogo?q=${encodeURIComponent(prod.sku)}`, '_blank', 'noopener'),
        remove: handleDeleteProduct,
    };

    const buildActions = useCallback((prod: any): CardActionDef[] => {
        const run = (key: string) => () => handlersRef.current[key]?.(prod);
        return [
            { key: 'edit', label: 'Editar', icon: Pencil, onClick: run('edit') },
            { key: 'proforma', label: 'A proforma', icon: FileText, tone: 'accent', onClick: run('proforma') },
            { key: 'queue', label: 'Cola etiquetas', icon: ListPlus, onClick: run('queue') },
            { key: 'print', label: 'Imprimir 3', icon: Printer, onClick: run('print') },
            { key: 'photo', label: 'Foto con cámara', icon: Camera, onClick: run('photo') },
            { key: 'tags', label: 'Etiquetas', icon: Tag, onClick: run('tags') },
            { key: 'demand', label: prod.demand_count > 0 ? `Demanda (${prod.demand_count})` : 'Registrar demanda', icon: BellRing, onClick: run('demand') },
            { key: 'sourcing', label: 'Sourcing', icon: Telescope, onClick: run('sourcing') },
            { key: 'group', label: 'Equivalentes', icon: LinkIcon, onClick: run('group') },
            { key: 'label', label: 'Etiqueta avanzada', icon: ScanBarcode, onClick: run('label') },
            { key: 'duplicate', label: 'Duplicar', icon: Copy, onClick: run('duplicate') },
            { key: 'lv', label: 'Ver en LV Parts', icon: ExternalLink, onClick: run('lv') },
            { key: 'delete', label: 'Eliminar', icon: Trash2, tone: 'danger', onClick: run('remove') },
        ];
    }, []);

    /* ────────────────────────────────────────────────────────────────────── */

    return (
        <div className="flex flex-col h-full bg-slate-950 font-sans overflow-hidden">
            <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slide-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes slide-down { from { opacity: 0; transform: translateY(-16px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
                .animate-slide-up { animation: slide-up 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-slide-down { animation: slide-down 0.25s ease-out forwards; }
                /* Exigido por la checklist de MASTER.md: quien active "reducir
                   movimiento" en su teléfono no debe ver ninguna animación. */
                @media (prefers-reduced-motion: reduce) {
                    .animate-fade-in, .animate-slide-up, .animate-slide-down { animation: none !important; }
                    * { transition-duration: 0.01ms !important; }
                }
            `}</style>

            {/* Entrada oculta para la cámara */}
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoSelected}
            />

            {/* ── TOAST ── */}
            {toast && (
                <div role="status" style={{ bottom: 'calc(168px + env(safe-area-inset-bottom))' }} className="fixed left-4 right-4 z-[70] bg-slate-100 text-slate-900 py-3 px-4 rounded-xl shadow-2xl flex items-center gap-2 font-semibold text-sm animate-slide-up">
                    <Check size={18} className="text-emerald-600 shrink-0" aria-hidden="true" />
                    <span className="leading-snug">{toast}</span>
                </div>
            )}

            {uploadingPhoto && (
                <div className="fixed inset-0 z-[80] bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                    <Loader2 size={32} className="animate-spin text-amber-400" aria-hidden="true" />
                    <span className="text-sm font-semibold text-slate-300">Subiendo foto…</span>
                </div>
            )}

            {loadingEdit && (
                <div className="fixed inset-0 z-[80] bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                    <Loader2 size={32} className="animate-spin text-amber-400" aria-hidden="true" />
                    <span className="text-sm font-semibold text-slate-300">Cargando repuesto…</span>
                </div>
            )}

            {/* ── CABECERA ──
                Se encoge al bajar: el título y el contador ocupaban ~60px fijos de
                una pantalla de unos 700px útiles. Al recorrer la lista sólo hace
                falta el buscador. */}
            <div className="shrink-0 sticky top-0 z-40 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/60 px-4 pt-3 pb-3">
                <div className={`flex justify-between items-center overflow-hidden transition-all duration-200 ${
                    headerCompact ? 'max-h-0 opacity-0 mb-0' : 'max-h-16 opacity-100 mb-3'
                }`}>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">Catálogo</h1>
                        <p className="text-xs text-slate-500">
                            {filteredAllProducts.length.toLocaleString('es-EC')} de {allProducts.length.toLocaleString('es-EC')} repuestos
                        </p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        className={`${TAP} rounded-xl bg-slate-900 border border-slate-800 text-slate-300 active:bg-slate-800 flex items-center justify-center`}
                        aria-label="Actualizar catálogo"
                    >
                        <RefreshCw size={20} className={catalogLoading ? 'animate-spin text-amber-400' : ''} aria-hidden="true" />
                    </button>
                </div>

                <div className="relative z-50">
                    {/*
                        El lector de código de barras físico se comporta como un
                        teclado: teclea el código muy rápido y cierra con Enter. Por
                        eso el campo no lleva `autoFocus` agresivo (abriría el teclado
                        en pantalla y taparía media lista), pero sí acepta la ráfaga
                        sin perder caracteres gracias a su propio retardo interno.
                    */}
                    <MobileSearchBar
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        products={allProducts}
                        placeholder="Escanea o busca por código, descripción…"
                        onClear={() => setSearchTerm('')}
                    />
                </div>
            </div>

            {/* ── LISTA ── */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                onTouchStart={onPullStart}
                onTouchMove={onPullMove}
                onTouchEnd={onPullEnd}
                className="flex-1 overflow-y-auto overscroll-contain px-4 pb-44"
            >
                {/* Tirar para actualizar */}
                <div
                    className="flex items-center justify-center overflow-hidden transition-[height] duration-150"
                    style={{ height: pullY }}
                >
                    {pullY > 8 && (
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                            <RefreshCw
                                size={16}
                                className={pullY >= PULL_TRIGGER ? 'text-amber-400' : ''}
                                style={{ transform: `rotate(${pullY * 4}deg)` }}
                                aria-hidden="true"
                            />
                            {pullY >= PULL_TRIGGER ? 'Suelta para actualizar' : 'Tira para actualizar'}
                        </div>
                    )}
                </div>

                <div className={`flex flex-col gap-2.5 pt-3 transition-opacity ${isStale ? 'opacity-60' : 'opacity-100'}`}>
                    {visibleProducts.map((prod, index) => (
                        <div key={prod.id} ref={index === visibleProducts.length - 1 ? lastElementRef : null}>
                            <ProductCard
                                prod={prod}
                                isSelected={selectedIds.has(prod.id)}
                                isExpanded={expandedCardId === prod.id}
                                copiedSku={copiedSku}
                                equivalents={prod.group_id ? (groupCounts[prod.group_id] || 0) - 1 : 0}
                                onToggleExpand={() => setExpandedCardId(expandedCardId === prod.id ? null : prod.id)}
                                onToggleSelect={() => toggleSelectRow(prod.id)}
                                onOpenLightbox={() => handleOpenLightbox(prod)}
                                onCopySku={(e) => handleCopySku(prod.sku, e)}
                                onQuickPrint={(e) => handleQuickPrint(prod, e)}
                                onQueue={() => { setQueueSheetProduct(prod); setQueueSheetQty(1); }}
                                buildActions={buildActions}
                            />
                        </div>
                    ))}
                </div>

                {/* Cargando el catálogo completo */}
                {catalogLoading && allProducts.length === 0 && (
                    <div className="flex flex-col gap-2.5 pt-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-[92px] rounded-2xl bg-slate-900 border border-slate-800 animate-pulse" />
                        ))}
                    </div>
                )}

                {/* Cargando más resultados */}
                {hasMore && !catalogLoading && (
                    <div className="flex items-center justify-center gap-2 py-6 text-slate-500 text-xs font-semibold">
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                        Cargando más repuestos…
                    </div>
                )}

                {/* Sin resultados */}
                {visibleProducts.length === 0 && !catalogLoading && (
                    <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
                        <div className="rounded-full bg-slate-900 border border-slate-800 p-4">
                            <SearchX size={30} className="text-slate-600" aria-hidden="true" />
                        </div>
                        <p className="font-semibold text-slate-200">
                            {hasAnyFilter ? 'Ningún repuesto coincide' : 'El catálogo está vacío'}
                        </p>
                        <p className="text-xs text-slate-500 max-w-[260px] leading-relaxed">
                            {hasAnyFilter
                                ? 'El buscador exige que todas las palabras aparezcan. Prueba con menos palabras o quita algún filtro.'
                                : 'Crea el primer repuesto con el botón Nuevo.'}
                        </p>
                        {hasAnyFilter && (
                            <button onClick={clearEverything} className="min-h-[44px] px-5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-sm active:bg-slate-700">
                                Limpiar búsqueda y filtros
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── VOLVER ARRIBA ── */}
            {showScrollTop && selectedIds.size === 0 && (
                <button
                    onClick={scrollToTop}
                    style={{ bottom: 'calc(216px + env(safe-area-inset-bottom))' }}
                    className="fixed right-4 z-30 w-11 h-11 rounded-full bg-slate-800/95 backdrop-blur border border-slate-700 text-slate-200 shadow-lg flex items-center justify-center active:bg-slate-700 animate-fade-in"
                    aria-label="Volver arriba"
                >
                    <ArrowUp size={20} aria-hidden="true" />
                </button>
            )}

            {/* ── BARRA DE HERRAMIENTAS INFERIOR ──
                Ordenar, filtrar y crear viven abajo, en el arco natural del pulgar.
                Estaban arriba del todo: en un teléfono de 6.5" hay que recolocar la
                mano cada vez, que es justo lo que hace incómodo el uso prolongado. */}
            {selectedIds.size === 0 ? (
                /*
                    108px: la barra de navegación mide ~91px y su botón central de
                    impresión sobresale por encima (`-top-5`), llegando a unos 100px.
                    A menos altura, la barra de herramientas quedaría partida por ese
                    botón justo en el centro. Se le suma la zona de gestos del sistema,
                    que empuja la barra de navegación hacia arriba.
                */
                <div style={{ bottom: 'calc(108px + env(safe-area-inset-bottom))' }} className="fixed inset-x-0 z-30 px-4">
                    <div className="max-w-md mx-auto flex gap-2">
                        <button
                            onClick={() => setIsFiltersOpen(true)}
                            className="relative flex-1 min-h-[48px] rounded-xl bg-slate-900/95 backdrop-blur border border-slate-700 text-slate-200 font-semibold text-sm flex items-center justify-center gap-2 active:bg-slate-800 shadow-lg"
                        >
                            <SlidersHorizontal size={17} aria-hidden="true" />
                            Filtros
                            {activeFilterCount > 0 && (
                                <span className="min-w-[20px] h-5 px-1 bg-amber-500 text-slate-950 text-xs font-bold rounded-full flex items-center justify-center">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setIsSortOpen(true)}
                            className="flex-1 min-h-[48px] rounded-xl bg-slate-900/95 backdrop-blur border border-slate-700 text-slate-200 font-semibold text-sm flex items-center justify-center gap-2 active:bg-slate-800 shadow-lg"
                        >
                            <ArrowUpDown size={17} aria-hidden="true" />
                            Ordenar
                        </button>
                        <button
                            onClick={() => { setProductToEdit(null); setIsModalOpen(true); }}
                            className="min-h-[48px] px-4 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-1.5 active:bg-amber-600 shadow-lg shadow-amber-500/20"
                        >
                            <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
                            Nuevo
                        </button>
                    </div>
                </div>
            ) : (
                /* ── BARRA DE SELECCIÓN ── */
                <div style={{ bottom: 'calc(108px + env(safe-area-inset-bottom))' }} className="fixed inset-x-0 z-30 px-4 animate-slide-up">
                    <div className="max-w-md mx-auto flex items-center gap-2 bg-amber-500 rounded-xl p-2 shadow-2xl">
                        <span className="pl-2 font-bold text-sm text-slate-950 tabular-nums shrink-0">
                            {selectedIds.size} sel.
                        </span>
                        <button
                            onClick={handleBulkPrint}
                            className="flex-1 min-h-[44px] rounded-lg bg-slate-950 text-amber-400 font-bold text-sm flex items-center justify-center gap-1.5 active:opacity-80"
                        >
                            <Printer size={16} aria-hidden="true" />
                            Imprimir 3
                        </button>
                        <button
                            onClick={() => setIsBulkSheetOpen(true)}
                            className="min-h-[44px] px-3 rounded-lg bg-slate-950/15 text-slate-950 font-bold text-sm active:bg-slate-950/25"
                        >
                            Más
                        </button>
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className={`${TAP} flex items-center justify-center text-slate-950/70 rounded-lg active:bg-slate-950/10 shrink-0`}
                            aria-label="Deseleccionar todo"
                        >
                            <X size={20} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            )}

            {/* ── HOJA: FILTROS ── */}
            <Sheet open={isFiltersOpen} onClose={() => setIsFiltersOpen(false)} title="Filtros" icon={SlidersHorizontal}>
                <div className="flex flex-col gap-5">
                    {FILTER_GROUPS.map(group => {
                        const Icon = group.icon;
                        return (
                            <div key={group.key} className="flex flex-col gap-2">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Icon size={14} aria-hidden="true" />
                                    {group.label}
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {group.options.map(opt => (
                                        <Chip
                                            key={opt.value}
                                            active={(filters[group.key] || '') === opt.value}
                                            onClick={() => setFilters(prev => ({ ...prev, [group.key]: opt.value }))}
                                        >
                                            {opt.label}
                                        </Chip>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex gap-2 mt-6">
                    <button
                        onClick={() => setFilters({})}
                        className="flex-1 min-h-[52px] rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-semibold active:bg-slate-700"
                    >
                        Limpiar
                    </button>
                    <button
                        onClick={() => setIsFiltersOpen(false)}
                        className="flex-[2] min-h-[52px] rounded-xl bg-amber-500 text-slate-950 font-bold active:bg-amber-600 flex items-center justify-center gap-2"
                    >
                        Ver {filteredAllProducts.length.toLocaleString('es-EC')} repuestos
                    </button>
                </div>
            </Sheet>

            {/* ── HOJA: ORDENAR ── */}
            <Sheet open={isSortOpen} onClose={() => setIsSortOpen(false)} title="Ordenar por" icon={ArrowUpDown}>
                <div className="flex flex-col gap-2">
                    {SORT_OPTIONS.map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => { setSortKey(opt.key); setIsSortOpen(false); }}
                            className={`min-h-[52px] px-4 rounded-xl border font-semibold text-sm flex items-center justify-between transition-colors ${
                                sortKey === opt.key
                                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                                    : 'bg-slate-800 border-slate-700 text-slate-200 active:bg-slate-700'
                            }`}
                        >
                            {opt.label}
                            {sortKey === opt.key && <Check size={18} aria-hidden="true" />}
                        </button>
                    ))}
                </div>
                {searchTerm.trim() && sortKey === 'name-asc' && (
                    <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                        Mientras haya una búsqueda activa, los resultados se ordenan por relevancia del buscador.
                        Elige otro criterio para forzar un orden distinto.
                    </p>
                )}
            </Sheet>

            {/* ── HOJA: ACCIONES EN LOTE ── */}
            <Sheet open={isBulkSheetOpen} onClose={() => setIsBulkSheetOpen(false)} title={`${selectedIds.size} seleccionados`} icon={Boxes}>
                <div className="flex flex-col gap-2">
                    <CardAction icon={ListPlus} label="Agregar todos a la cola de etiquetas" onClick={handleBulkQueue} />
                    <CardAction icon={FileText} label="Agregar todos a la proforma" tone="accent" onClick={handleBulkProforma} />
                    <CardAction icon={Boxes} label="Asignar a grupo de inventario" onClick={() => { setIsBulkSheetOpen(false); setIsInventoryGroupOpen(true); }} />
                    <CardAction icon={FilePen} label="Edición rápida en lote" onClick={() => { setIsBulkSheetOpen(false); setIsBulkEditOpen(true); }} />
                    <CardAction icon={Trash2} label="Eliminar seleccionados" tone="danger" onClick={handleBulkDelete} />
                </div>
            </Sheet>

            {/* ── HOJA: CANTIDAD PARA LA COLA ── */}
            <Sheet open={!!queueSheetProduct} onClose={() => setQueueSheetProduct(null)} title="Agregar a la cola" icon={ListPlus}>
                {queueSheetProduct && (
                    <>
                        <div className="flex items-center gap-3 bg-slate-800 p-3 rounded-xl border border-slate-700 mb-4">
                            {queueSheetProduct.image_url ? (
                                <img src={getThumbnailUrl(queueSheetProduct.image_url, 128, 128)} alt="" loading="lazy" className="w-14 h-14 rounded-lg object-contain bg-slate-900 border border-slate-700 shrink-0" />
                            ) : (
                                <div className="w-14 h-14 bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                                    <ImageOff size={20} aria-hidden="true" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <span className="text-xs font-mono font-semibold text-amber-300">{queueSheetProduct.sku}</span>
                                <p className="text-sm font-semibold text-white leading-snug">{queueSheetProduct.name}</p>
                            </div>
                        </div>

                        {/* Contador con botones grandes: el stepper anterior medía 32px
                            de ancho, imposible de acertar sin mirar. */}
                        <div className="flex items-center justify-between gap-3 mb-5">
                            <span className="text-sm font-semibold text-slate-300">Cantidad</span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setQueueSheetQty(q => Math.max(1, q - 1))}
                                    className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-2xl font-bold active:bg-slate-700"
                                    aria-label="Menos una etiqueta"
                                >
                                    −
                                </button>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    min="1"
                                    value={queueSheetQty}
                                    onChange={(e) => setQueueSheetQty(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-20 h-14 text-center bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-xl tabular-nums"
                                    aria-label="Cantidad de etiquetas"
                                />
                                <button
                                    type="button"
                                    onClick={() => setQueueSheetQty(q => q + 1)}
                                    className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-2xl font-bold active:bg-slate-700"
                                    aria-label="Una etiqueta más"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleAddToQueueConfirm}
                            className="w-full min-h-[52px] rounded-xl bg-amber-500 text-slate-950 font-bold flex items-center justify-center gap-2 active:bg-amber-600"
                        >
                            <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
                            Agregar {queueSheetQty} a la cola
                        </button>
                    </>
                )}
            </Sheet>

            {/* ── MODALES COMPARTIDOS CON ESCRITORIO ── */}
            {isModalOpen && <ProductModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={refreshInPlace} productToEdit={productToEdit} />}
            {isGroupModalOpen && groupModalProduct && (
                <ProductGroupModal
                    isOpen={isGroupModalOpen}
                    onClose={() => { setIsGroupModalOpen(false); setSelectedGroupId(null); setGroupModalProduct(null); }}
                    groupId={selectedGroupId}
                    initialProduct={groupModalProduct}
                    onSuccess={refreshInPlace}
                    onEditProduct={(p: any) => { setIsGroupModalOpen(false); handleEditProduct(p); }}
                />
            )}
            {lightbox.isOpen && (
                <MediaLightbox
                    isOpen={lightbox.isOpen}
                    media={lightbox.media}
                    initialIndex={lightbox.initialIndex}
                    onClose={() => setLightbox(prev => ({ ...prev, isOpen: false }))}
                    onAddMedia={() => {
                        setLightbox(prev => ({ ...prev, isOpen: false }));
                        if (lightbox.product) { setProductToEdit(lightbox.product); setIsModalOpen(true); }
                    }}
                />
            )}
            {selectedProductForTags && (
                <QuickTagAssignModal
                    isOpen={!!selectedProductForTags}
                    onClose={() => setSelectedProductForTags(null)}
                    onSuccess={refreshInPlace}
                    productId={selectedProductForTags.id}
                    productName={selectedProductForTags.name}
                />
            )}
            {isLabelModalOpen && <ProductLabelModal isOpen={isLabelModalOpen} onClose={() => { setIsLabelModalOpen(false); setLabelProduct(null); }} product={labelProduct} />}
            {demandProduct && <ProductDemandModal isOpen={!!demandProduct} onClose={() => setDemandProduct(null)} product={demandProduct} />}
            {sourcingProduct && (
                <SourcingQuickEditModal
                    isOpen={!!sourcingProduct}
                    onClose={() => setSourcingProduct(null)}
                    product={sourcingProduct}
                    onSuccess={refreshInPlace}
                />
            )}
            {isBulkEditOpen && (
                <BulkEditModal
                    isOpen={isBulkEditOpen}
                    onClose={() => setIsBulkEditOpen(false)}
                    onSuccess={() => { setSelectedIds(new Set()); refreshInPlace(); }}
                    selectedProducts={selectedProducts}
                />
            )}
            {isInventoryGroupOpen && (
                <InventoryGroupSelectModal
                    isOpen={isInventoryGroupOpen}
                    onClose={() => setIsInventoryGroupOpen(false)}
                    onSuccess={() => setSelectedIds(new Set())}
                    selectedIds={selectedIds}
                />
            )}
        </div>
    );
};

export default MobileCatalog;
