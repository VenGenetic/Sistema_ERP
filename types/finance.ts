
export interface Account {
    id: number;
    code: string;
    name: string;
    category: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
    is_nominal: boolean;
    currency: string;
    created_at?: string;
    updated_at?: string;
}

export interface Transaction {
    id: number;
    order_id?: number;
    reference_type: string;
    description: string;
    created_at: string;
    transaction_lines?: TransactionLine[];
}

export interface TransactionLine {
    id: number;
    transaction_id: number;
    account_id: number;
    debit: number;
    credit: number;
    account?: Account;
}
