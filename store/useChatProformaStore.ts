import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { precioParaCliente } from '../utils/precioCliente';

/**
 * Proformas en borrador de la Bandeja de WhatsApp, UNA POR CONVERSACIÓN.
 *
 * Por qué no se reusa `useProformaStore`: ese guarda un solo borrador
 * global, atado al flujo del POS (se convierte en carrito y se cobra).
 * Acá el vendedor atiende varios chats a la vez -- arma la cotización de
 * un cliente, lo interrumpe otro, vuelve al primero. Con un solo borrador
 * global le mandaría a un cliente los repuestos del otro, que es el peor
 * error posible en esta pantalla.
 *
 * Se persiste en localStorage porque armar una proforma lleva su tiempo:
 * un F5 o un cambio de página no puede obligar a rehacerla.
 */

export interface ChatProformaItem {
    /** `product-${productId}`: clave estable, permite sumar al re-agregar. */
    id: string;
    productId: number;
    sku: string;
    name: string;
    imageUrl: string | null;
    quantity: number;
    /** Arranca en el precio del catálogo redondeado; editable. */
    unitPrice: number;
}

export interface ChatProforma {
    items: ChatProformaItem[];
    shippingEnabled: boolean;
    shippingCost: number;
    /** Nota al pie de la proforma (garantía, plazo de entrega, etc.). */
    nota: string;
}

interface Producto {
    product_id: number;
    sku: string;
    name: string;
    price: number | null;
    image_url: string | null;
}

const VACIA: ChatProforma = { items: [], shippingEnabled: false, shippingCost: 0, nota: '' };

interface Estado {
    /** conversationId -> borrador. */
    porConversacion: Record<number, ChatProforma>;

    obtener: (conversationId: number) => ChatProforma;
    agregar: (conversationId: number, producto: Producto, cantidad?: number) => void;
    quitar: (conversationId: number, itemId: string) => void;
    cambiarCantidad: (conversationId: number, itemId: string, cantidad: number) => void;
    cambiarPrecio: (conversationId: number, itemId: string, precio: number) => void;
    setEnvio: (conversationId: number, activo: boolean, costo?: number) => void;
    setNota: (conversationId: number, nota: string) => void;
    limpiar: (conversationId: number) => void;
}

/** Modifica el borrador de una conversación sin tocar los de las demás. */
function editar(
    estado: Estado,
    conversationId: number,
    cambio: (p: ChatProforma) => ChatProforma,
): Pick<Estado, 'porConversacion'> {
    const actual = estado.porConversacion[conversationId] ?? VACIA;
    return { porConversacion: { ...estado.porConversacion, [conversationId]: cambio(actual) } };
}

export const useChatProformaStore = create<Estado>()(
    persist(
        (set, get) => ({
            porConversacion: {},

            obtener: (conversationId) => get().porConversacion[conversationId] ?? VACIA,

            agregar: (conversationId, producto, cantidad = 1) =>
                set((s) =>
                    editar(s, conversationId, (p) => {
                        const id = `product-${producto.product_id}`;
                        const existente = p.items.find((i) => i.id === id);
                        if (existente) {
                            return {
                                ...p,
                                items: p.items.map((i) =>
                                    i.id === id ? { ...i, quantity: i.quantity + cantidad } : i,
                                ),
                            };
                        }
                        return {
                            ...p,
                            items: [
                                ...p.items,
                                {
                                    id,
                                    productId: producto.product_id,
                                    sku: producto.sku,
                                    name: producto.name,
                                    imageUrl: producto.image_url,
                                    quantity: cantidad,
                                    // Precio al cliente (ver `utils/precioCliente.ts`):
                                    // la misma cifra conteste quien conteste.
                                    unitPrice: precioParaCliente(producto.price ?? 0),
                                },
                            ],
                        };
                    }),
                ),

            quitar: (conversationId, itemId) =>
                set((s) => editar(s, conversationId, (p) => ({ ...p, items: p.items.filter((i) => i.id !== itemId) }))),

            cambiarCantidad: (conversationId, itemId, cantidad) =>
                set((s) =>
                    editar(s, conversationId, (p) => ({
                        ...p,
                        items: p.items.map((i) => (i.id === itemId ? { ...i, quantity: Math.max(1, cantidad) } : i)),
                    })),
                ),

            cambiarPrecio: (conversationId, itemId, precio) =>
                set((s) =>
                    editar(s, conversationId, (p) => ({
                        ...p,
                        items: p.items.map((i) => (i.id === itemId ? { ...i, unitPrice: Math.max(0, precio) } : i)),
                    })),
                ),

            setEnvio: (conversationId, activo, costo) =>
                set((s) =>
                    editar(s, conversationId, (p) => ({
                        ...p,
                        shippingEnabled: activo,
                        shippingCost: costo === undefined ? p.shippingCost : Math.max(0, costo),
                    })),
                ),

            setNota: (conversationId, nota) => set((s) => editar(s, conversationId, (p) => ({ ...p, nota }))),

            limpiar: (conversationId) =>
                set((s) => {
                    const copia = { ...s.porConversacion };
                    delete copia[conversationId];
                    return { porConversacion: copia };
                }),
        }),
        {
            name: 'chat-proforma-drafts-v1',
            storage: createJSONStorage(() => localStorage),
        },
    ),
);

/** Subtotal de los repuestos, sin envío. */
export function subtotalDe(p: ChatProforma): number {
    return p.items.reduce((suma, i) => suma + i.quantity * i.unitPrice, 0);
}

export function totalDe(p: ChatProforma): number {
    return subtotalDe(p) + (p.shippingEnabled ? p.shippingCost : 0);
}
