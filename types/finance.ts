import { Database } from './supabase';

type AccountRow = Database['public']['Tables']['accounts']['Row'];
type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type TransactionLineRow = Database['public']['Tables']['transaction_lines']['Row'];

export interface Account extends AccountRow {
    current_balance?: number;
}

export interface Transaction extends TransactionRow {
    transaction_lines?: TransactionLine[];
}

export interface TransactionLine extends TransactionLineRow {
    account?: Account;
}
