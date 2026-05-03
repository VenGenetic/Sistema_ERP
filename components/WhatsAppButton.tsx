import React from 'react';
import { MessageCircle } from 'lucide-react';
import { buildWhatsAppConfirmationURL, openWhatsApp } from '../utils/whatsapp';

interface WhatsAppButtonProps {
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
    /** Visual variant: 'full' shows text, 'icon' shows just the icon */
    variant?: 'full' | 'icon';
    /** Optional callback after the WhatsApp window opens */
    onSent?: () => void;
}

/**
 * WhatsApp Button — Opens a pre-filled WhatsApp message for confirmed orders.
 * Used in the "Confirmado_Proveedor" stage of the order lifecycle.
 */
const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({
    customerName,
    customerPhone,
    orderId,
    items,
    totalAmount,
    shippingCost,
    variant = 'full',
    onSent
}) => {
    const handleClick = () => {
        const url = buildWhatsAppConfirmationURL({
            customerName,
            customerPhone,
            orderId,
            items,
            totalAmount,
            shippingCost,
        });

        openWhatsApp(url);
        onSent?.();
    };

    if (variant === 'icon') {
        return (
            <button
                onClick={handleClick}
                title={`Enviar WhatsApp a ${customerName}`}
                className="p-2 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors shadow-sm hover:shadow-md"
            >
                <MessageCircle size={18} />
            </button>
        );
    }

    return (
        <button
            onClick={handleClick}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white font-bold shadow-md hover:shadow-lg transition-all text-sm"
        >
            <MessageCircle size={18} />
            <span>Enviar WhatsApp</span>
        </button>
    );
};

export default WhatsAppButton;
