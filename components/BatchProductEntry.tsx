import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BrandSelect } from './BrandSelect';
import { WarehouseSelect } from './WarehouseSelect';

interface ProductRow {
    id: string; // Temporary ID for React key
    sku: string;
    name: string;
    category: string;
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

    // Initial row
    const [rows, setRows] = useState<ProductRow[]>([
        { id: '1', sku: '', name: '', category: '', costWithoutVat: '', discountedCost: '', profitMargin: '0.30', costWithVat: 0, pvp: 0 }
    ]);

    // Update calculations when inputs change
    useEffect(() => {
        const newRows = rows.map(row => {
            const cost = parseFloat(row.discountedCost || row.costWithoutVat) || 0;
            const margin = parseFloat(row.profitMargin) || 0;

            const costWithVat = cost * (1 + globalVat / 100);
            const pvp = costWithVat * (1 + margin);

            return { ...row, costWithVat, pvp };
        });

        // Only update if values actually changed to avoid infinite loop
        if (JSON.stringify(newRows) !== JSON.stringify(rows)) {
            setRows(newRows);
        }
    }, [rows, globalVat]);

    const handleRowChange = (id: string, field: keyof ProductRow, value: string) => {
        setRows(prev => prev.map(row => {
            if (row.id === id) {
                // Determine effective cost for calculation updates immediately
                const updatedRow = { ...row, [field]: value };
                const cost = parseFloat(updatedRow.discountedCost || updatedRow.costWithoutVat) || 0;
                const margin = parseFloat(updatedRow.profitMargin) || 0;
                const costWithVat = cost * (1 + globalVat / 100);
                const pvp = costWithVat * (1 + margin);
                return { ...updatedRow, costWithVat, pvp };
            }
            return row;
        }));
    };

    const addRow = () => {
        setRows([...rows, {
            id: Date.now().toString(),
            sku: '',
            name: '',
            category: '',
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
                category: r.category,
                // Use discounted cost if present, logic handled by RPC/Strategy
                // The Logic: "Si Costo S/I Descontado no es igual a null... se debe colocar"
                // logic handled by RPC based on input? Wait, the RPC expects `cost_without_vat` as the EFFECTIVE cost.
                // The prompt said: "Si Distcounted != null -> effective = Discounted * (1+IVA)".
                // Wait, "Costo S/I (sin iva): no puede ser null... Costo S/I Descontado: puede ser null".
                // "Costo con iva... si Discounted != null -> Discounted * (1+VAT)".
                // Basically, the "Effective Cost" we send to 'process_product_entry_cost' should be the Discounted Cost if exists.
                // So here in Frontend, we decide which 'cost' value to send as the key parameter.
                cost_without_vat: r.discountedCost ? parseFloat(r.discountedCost) : parseFloat(r.costWithoutVat),

                // We send profit margin as distinct field
                profit_margin: parseFloat(r.profitMargin) || 0
            }));

            const { data, error } = await supabase.rpc('process_batch_product_entry', {
                p_brand_id: globalBrandId,
                p_warehouse_id: globalWarehouseId,
                p_vat_percentage: globalVat,
                p_products: productsPayload
            });

            if (error) throw error;

            alert(`Lote procesado exitosamente.`);
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error saving batch:', error);
            alert('Error al guardar el lote: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
                            <span className="material-symbols-outlined text-[24px]">dataset</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Entrada de Productos por Lote</h2>
                            <p className="text-sm text-slate-500">Ingresa múltiples productos con la misma marca e IVA.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
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
                    <div className="flex items-end">
                        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg text-sm text-blue-800 dark:text-blue-300 w-full">
                            <span className="font-semibold">Nota:</span> Se aplicará la lógica de "Mejor Margen" y "Three Strikes" automáticamente.
                        </div>
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
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Categoría</th>
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
                                            type="text"
                                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm focus:ring-1 focus:ring-primary outline-none"
                                            value={row.category}
                                            onChange={e => handleRowChange(row.id, 'category', e.target.value)}
                                            placeholder="General"
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
                <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
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
                        {loading ? 'Procesando Lote...' : 'Guardar Lote Completo'}
                    </button>
                </div>
            </div>
        </div>
    );
};
