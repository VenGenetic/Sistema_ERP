/**
 * importerOverride.ts
 * Shared helpers for the "marcado como agotado en importadora" override
 * (products.importer_unavailable_override / importer_unavailable_until).
 * Mirrors the duration semantics of is_discontinued/discontinued_until
 * (utils/discontinuedHelper.ts) since it's the same "permanente vs temporal"
 * UX pattern applied to a different field.
 */
import { supabase } from '../supabaseClient';

export type ImporterUnavailableDuration = 'permanente' | '3' | '6' | '12';

export const computeImporterUnavailableUntil = (duration: ImporterUnavailableDuration): string | null => {
    if (duration === 'permanente') return null;
    const months = parseInt(duration, 10);
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toISOString();
};

export const durationFromUntil = (until: string | null | undefined): ImporterUnavailableDuration => {
    if (!until) return 'permanente';
    const diffMonths = Math.round((new Date(until).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30));
    if (diffMonths <= 4) return '3';
    if (diffMonths <= 7) return '6';
    return '12';
};

// The DB trigger (trg_check_demand_stock_arrival) is what actually reverts
// product_demands from 'stock_available' back to 'pending_stock' when the
// override kicks in. Call this BEFORE saving the override so the count still
// reflects demands about to be reverted, then warn staff after saving.
export const getStockAvailableDemandCount = async (productId: number): Promise<number> => {
    const { count } = await supabase
        .from('product_demands')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId)
        .eq('status', 'stock_available');
    return count || 0;
};

export const warnRevertedDemands = (count: number): void => {
    if (count > 0) {
        alert(`Se revirtieron ${count} solicitud(es) de "Disponible" a "Pendiente" porque el stock de la importadora no es confiable. No prometas disponibilidad a esos clientes todavía.`);
    }
};
