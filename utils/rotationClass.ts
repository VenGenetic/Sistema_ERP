// Single source of truth for Modo Inventario's rotation-class guardrails and
// the accuracy -> next-interval suggestion math. The RPC apply_inventory_group
// (supabase/migrations/20260915140000_inventory_rotation_classes.sql) mirrors
// the min/max bounds in SQL to enforce them server-side no matter what the
// client sends — if these bounds change, that CASE statement must move with
// them, the same way utils/orderStateMachine.ts mirrors its Postgres RPC.

export type RotationClass = 'high' | 'medium' | 'low';

export const ROTATION_CLASSES: RotationClass[] = ['high', 'medium', 'low'];

export const ROTATION_CLASS_BOUNDS: Record<RotationClass, { min: number; max: number; label: string; examples: string }> = {
    high: { min: 7, max: 30, label: 'Alta (A)', examples: 'Aceite, bujías, pastillas de freno, cadenas' },
    medium: { min: 30, max: 90, label: 'Media (B)', examples: 'Baterías, espejos, cables de embrague' },
    low: { min: 90, max: 365, label: 'Baja (C)', examples: 'Bloques de motor, horquillas, herramientas especializadas' },
};

export function clampToClass(days: number, rotationClass: RotationClass): number {
    const { min, max } = ROTATION_CLASS_BOUNDS[rotationClass];
    return Math.min(max, Math.max(min, Math.round(days)));
}

export function midpointOfClass(rotationClass: RotationClass): number {
    const { min, max } = ROTATION_CLASS_BOUNDS[rotationClass];
    return Math.round((min + max) / 2);
}

export interface AccuracyTier {
    tier: 'alta' | 'media' | 'baja';
    multiplier: number;
    headline: string;
    detail: string;
}

export function getAccuracyTier(accuracyPct: number): AccuracyTier {
    if (accuracyPct > 95) {
        return {
            tier: 'alta',
            multiplier: 1.5,
            headline: 'Excelente precisión.',
            detail: 'El sistema sugiere confiar más en el stock y distanciar el próximo conteo para ahorrar tiempo operativo.',
        };
    }
    if (accuracyPct >= 85) {
        return {
            tier: 'media',
            multiplier: 1.0,
            headline: 'Precisión dentro de lo normal.',
            detail: 'Desgaste, extravíos o descuadres menores. El sistema mantiene el intervalo actual.',
        };
    }
    return {
        tier: 'baja',
        multiplier: 0.5,
        headline: 'Precisión baja.',
        detail: 'Posible error de recepción, robo o desorganización. El sistema sugiere acortar el próximo conteo para auditar más pronto.',
    };
}

export function suggestNextInterval(currentIntervalDays: number, accuracyPct: number, rotationClass: RotationClass): number {
    const { multiplier } = getAccuracyTier(accuracyPct);
    return clampToClass(currentIntervalDays * multiplier, rotationClass);
}
