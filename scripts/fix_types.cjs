const fs = require('fs');

let content = fs.readFileSync('types/supabase.ts', 'utf8');

// Insert missing tables: api_keys, brands, system_events, product_entries_history
const apiKeysStr = `
            api_keys: {
                Row: { id: string, name: string, key_hash: string, provider: string, is_active: boolean, last_used_at: string | null, created_at: string, updated_at: string }
                Insert: { id?: string, name: string, key_hash: string, provider: string, is_active?: boolean, last_used_at?: string | null, created_at?: string, updated_at?: string }
                Update: { id?: string, name?: string, key_hash?: string, provider?: string, is_active?: boolean, last_used_at?: string | null, created_at?: string, updated_at?: string }
            }`;

const brandsStr = `
            brands: {
                Row: { id: number, name: string, is_active: boolean, created_at: string }
                Insert: { id?: number, name: string, is_active?: boolean, created_at?: string }
                Update: { id?: number, name?: string, is_active?: boolean, created_at?: string }
            }`;

const customSaleItemsStr = `
            custom_sale_items: {
                Row: { id: number, custom_sale_id: number, description: string, quantity: number, unit_price: number, created_at: string }
                Insert: { id?: number, custom_sale_id: number, description: string, quantity: number, unit_price: number, created_at?: string }
                Update: { id?: number, custom_sale_id?: number, description?: string, quantity?: number, unit_price?: number, created_at?: string }
            }`;

const systemEventsStr = `
            system_events: {
                Row: { id: string, event_type: string, payload: Json, status: string, created_at: string, processed_at: string | null }
                Insert: { id?: string, event_type: string, payload: Json, status: string, created_at?: string, processed_at?: string | null }
                Update: { id?: string, event_type?: string, payload?: Json, status?: string, created_at?: string, processed_at?: string | null }
            }`;

const productEntriesHistoryStr = `
            product_entries_history: {
                Row: { id: number, product_id: number, sku: string, cost_without_vat: number, discounted_cost: number, discount_percentage: number, vat_percentage: number, final_cost_with_vat: number, created_at: string, user_id: string }
                Insert: { id?: number, product_id: number, sku: string, cost_without_vat: number, discounted_cost: number, discount_percentage: number, vat_percentage: number, final_cost_with_vat: number, created_at?: string, user_id: string }
                Update: { id?: number, product_id?: number, sku?: string, cost_without_vat?: number, discounted_cost?: number, discount_percentage?: number, vat_percentage?: number, final_cost_with_vat?: number, created_at?: string, user_id?: string }
            }`;

if (!content.includes('api_keys: {')) {
    content = content.replace('Tables: {', 'Tables: {' + apiKeysStr + brandsStr + customSaleItemsStr + systemEventsStr + productEntriesHistoryStr);
}

// Helper to replace Row, Insert, Update for an existing table
function replaceTable(content, tableName, rowProps, insertProps, updateProps) {
    const tableRegex = new RegExp(`${tableName}: \\{[\\s\\S]*?Update: \\{[\\s\\S]*?\\}\\n\\s*\\}`);
    const newReplacement = `${tableName}: {
                Row: {
${rowProps}
                }
                Insert: {
${insertProps}
                }
                Update: {
${updateProps}
                }`;
    return content.replace(tableRegex, newReplacement);
}

// Modify customers
content = replaceTable(content, 'customers',
    `                    id: number
                    identification_number: string | null
                    name: string
                    email: string | null
                    phone: string | null
                    is_final_consumer: boolean
                    customer_type: string | null
                    discount_percentage: number | null
                    claimed_by: string | null
                    claimed_at: string | null
                    created_at: string`,
    `                    id?: number
                    identification_number?: string | null
                    name: string
                    email?: string | null
                    phone?: string | null
                    is_final_consumer?: boolean
                    customer_type?: string | null
                    discount_percentage?: number | null
                    claimed_by?: string | null
                    claimed_at?: string | null
                    created_at?: string`,
    `                    id?: number
                    identification_number?: string | null
                    name?: string
                    email?: string | null
                    phone?: string | null
                    is_final_consumer?: boolean
                    customer_type?: string | null
                    discount_percentage?: number | null
                    claimed_by?: string | null
                    claimed_at?: string | null
                    created_at?: string`
);

// Modify products
content = replaceTable(content, 'products',
    `                    id: number
                    sku: string
                    name: string
                    category: string | null
                    min_stock_threshold: number
                    created_at: string
                    price: number
                    cost_without_vat: number
                    vat_percentage: number
                    strike_price_candidate: number | null
                    strike_count: number
                    profit_margin: number
                    brand_id: number | null`,
    `                    id?: number
                    sku: string
                    name: string
                    category?: string | null
                    min_stock_threshold?: number
                    created_at?: string
                    price?: number
                    cost_without_vat?: number
                    vat_percentage?: number
                    strike_price_candidate?: number | null
                    strike_count?: number
                    profit_margin?: number
                    brand_id?: number | null`,
    `                    id?: number
                    sku?: string
                    name?: string
                    category?: string | null
                    min_stock_threshold?: number
                    created_at?: string
                    price?: number
                    cost_without_vat?: number
                    vat_percentage?: number
                    strike_price_candidate?: number | null
                    strike_count?: number
                    profit_margin?: number
                    brand_id?: number | null`
);

// Modify orders
content = replaceTable(content, 'orders',
    `                    id: number
                    partner_id: number | null
                    warehouse_id: number | null
                    status: string | null
                    total_amount: number
                    created_at: string
                    customer_id: number | null
                    channel: string | null
                    payment_status: string | null
                    created_by: string | null
                    closer_id: string | null
                    promo_code: string | null
                    payment_receipt_url: string | null
                    bank_reference_code: string | null
                    shipping_cost: number | null
                    shipping_address: string | null
                    shipping_notes: string | null
                    payment_account_id: number | null
                    shipping_expense_account_id: number | null`,
    `                    id?: number
                    partner_id?: number | null
                    warehouse_id?: number | null
                    status?: string | null
                    total_amount?: number
                    created_at?: string
                    customer_id?: number | null
                    channel?: string | null
                    payment_status?: string | null
                    created_by?: string | null
                    closer_id?: string | null
                    promo_code?: string | null
                    payment_receipt_url?: string | null
                    bank_reference_code?: string | null
                    shipping_cost?: number | null
                    shipping_address?: string | null
                    shipping_notes?: string | null
                    payment_account_id?: number | null
                    shipping_expense_account_id?: number | null`,
    `                    id?: number
                    partner_id?: number | null
                    warehouse_id?: number | null
                    status?: string | null
                    total_amount?: number
                    created_at?: string
                    customer_id?: number | null
                    channel?: string | null
                    payment_status?: string | null
                    created_by?: string | null
                    closer_id?: string | null
                    promo_code?: string | null
                    payment_receipt_url?: string | null
                    bank_reference_code?: string | null
                    shipping_cost?: number | null
                    shipping_address?: string | null
                    shipping_notes?: string | null
                    payment_account_id?: number | null
                    shipping_expense_account_id?: number | null`
);

// Modify order_items
content = replaceTable(content, 'order_items',
    `                    id: number
                    order_id: number
                    product_id: number
                    quantity: number
                    unit_price: number
                    unit_cost: number | null`,
    `                    id?: number
                    order_id: number
                    product_id: number
                    quantity: number
                    unit_price: number
                    unit_cost?: number | null`,
    `                    id?: number
                    order_id?: number
                    product_id?: number
                    quantity?: number
                    unit_price?: number
                    unit_cost?: number | null`
);

// Modify inventory_logs
content = replaceTable(content, 'inventory_logs',
    `                    id: number
                    product_id: number
                    warehouse_id: number
                    quantity_change: number
                    reason: string | null
                    user_id: string | null
                    created_at: string
                    reference_type: string | null
                    reference_id: string | null`,
    `                    id?: number
                    product_id: number
                    warehouse_id: number
                    quantity_change: number
                    reason?: string | null
                    user_id?: string | null
                    created_at?: string
                    reference_type?: string | null
                    reference_id?: string | null`,
    `                    id?: number
                    product_id?: number
                    warehouse_id?: number
                    quantity_change?: number
                    reason?: string | null
                    user_id?: string | null
                    created_at?: string
                    reference_type?: string | null
                    reference_id?: string | null`
);

// Modify profiles
content = replaceTable(content, 'profiles',
    `                    id: string
                    full_name: string | null
                    email: string | null
                    is_active: boolean
                    role_id: number | null
                    nickname: string | null
                    bio: string | null
                    avatar_url: string | null
                    referral_code: string | null`,
    `                    id: string
                    full_name?: string | null
                    email?: string | null
                    is_active?: boolean
                    role_id?: number | null
                    nickname?: string | null
                    bio?: string | null
                    avatar_url?: string | null
                    referral_code?: string | null`,
    `                    id?: string
                    full_name?: string | null
                    email?: string | null
                    is_active?: boolean
                    role_id?: number | null
                    nickname?: string | null
                    bio?: string | null
                    avatar_url?: string | null
                    referral_code?: string | null`
);

// Modify accounts (add position)
content = replaceTable(content, 'accounts',
    `                    id: number
                    code: string | null
                    name: string
                    category: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | null
                    is_nominal: boolean
                    currency: string
                    position: number | null`,
    `                    id?: number
                    code?: string | null
                    name: string
                    category?: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | null
                    is_nominal?: boolean
                    currency?: string
                    position?: number | null`,
    `                    id?: number
                    code?: string | null
                    name?: string
                    category?: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | null
                    is_nominal?: boolean
                    currency?: string
                    position?: number | null`
);

// Modify lost_demand
content = replaceTable(content, 'lost_demand',
    `                    id: number
search_term: string | null
product_id: number | null
reason: string | null
channel: string | null
created_at: string
user_id: string | null`,
    `                    id ?: number
search_term ?: string | null
product_id ?: number | null
reason ?: string | null
channel ?: string | null
created_at ?: string
user_id ?: string | null`,
    `                    id ?: number
search_term ?: string | null
product_id ?: number | null
reason ?: string | null
channel ?: string | null
created_at ?: string
user_id ?: string | null`
);

fs.writeFileSync('types/supabase.ts', content);
console.log('Successfully injected missing types into supabase.ts based on schema.md');
