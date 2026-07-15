-- Migration: Create Daily Expenses Table
-- Timestamp: 20260715120000

CREATE TABLE IF NOT EXISTS daily_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    category TEXT NOT NULL,
    date DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'America/Guayaquil'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on daily_expenses
ALTER TABLE daily_expenses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow read access to daily_expenses for authenticated" ON daily_expenses;
DROP POLICY IF EXISTS "Allow insert access to daily_expenses for authenticated" ON daily_expenses;
DROP POLICY IF EXISTS "Allow update access to daily_expenses for authenticated" ON daily_expenses;
DROP POLICY IF EXISTS "Allow delete access to daily_expenses for authenticated" ON daily_expenses;

-- Create policies
CREATE POLICY "Allow read access to daily_expenses for authenticated" 
    ON daily_expenses FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert access to daily_expenses for authenticated" 
    ON daily_expenses FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update access to daily_expenses for authenticated" 
    ON daily_expenses FOR UPDATE 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete access to daily_expenses for authenticated" 
    ON daily_expenses FOR DELETE 
    USING (auth.role() = 'authenticated');
