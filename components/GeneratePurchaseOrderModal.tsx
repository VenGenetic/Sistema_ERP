/**
 * GeneratePurchaseOrderModal.tsx
 * Arma de un clic el pedido a la importadora y lo baja en Excel.
 *
 * Cruza dos cosas que hasta ahora había que juntar a mano:
 *
 *   1. Lo que la importadora tiene disponible (products.importer_stock).
 *   2. Lo que los clientes están esperando (product_demands activas).
 *
 * De ahí salen las dos listas que interesan:
 *
 *   - El PEDIDO: lo que se puede pedir ya, con la cantidad sugerida y el total
 *     a pagar.
 *   - Lo que FALTA: repuestos que los clientes pidieron y la importadora no
 *     tiene, para salir a buscarlos con otro proveedor.
 *
 * Se lee de Supabase y no del JSON del scraper: `importer_stock` ya se
 * sincroniza desde ese mismo archivo (scripts/sync-importer-stock.js), y
 * además pasa por el trigger que fuerza a 0 los repuestos marcados a mano como
 * "no disponible en importadora" (ver migración 20260803120000). Leer el JSON
 * crudo se saltaría ese ajuste y pediría cosas que ya sabemos que no llegan.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Loader2,
  PackageSearch,
  ShoppingCart,
  X,
} from 'lucide-react';

/*
    Una solicitud sigue "activa" mientras espera stock, o mientras el stock ya
    llegó pero todavía no se avisó al cliente. Notificado, cancelado y vencido
    ya no son una espera real. Mismo criterio que usa ExportDemandsModal.
*/
const ACTIVE_DEMAND_STATUSES = ['pending_stock', 'stock_available'];

/** El IVA por defecto de los productos nuevos (ver ProductModal). */
const DEFAULT_VAT = 15.0;

interface DemandRow {
    id: number;
    phone_number: string;
    customer_name: string | null;
    status: string;
    created_at: string;
    product: {
        id: number;
        sku: string;
        name: string;
        price: number | null;
        cost_without_vat: number | null;
        vat_percentage: number | null;
        importer_stock: number | null;
        inventory_levels: { current_stock: number }[] | null;
    } | null;
}

interface OrderLine {
    sku: string;
    name: string;
    brand: string;
    waiting: number;
    localStock: number;
    importerStock: number;
    /** Lo que se va a pedir: cubrir a los clientes sin pasarse del stock que hay. */
    qty: number;
    costNoVat: number;
    costVat: number;
}

interface MissingLine {
    sku: string;
    name: string;
    waiting: number;
    localStock: number;
    price: number;
    lastCost: number;
    oldestRequest: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const money = (v: number) => `$${(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const r2 = (v: number) => Math.round((v || 0) * 100) / 100;

export const GeneratePurchaseOrderModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [demands, setDemands] = useState<DemandRow[]>([]);

    /*
        Además de lo que piden los clientes, se puede sumar al pedido lo que
        está por debajo del stock mínimo. Va apagado por defecto: el pedido que
        se pide "de un clic" es el de los clientes que están esperando, y meter
        la reposición sin avisar infla el total sin que nadie lo haya decidido.
    */
    const [includeLowStock, setIncludeLowStock] = useState(false);
    const [lowStockLines, setLowStockLines] = useState<OrderLine[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // ── Solicitudes activas de clientes ──
            const { data: demandData, error: demandErr } = await supabase
                .from('product_demands')
                .select(`
                    id, phone_number, customer_name, status, created_at,
                    product:products(
                        id, sku, name, price, cost_without_vat, vat_percentage,
                        importer_stock, inventory_levels(current_stock)
                    )
                `)
                .in('status', ACTIVE_DEMAND_STATUSES)
                .order('created_at', { ascending: true });
            if (demandErr) throw demandErr;
            setDemands(((demandData || []) as any[]).filter(d => d.product));

            // ── Reposición por stock mínimo, sólo de lo que la importadora tiene ──
            // Se pagina: Supabase corta en 1000 filas por consulta.
            const lows: OrderLine[] = [];
            const pageSize = 1000;
            for (let from = 0; ; from += pageSize) {
                const { data, error: prodErr } = await supabase
                    .from('products')
                    .select('sku, name, min_stock_threshold, importer_stock, cost_without_vat, vat_percentage, brands(name), inventory_levels(current_stock)')
                    .eq('is_active', true)
                    .eq('auto_order_disabled', false)
                    .gt('importer_stock', 0)
                    .order('sku')
                    .range(from, from + pageSize - 1);
                if (prodErr) throw prodErr;
                const page = (data || []) as any[];

                page.forEach(p => {
                    const localStock = (p.inventory_levels || []).reduce(
                        (acc: number, lvl: any) => acc + (lvl.current_stock || 0), 0);
                    const minStock = Number(p.min_stock_threshold ?? 10);
                    if (localStock >= minStock) return;

                    const importerStock = Number(p.importer_stock || 0);
                    const costNoVat = Number(p.cost_without_vat || 0);
                    const vat = Number(p.vat_percentage ?? DEFAULT_VAT);
                    lows.push({
                        sku: p.sku,
                        name: p.name,
                        brand: p.brands?.name || '',
                        waiting: 0,
                        localStock,
                        importerStock,
                        qty: Math.min(Math.ceil(minStock - localStock), importerStock),
                        costNoVat,
                        costVat: r2(costNoVat * (1 + vat / 100)),
                    });
                });

                if (page.length < pageSize) break;
            }
            setLowStockLines(lows);
        } catch (err: any) {
            console.error('Error armando el pedido:', err);
            setError(err?.message || 'No se pudo leer la información del pedido.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) load();
    }, [isOpen, load]);

    /* ── Agrupar las solicitudes por repuesto y partirlas en dos listas ── */
    const { orderLines, missingLines, byProduct } = useMemo(() => {
        const groups = new Map<string, DemandRow[]>();
        demands.forEach(d => {
            const sku = (d.product?.sku || '').trim().toUpperCase();
            if (!sku) return;
            if (!groups.has(sku)) groups.set(sku, []);
            groups.get(sku)!.push(d);
        });

        const order: OrderLine[] = [];
        const missing: MissingLine[] = [];

        groups.forEach((rows, sku) => {
            const prod = rows[0].product!;
            const localStock = (prod.inventory_levels || []).reduce(
                (acc, lvl: any) => acc + (lvl.current_stock || 0), 0);
            const importerStock = Number(prod.importer_stock || 0);
            const costNoVat = Number(prod.cost_without_vat || 0);
            const vat = Number(prod.vat_percentage ?? DEFAULT_VAT);

            // Cubrir a los que esperan, descontando lo que ya hay en bodega y
            // sin pedir más de lo que la importadora tiene. Si el stock local ya
            // alcanza para todos, no hay nada que pedir: la línea no entra.
            const needed = Math.min(Math.max(rows.length - localStock, 0), importerStock);

            if (importerStock > 0 && needed > 0) {
                order.push({
                    sku,
                    name: prod.name,
                    brand: '',
                    waiting: rows.length,
                    localStock,
                    importerStock,
                    qty: needed,
                    costNoVat,
                    costVat: r2(costNoVat * (1 + vat / 100)),
                });
            } else if (importerStock <= 0) {
                missing.push({
                    sku,
                    name: prod.name,
                    waiting: rows.length,
                    localStock,
                    price: Number(prod.price || 0),
                    lastCost: costNoVat,
                    oldestRequest: rows[0].created_at?.slice(0, 10) || '',
                });
            }
        });

        order.sort((a, b) => b.waiting - a.waiting || a.name.localeCompare(b.name, 'es'));
        missing.sort((a, b) => b.waiting - a.waiting || a.name.localeCompare(b.name, 'es'));
        return { orderLines: order, missingLines: missing, byProduct: groups };
    }, [demands]);

    /* ── Líneas finales del pedido, con la reposición si se pidió ── */
    const finalLines = useMemo(() => {
        if (!includeLowStock) return orderLines;
        const already = new Set(orderLines.map(l => l.sku));
        const extra = lowStockLines.filter(l => !already.has(l.sku) && l.qty > 0);
        return [...orderLines, ...extra];
    }, [orderLines, lowStockLines, includeLowStock]);

    const totals = useMemo(() => {
        const units = finalLines.reduce((acc, l) => acc + l.qty, 0);
        const noVat = finalLines.reduce((acc, l) => acc + l.costNoVat * l.qty, 0);
        const withVat = finalLines.reduce((acc, l) => acc + l.costVat * l.qty, 0);
        return { units, noVat: r2(noVat), withVat: r2(withVat), lines: finalLines.length };
    }, [finalLines]);

    const missingClients = useMemo(
        () => missingLines.reduce((acc, l) => acc + l.waiting, 0),
        [missingLines]
    );

    /* ── Excel ── */
    const handleExport = async () => {
        setExporting(true);
        try {
            // xlsx se carga sólo al exportar, para no inflar el bundle inicial
            // (mismo patrón que el resto del proyecto, ver vite.config.ts).
            const XLSX = await import('xlsx');
            const wb = XLSX.utils.book_new();
            const today = new Date().toISOString().slice(0, 10);

            // ── Hoja 1: el pedido ──
            const pedidoRows: any[] = finalLines.map(l => ({
                'Código': l.sku,
                'Repuesto': l.name,
                'Clientes Esperando': l.waiting || '',
                'Mi Stock': l.localStock,
                'Disponible Importadora': l.importerStock,
                'Cantidad a Pedir': l.qty,
                'Costo Unit. s/IVA': r2(l.costNoVat),
                'Costo Unit. c/IVA': r2(l.costVat),
                'Subtotal s/IVA': r2(l.costNoVat * l.qty),
                'Subtotal c/IVA': r2(l.costVat * l.qty),
            }));
            pedidoRows.push({
                'Código': '',
                'Repuesto': 'TOTAL A PAGAR',
                'Clientes Esperando': '',
                'Mi Stock': '',
                'Disponible Importadora': '',
                'Cantidad a Pedir': totals.units,
                'Costo Unit. s/IVA': '',
                'Costo Unit. c/IVA': '',
                'Subtotal s/IVA': totals.noVat,
                'Subtotal c/IVA': totals.withVat,
            });
            const wsPedido = XLSX.utils.json_to_sheet(pedidoRows);
            wsPedido['!cols'] = [
                { wch: 16 }, { wch: 55 }, { wch: 18 }, { wch: 10 }, { wch: 20 },
                { wch: 16 }, { wch: 17 }, { wch: 17 }, { wch: 16 }, { wch: 16 },
            ];
            XLSX.utils.book_append_sheet(wb, wsPedido, 'Pedido');

            // ── Hoja 2: lo que la importadora NO tiene ──
            const faltaRows = missingLines.map(l => ({
                'Código': l.sku,
                'Repuesto': l.name,
                'Clientes Esperando': l.waiting,
                'Mi Stock': l.localStock,
                'Último Costo Conocido s/IVA': r2(l.lastCost),
                'PVP Nuestro': r2(l.price),
                'Solicitud Más Antigua': l.oldestRequest,
                'Proveedor Alternativo': '',
                'Costo Cotizado': '',
                'Notas': '',
            }));
            const wsFalta = XLSX.utils.json_to_sheet(
                faltaRows.length > 0
                    ? faltaRows
                    // Una hoja vacía sin encabezados no se entiende al abrirla:
                    // se deja la fila de títulos para que se vea qué se buscó.
                    : [{
                        'Código': '', 'Repuesto': 'Sin faltantes: la importadora tiene todo lo pedido',
                        'Clientes Esperando': '', 'Mi Stock': '', 'Último Costo Conocido s/IVA': '',
                        'PVP Nuestro': '', 'Solicitud Más Antigua': '', 'Proveedor Alternativo': '',
                        'Costo Cotizado': '', 'Notas': '',
                    }]
            );
            wsFalta['!cols'] = [
                { wch: 16 }, { wch: 55 }, { wch: 18 }, { wch: 10 }, { wch: 24 },
                { wch: 14 }, { wch: 20 }, { wch: 24 }, { wch: 16 }, { wch: 30 },
            ];
            XLSX.utils.book_append_sheet(wb, wsFalta, 'Buscar con Otro Proveedor');

            // ── Hoja 3: a quién hay que llamar ──
            const detalleRows: any[] = [];
            byProduct.forEach((rows, sku) => {
                const prod = rows[0].product!;
                const disponible = Number(prod.importer_stock || 0) > 0;
                rows.forEach(d => {
                    detalleRows.push({
                        'Código': sku,
                        'Repuesto': prod.name,
                        'Cliente': d.customer_name || 'Sin nombre',
                        'Teléfono': d.phone_number || '',
                        'Estado': d.status === 'stock_available' ? 'Stock disponible' : 'Esperando stock',
                        'Fecha Solicitud': d.created_at?.slice(0, 10) || '',
                        'En Importadora': disponible ? 'Sí' : 'No',
                    });
                });
            });
            detalleRows.sort((a, b) => String(a['Código']).localeCompare(String(b['Código'])));
            const wsDetalle = XLSX.utils.json_to_sheet(detalleRows);
            wsDetalle['!cols'] = [
                { wch: 16 }, { wch: 50 }, { wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 15 },
            ];
            XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle de Clientes');

            // ── Hoja 4: resumen ──
            const wsResumen = XLSX.utils.json_to_sheet([
                { Concepto: 'Fecha de generación', Valor: new Date().toLocaleString('es-EC') },
                { Concepto: 'Líneas en el pedido', Valor: totals.lines },
                { Concepto: 'Unidades a pedir', Valor: totals.units },
                { Concepto: 'TOTAL a pagar (s/IVA)', Valor: totals.noVat },
                { Concepto: 'TOTAL a pagar (c/IVA)', Valor: totals.withVat },
                { Concepto: '', Valor: '' },
                { Concepto: 'Repuestos que la importadora no tiene', Valor: missingLines.length },
                { Concepto: 'Clientes esperando esos repuestos', Valor: missingClients },
                { Concepto: '', Valor: '' },
                { Concepto: 'Incluye reposición por stock mínimo', Valor: includeLowStock ? 'Sí' : 'No' },
            ]);
            wsResumen['!cols'] = [{ wch: 42 }, { wch: 26 }];
            XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

            XLSX.writeFile(wb, `pedido_importadora_${today}.xlsx`);
            onClose();
        } catch (err: any) {
            console.error('Error exportando el pedido:', err);
            setError(`No se pudo generar el Excel: ${err?.message || 'error desconocido'}`);
        } finally {
            setExporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-surface rounded-t-2xl sm:rounded-xl shadow-xl overflow-hidden flex flex-col w-full max-w-2xl max-h-[92dvh] border border-subtle">

                {/* Header */}
                <div className="px-6 py-4 border-b border-subtle flex justify-between items-center bg-surface-2">
                    <h2 className="text-lg font-bold tracking-tight text-fg flex items-center gap-2">
                        <FileSpreadsheet size={20} className="text-primary" aria-hidden="true" />
                        Generar Pedido a la Importadora
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-fg-subtle hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        aria-label="Cerrar"
                    >
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-5 overflow-y-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-12 text-fg-muted">
                            <Loader2 size={32} className="animate-spin text-primary" aria-hidden="true" />
                            <span className="text-sm font-medium">Cruzando solicitudes de clientes con el stock de la importadora…</span>
                        </div>
                    ) : error ? (
                        <div role="alert" className="flex gap-3 p-4 rounded-lg bg-danger-soft border border-danger/20">
                            <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" aria-hidden="true" />
                            <div className="flex-1">
                                <p className="text-sm font-bold text-danger">{error}</p>
                                <button
                                    onClick={load}
                                    className="mt-2 px-3 py-1.5 rounded-lg bg-danger text-white text-sm font-bold hover:opacity-90"
                                >
                                    Reintentar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* El pedido */}
                            <div className="rounded-xl border border-subtle overflow-hidden">
                                <div className="px-4 py-3 bg-primary-soft flex items-center gap-2">
                                    <ShoppingCart size={18} className="text-primary" aria-hidden="true" />
                                    <span className="font-bold text-sm text-primary-soft-fg">Se puede pedir ahora</span>
                                </div>
                                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div>
                                        <span className="block text-xs text-fg-muted">Repuestos</span>
                                        <span className="block text-2xl font-bold text-fg tabular-nums">{totals.lines}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-fg-muted">Unidades</span>
                                        <span className="block text-2xl font-bold text-fg tabular-nums">{totals.units}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-fg-muted">Total s/IVA</span>
                                        <span className="block text-2xl font-bold text-fg tabular-nums">{money(totals.noVat)}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-fg-muted">Total a pagar</span>
                                        <span className="block text-2xl font-bold text-primary tabular-nums">{money(totals.withVat)}</span>
                                    </div>
                                </div>

                                <label className="flex items-start gap-3 px-4 py-3 border-t border-subtle cursor-pointer hover:bg-surface-hover transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={includeLowStock}
                                        onChange={(e) => setIncludeLowStock(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 rounded text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm text-fg">
                                        Sumar también la reposición por stock mínimo
                                        <span className="block text-xs text-fg-muted mt-0.5">
                                            {lowStockLines.length} repuestos por debajo de su mínimo que la importadora sí tiene.
                                            Sin marcar, el pedido cubre sólo lo que los clientes están esperando.
                                        </span>
                                    </span>
                                </label>
                            </div>

                            {/* Lo que falta */}
                            <div className="rounded-xl border border-subtle overflow-hidden">
                                <div className="px-4 py-3 bg-warning-soft flex items-center gap-2">
                                    <PackageSearch size={18} className="text-warning" aria-hidden="true" />
                                    <span className="font-bold text-sm text-warning-soft-fg">Hay que buscar con otro proveedor</span>
                                </div>
                                <div className="p-4">
                                    <p className="text-sm text-fg-muted mb-3">
                                        <strong className="text-fg">{missingLines.length}</strong> repuestos que los clientes pidieron y
                                        la importadora no tiene, con <strong className="text-fg">{missingClients}</strong> clientes esperando.
                                        Van en su propia hoja del Excel, con columnas en blanco para anotar proveedor y costo cotizado.
                                    </p>
                                    {missingLines.length > 0 && (
                                        <div className="max-h-40 overflow-y-auto rounded-lg border border-subtle divide-y divide-subtle">
                                            {missingLines.slice(0, 20).map(l => (
                                                <div key={l.sku} className="px-3 py-2 flex items-center gap-3 text-xs">
                                                    <span className="font-mono font-bold text-fg-muted shrink-0">{l.sku}</span>
                                                    <span className="flex-1 truncate text-fg">{l.name}</span>
                                                    <span className="shrink-0 font-bold text-warning tabular-nums">
                                                        {l.waiting} {l.waiting === 1 ? 'cliente' : 'clientes'}
                                                    </span>
                                                </div>
                                            ))}
                                            {missingLines.length > 20 && (
                                                <div className="px-3 py-2 text-xs text-fg-subtle italic">
                                                    y {missingLines.length - 20} más en el Excel…
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-subtle bg-surface-2 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-fg-muted hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={loading || exporting || !!error || (totals.lines === 0 && missingLines.length === 0)}
                        className="flex items-center gap-2 px-5 py-2 bg-primary hover:opacity-90 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        {exporting
                            ? <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                            : <Download size={18} aria-hidden="true" />}
                        {exporting ? 'Generando…' : 'Descargar Excel'}
                    </button>
                </div>
            </div>
        </div>
    );
};
