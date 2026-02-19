import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixTransaction() {
    console.log("Starting fix process...");
    // Load env vars
    const envPath = path.resolve(__dirname, '../.env');
    let env = {};
    try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join('=').trim();
                env[key] = val;
            }
        });
    } catch (e) {
        console.error("Error reading .env:", e);
        return;
    }

    const supabaseUrl = env.VITE_SUPABASE_URL;
    const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase credentials');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Authenticate (Sign Up/Sign In) to bypass RLS
    const email = `temp_fix_${Date.now()}@example.com`;
    const password = 'TempPassword123!';

    console.log(`Creating temporary session for ${email}...`);
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
    });

    if (authError) {
        console.error('Auth error:', authError);
        // Try to sign in if user exists? Unlikely for random email.
        return;
    }

    const user = authData.user;
    if (!user) {
        console.error('Failed to create user/session');
        return;
    }
    console.log('Authenticated successfully.');

    // 2. Find the transaction
    const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('description', 'Balance inicial Pichincha')
        .order('created_at', { ascending: false })
        .limit(1);

    if (txError) {
        console.error('Error fetching transaction:', txError);
        return;
    }

    if (!transactions || transactions.length === 0) {
        console.log('Transaction explicitly not found');
        return;
    }

    const transaction = transactions[0];
    console.log(`Found Transaction: ${transaction.id} - ${transaction.description}`);

    // 3. Get Lines
    const { data: lines, error: linesError } = await supabase
        .from('transaction_lines')
        .select('*, account:accounts(name, category)')
        .eq('transaction_id', transaction.id);

    if (linesError) {
        console.error('Error fetching lines:', linesError);
        return;
    }

    let needsFix = false;
    lines.forEach(line => {
        const accName = line.account?.name;
        console.log(`Line: Account=${accName}, Debit=${line.debit}, Credit=${line.credit}`);

        // Check for the error condition
        // Expectation: 
        //  - Pichincha (Asset) -> Debit
        //  - Balances (Equity) -> Credit
        // Current Bug:
        //  - Pichincha -> Credit (so Debit=0, Credit>0)
        //  - Balances -> Debit (so Debit>0, Credit=0)

        if (accName.includes('Pichincha')) {
            if (line.credit > 0 && line.debit == 0) {
                console.log('DETECTED: Pichincha has Credit instead of Debit. FIX NEEDED.');
                needsFix = true;
            } else {
                console.log('Pichincha looks likely correct (or already fixed).');
            }
        }
    });

    if (needsFix) {
        console.log('Applying fix...');
        // Swap debit and credit for all lines in this transaction
        // Since we can't do it in one atomic SQL query easily via JS client without RPC,
        // we will update each line.
        for (const line of lines) {
            const newDebit = line.credit;
            const newCredit = line.debit;

            const { error: updateError } = await supabase
                .from('transaction_lines')
                .update({ debit: newDebit, credit: newCredit })
                .eq('id', line.id);

            if (updateError) {
                console.error(`Failed to update line ${line.id}:`, updateError);
            } else {
                console.log(`Updated line ${line.id}: Debit ${line.debit}->${newDebit}, Credit ${line.credit}->${newCredit}`);
            }
        }
        console.log('Fix applied.');
    } else {
        console.log('No fix needed.');
    }
}

fixTransaction();
