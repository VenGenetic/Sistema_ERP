export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            roles: {
                Row: {
                    id: number
                    name: string
                    permissions: Json
                }
                Insert: {
                    id?: number
                    name: string
                    permissions?: Json
                }
                Update: {
                    id?: number
                    name?: string
                    permissions?: Json
                }
            }
            profiles: {
                Row: {
                    id: string
                    full_name: string | null
                    email: string | null
                    is_active: boolean
                    role_id: number | null
                }
                Insert: {
                    id: string
                    full_name?: string | null
                    email?: string | null
                    is_active?: boolean
                    role_id?: number | null
                }
                Update: {
                    id?: string
                    full_name?: string | null
                    email?: string | null
                    is_active?: boolean
                    role_id?: number | null
                }
            }
            partners: {
                Row: {
                    id: number
                    name: string
                    type: 'supplier' | 'reseller' | null
                    status: string | null
                }
                Insert: {
                    id?: number
                    name: string
                    type?: 'supplier' | 'reseller' | null
                    status?: string | null
                }
                Update: {
                    id?: number
                    name?: string
                    type?: 'supplier' | 'reseller' | null
                    status?: string | null
                }
            }
            warehouses: {
                Row: {
                    id: number
                    name: string
                    type: 'physical' | 'digital_partner' | null
                    location: string | null
                    partner_id: number | null
                    is_active: boolean
                }
                Insert: {
                    id?: number
                    name: string
                    type?: 'physical' | 'digital_partner' | null
                    location?: string | null
                    partner_id?: number | null
                    is_active?: boolean
                }
                Update: {
                    id?: number
                    name?: string
                    type?: 'physical' | 'digital_partner' | null
                    location?: string | null
                    partner_id?: number | null
                    is_active?: boolean
                }
            }
            products: {
                Row: {
                    id: number
                    sku: string
                    name: string
                    category: string | null
                    min_stock_threshold: number
                    created_at: string
                    price: number
                    cost_without_vat: number
                    vat_percentage: number
                    profit_margin: number
                    brand_id: number | null
                }
                Insert: {
                    id?: number
                    sku: string
                    name: string
                    category?: string | null
                    min_stock_threshold?: number
                    created_at?: string
                    price?: number
                    cost_without_vat?: number
                    vat_percentage?: number
                    profit_margin?: number
                    brand_id?: number | null
                }
                Update: {
                    id?: number
                    sku?: string
                    name?: string
                    category?: string | null
                    min_stock_threshold?: number
                    created_at?: string
                    price?: number
                    cost_without_vat?: number
                    vat_percentage?: number
                    profit_margin?: number
                    brand_id?: number | null
                }
            }
            inventory_levels: {
                Row: {
                    id: number
                    product_id: number
                    warehouse_id: number
                    current_stock: number
                    last_updated: string
                }
                Insert: {
                    id?: number
                    product_id: number
                    warehouse_id: number
                    current_stock?: number
                    last_updated?: string
                }
                Update: {
                    id?: number
                    product_id?: number
                    warehouse_id?: number
                    current_stock?: number
                    last_updated?: string
                }
            }
            inventory_logs: {
                Row: {
                    id: number
                    product_id: number
                    warehouse_id: number
                    quantity_change: number
                    reason: string | null
                    user_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: number
                    product_id: number
                    warehouse_id: number
                    quantity_change: number
                    reason?: string | null
                    user_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: number
                    product_id?: number
                    warehouse_id?: number
                    quantity_change?: number
                    reason?: string | null
                    user_id?: string | null
                    created_at?: string
                }
            }
            orders: {
                Row: {
                    id: number
                    partner_id: number | null
                    warehouse_id: number | null
                    status: string | null
                    total_amount: number
                    created_at: string
                }
                Insert: {
                    id?: number
                    partner_id?: number | null
                    warehouse_id?: number | null
                    status?: string | null
                    total_amount?: number
                    created_at?: string
                }
                Update: {
                    id?: number
                    partner_id?: number | null
                    warehouse_id?: number | null
                    status?: string | null
                    total_amount?: number
                    created_at?: string
                }
            }
            order_items: {
                Row: {
                    id: number
                    order_id: number
                    product_id: number
                    quantity: number
                    unit_price: number
                }
                Insert: {
                    id?: number
                    order_id: number
                    product_id: number
                    quantity: number
                    unit_price: number
                }
                Update: {
                    id?: number
                    order_id?: number
                    product_id?: number
                    quantity?: number
                    unit_price?: number
                }
            }
            accounts: {
                Row: {
                    id: number
                    code: string | null
                    name: string
                    category: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | null
                    is_nominal: boolean
                    currency: string
                }
                Insert: {
                    id?: number
                    code?: string | null
                    name: string
                    category?: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | null
                    is_nominal?: boolean
                    currency?: string
                }
                Update: {
                    id?: number
                    code?: string | null
                    name?: string
                    category?: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | null
                    is_nominal?: boolean
                    currency?: string
                }
            }
            transactions: {
                Row: {
                    id: number
                    order_id: number | null
                    reference_type: string | null
                    description: string | null
                    created_at: string
                }
                Insert: {
                    id?: number
                    order_id?: number | null
                    reference_type?: string | null
                    description?: string | null
                    created_at?: string
                }
                Update: {
                    id?: number
                    order_id?: number | null
                    reference_type?: string | null
                    description?: string | null
                    created_at?: string
                }
            }
            transaction_lines: {
                Row: {
                    id: number
                    transaction_id: number
                    account_id: number
                    debit: number
                    credit: number
                }
                Insert: {
                    id?: number
                    transaction_id: number
                    account_id: number
                    debit?: number
                    credit?: number
                }
                Update: {
                    id?: number
                    transaction_id?: number
                    account_id?: number
                    debit?: number
                    credit?: number
                }
            }
            customers: {
                Row: {
                    id: number
                    name: string
                    email: string | null
                    phone: string | null
                    document_id: string | null
                    address: string | null
                    created_at: string
                }
                Insert: {
                    id?: number
                    name: string
                    email?: string | null
                    phone?: string | null
                    document_id?: string | null
                    address?: string | null
                    created_at?: string
                }
                Update: {
                    id?: number
                    name?: string
                    email?: string | null
                    phone?: string | null
                    document_id?: string | null
                    address?: string | null
                    created_at?: string
                }
            }
            lost_demand: {
                Row: {
                    id: number
                    search_query: string | null
                    product_requested: string
                    customer_name: string | null
                    customer_contact: string | null
                    notes: string | null
                    created_at: string
                    user_id: string | null
                }
                Insert: {
                    id?: number
                    search_query?: string | null
                    product_requested: string
                    customer_name?: string | null
                    customer_contact?: string | null
                    notes?: string | null
                    created_at?: string
                    user_id?: string | null
                }
                Update: {
                    id?: number
                    search_query?: string | null
                    product_requested?: string
                    customer_name?: string | null
                    customer_contact?: string | null
                    notes?: string | null
                    created_at?: string
                    user_id?: string | null
                }
            }
            product_compatibilities: {
                Row: {
                    id: number
                    product_id: number
                    make: string
                    model: string
                    year_from: number
                    year_to: number
                    created_at: string
                }
                Insert: {
                    id?: number
                    product_id: number
                    make: string
                    model: string
                    year_from: number
                    year_to: number
                    created_at?: string
                }
                Update: {
                    id?: number
                    product_id?: number
                    make?: string
                    model?: string
                    year_from?: number
                    year_to?: number
                    created_at?: string
                }
            }
        }
    }
}
