/**
 * Shared utility for determining the natural balance direction
 * and effect of debit/credit entries on different account categories.
 *
 * Standard double-entry accounting rules:
 *   Asset / Expense  → "Deudora"  → Debit increases, Credit decreases
 *   Liability / Income / Equity → "Acreedora" → Credit increases, Debit decreases
 */

export type AccountCategory = 'asset' | 'expense' | 'liability' | 'income' | 'equity';

/** Returns true when the account's natural (increasing) side is Debit. */
export function isDebitNatural(category: string | null | undefined): boolean {
    return ['asset', 'expense'].includes(category || '');
}

/**
 * Given an account category and its debit/credit amounts, returns a
 * human-readable effect descriptor (or null when both amounts are 0).
 */
export function getAccountEffect(
    category: string | null | undefined,
    debit: number,
    credit: number,
): { direction: 'increase' | 'decrease'; label: string; icon: string } | null {
    const debitNatural = isDebitNatural(category);

    if (debit > 0) {
        return debitNatural
            ? { direction: 'increase', label: 'Aumenta saldo', icon: '↑' }
            : { direction: 'decrease', label: 'Disminuye saldo', icon: '↓' };
    }
    if (credit > 0) {
        return debitNatural
            ? { direction: 'decrease', label: 'Disminuye saldo', icon: '↓' }
            : { direction: 'increase', label: 'Aumenta saldo', icon: '↑' };
    }
    return null;
}

/**
 * Returns the static labels / arrows for an account category so
 * column headers and badges can be rendered before any amount is entered.
 */
export function getAccountNatureLabel(category: string | null | undefined) {
    const debitNatural = isDebitNatural(category);
    return {
        nature: debitNatural ? 'Deudora' : 'Acreedora',
        debitEffect: debitNatural ? '↑' : '↓',
        creditEffect: debitNatural ? '↓' : '↑',
        debitLabel: debitNatural ? 'Entrada' : 'Salida',
        creditLabel: debitNatural ? 'Salida' : 'Entrada',
    };
}

/**
 * Translates an account category slug into a Spanish display name.
 */
export function categoryDisplayName(category: string | null | undefined): string {
    switch (category) {
        case 'asset':     return 'Activo';
        case 'liability': return 'Pasivo';
        case 'income':    return 'Ingreso';
        case 'expense':   return 'Gasto';
        case 'equity':    return 'Capital';
        default:          return category || '—';
    }
}
