import { create } from 'zustand';

export interface Product {
    id: number;
    sku: string;
    name: string;
    price: number;
    cost_without_vat?: number;
    vat_percentage?: number;
    final_cost_with_vat?: number;
}

export interface InventoryResult {
    product: Product;
    warehouse_id: number;
    warehouse_name: string;
    current_stock: number;
}

export interface Customer {
    id: number;
    identification_number: string;
    name: string;
    email?: string;
    phone?: string;
    is_final_consumer: boolean;
    customer_type?: 'retail' | 'mechanic' | 'trade';
    discount_percentage?: number;
    claimed_by?: string;
}

export interface CartItem {
    id: string; // unique cart row id
    product: Product;
    warehouse_id: number;
    warehouse_name: string;
    quantity: number;
    unitPrice: number;
    unitCost: number;
    subtotal: number;
}

interface CartState {
    cart: CartItem[];
    customer: Customer;
    shippingCost: number;

    // Actions
    setCustomer: (customer: Customer) => void;
    setShippingCost: (cost: number) => void;
    addToCart: (item: InventoryResult) => void;
    updateQuantity: (itemId: string, quantity: number) => void;
    removeFromCart: (itemId: string) => void;
    clearCart: () => void;

    // Computed Properties
    getSubtotal: () => number;
    getTotal: () => number;
}

export const defaultConsumidorFinal: Customer = {
    id: 1,
    identification_number: '9999999999',
    name: 'CONSUMIDOR FINAL',
    is_final_consumer: true
};

export const useCartStore = create<CartState>((set, get) => ({
    cart: [],
    customer: defaultConsumidorFinal,
    shippingCost: 0,

    setCustomer: (customer) => set({ customer }),

    setShippingCost: (cost) => set({ shippingCost: cost }),

    addToCart: (item: InventoryResult) => {
        const newItemId = crypto.randomUUID();
        const unitCost = item.product.final_cost_with_vat || item.product.cost_without_vat || 0;

        const cartItem: CartItem = {
            id: newItemId,
            product: item.product,
            warehouse_id: item.warehouse_id,
            warehouse_name: item.warehouse_name,
            quantity: 1,
            unitPrice: item.product.price,
            unitCost: unitCost,
            subtotal: item.product.price,
        };

        set((state) => ({ cart: [...state.cart, cartItem] }));
    },

    updateQuantity: (itemId: string, newQuantity: number) => {
        if (newQuantity < 0) return;

        set((state) => ({
            cart: state.cart.map((item) => {
                if (item.id === itemId) {
                    return {
                        ...item,
                        quantity: newQuantity,
                        subtotal: newQuantity * item.unitPrice
                    };
                }
                return item;
            })
        }));
    },

    removeFromCart: (itemId: string) => {
        set((state) => ({
            cart: state.cart.filter((item) => item.id !== itemId)
        }));
    },

    clearCart: () => {
        set({ cart: [], customer: defaultConsumidorFinal, shippingCost: 0 });
    },

    getSubtotal: () => {
        return get().cart.reduce((total, item) => total + item.subtotal, 0);
    },

    getTotal: () => {
        const discountMultiplier = 1 - ((get().customer.discount_percentage || 0) / 100);
        return (get().getSubtotal() * discountMultiplier) + get().shippingCost;
    }
}));
