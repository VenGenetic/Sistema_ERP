/**
 * Order Status State Machine — Single source of truth for the order lifecycle.
 * Mirrors the guarded transitions in the update_order_status RPC.
 */

export type OrderStatus =
    | 'Borrador'
    | 'Sourcing_Pendiente'
    | 'Confirmado_Proveedor'
    | 'Pendiente_Pago'
    | 'Listo_Cumplimiento'
    | 'Alerta_Margen'
    | 'En_Transito'
    | 'Entregado'
    | 'RMA_Pendiente'
    | 'Cancelado'
    | 'Reembolsado';

/**
 * Human-readable labels for each status (Spanish).
 */
export const STATUS_LABELS: Record<OrderStatus, string> = {
    Borrador: 'Borrador / Cotización',
    Sourcing_Pendiente: 'Pendiente Proveedor',
    Confirmado_Proveedor: 'Confirmado (WhatsApp)',
    Pendiente_Pago: 'Verificación de Pago',
    Listo_Cumplimiento: 'Listo para Despacho',
    Alerta_Margen: 'Alerta de Margen',
    En_Transito: 'En Tránsito',
    Entregado: 'Entregado',
    RMA_Pendiente: 'RMA Pendiente',
    Cancelado: 'Cancelado',
    Reembolsado: 'Reembolsado',
};

/**
 * Status badge colors for UI rendering.
 */
export const STATUS_COLORS: Record<OrderStatus, { bg: string; text: string; border: string }> = {
    Borrador:              { bg: 'bg-slate-100 dark:bg-slate-800',     text: 'text-slate-600 dark:text-slate-300',    border: 'border-slate-300 dark:border-slate-700' },
    Sourcing_Pendiente:    { bg: 'bg-orange-50 dark:bg-orange-900/10', text: 'text-orange-700 dark:text-orange-400',   border: 'border-orange-300 dark:border-orange-800' },
    Confirmado_Proveedor:  { bg: 'bg-green-50 dark:bg-green-900/10',   text: 'text-green-700 dark:text-green-400',     border: 'border-green-300 dark:border-green-800' },
    Pendiente_Pago:        { bg: 'bg-yellow-50 dark:bg-yellow-900/10', text: 'text-yellow-700 dark:text-yellow-400',   border: 'border-yellow-300 dark:border-yellow-800' },
    Listo_Cumplimiento:    { bg: 'bg-purple-50 dark:bg-purple-900/10', text: 'text-purple-700 dark:text-purple-400',   border: 'border-purple-300 dark:border-purple-800' },
    Alerta_Margen:         { bg: 'bg-red-50 dark:bg-red-900/10',      text: 'text-red-700 dark:text-red-400',         border: 'border-red-300 dark:border-red-800' },
    En_Transito:           { bg: 'bg-blue-50 dark:bg-blue-900/10',     text: 'text-blue-700 dark:text-blue-400',       border: 'border-blue-300 dark:border-blue-800' },
    Entregado:             { bg: 'bg-emerald-50 dark:bg-emerald-900/10', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-300 dark:border-emerald-800' },
    RMA_Pendiente:         { bg: 'bg-rose-50 dark:bg-rose-900/10',     text: 'text-rose-700 dark:text-rose-400',       border: 'border-rose-300 dark:border-rose-800' },
    Cancelado:             { bg: 'bg-gray-100 dark:bg-gray-900/10',    text: 'text-gray-500 dark:text-gray-500',       border: 'border-gray-300 dark:border-gray-700' },
    Reembolsado:           { bg: 'bg-gray-100 dark:bg-gray-900/10',    text: 'text-gray-500 dark:text-gray-500',       border: 'border-gray-300 dark:border-gray-700' },
};

export const VALID_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
    Borrador:              ['Listo_Cumplimiento', 'Entregado', 'Cancelado'],
    Listo_Cumplimiento:    ['Entregado', 'Borrador', 'Cancelado'],
    Entregado:             ['RMA_Pendiente', 'Reembolsado'],
};

/**
 * Checks if a transition from one status to another is allowed.
 */
export function isTransitionAllowed(from: OrderStatus, to: OrderStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Returns the list of allowed next statuses for a given current status.
 */
export function getNextStatuses(current: OrderStatus): OrderStatus[] {
    return VALID_TRANSITIONS[current] || [];
}

/**
 * Which role_id is responsible for acting on orders in a given status.
 */
export const STATUS_RESPONSIBLE_ROLE: Partial<Record<OrderStatus, number[]>> = {
    Borrador:              [1, 2],       // Admin or Closer
    Listo_Cumplimiento:    [1, 4],       // Admin or Warehouse
    Entregado:             [1, 2, 5],    // Admin, Closer, or Sales Monitor
};

/**
 * Returns the statuses that a given role_id is responsible for managing.
 */
export function getStatusesForRole(roleId: number): OrderStatus[] {
    return (Object.entries(STATUS_RESPONSIBLE_ROLE) as [OrderStatus, number[]][])
        .filter(([, roles]) => roles.includes(roleId))
        .map(([status]) => status);
}
