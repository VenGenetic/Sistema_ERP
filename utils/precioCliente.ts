/**
 * El precio que se le dice al cliente.
 *
 * Una sola regla, en un solo archivo, porque la misma cifra aparece en sitios
 * que no se hablan entre sí: la ficha que se manda por WhatsApp, la proforma
 * del chat, la proforma del POS, el aviso de llegada y la tarjeta de demanda.
 * Cuando cada uno hacía su propio `Math.ceil` bastaba con tocar uno para que
 * el mismo repuesto tuviera dos precios distintos según por dónde se cotizara.
 *
 * La regla la comparte el bot (`agente/src/utils/pricing.ts`): si cambia allá,
 * cambia acá — si no, el cliente escucha un precio del bot y otro del vendedor.
 */

/**
 * Redondea hacia ARRIBA al dólar entero: 12.12 y 12.56 salen ambos $13.
 * Sin centavos no hay discusión por centavos.
 */
export function precioParaCliente(price: number): number {
    return Math.ceil(price);
}

/** `$12.00` — formato de precio para el cliente. */
export function formatearPrecio(valor: number): string {
    return `$${valor.toFixed(2)}`;
}
