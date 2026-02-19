import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// Definición de tipos para el estado del formulario de costos
interface CostFormState {
    costoSinIva: number | '';
    costoSinIvaDescontado: number | ''; // Puede ser vacío (null)
    porcentajeIva: number;
}

// Valores calculados automáticamente
interface CalculatedValues {
    porcentajeDescuento: number | null;
    costoConIva: number;
}

export const ProductEntryForm = ({ productId, onSave }: { productId: number, onSave: () => void }) => {
    const [form, setForm] = useState<CostFormState>({
        costoSinIva: '',
        costoSinIvaDescontado: '',
        porcentajeIva: 12 // Default Ecuador/latam, ajustar según país
    });

    const [calculated, setCalculated] = useState<CalculatedValues>({
        porcentajeDescuento: null,
        costoConIva: 0
    });

    const [loading, setLoading] = useState(false);

    // Lógica de Fórmulas en tiempo real
    useEffect(() => {
        const rawCosto = Number(form.costoSinIva);
        const rawDescontado = form.costoSinIvaDescontado !== '' ? Number(form.costoSinIvaDescontado) : null;
        const ivaPct = Number(form.porcentajeIva) / 100;

        let dctoPct = null;
        let baseParaIva = rawCosto;

        // 1. Calcular Porcentaje Descontado
        // Formula: (1 - (CostoDescontado / CostoSinIva)) * 100
        if (rawDescontado !== null && rawCosto > 0) {
            dctoPct = (1 - (rawDescontado / rawCosto)) * 100;
            baseParaIva = rawDescontado; // El IVA se calcula sobre el precio final pagado
        }

        // 2. Calcular Costo Con IVA
        const costoFinal = baseParaIva * (1 + ivaPct);

        setCalculated({
            porcentajeDescuento: dctoPct,
            costoConIva: costoFinal
        });

    }, [form]);

    const handleSubmit = async () => {
        if (!form.costoSinIva) return alert("El costo sin IVA es obligatorio");

        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('process_product_entry_cost', {
                p_product_id: productId,
                p_cost_without_vat: form.costoSinIva,
                p_discounted_cost: form.costoSinIvaDescontado === '' ? null : form.costoSinIvaDescontado,
                p_vat_percentage: form.porcentajeIva,
                p_user_id: (await supabase.auth.getUser()).data.user?.id
            });

            if (error) throw error;

            alert(`Procesado: ${data.message}`);
            onSave(); // Callback para cerrar modal o refrescar tabla
        } catch (err: any) {
            console.error(err);
            alert('Error al guardar costos: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold mb-4 dark:text-white">Ingreso de Precios (Lógica Strikes)</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Costo Sin IVA (Obligatorio) */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Costo Unitario (Sin IVA)</label>
                    <input
                        type="number"
                        value={form.costoSinIva}
                        onChange={e => setForm({ ...form, costoSinIva: parseFloat(e.target.value) || '' })}
                        className="w-full mt-1 p-2 border rounded dark:bg-slate-900 dark:border-slate-700"
                        placeholder="0.00"
                    />
                </div>

                {/* Costo Descontado (Opcional) */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Costo c/ Descuento <span className="text-xs text-slate-500">(Opcional)</span>
                    </label>
                    <input
                        type="number"
                        value={form.costoSinIvaDescontado}
                        onChange={e => setForm({ ...form, costoSinIvaDescontado: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                        className="w-full mt-1 p-2 border rounded dark:bg-slate-900 dark:border-slate-700"
                        placeholder="Dejar vacío si no aplica"
                    />
                </div>

                {/* Porcentaje Descuento (Calculado / ReadOnly) */}
                <div>
                    <label className="block text-sm font-medium text-slate-500">Descuento Aplicado (%)</label>
                    <div className="mt-1 p-2 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300 font-mono">
                        {calculated.porcentajeDescuento !== null
                            ? `${calculated.porcentajeDescuento.toFixed(2)}%`
                            : 'N/A'}
                    </div>
                </div>

                {/* Porcentaje IVA */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">IVA (%)</label>
                    <input
                        type="number"
                        value={form.porcentajeIva}
                        onChange={e => setForm({ ...form, porcentajeIva: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 p-2 border rounded dark:bg-slate-900 dark:border-slate-700"
                    />
                </div>

                {/* Costo Final con IVA (Calculado) */}
                <div className="col-span-full bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                    <label className="block text-sm font-bold text-blue-800 dark:text-blue-300">Costo Final (Con IVA)</label>
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                        ${calculated.costoConIva.toFixed(2)}
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        * Este valor se usará para calcular márgenes de venta.
                    </p>
                </div>
            </div>

            <button
                onClick={handleSubmit}
                disabled={loading || !form.costoSinIva}
                className="w-full mt-6 bg-primary hover:bg-primary/90 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50"
            >
                {loading ? 'Procesando Strikes...' : 'Registrar Entrada y Validar Costo'}
            </button>
        </div>
    );
};
