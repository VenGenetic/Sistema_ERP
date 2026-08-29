import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { precioParaCliente } from '../utils/precioCliente';

export interface ProformaItem {
    id: string; // `product-${productId}` — stable key, enables merge-on-re-add
    productId: number;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number; // defaults to product.price, user-editable
}

interface ProformaProduct {
    id: number;
    sku: string;
    name: string;
    price: number;
}

interface ProformaState {
    items: ProformaItem[];
    shippingEnabled: boolean;
    shippingCost: number;

    addItem: (product: ProformaProduct, quantity?: number) => void;
    removeItem: (id: string) => void;
    updateQuantity: (id: string, quantity: number) => void;
    updateUnitPrice: (id: string, unitPrice: number) => void;
    setShippingEnabled: (enabled: boolean) => void;
    setShippingCost: (cost: number) => void;
    clear: () => void;

    getItemsTotal: () => number;
    getTotal: () => number;
}

// Persisted so an accidental navigation away (or refresh) doesn't force the
// user to rebuild the proforma they were already assembling.
export const useProformaStore = create<ProformaState>()(
    persist(
        (set, get) => ({
            items: [],
            shippingEnabled: false,
            shippingCost: 0,

            addItem: (product, quantity = 1) => set((state) => {
                const id = `product-${product.id}`;
                const existing = state.items.find(i => i.id === id);
                if (existing) {
                    return {
                        items: state.items.map(i => i.id === id ? { ...i, quantity: i.quantity + quantity } : i),
                    };
                }
                return {
                    items: [...state.items, {
                        id,
                        productId: product.id,
                        sku: product.sku,
                        name: product.name,
                        quantity,
                        // Precio al cliente (ver `utils/precioCliente.ts`); editable
                        // después con updateUnitPrice.
                        unitPrice: precioParaCliente(product.price),
                    }],
                };
            }),

            removeItem: (id) => set((state) => ({
                items: state.items.filter(i => i.id !== id),
            })),

            updateQuantity: (id, quantity) => set((state) => ({
                items: state.items.map(i => i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i),
            })),

            updateUnitPrice: (id, unitPrice) => set((state) => ({
                items: state.items.map(i => i.id === id ? { ...i, unitPrice: Math.max(0, unitPrice) } : i),
            })),

            setShippingEnabled: (enabled) => set({ shippingEnabled: enabled }),
            setShippingCost: (cost) => set({ shippingCost: Math.max(0, cost) }),

            clear: () => set({ items: [], shippingEnabled: false, shippingCost: 0 }),

            getItemsTotal: () => get().items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
            getTotal: () => {
                const state = get();
                return state.getItemsTotal() + (state.shippingEnabled ? state.shippingCost : 0);
            },
        }),
        {
            name: 'proforma-draft-v1',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
