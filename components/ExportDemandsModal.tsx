import React, { useState, useMemo } from 'react';
import {
  Download,
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
    notified_at?: string | null;
    is_approved?: boolean;
    product: {
        id: number;
        name: string;
        sku: string;
        price?: number;
        cost_without_vat?: number;
        vat_percentage?: number;
        importer_stock: number;
        local_stock: number;
        image_url?: string | null;
        is_discontinued?: boolean;
        discontinued_until?: string | null;
        inventory_levels: { current_stock: number }[];
    } | null;
}

interface ExportDemandsModalProps {
    isOpen: boolean;
    onClose: () => void;
    demands: ProductDemand[];
    initialStatusFilter: string;
    initialStockFilter: string;
    initialSearchTerm: string;
}

export const ExportDemandsModal: React.FC<ExportDemandsModalProps> = ({
    isOpen,
    onClose,
    demands,
    initialStatusFilter,
    initialStockFilter,
    initialSearchTerm
}) => {
    const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
    const [stockFilter, setStockFilter] = useState<string>(initialStockFilter);
    const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
    const [csvSeparator, setCsvSeparator] = useState<',' | ';'>(';');

    // Sync state when modal is opened (if needed, but usually handled by initial values on mounting.
    // However, since it mounts/demounts in React, setting them as initial state is clean).

    const filteredAndGroupedData = useMemo(() => {
        let filtered = demands.filter(d => {
            // Status Filter
            if (statusFilter === 'active') {
                if (d.status !== 'pending_stock' && d.status !== 'stock_available') return false;
            } else if (statusFilter === 'ready_to_notify') {
                // Mismo criterio que la tarjeta de la pantalla: activa y con
                // stock hoy, sin mirar el estado `stock_available` (que casi
                // nunca se pone). Tiene que estar acá porque el modal hereda
                // el filtro de la pantalla: sin esta rama, abrir la
                // exportación con "Listos para Notificar" puesto no exportaba
                // NADA -- cae en `d.status !== statusFilter` y no coincide
                // ninguna fila.
                if (!['pending_stock', 'stock_available'].includes(d.status)) return false;
                // Solo bodega propia, igual que la tarjeta: la importadora no
                // cuenta para avisar (el repuesto todavia no esta aca).
                const local = d.product?.inventory_levels
                    ? d.product.inventory_levels.reduce((acc: number, lvl: any) => acc + (lvl.current_stock || 0), 0)
                    : 0;
                if (local <= 0) return false;
            } else if (statusFilter === 'inactive') {
                // La pantalla cuenta como inactivas notificado, cancelado,
                // vencido y descontinuado. Aquí faltaban las dos últimas, así
                // que exportar "Inactivas" daba menos filas de las que se veían.
                if (!['notified', 'cancelled', 'expired', 'discontinued'].includes(d.status)) return false;
            } else if (statusFilter !== 'all') {
                if (d.status !== statusFilter) return false;
            }

            // Stock Filter
            if (stockFilter !== 'all') {
                const hasImporterStock = (d.product?.importer_stock || 0) > 0;
                const localStock = d.product?.inventory_levels ? d.product.inventory_levels.reduce((acc: number, lvl: any) => acc + (lvl.current_stock || 0), 0) : 0;
                const hasLocalStock = localStock > 0;

                // Mismo criterio que la pagina: `has_local` mira solo la bodega
                // propia. Sin esta linea, elegir ese filtro en la pantalla y
                // abrir la exportacion sacaba TODO, porque un filtro que el
                // modal no reconoce no descarta nada.
                if (stockFilter === 'has_local' && !hasLocalStock) return false;
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

        // Group by product
        const groupsMap = new Map<number, { product: any; demands: ProductDemand[] }>();
        filtered.forEach(d => {
            if (!d.product) return;
            const pId = d.product.id;
            if (!groupsMap.has(pId)) {
                groupsMap.set(pId, { product: d.product, demands: [] });
            }
            groupsMap.get(pId)!.demands.push(d);
        });

        const productsList = Array.from(groupsMap.values()).map(group => {
            const prod = group.product;
            const localStock = prod.inventory_levels ? prod.inventory_levels.reduce((acc: number, lvl: any) => acc + (lvl.current_stock || 0), 0) : 0;
            const cost = prod.cost_without_vat || 0;
            const vat = prod.vat_percentage || 12.0;
            const costWithVat = cost * (1 + (vat / 100));
            const pvp = prod.price || 0;
            return {
                sku: prod.sku,
                name: prod.name,
                waitingCount: group.demands.length,
                localStock: localStock,
                importerStock: prod.importer_stock || 0,
                cost: cost,
                costWithVat: costWithVat,
                pvp: pvp
            };
        });

        return {
            totalDemands: filtered.length,
            totalProducts: productsList.length,
            productsList
        };
    }, [demands, statusFilter, stockFilter, searchTerm]);

    if (!isOpen) return null;

    const handleExport = () => {
        const { productsList } = filteredAndGroupedData;
        if (productsList.length === 0) return;

        const headers = ['Código', 'Nombre', 'Cantidad en Espera', 'Stock Local', 'Stock Importadora', 'Costo', 'Costo con IVA', 'PVP'];
        
        // Escape helper for CSV cells
        const escapeCSV = (val: any) => {
            if (val === null || val === undefined) return '';
            const str = String(val);
            // If it contains separator, quote, or newline, escape double quotes and wrap in quotes
            if (str.includes(csvSeparator) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const csvRows = [headers.map(escapeCSV).join(csvSeparator)];

        productsList.forEach(item => {
            const row = [
                item.sku,
                item.name,
                item.waitingCount,
                item.localStock,
                item.importerStock,
                item.cost.toFixed(2),
                item.costWithVat.toFixed(2),
                item.pvp.toFixed(2)
            ];
            csvRows.push(row.map(escapeCSV).join(csvSeparator));
        });

        const csvContent = csvRows.join('\n');
        // Include UTF-8 BOM so Excel opens it with proper encoding for tildes / spanish chars
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        
        const dateStr = new Date().toISOString().slice(0, 10);
        link.setAttribute('download', `productos_demanda_perdida_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-surface rounded-xl shadow-xl overflow-hidden flex flex-col w-[500px] border border-subtle max-h-[90dvh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-subtle flex justify-between items-center bg-surface-2">
                    <h2 className="text-lg font-bold tracking-tight text-fg flex items-center gap-2">
                        <Download size={20} className="text-success" aria-hidden="true" />
                        Exportar a CSV
                    </h2>
                    <button onClick={onClose} className="text-fg-subtle hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>

                {/* Form Content */}
                <div className="p-6 flex flex-col gap-4 overflow-y-auto">
                    <p className="text-xs text-fg-muted">
                        Configure los filtros para exportar la lista de productos en demanda perdida. Los filtros se inicializan automáticamente con los que tiene aplicados en la vista actual.
                    </p>

                    {/* Estado */}
                    <div>
                        <label className="block text-xs font-semibold text-fg-muted mb-1.5">Estado de Solicitudes</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="w-full bg-surface-2 border border-subtle rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                        >
                            <option value="all">Todos los estados</option>
                            <option value="active">Activas (Cola)</option>
                            <option value="inactive">Inactivas (Historial)</option>
                            <option value="ready_to_notify">Listos para Notificar (en bodega)</option>
                            <option value="pending_stock">Esperando Stock</option>
                            <option value="stock_available">Marcados como Stock Disponible</option>
                            <option value="notified">Notificados</option>
                            <option value="cancelled">Cancelados</option>
                            <option value="discontinued">Descontinuados</option>
                        </select>
                    </div>

                    {/* Filtro Stock */}
                    <div>
                        <label className="block text-xs font-semibold text-fg-muted mb-1.5">Filtro de Stock</label>
                        <select
                            value={stockFilter}
                            onChange={(e) => setStockFilter(e.target.value as any)}
                            className="w-full bg-surface-2 border border-subtle rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                        >
                            <option value="all">Todos</option>
                            <option value="has_local">Hay en el local (sin importar la importadora)</option>
                            <option value="importer_only">Con stock en la importadora y no en local</option>
                            <option value="local_only">Con stock en local y no importadora</option>
                            <option value="no_stock">Sin stock completamente</option>
                            <option value="approved_only">Solo pedidos aprobados en espera</option>
                        </select>
                    </div>

                    {/* Término de búsqueda */}
                    <div>
                        <label className="block text-xs font-semibold text-fg-muted mb-1.5">Buscar por Cliente, Teléfono, SKU o Nombre</label>
                        <input
                            type="text"
                            placeholder="Ej. Daytona, 099..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-surface-2 border border-subtle rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                        />
                    </div>

                    {/* Separador de campos */}
                    <div>
                        <label className="block text-xs font-semibold text-fg-muted mb-2">Separador de Campos</label>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <label className="flex items-center gap-2 text-sm text-fg cursor-pointer">
                                <input
                                    type="radio"
                                    name="csvSeparator"
                                    value=";"
                                    checked={csvSeparator === ';'}
                                    onChange={() => setCsvSeparator(';')}
                                    className="text-primary focus:ring-primary"
                                />
                                Punto y coma ( ; ) - Excel en Español (Recomendado)
                            </label>
                            <label className="flex items-center gap-2 text-sm text-fg cursor-pointer">
                                <input
                                    type="radio"
                                    name="csvSeparator"
                                    value=","
                                    checked={csvSeparator === ','}
                                    onChange={() => setCsvSeparator(',')}
                                    className="text-primary focus:ring-primary"
                                />
                                Coma ( , ) - Estándar CSV
                            </label>
                        </div>
                    </div>

                    {/* Resumen */}
                    <div className="bg-surface-2 p-3 rounded-lg border border-slate-100 dark:border-slate-800 text-xs text-fg-muted flex flex-col gap-1.5">
                        <span className="font-semibold text-fg">Resumen de Exportación:</span>
                        <span>• Solicitudes encontradas: <strong className="text-primary">{filteredAndGroupedData.totalDemands}</strong></span>
                        <span>• Productos únicos a exportar: <strong className="text-success">{filteredAndGroupedData.totalProducts}</strong></span>
                    </div>
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
                        disabled={filteredAndGroupedData.totalProducts === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-success hover:bg-success text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-success/10"
                    >
                        <Download size={18} aria-hidden="true" />
                        Exportar CSV
                    </button>
                </div>

            </div>
        </div>
    );
};
