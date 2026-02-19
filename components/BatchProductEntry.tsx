import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BrandSelect } from './BrandSelect';
import { WarehouseSelect } from './WarehouseSelect';
import { read, utils, writeFile } from 'xlsx';

interface Account {
    id: number;
    name: string;
    code: string;
    currency: string;
}

interface ProductRow {
    id: string; // Temporary ID for React key
    sku: string;
    name: string;
    quantity: string;
    costWithoutVat: string;
    discountedCost: string;
    profitMargin: string;
    // Calculated fields for display
    costWithVat: number;
    pvp: number;
}

interface BatchProductEntryProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const BatchProductEntry: React.FC<BatchProductEntryProps> = ({ isOpen, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [globalBrandId, setGlobalBrandId] = useState<number | null>(null);
    const [globalWarehouseId, setGlobalWarehouseId] = useState<number | null>(null);
    const [globalVat, setGlobalVat] = useState<number>(12); // Default 12%
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

    // Initial row
    const [rows, setRows] = useState<ProductRow[]>([
        { id: '1', sku: '', name: '', quantity: '1', costWithoutVat: '', discountedCost: '', profitMargin: '0.30', costWithVat: 0, pvp: 0 }
    ]);

    // Computed totals
    const [totals, setTotals] = useState({
        totalCostExVat: 0,
        totalCostIncVat: 0,
        totalPvp: 0,
        estimatedProfit: 0
    });

    useEffect(() => {
        if (isOpen) {
            fetchAccounts();
        }
    }, [isOpen]);

    const fetchAccounts = async () => {
        try {
            // Fetch all accounts to allow user flexibility
            const { data, error } = await supabase
                .from('accounts')
                .select('*')
                .order('name');

            if (error) throw error;
            setAccounts(data || []);
        } catch (error) {
            console.error('Error fetching accounts:', error);
        }
    };

    // Update calculations when inputs change
    useEffect(() => {
        let totalCostExVat = 0;
        let totalCostIncVat = 0;
        let totalPvp = 0;

        const newRows = rows.map(row => {
            const cost = parseFloat(row.discountedCost || row.costWithoutVat) || 0;
            const margin = parseFloat(row.profitMargin) || 0;
            const qty = parseFloat(row.quantity) || 0;

            const costWithVat = cost * (1 + globalVat / 100);
            const pvp = costWithVat * (1 + margin);

            // Accumulate totals
            if (qty > 0) {
                totalCostExVat += cost * qty;
                totalCostIncVat += costWithVat * qty;
                totalPvp += pvp * qty;
            }

            return { ...row, costWithVat, pvp };
        });

        setTotals({
            totalCostExVat,
            totalCostIncVat,
            totalPvp,
            estimatedProfit: totalPvp - totalCostIncVat
        });

        if (JSON.stringify(newRows) !== JSON.stringify(rows)) {
            setRows(newRows);
        }

    }, [rows, globalVat]);

    const handleRowChange = (id: string, field: keyof ProductRow, value: string) => {
        setRows(prev => prev.map(row => {
            if (row.id === id) {
                return { ...row, [field]: value };
            }
            return row;
        }));
    };

    const addRow = () => {
        setRows([...rows, {
            id: Date.now().toString(),
            sku: '',
            name: '',
            quantity: '1',
            costWithoutVat: '',
            discountedCost: '',
            profitMargin: '0.30',
            costWithVat: 0,
            pvp: 0
        }]);
    };

    const removeRow = (id: string) => {
        if (rows.length > 1) {
            setRows(rows.filter(r => r.id !== id));
        }
    };

    const handleSubmit = async () => {
        if (!globalBrandId) {
            alert('Por favor selecciona una marca para el lote.');
            return;
        }

        if (!globalWarehouseId) {
            alert('Por favor selecciona un almacén para el lote.');
            return;
        }

        if (!selectedAccountId) {
            alert('Por favor selecciona una cuenta de pago.');
            return;
        }

        // Validate rows
        const validRows = rows.filter(r => r.sku && r.name && r.costWithoutVat);
        if (validRows.length === 0) {
            alert('Debe haber al menos un producto con SKU, Nombre y Costo.');
            return;
        }

        setLoading(true);
        try {
            // Prepare payload
            const productsPayload = validRows.map(r => ({
                sku: r.sku.toUpperCase(),
                name: r.name,
                quantity: parseInt(r.quantity) || 0,
                cost_without_vat: r.discountedCost ? parseFloat(r.discountedCost) : parseFloat(r.costWithoutVat),
                profit_margin: parseFloat(r.profitMargin) || 0
            }));

            const { data, error } = await supabase.rpc('process_batch_product_entry', {
                p_brand_id: globalBrandId,
                p_warehouse_id: globalWarehouseId,
                p_vat_percentage: globalVat,
                p_payment_account_id: selectedAccountId,
                p_products: productsPayload
            });

            if (error) throw error;

            if (!data.success) {
                throw new Error(data.message || 'Error desconocido al guardar el lote.');
            }

            alert(`Lote procesado exitosamente. Transacción #${data.transaction_id} generada.`);
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error saving batch:', error);
            alert('Error al guardar el lote: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Excel Logic
    const handleDownloadTemplate = () => {
        const ws = utils.json_to_sheet([
            { SKU: 'EJEMPLO-SKU', Nombre: 'Producto Ejemplo', Cantidad: 10, 'Costo S/I': 15.50, 'Costo Desc.': 0, Margen: 0.30 }
        ], { header: ['SKU', 'Nombre', 'Cantidad', 'Costo S/I', 'Costo Desc.', 'Margen'] });
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Plantilla");
        writeFile(wb, "plantilla_importacion.xlsx");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data: any[] = utils.sheet_to_json(ws);

            const newRows: ProductRow[] = data.map((item, index) => {
                // Check common variations of headers just in case
                const sku = item['SKU'] || item['sku'] || '';
                const name = item['Nombre'] || item['nombre'] || '';
                const qty = item['Cantidad'] || item['cantidad'] || '1';
                const cost = item['Costo S/I'] || item['costo'] || item['Costo'] || '0';
                const discountCost = item['Costo Desc.'] || item['descuento'] || '';
                const margin = item['Margen'] || item['margen'] || '0.30';

                return {
                    id: `imported-${Date.now()}-${index}`,
                    sku: String(sku).toUpperCase(),
                    name: String(name),
                    quantity: String(qty),
                    costWithoutVat: String(cost),
                    discountedCost: String(discountCost),
                    profitMargin: String(margin),
                    costWithVat: 0,
                    pvp: 0
                };
            }).filter(row => row.sku && row.name); // Basic validation that row has content

            if (newRows.length > 0) {
                // If the first row is empty/default, replace it, otherwise append
                if (rows.length === 1 && !rows[0].sku && !rows[0].name) {
                    setRows(newRows);
                } else {
                    setRows(prev => [...prev, ...newRows]);
                }
                alert(`Se han importado ${newRows.length} productos.`);
            } else {
                alert('No se encontraron datos válidos en el archivo Excel.');
            }
        };
        reader.readAsBinaryString(file);
        // Reset input
        e.target.value = '';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
                            <span className="material-symbols-outlined text-[24px]">dataset</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Entrada de Productos por Lote</h2>
                            <p className="text-sm text-slate-500">Ingresa inventario, costos y genera transacción financiera.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleDownloadTemplate}
                            className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                            title="Descargar plantilla Excel para importar"
                        >
                            <span className="material-symbols-outlined text-[18px]">download</span>
                            Plantilla
                        </button>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileUpload}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                title="Importar desde Excel"
                            />
                            <button className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors">
                                <span className="material-symbols-outlined text-[18px]">upload_file</span>
                                Importar Excel
                            </button>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors ml-2">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>

                {/* Global Configuration */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6 border-b border-slate-200 dark:border-slate-700">
                    <div>
                        <WarehouseSelect
                            value={globalWarehouseId}
                            onChange={setGlobalWarehouseId}
                            label="Almacén de Entrada"
                            required
                        />
                    </div>
                    <div>
                        <BrandSelect
                            value={globalBrandId}
                            onChange={setGlobalBrandId}
                            label="Marca del Lote"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cuenta de Pago / Origen</label>
                        <select
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            value={selectedAccountId || ''}
                            onChange={(e) => setSelectedAccountId(parseInt(e.target.value))}
                        >
                            <option value="">Seleccionar Cuenta...</option>
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>
                                    {acc.code} - {acc.name} ({acc.currency})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">IVA Global (%)</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            value={globalVat}
                            onChange={(e) => setGlobalVat(parseFloat(e.target.value) || 0)}
                        />
                    </div>
                </div>

                {/* Spreadsheet Table */}
                <div className="flex-1 overflow-auto p-0">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">#</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">SKU *</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-48">Nombre *</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Cant.</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32 " title="Costo Unitario Sin IVA">Costo S/I *</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32" title="Opcional: Si hay descuento">Costo Desc.</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Margen</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28 bg-slate-100 dark:bg-slate-800 text-center">Costo + IVA</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28 bg-emerald-50 dark:bg-emerald-900/10 text-center">PVP Tentativo</th>
                                <th className="px-4 py-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {rows.map((row, index) => (
                                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                    <td className="px-4 py-2 text-slate-400 text-xs">{index + 1}</td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="text"
                                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm font-mono uppercase focus:ring-1 focus:ring-primary outline-none"
                                            value={row.sku}
                                            onChange={e => handleRowChange(row.id, 'sku', e.target.value.toUpperCase())}
                                            placeholder="SKU-123"
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="text"
                                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm focus:ring-1 focus:ring-primary outline-none"
                                            value={row.name}
                                            onChange={e => handleRowChange(row.id, 'name', e.target.value)}
                                            placeholder="Nombre Producto"
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="number"
                                            min="1"
                                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm focus:ring-1 focus:ring-primary outline-none text-center"
                                            value={row.quantity}
                                            onChange={e => handleRowChange(row.id, 'quantity', e.target.value)}
                                            placeholder="1"
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm focus:ring-1 focus:ring-primary outline-none"
                                            value={row.costWithoutVat}
                                            onChange={e => handleRowChange(row.id, 'costWithoutVat', e.target.value)}
                                            placeholder="0.00"
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm focus:ring-1 focus:ring-primary outline-none"
                                            value={row.discountedCost}
                                            onChange={e => handleRowChange(row.id, 'discountedCost', e.target.value)}
                                            placeholder="Opcional"
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm focus:ring-1 focus:ring-primary outline-none"
                                            value={row.profitMargin}
                                            onChange={e => handleRowChange(row.id, 'profitMargin', e.target.value)}
                                            placeholder="0.30"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-center font-mono text-sm text-slate-600 bg-slate-50 dark:bg-slate-800/50">
                                        ${row.costWithVat.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-2 text-center font-bold text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10">
                                        ${row.pvp.toFixed(2)}
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                        <button
                                            onClick={() => removeRow(row.id)}
                                            className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-colors"
                                            title="Eliminar fila"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                        <button
                            onClick={addRow}
                            className="flex items-center gap-2 text-primary hover:text-primary/80 font-medium text-sm transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">add_circle</span>
                            Agregar Fila
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex gap-6 text-sm">
                            <div className="flex flex-col">
                                <span className="text-slate-500">Total Costo S/IVA</span>
                                <span className="font-bold text-slate-900 dark:text-white">${totals.totalCostExVat.toFixed(2)}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-slate-500">Total Costo C/IVA</span>
                                <span className="font-bold text-indigo-600">${totals.totalCostIncVat.toFixed(2)}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-slate-500">Total PVP Esperado</span>
                                <span className="font-bold text-emerald-600">${totals.totalPvp.toFixed(2)}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-slate-500">Ganancia Est.</span>
                                <span className="font-bold text-teal-600">${totals.estimatedProfit.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg shadow-sm shadow-primary/30 transition-all font-medium flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                                {loading ? 'Procesando...' : 'Guardar Lote Completo'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
