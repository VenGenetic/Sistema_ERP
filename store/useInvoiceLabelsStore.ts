import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface InvoiceLabelRow {
    key: string;
    sku: string;
    description: string;
    quantity: number;
    unitPrice?: number;
    amount?: number;
    included: boolean;
    productId: number | null; // matched product id in catálogo, if any
    labelName: string;        // editable name printed on the label
    imageUrl?: string;
    existingMargin?: number;  // product's current profit_margin, if already in catálogo
    addedToInventory: boolean;
}

interface InvoiceLabelsState {
    fileName: string | null;
    invoiceNumber: string | null;
    rows: InvoiceLabelRow[];

    setInvoice: (fileName: string, invoiceNumber: string | null, rows: InvoiceLabelRow[]) => void;
    updateRow: (key: string, patch: Partial<InvoiceLabelRow>) => void;
    markAddedToInventory: (keys: string[]) => void;
    reset: () => void;
}

// Persisted so an accidental navigation away (or refresh) doesn't force the
// user to re-upload and re-check the invoice they were already working on.
export const useInvoiceLabelsStore = create<InvoiceLabelsState>()(
    persist(
        (set) => ({
            fileName: null,
            invoiceNumber: null,
            rows: [],

            setInvoice: (fileName, invoiceNumber, rows) => set({ fileName, invoiceNumber, rows }),

            updateRow: (key, patch) => set((state) => ({
                rows: state.rows.map(r => (r.key === key ? { ...r, ...patch } : r)),
            })),

            markAddedToInventory: (keys) => set((state) => ({
                rows: state.rows.map(r => (keys.includes(r.key) ? { ...r, addedToInventory: true } : r)),
            })),

            reset: () => set({ fileName: null, invoiceNumber: null, rows: [] }),
        }),
        {
            name: 'invoice-labels-draft-v1',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
