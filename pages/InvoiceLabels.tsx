import React, { useCallback, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { parseInvoicePdf } from '../utils/invoiceParser';
import { generateQueuePDF, addToQueue, PrintQueueItem } from '../utils/mobilePrintQueue';
import { useInvoiceLabelsStore, InvoiceLabelRow } from '../store/useInvoiceLabelsStore';
import { BatchProductEntry } from '../components/BatchProductEntry';
import { LabelSizeSelector } from '../components/LabelSizeSelector';
import { ThermalPrinterSelector } from '../components/ThermalPrinterSelector';
import { LabelSizePreset } from '../utils/labelPresets';
import { printLabelsOnThermalPrinter, getCutAtEnd } from '../utils/thermalLabelPrinter';

/**
 * Reads a print-range expression -- "1-10", "12", "1-5, 8, 14-16" -- into the
 * set of 1-based line numbers it names.
 *
 * Returns null when the text names nothing usable, rather than an empty set.
 * The difference matters: the caller applies the result as the whole
 * selection, so a typo that quietly resolved to "nothing" would untick every
 * line on the invoice instead of reporting a mistake.
 */
export const parseRowSelection = (text: string, rowCount: number): Set<number> | null => {
    const picked = new Set<number>();

    for (const part of text.split(',')) {
        const chunk = part.trim();
        if (!chunk) continue;

        const range = chunk.match(/^(\d+)\s*-\s*(\d+)$/);
        if (range) {
            let from = Number(range[1]);
            let to = Number(range[2]);
            // "10-1" is what someone means by "the first ten" written backwards.
            if (from > to) [from, to] = [to, from];
            for (let n = from; n <= to; n++) {
                if (n >= 1 && n <= rowCount) picked.add(n);
            }
            continue;
        }

        if (/^\d+$/.test(chunk)) {
            const n = Number(chunk);
            if (n >= 1 && n <= rowCount) picked.add(n);
            continue;
        }

        return null; // one unparseable chunk invalidates the whole expression
    }

    return picked.size > 0 ? picked : null;
};

const InvoiceLabels: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { fileName, invoiceNumber, rows, setInvoice, updateRow, setIncluded, markAddedToInventory, reset } = useInvoiceLabelsStore();

    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isWorking, setIsWorking] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [isBatchEntryOpen, setIsBatchEntryOpen] = useState(false);
    const [labelSize, setLabelSize] = useState<LabelSizePreset | null>(null);
    const [isPrintingThermal, setIsPrintingThermal] = useState(false);
    const [rangeText, setRangeText] = useState('');

    const applyRangeSelection = () => {
        const picked = parseRowSelection(rangeText, rows.length);
        if (!picked) {
            setError(
                `No entendí "${rangeText}". Escribe números de línea y rangos separados por comas, ` +
                `por ejemplo: 1-10, 12, 15-18 (hay ${rows.length} línea(s)).`
            );
            return;
        }
        setError(null);
        setIncluded(rows.filter((_, i) => picked.has(i + 1)).map(r => r.key));
        setFeedback(`${picked.size} de ${rows.length} línea(s) seleccionadas.`);
        setTimeout(() => setFeedback(null), 4000);
    };

    const handleFile = useCallback(async (file: File) => {
        setError(null);
        setFeedback(null);
        setIsParsing(true);
        try {
            const { invoiceNumber: invNum, lines } = await parseInvoicePdf(file);

            if (lines.length === 0) {
                setError('No se pudo encontrar ningún repuesto en este PDF. Verifica que sea una factura de venta con el formato habitual (Código / Descripción / Cantidad).');
                setIsParsing(false);
                return;
            }

            // Cross-reference against the catálogo to reuse the canonical
            // product name/id whenever the SKU is already registered.
            const skus = Array.from(new Set(lines.map(l => l.sku)));
            let matches: Record<string, { id: number; name: string; image_url?: string; profit_margin?: number }> = {};
            const { data, error: dbError } = await supabase
                .from('products')
                .select('id, sku, name, image_url, profit_margin')
                .in('sku', skus);

            if (!dbError && data) {
                matches = Object.fromEntries(
                    data.map((p: any) => [p.sku, { id: p.id, name: p.name, image_url: p.image_url, profit_margin: p.profit_margin }])
                );
            }

            const builtRows: InvoiceLabelRow[] = lines.map((line, idx) => {
                const match = matches[line.sku];
                return {
                    ...line,
                    key: `${line.sku}-${idx}`,
                    included: true,
                    productId: match?.id ?? null,
                    labelName: match?.name ?? line.description,
                    imageUrl: match?.image_url,
                    existingMargin: match?.profit_margin,
                    addedToInventory: false,
                };
            });

            setInvoice(file.name, invNum, builtRows);
        } catch (err: any) {
            console.error('Error al procesar la factura:', err);
            setError('Ocurrió un error al leer el PDF. Asegúrate de que el archivo no esté dañado y vuelve a intentarlo.');
        } finally {
            setIsParsing(false);
        }
    }, [setInvoice]);

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type === 'application/pdf') handleFile(file);
    };

    const toggleRow = (key: string) => {
        const row = rows.find(r => r.key === key);
        if (row) updateRow(key, { included: !row.included });
    };

    const updateQty = (key: string, qty: number) => {
        // Quantity changed after a row was already sent to inventory —
        // clear the flag so it's clear a (re)addition is still pending.
        updateRow(key, { quantity: Math.max(1, Math.round(qty) || 1), addedToInventory: false });
    };

    const updateName = (key: string, name: string) => {
        updateRow(key, { labelName: name });
    };

    const includedRows = rows.filter(r => r.included);
    const totalLabels = includedRows.reduce((acc, r) => acc + r.quantity, 0);
    const matchedCount = rows.filter(r => r.productId !== null).length;
    const pendingInventoryRows = includedRows.filter(r => !r.addedToInventory);

    const buildQueueItems = (): PrintQueueItem[] =>
        includedRows.map((r, idx) => ({
            id: r.productId ?? -(idx + 1),
            sku: r.sku,
            name: r.labelName || r.description,
            image_url: r.imageUrl,
            quantity: r.quantity,
        }));

    const handleDownloadPdf = async () => {
        if (includedRows.length === 0) return;
        setIsWorking(true);
        try {
            const pdf = await generateQueuePDF(buildQueueItems());
            const suffix = invoiceNumber ? invoiceNumber : 'factura';
            pdf.save(`etiquetas_${suffix}_x${totalLabels}.pdf`);
        } catch (err) {
            console.error('Error al generar el PDF:', err);
            setError('Ocurrió un error al generar el PDF de etiquetas.');
        } finally {
            setIsWorking(false);
        }
    };

    const handleOpenPdf = async () => {
        if (includedRows.length === 0) return;
        setIsWorking(true);
        try {
            const pdf = await generateQueuePDF(buildQueueItems());
            const blob = pdf.output('blob');
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (err) {
            console.error('Error al abrir el PDF:', err);
            setError('Ocurrió un error al abrir el PDF de etiquetas.');
        } finally {
            setIsWorking(false);
        }
    };

    // Unlike the print queue, this needs no catálogo match: the thermal path
    // only wants a SKU, a name and a count, all of which the invoice already
    // provides. So every included line prints, including repuestos that have
    // never been added to the catálogo.
    const handlePrintThermal = async () => {
        if (includedRows.length === 0 || !labelSize) return;
        setIsPrintingThermal(true);
        setError(null);
        try {
            await printLabelsOnThermalPrinter(
                includedRows.map(r => ({
                    sku: r.sku,
                    name: r.labelName || r.description,
                    quantity: r.quantity,
                })),
                { widthMm: labelSize.widthMm, heightMm: labelSize.heightMm },
                undefined,
                { gapMm: labelSize.gapMm, offsetMm: labelSize.offsetMm, cutAtEnd: getCutAtEnd() }
            );
            setFeedback(`${totalLabels} etiqueta(s) enviadas a la impresora térmica.`);
            setTimeout(() => setFeedback(null), 5000);
        } catch (err: any) {
            console.error('Error al imprimir en térmica:', err);
            setError(err?.message || 'Ocurrió un error al enviar las etiquetas a la impresora térmica.');
        } finally {
            setIsPrintingThermal(false);
        }
    };

    const handleAddToQueue = async () => {
        const matched = includedRows.filter(r => r.productId !== null);
        if (matched.length === 0) return;
        setIsWorking(true);
        try {
            for (const r of matched) {
                await addToQueue({ id: r.productId as number, sku: r.sku, name: r.labelName, image_url: r.imageUrl }, r.quantity);
            }
            const skipped = includedRows.length - matched.length;
            setFeedback(
                skipped > 0
                    ? `${matched.length} repuesto(s) agregados a la cola de impresión. ${skipped} no están en el catálogo y no se agregaron (pero sí puedes descargar/imprimir su PDF directamente).`
                    : `${matched.length} repuesto(s) agregados a la cola de impresión.`
            );
            setTimeout(() => setFeedback(null), 5000);
        } catch (err) {
            console.error('Error al agregar a la cola:', err);
            setError('Ocurrió un error al agregar las etiquetas a la cola de impresión.');
        } finally {
            setIsWorking(false);
        }
    };

    // Instead of writing to inventory directly, hand the pending rows off to
    // the app's existing "Entrada de Productos por Lote" tool — it already
    // knows how to create/update products, add stock per almacén, and
    // (optionally) record the purchase transaction, so there's no need for a
    // second, parallel way of doing the same thing.
    const batchEntryProducts = pendingInventoryRows.map(r => ({
        sku: r.sku,
        name: r.labelName || r.description,
        quantity: r.quantity,
        costWithoutVat: r.unitPrice,
        // Keep the product's own margin so an existing SKU's price doesn't
        // get pushed up by a generic default (process_batch_product_entry
        // only ever raises the stored margin, never lowers it).
        profitMargin: r.existingMargin,
    }));

    const handleBatchEntrySuccess = () => {
        markAddedToInventory(pendingInventoryRows.map(r => r.key));
        setFeedback(`${pendingInventoryRows.length} repuesto(s) enviados a Entrada por Lote e ingresados al inventario.`);
        setTimeout(() => setFeedback(null), 5000);
    };

    const handleStartOver = () => {
        if (rows.length > 0 && !window.confirm('¿Deseas descartar esta factura y cargar una nueva?')) return;
        reset();
        setError(null);
        setFeedback(null);
    };

    return (
        <div className="p-6 md:p-8 max-w-[1100px] mx-auto flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold dark:text-white tracking-tight">Etiquetas de Factura</h1>
                <p className="text-slate-500 mt-1">
                    Sube el PDF de una factura de compra y genera automáticamente todas las etiquetas de los repuestos que vinieron en ella, respetando la cantidad de cada uno.
                </p>
            </div>

            {rows.length === 0 && (
                <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-900 text-center"
                >
                    <span className="material-symbols-outlined text-4xl text-slate-400">picture_as_pdf</span>
                    <div>
                        <p className="font-medium text-slate-700 dark:text-slate-200">
                            {fileName ? fileName : 'Arrastra el PDF de la factura aquí'}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">o haz clic para seleccionar el archivo</p>
                    </div>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isParsing}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-70"
                    >
                        <span className={`material-symbols-outlined text-[20px] ${isParsing ? 'animate-spin' : ''}`}>
                            {isParsing ? 'progress_activity' : 'upload_file'}
                        </span>
                        {isParsing ? 'Leyendo factura...' : 'Seleccionar PDF'}
                    </button>
                    <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileInputChange} />
                </div>
            )}

            {error && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
                    <span className="material-symbols-outlined text-[20px]">error</span>
                    {error}
                </div>
            )}

            {feedback && (
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm flex items-start gap-2">
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    {feedback}
                </div>
            )}

            {rows.length > 0 && (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                            {invoiceNumber && <span className="font-medium">Factura No: {invoiceNumber} · </span>}
                            {fileName && <span className="text-slate-400">({fileName}) · </span>}
                            {rows.length} repuesto(s) detectados · {matchedCount} coinciden con el catálogo
                            {matchedCount < rows.length && (
                                <span className="text-amber-600 dark:text-amber-400"> · {rows.length - matchedCount} sin coincidencia (se imprimen con la descripción de la factura; si los envías a Entrada por Lote se crean como producto nuevo)</span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                {totalLabels} etiqueta(s) a imprimir
                            </span>
                            <button
                                onClick={handleStartOver}
                                className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline decoration-dotted"
                            >
                                Cargar otra factura
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 shrink-0">
                            Imprimir líneas:
                        </label>
                        <input
                            type="text"
                            value={rangeText}
                            onChange={(e) => setRangeText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') applyRangeSelection(); }}
                            placeholder="ej. 1-10, 12"
                            className="flex-1 min-w-[160px] px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <button
                            onClick={applyRangeSelection}
                            disabled={!rangeText.trim()}
                            className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 border border-primary/30 rounded-lg disabled:opacity-50 shrink-0"
                        >
                            Aplicar
                        </button>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <button
                            onClick={() => { setIncluded(rows.map(r => r.key)); setRangeText(''); }}
                            className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg shrink-0"
                        >
                            Todas
                        </button>
                        <button
                            onClick={() => { setIncluded([]); setRangeText(''); }}
                            className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg shrink-0"
                        >
                            Ninguna
                        </button>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                <tr>
                                    <th className="p-3 text-left w-10"></th>
                                    <th className="p-3 text-right w-10">#</th>
                                    <th className="p-3 text-left">Código</th>
                                    <th className="p-3 text-left">Nombre en la etiqueta</th>
                                    <th className="p-3 text-center w-28">Cantidad</th>
                                    <th className="p-3 text-center w-32">Catálogo</th>
                                    <th className="p-3 text-center w-32">Inventario</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, idx) => (
                                    <tr key={row.key} className={`border-t border-slate-100 dark:border-slate-800 ${!row.included ? 'opacity-50' : ''}`}>
                                        <td className="p-3">
                                            <input
                                                type="checkbox"
                                                checked={row.included}
                                                onChange={() => toggleRow(row.key)}
                                                className="w-4 h-4 accent-primary"
                                            />
                                        </td>
                                        {/* The number the range box refers to. */}
                                        <td className="p-3 text-right font-mono text-slate-400 dark:text-slate-500 tabular-nums">
                                            {idx + 1}
                                        </td>
                                        <td className="p-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{row.sku}</td>
                                        <td className="p-3">
                                            <input
                                                type="text"
                                                value={row.labelName}
                                                onChange={(e) => updateName(row.key, e.target.value)}
                                                className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                                            />
                                        </td>
                                        <td className="p-3">
                                            <input
                                                type="number"
                                                min={1}
                                                value={row.quantity}
                                                onChange={(e) => updateQty(row.key, parseInt(e.target.value, 10))}
                                                className="w-20 mx-auto block px-2 py-1 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white font-medium"
                                            />
                                        </td>
                                        <td className="p-3 text-center">
                                            {row.productId !== null ? (
                                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                                                    <span className="material-symbols-outlined text-[16px]">check_circle</span> En catálogo
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-medium">
                                                    <span className="material-symbols-outlined text-[16px]">help</span> No encontrado
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 text-center">
                                            {row.addedToInventory ? (
                                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                                                    <span className="material-symbols-outlined text-[16px]">inventory_2</span> Ingresado
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-400">Pendiente</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Add to inventory via the existing Batch Entry tool */}
                    <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                        <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">inventory_2</span>
                        <span className="text-sm text-slate-600 dark:text-slate-300 flex-1 min-w-[220px]">
                            Envía estos repuestos (con su costo y cantidad de la factura) a <strong>Entrada por Lote</strong> para registrar la llegada al almacén.
                        </span>
                        <button
                            onClick={() => setIsBatchEntryOpen(true)}
                            disabled={isWorking || pendingInventoryRows.length === 0}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-[20px]">add_box</span>
                            {pendingInventoryRows.length === 0
                                ? 'Ya enviado a Entrada por Lote'
                                : `Enviar a Entrada por Lote (${pendingInventoryRows.reduce((a, r) => a + r.quantity, 0)})`}
                        </button>
                    </div>

                    <div className="flex flex-col gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <span className="material-symbols-outlined">receipt_long</span>
                            Impresora Térmica
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Imprime las {totalLabels} etiqueta(s) directamente, sin generar un PDF. Incluye los
                            repuestos que aún no están en el catálogo.
                        </p>
                        <div className="grid sm:grid-cols-2 gap-3">
                            <LabelSizeSelector value={labelSize} onChange={setLabelSize} />
                            <ThermalPrinterSelector />
                        </div>
                        <button
                            onClick={handlePrintThermal}
                            disabled={isPrintingThermal || includedRows.length === 0 || !labelSize}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <span className={`material-symbols-outlined ${isPrintingThermal ? 'animate-spin' : ''}`}>
                                {isPrintingThermal ? 'progress_activity' : 'print'}
                            </span>
                            {isPrintingThermal ? 'Enviando...' : `Imprimir en Térmica (${totalLabels})`}
                        </button>
                    </div>

                    <div className="flex flex-wrap justify-end gap-3">
                        <button
                            onClick={handleAddToQueue}
                            disabled={isWorking || matchedCount === 0}
                            className="px-4 py-2 text-amber-700 dark:text-amber-300 font-medium hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors flex items-center gap-2 border border-amber-200 dark:border-amber-700 disabled:opacity-50"
                            title="Agrega las etiquetas de los repuestos que sí están en el catálogo a la cola de impresión"
                        >
                            <span className="material-symbols-outlined text-[20px]">playlist_add</span>
                            Agregar a la Cola
                        </button>
                        <button
                            onClick={handleDownloadPdf}
                            disabled={isWorking || includedRows.length === 0}
                            className="px-4 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-900/20 dark:hover:bg-violet-900/40 dark:border-violet-800 dark:text-violet-300 font-medium rounded-lg shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-[20px]">download</span>
                            Descargar PDF ({totalLabels})
                        </button>
                        <button
                            onClick={handleOpenPdf}
                            disabled={isWorking || includedRows.length === 0}
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            <span className={`material-symbols-outlined text-[20px] ${isWorking ? 'animate-spin' : ''}`}>
                                {isWorking ? 'progress_activity' : 'print'}
                            </span>
                            Imprimir PDF
                        </button>
                    </div>
                </>
            )}

            <BatchProductEntry
                isOpen={isBatchEntryOpen}
                onClose={() => setIsBatchEntryOpen(false)}
                onSuccess={handleBatchEntrySuccess}
                initialProducts={batchEntryProducts}
            />
        </div>
    );
};

export default InvoiceLabels;
