/**
 * WhatsApp integration utilities.
 * Builds pre-filled wa.me URLs for order-related customer communication.
 */

import { normalizePhoneEC } from './phone';

interface WhatsAppOrderContext {
    customerName: string;
    customerPhone: string;
    orderId: number;
    items: Array<{
        name: string;
        sku: string;
        quantity: number;
        unitPrice: number;
    }>;
    totalAmount: number;
    shippingCost?: number;
}

/**
 * Builds a WhatsApp URL to open a pre-filled message for a confirmed order.
 * Used when an order transitions to Confirmado_Proveedor and a salesperson
 * needs to contact the customer to close the sale.
 * 
 * @param context Order details for the message
 * @returns Full wa.me URL, or null if phone is invalid
 */
export function buildWhatsAppConfirmationURL(context: WhatsAppOrderContext): string | null {
    const phone = normalizePhoneEC(context.customerPhone);
    if (!phone) return null;

    const itemsList = context.items
        .map(item => `• ${item.name} (${item.sku}) x${item.quantity} — $${item.unitPrice.toFixed(2)}`)
        .join('\n');

    const total = context.totalAmount + (context.shippingCost || 0);

    const message = `¡Hola ${context.customerName}! 🛵

Tu pedido *#${context.orderId}* ha sido confirmado por nuestro proveedor.

📦 *Productos:*
${itemsList}

💰 *Total: $${total.toFixed(2)}*${context.shippingCost ? `\n🚚 Envío incluido: $${context.shippingCost.toFixed(2)}` : ''}

¿Procedemos con el envío? Envíanos tu comprobante de pago para continuar. ✅`;

    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${phone}?text=${encodedMessage}`;
}

/**
 * Builds a WhatsApp URL for shipping notification (when order is shipped).
 */
export function buildWhatsAppShippingURL(context: WhatsAppOrderContext & { trackingNumber: string; carrierName?: string }): string | null {
    const phone = normalizePhoneEC(context.customerPhone);
    if (!phone) return null;

    const message = `¡Hola ${context.customerName}! 📦

Tu pedido *#${context.orderId}* ha sido enviado.

🚚 *Courier:* ${context.carrierName || 'Servientrega'}
📋 *Número de rastreo:* ${context.trackingNumber}

Total pagado: *$${context.totalAmount.toFixed(2)}*

¡Te avisaremos cuando llegue! 🎉`;

    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${phone}?text=${encodedMessage}`;
}

interface WhatsAppDemandContext {
    customerPhone: string;
    customerName?: string;
    productSku: string;
    productName: string;
}

/**
 * Builds a WhatsApp URL for product demand notification (when stock arrives).
 */
export function buildWhatsAppDemandURL(context: WhatsAppDemandContext): string | null {
    const phone = normalizePhoneEC(context.customerPhone);
    if (!phone) return null;

    const greeting = context.customerName ? `¡Hola ${context.customerName}!` : `¡Hola!`;
    const message = `${greeting} 👋

Te escribimos para avisarte que el producto que estabas buscando ya se encuentra disponible en stock:

📦 *${context.productName}* (SKU: ${context.productSku})

¿Sigues interesado? Avísanos para ayudarte con tu compra. 🏍️💨`;

    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${phone}?text=${encodedMessage}`;
}

/**
 * Opens a WhatsApp URL in a new tab/window.
 * Falls back gracefully if the URL is invalid.
 */
export function openWhatsApp(url: string | null): void {
    if (!url) {
        alert('No se pudo abrir WhatsApp: número de teléfono inválido o no registrado.');
        return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
}
