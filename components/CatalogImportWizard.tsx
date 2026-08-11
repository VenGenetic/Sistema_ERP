import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  CircleCheckBig,
  CirclePlus,
  Database,
  Download,
  FilePen,
  FilePlus,
  FileUp,
  Loader2,
  Percent,
  RefreshCw,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react';

interface CatalogRow {
    id: string;
    sku: string;
    name: string;
    cost: string;
    profitMargin: string;
    category: string;
    vatPercentage: string;
}

interface CatalogImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const CatalogImportWizard: React.FC<CatalogImportWizardProps> = ({ isOpen, onClose, onSuccess }) => {
    const [dbProducts, setDbProducts] = useState<Record<string, any>>({});
    const [excelRows, setExcelRows] = useState<CatalogRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // IVA Fallback Prompt state
    const [ivaFallback, setIvaFallback] = useState<string>('');
    const [showIvaPrompt, setShowIvaPrompt] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchBaseline();
        } else {
            setExcelRows([]);
            setDbProducts({});
            setIvaFallback('');
            setShowIvaPrompt(false);
        }
    }, [isOpen]);

    const fetchBaseline = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('products').select('sku, name, cost_without_vat, profit_margin, category, vat_percentage');
            if (error) throw error;
            const lookup = (data || []).reduce((acc: Record<string, any>, prod) => {
                acc[prod.sku] = prod;
                return acc;
            }, {});
            setDbProducts(lookup);
        } catch (error) {
            console.error("Error fetching baseline products:", error);
            alert("Error al cargar el catálogo actual.");
        } finally {
            setLoading(false);
        }
    };

    // ──────────────────────────────────────────────
    // TEMPLATE DOWNLOAD
    // ──────────────────────────────────────────────
    const handleDownloadTemplate = async () => {
        // xlsx se carga solo al usar esta función, para no inflar el bundle inicial
        const { utils, writeFile } = await import('xlsx');
        const templateData = [
            { 'SKU': 'SKU-123', 'Nombre': 'Filtro de Aceite Premium', 'Costo S/IVA': 12.50, 'Margen': 0.35, 'Categoría': 'Repuestos', 'IVA %': 12 },
            { 'SKU': 'SKU-456', 'Nombre': 'Pastillas de Freno XYZ', 'Costo S/IVA': 45.00, 'Margen': '', 'Categoría': 'Frenos', 'IVA %': '' },
            { 'SKU': 'SKU-NEW', 'Nombre': 'Nuevo Producto 2026', 'Costo S/IVA': 5.00, 'Margen': 0.30, 'Categoría': 'Accesorios', 'IVA %': 0 },
        ];
        const ws = utils.json_to_sheet(templateData, {
            header: ['SKU', 'Nombre', 'Costo S/IVA', 'Margen', 'Categoría', 'IVA %']
        });
        ws['!cols'] = [
            { wch: 16 }, // SKU
            { wch: 35 }, // Nombre
            { wch: 14 }, // Costo S/IVA
            { wch: 10 }, // Margen
            { wch: 18 }, // Categoría
            { wch: 8 },  // IVA %
        ];
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Plantilla');
        writeFile(wb, 'plantilla_catalogo_vendor.xlsx');
    };

    // ──────────────────────────────────────────────
    // FILE UPLOAD
    // ──────────────────────────────────────────────
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const { read, utils } = await import('xlsx');
                const bstr = evt.target?.result;
                const wb = read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data: any[] = utils.sheet_to_json(ws);

                const newRows: CatalogRow[] = data.map((item, index) => {
                    const sku = item['SKU'] || item['sku'] || '';
                    const name = item['Nombre'] || item['nombre'] || item['Name'] || item['name'] || '';
                    const cost = item['Costo S/IVA'] || item['Costo S/I'] || item['costo'] || item['Costo'] || item['cost'] || '';
                    const margin = item['Margen'] || item['margen'] || item['profit_margin'] || '';
                    const category = item['Categoría'] || item['Categoria'] || item['categoria'] || item['Category'] || item['category'] || '';
                    const vat = item['IVA %'] || item['IVA'] || item['iva'] || item['vat_percentage'] || '';

                    return {
                        id: `imported-${Date.now()}-${index}`,
                        sku: String(sku),
                        name: String(name),
                        cost: String(cost),
                        profitMargin: margin === 0 ? '0' : (margin ? String(margin) : ''),
                        category: String(category || ''),
                        vatPercentage: vat === 0 ? '0' : (vat ? String(vat) : ''),
                    };
                }).filter(row => row.sku || row.name || row.cost);

                setExcelRows(newRows);
                // Reset IVA fallback when new file is loaded
                setIvaFallback('');
                setShowIvaPrompt(false);
            } catch (error) {
                console.error("Error parsing Excel file:", error);
                alert("Error al procesar el archivo Excel.");
            }
        };
        reader.readAsBinaryString(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ──────────────────────────────────────────────
    // INLINE EDIT & ROW HANDLING
    // ──────────────────────────────────────────────
    const handleRowEdit = (id: string, field: keyof CatalogRow, value: string) => {
        setExcelRows(prevRows =>
            prevRows.map(row => row.id === id ? { ...row, [field]: value } : row)
        );
    };

    const handleRemoveRow = (id: string) => {
        setExcelRows(prevRows => prevRows.filter(row => row.id !== id));
    };

    // ──────────────────────────────────────────────
    // IVA FALLBACK: Detect blank IVA cells
    // ──────────────────────────────────────────────
    const rowsWithBlankIva = useMemo(() => {
        return excelRows.filter(row => {
            const cleanSku = row.sku?.trim().toUpperCase();
            if (!cleanSku || !row.name?.trim()) return false;
            const vatVal = row.vatPercentage?.trim();
            // If blank AND it's a new product (no DB match to inherit from)
            // OR if blank and we want the prompt for all blanks
            if (vatVal === '' || vatVal === 'undefined') {
                return true;
            }
            return false;
        });
    }, [excelRows]);

    // Show IVA prompt when blank IVA rows detected
    useEffect(() => {
        if (rowsWithBlankIva.length > 0 && excelRows.length > 0) {
            setShowIvaPrompt(true);
        } else {
            setShowIvaPrompt(false);
        }
    }, [rowsWithBlankIva.length, excelRows.length]);

    // Apply IVA fallback to blank cells
    const handleApplyIvaFallback = () => {
        if (ivaFallback === '') return;
        setExcelRows(prevRows =>
            prevRows.map(row => {
                const vatVal = row.vatPercentage?.trim();
                if (vatVal === '' || vatVal === 'undefined') {
                    return { ...row, vatPercentage: ivaFallback };
                }
                return row;
            })
        );
        setShowIvaPrompt(false);
    };

    // ──────────────────────────────────────────────
    // THE LIVE ENGINE
    // ──────────────────────────────────────────────
    const categorizedData = useMemo(() => {
        const buckets = { errors: [] as any[], new: [] as any[], modified: [] as any[], unchanged: [] as any[] };

        excelRows.forEach(row => {
            const costNum = parseFloat(row.cost);
            const cleanSku = row.sku?.trim().toUpperCase();

            // Basic mandatory validation: SKU, Name, Cost
            if (!cleanSku || !row.name?.trim() || isNaN(costNum) || costNum < 0) {
                buckets.errors.push({ ...row, errorReason: 'Faltan datos obligatorios (SKU, Nombre o Costo)' });
                return;
            }

            const dbMatch = dbProducts[cleanSku];

            // New product-specific validation
            if (!dbMatch) {
                // CONDITIONAL: New products MUST have a margin
                const marginVal = row.profitMargin?.trim();
                if (marginVal === '' || marginVal === 'undefined' || isNaN(parseFloat(marginVal))) {
                    buckets.errors.push({ ...row, errorReason: 'Producto nuevo requiere Margen' });
                    return;
                }
                buckets.new.push(row);
                return;
            }

            // Existing products: compare mandatory + optional fields
            const isNameDiff = dbMatch.name !== row.name.trim();
            const isCostDiff = Number(dbMatch.cost_without_vat) !== costNum;

            const excelMargin = row.profitMargin !== '' ? parseFloat(row.profitMargin) : null;
            const isMarginDiff = excelMargin !== null && !isNaN(excelMargin) && Number(dbMatch.profit_margin) !== excelMargin;

            const excelCategory = row.category?.trim() || null;
            const isCategoryDiff = excelCategory !== null && dbMatch.category !== excelCategory;

            const excelVat = row.vatPercentage !== '' ? parseFloat(row.vatPercentage) : null;
            const isVatDiff = excelVat !== null && !isNaN(excelVat) && Number(dbMatch.vat_percentage) !== excelVat;

            if (isNameDiff || isCostDiff || isMarginDiff || isCategoryDiff || isVatDiff) {
                buckets.modified.push({
                    ...row,
                    oldName: dbMatch.name,
                    oldCost: Number(dbMatch.cost_without_vat),
                    oldMargin: Number(dbMatch.profit_margin),
                    oldCategory: dbMatch.category,
                    oldVat: Number(dbMatch.vat_percentage),
                    isNameDiff, isCostDiff, isMarginDiff, isCategoryDiff, isVatDiff,
                });
            } else {
                buckets.unchanged.push(row);
            }
        });

        return buckets;
    }, [excelRows, dbProducts]);

    // ──────────────────────────────────────────────
    // SYNC
    // ──────────────────────────────────────────────
    const handleSync = async () => {
        if (categorizedData.errors.length > 0) {
            alert("Por favor, corrige todos los errores antes de sincronizar.");
            return;
        }

        // Check if IVA prompt is still pending
        if (showIvaPrompt && rowsWithBlankIva.length > 0) {
            alert("Por favor, selecciona un IVA de respaldo para las celdas vacías antes de sincronizar.");
            return;
        }

        const payload = [...categorizedData.new, ...categorizedData.modified].map(item => ({
            sku: item.sku.trim().toUpperCase(),
            name: item.name.trim(),
            cost_without_vat: parseFloat(item.cost),
            profit_margin: item.profitMargin !== '' && !isNaN(parseFloat(item.profitMargin)) ? parseFloat(item.profitMargin) : null,
            category: item.category?.trim() || null,
            vat_percentage: item.vatPercentage !== '' && !isNaN(parseFloat(item.vatPercentage)) ? parseFloat(item.vatPercentage) : null,
        }));

        if (payload.length === 0) {
            alert("No hay cambios que sincronizar.");
            return;
        }

        setSyncing(true);
        try {
            const { data, error } = await supabase.rpc('sync_vendor_catalog', { p_products: payload });
            if (error) throw error;
            alert(`Sincronización Exitosa!\nInsertados: ${data.inserted_count}\nActualizados: ${data.updated_count}`);
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Error during sync:", error);
            alert("Error en la sincronización: " + error.message);
        } finally {
            setSyncing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-surface rounded-2xl shadow-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden border border-subtle">

                {/* ═══════ TOP BAR ═══════ */}
                <div className="p-6 border-b border-subtle flex justify-between items-center bg-surface-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 text-primary rounded-xl">
                            <Sparkles size={24} aria-hidden="true" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-fg">Master Data Override Wizard</h2>
                            <p className="text-sm text-fg-muted">Sincroniza el catálogo de productos saltando la protección de 3 strikes.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {/* Download Template */}
                        <button
                            onClick={handleDownloadTemplate}
                            className="flex items-center gap-2 px-3 py-2 bg-surface border border-subtle rounded-xl text-sm font-medium text-fg-muted hover:bg-surface-hover transition-colors"
                            title="Descargar plantilla Excel"
                        >
                            <Download size={18} aria-hidden="true" />
                            Plantilla
                        </button>
                        {/* Upload */}
                        <div className="relative">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileUpload}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                title="Importar Excel"
                            />
                            <button className="flex items-center gap-2 px-3 py-2 bg-success-soft text-success-soft-fg border border-success/20 rounded-xl text-sm font-medium hover:bg-success-soft transition-colors">
                                <FileUp size={18} aria-hidden="true" />
                                Cargar Excel
                            </button>
                        </div>
                        <button onClick={onClose} className="p-2 text-fg-subtle hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors ml-1">
                            <X size={18} aria-hidden="true" />
                        </button>
                    </div>
                </div>

                {/* ═══════ MAIN CONTENT ═══════ */}
                <div className="flex-1 overflow-auto p-6 bg-slate-50/50 dark:bg-slate-900/50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-fg-muted gap-4">
                            <Loader2 size={40} className="animate-spin text-primary" aria-hidden="true" />
                            <p className="font-medium animate-pulse">Cargando catálogo base...</p>
                        </div>
                    ) : excelRows.length === 0 ? (
                        /* ═══════ EMPTY STATE ═══════ */
                        <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
                            <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center mb-6">
                                <FilePlus size={48} className="text-primary/40" aria-hidden="true" />
                            </div>
                            <h3 className="text-xl font-bold text-fg mb-2">Sube tu archivo Excel</h3>
                            <p className="text-fg-muted mb-4">Columnas obligatorias:</p>
                            <div className="flex flex-wrap gap-2 justify-center mb-2">
                                <span className="font-mono bg-danger-soft text-danger-soft-fg px-2 py-0.5 rounded text-sm">SKU</span>
                                <span className="font-mono bg-danger-soft text-danger-soft-fg px-2 py-0.5 rounded text-sm">Nombre</span>
                                <span className="font-mono bg-danger-soft text-danger-soft-fg px-2 py-0.5 rounded text-sm">Costo S/IVA</span>
                            </div>
                            <p className="text-fg-subtle text-xs mb-4">Condicional: <span className="font-mono">Margen</span> (requerido para nuevos)</p>
                            <p className="text-fg-subtle text-xs mb-6">Opcionales: <span className="font-mono">Categoría</span>, <span className="font-mono">IVA %</span></p>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="px-5 py-2.5 bg-surface border border-subtle text-fg-muted rounded-xl font-medium hover:bg-surface-hover transition-colors flex items-center gap-2"
                                >
                                    <Download size={18} aria-hidden="true" />
                                    Descargar Plantilla
                                </button>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-6 py-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/30 font-medium hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-2"
                                >
                                    <Upload size={18} aria-hidden="true" />
                                    Seleccionar Archivo
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* ═══════ DATA LOADED ═══════ */
                        <div className="flex flex-col gap-6 max-w-5xl mx-auto">

                            {/* ── IVA SMART PROMPT ── */}
                            {showIvaPrompt && rowsWithBlankIva.length > 0 && (
                                <div className="bg-warning-soft border-2 border-warning rounded-2xl p-5 shadow-lg shadow-warning">
                                    <div className="flex items-start gap-4">
                                        <div className="bg-warning-soft p-3 rounded-xl">
                                            <Percent size={32} className="text-warning" aria-hidden="true" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-bold text-warning mb-1">IVA sin definir detectado</h3>
                                            <p className="text-sm text-warning mb-4">
                                                Tienes <span className="font-bold">{rowsWithBlankIva.length}</span> productos con la columna <span className="font-mono font-semibold">IVA %</span> vacía.
                                                Selecciona un IVA de respaldo para aplicar a estos productos:
                                            </p>
                                            <div className="flex items-center gap-3">
                                                <select
                                                    value={ivaFallback}
                                                    onChange={(e) => setIvaFallback(e.target.value)}
                                                    className="px-4 py-2.5 bg-surface border border-warning/20 rounded-xl font-medium text-fg focus:ring-2 focus:ring-warning outline-none min-w-[180px]"
                                                >
                                                    <option value="">Seleccionar IVA...</option>
                                                    <option value="15">15%</option>
                                                    <option value="12">12%</option>
                                                    <option value="8">8%</option>
                                                    <option value="5">5%</option>
                                                    <option value="0">0% (Exento)</option>
                                                </select>
                                                <button
                                                    onClick={handleApplyIvaFallback}
                                                    disabled={ivaFallback === ''}
                                                    className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${ivaFallback !== '' ? 'bg-warning hover:bg-warning text-white shadow-sm active:scale-95' : 'bg-slate-200 dark:bg-slate-700 text-fg-subtle cursor-not-allowed' }`}
                                                >
                                                    <CircleCheck size={18} aria-hidden="true" />
                                                    Aplicar a {rowsWithBlankIva.length} filas
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── SUMMARY STATS ── */}
                            <div className="grid grid-cols-4 gap-4">
                                <div className="bg-surface p-4 rounded-xl border border-danger/20 shadow-sm flex items-center gap-4">
                                    <div className="bg-danger-soft text-danger-soft-fg p-3 rounded-lg"><CircleAlert size={18} aria-hidden="true" /></div>
                                    <div><p className="text-sm text-fg-muted">Errores</p><p className="text-2xl font-bold text-fg">{categorizedData.errors.length}</p></div>
                                </div>
                                <div className="bg-surface p-4 rounded-xl border border-warning/20 shadow-sm flex items-center gap-4">
                                    <div className="bg-warning-soft text-warning-soft-fg p-3 rounded-lg"><FilePen size={18} aria-hidden="true" /></div>
                                    <div><p className="text-sm text-fg-muted">Modificados</p><p className="text-2xl font-bold text-fg">{categorizedData.modified.length}</p></div>
                                </div>
                                <div className="bg-surface p-4 rounded-xl border border-success/20 shadow-sm flex items-center gap-4">
                                    <div className="bg-success-soft text-success-soft-fg p-3 rounded-lg"><Sparkles size={18} aria-hidden="true" /></div>
                                    <div><p className="text-sm text-fg-muted">Nuevos</p><p className="text-2xl font-bold text-fg">{categorizedData.new.length}</p></div>
                                </div>
                                <div className="bg-surface p-4 rounded-xl border border-subtle shadow-sm flex items-center gap-4">
                                    <div className="bg-surface-3 text-fg-muted p-3 rounded-lg"><CircleCheck size={18} aria-hidden="true" /></div>
                                    <div><p className="text-sm text-fg-muted">Sin Cambios</p><p className="text-2xl font-bold text-fg">{categorizedData.unchanged.length}</p></div>
                                </div>
                            </div>

                            {/* ── ERRORS SECTION ── */}
                            {categorizedData.errors.length > 0 && (
                                <div className="bg-surface border-[2px] border-danger rounded-2xl shadow-lg shadow-danger overflow-hidden">
                                    <div className="bg-danger-soft px-6 py-4 border-b border-danger/20 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <TriangleAlert size={32} className="text-danger" aria-hidden="true" />
                                            <h3 className="text-lg font-bold text-danger">Atención Requerida ({categorizedData.errors.length})</h3>
                                        </div>
                                        <p className="text-sm text-danger">Corrige los datos para procesarlos.</p>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-surface-2 border-b border-subtle">
                                                <tr>
                                                    <th className="px-4 py-2.5 text-xs font-semibold text-fg-muted uppercase tracking-wider">SKU</th>
                                                    <th className="px-4 py-2.5 text-xs font-semibold text-fg-muted uppercase tracking-wider">Nombre</th>
                                                    <th className="px-4 py-2.5 text-xs font-semibold text-fg-muted uppercase tracking-wider w-32">Costo</th>
                                                    <th className="px-4 py-2.5 text-xs font-semibold text-fg-muted uppercase tracking-wider w-28">Margen</th>
                                                    <th className="px-4 py-2.5 text-xs font-semibold text-fg-muted uppercase tracking-wider">Motivo</th>
                                                    <th className="px-4 py-2.5 w-12"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                                {categorizedData.errors.map((row: any) => {
                                                    const isSkuMissing = !row.sku?.trim();
                                                    const isNameMissing = !row.name?.trim();
                                                    const costNum = parseFloat(row.cost);
                                                    const isCostBad = isNaN(costNum) || costNum < 0;
                                                    const isMarginMissing = row.errorReason?.includes('Margen');

                                                    return (
                                                        <tr key={row.id} className="hover:bg-surface-hover transition-colors">
                                                            <td className="px-4 py-3">
                                                                <input type="text" value={row.sku}
                                                                    onChange={(e) => handleRowEdit(row.id, 'sku', e.target.value)}
                                                                    placeholder="Requerido"
                                                                    className={`w-full px-3 py-2 rounded-lg text-sm border font-mono ${isSkuMissing ? 'border-danger/20 bg-danger-soft dark:bg-danger/20' : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'} outline-none focus:ring-2 focus:ring-primary`}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input type="text" value={row.name}
                                                                    onChange={(e) => handleRowEdit(row.id, 'name', e.target.value)}
                                                                    placeholder="Requerido"
                                                                    className={`w-full px-3 py-2 rounded-lg text-sm border ${isNameMissing ? 'border-danger/20 bg-danger-soft dark:bg-danger/20' : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'} outline-none focus:ring-2 focus:ring-primary`}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input type="number" value={row.cost} min="0" step="0.01"
                                                                    onChange={(e) => handleRowEdit(row.id, 'cost', e.target.value)}
                                                                    placeholder="0.00"
                                                                    className={`w-full px-3 py-2 rounded-lg text-sm border ${isCostBad ? 'border-danger/20 bg-danger-soft dark:bg-danger/20' : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'} outline-none focus:ring-2 focus:ring-primary`}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input type="number" value={row.profitMargin} min="0" step="0.01"
                                                                    onChange={(e) => handleRowEdit(row.id, 'profitMargin', e.target.value)}
                                                                    placeholder="0.30"
                                                                    className={`w-full px-3 py-2 rounded-lg text-sm border ${isMarginMissing ? 'border-danger/20 bg-danger-soft dark:bg-danger/20' : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'} outline-none focus:ring-2 focus:ring-primary`}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className="text-xs text-danger-soft-fg font-medium bg-danger-soft px-2 py-1 rounded-lg">{row.errorReason}</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <button onClick={() => handleRemoveRow(row.id)}
                                                                    className="p-1.5 text-fg-subtle hover:text-danger hover:bg-danger-soft rounded-lg transition-colors"
                                                                    title="Descartar">
                                                                    <Trash2 size={18} aria-hidden="true" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* ── MODIFIED SECTION ── */}
                            {categorizedData.modified.length > 0 && (
                                <div className="bg-surface border border-subtle rounded-2xl shadow-sm overflow-hidden">
                                    <div className="bg-warning-soft px-6 py-3 border-b border-warning/20 flex items-center gap-2">
                                        <RefreshCw size={20} className="text-warning" aria-hidden="true" />
                                        <h3 className="font-bold text-warning">Actualizaciones ({categorizedData.modified.length})</h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-surface-2 border-b border-subtle">
                                                <tr>
                                                    <th className="px-4 py-2.5 font-semibold text-fg-muted">SKU</th>
                                                    <th className="px-4 py-2.5 font-semibold text-fg-muted">Nombre</th>
                                                    <th className="px-4 py-2.5 font-semibold text-fg-muted">Costo</th>
                                                    <th className="px-4 py-2.5 font-semibold text-fg-muted">Otros Cambios</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                                {categorizedData.modified.map((row: any) => {
                                                    const otherChanges: string[] = [];
                                                    if (row.isMarginDiff) otherChanges.push(`Margen: ${row.oldMargin} ➔ ${parseFloat(row.profitMargin)}`);
                                                    if (row.isCategoryDiff) otherChanges.push(`Cat: ${row.oldCategory || '—'} ➔ ${row.category}`);
                                                    if (row.isVatDiff) otherChanges.push(`IVA: ${row.oldVat}% ➔ ${parseFloat(row.vatPercentage)}%`);

                                                    return (
                                                        <tr key={row.id} className="hover:bg-surface-hover">
                                                            <td className="px-4 py-3 font-mono text-fg font-medium">{row.sku}</td>
                                                            <td className="px-4 py-3">
                                                                {row.isNameDiff ? (
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-fg-subtle line-through text-xs">{row.oldName}</span>
                                                                        <span className="text-warning font-medium bg-warning-soft/50 px-2 py-0.5 rounded inline-block w-fit">{row.name}</span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-fg">{row.name}</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {row.isCostDiff ? (
                                                                    <div className="flex flex-col gap-1 font-mono">
                                                                        <span className="text-fg-subtle line-through text-xs">${row.oldCost.toFixed(2)}</span>
                                                                        <div className="flex items-center gap-1">
                                                                            <ArrowRight size={14} className="text-warning" aria-hidden="true" />
                                                                            <span className="text-warning font-bold bg-warning-soft/50 px-2 py-0.5 rounded inline-block w-fit">${parseFloat(row.cost).toFixed(2)}</span>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-fg font-mono">${parseFloat(row.cost).toFixed(2)}</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {otherChanges.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {otherChanges.map((change, i) => (
                                                                            <span key={i} className="text-xs bg-surface-3 text-fg-muted px-2 py-1 rounded-lg">{change}</span>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs text-fg-subtle">—</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* ── NEW PRODUCTS SECTION ── */}
                            {categorizedData.new.length > 0 && (
                                <div className="bg-surface border border-subtle rounded-2xl shadow-sm overflow-hidden">
                                    <div className="bg-success-soft px-6 py-3 border-b border-success/20 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <CirclePlus size={20} className="text-success" aria-hidden="true" />
                                            <h3 className="font-bold text-success">Nuevos Productos ({categorizedData.new.length})</h3>
                                        </div>
                                        <span className="text-xs font-semibold text-success-soft-fg bg-success-soft px-3 py-1 rounded-full">Se crearán con stock 0</span>
                                    </div>
                                    <div className="p-6">
                                        <div className="flex flex-wrap gap-3">
                                            {categorizedData.new.map((row: any) => (
                                                <div key={row.id} className="flex flex-col bg-surface-2 border border-subtle p-3 rounded-xl min-w-[200px] flex-1 max-w-[300px]">
                                                    <span className="font-mono text-xs text-fg-muted mb-1">{row.sku}</span>
                                                    <span className="font-bold text-fg text-sm truncate" title={row.name}>{row.name}</span>
                                                    <span className="text-success font-mono font-medium mt-2">${parseFloat(row.cost).toFixed(2)}</span>
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        <span className="text-2xs bg-success-soft text-success-soft-fg px-1.5 py-0.5 rounded">Margen: {row.profitMargin}</span>
                                                        {row.category && <span className="text-2xs bg-slate-200 dark:bg-slate-700 text-fg-muted px-1.5 py-0.5 rounded">{row.category}</span>}
                                                        {row.vatPercentage && <span className="text-2xs bg-slate-200 dark:bg-slate-700 text-fg-muted px-1.5 py-0.5 rounded">IVA: {row.vatPercentage}%</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── UNCHANGED BANNER ── */}
                            {categorizedData.unchanged.length > 0 && (
                                <div className="flex items-center justify-center gap-3 py-4 text-fg-muted bg-surface-3 rounded-xl border border-dashed border-strong">
                                    <CircleCheckBig size={18} className="text-fg-subtle" aria-hidden="true" />
                                    <span className="text-sm font-medium">{categorizedData.unchanged.length} productos coinciden perfectamente y serán ignorados.</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ═══════ FOOTER ═══════ */}
                <div className="p-5 border-t border-subtle bg-surface flex justify-between items-center shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
                    <span className="text-sm text-fg-muted font-medium">
                        {excelRows.length > 0 ? `${excelRows.length} filas analizadas` : 'Esperando archivo...'}
                    </span>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 text-fg-muted font-medium hover:bg-surface-hover rounded-xl transition-colors">
                            Cancelar
                        </button>
                        <button
                            disabled={excelRows.length === 0 || categorizedData.errors.length > 0 || syncing || (categorizedData.new.length === 0 && categorizedData.modified.length === 0) || (showIvaPrompt && rowsWithBlankIva.length > 0)}
                            onClick={handleSync}
                            className={`px-6 py-2.5 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 ${excelRows.length > 0 && categorizedData.errors.length === 0 && (categorizedData.new.length > 0 || categorizedData.modified.length > 0) && !(showIvaPrompt && rowsWithBlankIva.length > 0) ? 'bg-primary hover:bg-primary/90 shadow-primary/30 active:scale-95' : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed text-fg-muted shadow-none'}`}
                        >
                            {syncing ? (
                                <>
                                    <RefreshCw size={20} className="animate-spin" aria-hidden="true" />
                                    Sincronizando...
                                </>
                            ) : (
                                <>
                                    <Database size={20} aria-hidden="true" />
                                    Confirmar y Sincronizar
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
