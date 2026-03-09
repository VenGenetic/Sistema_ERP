import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');
const migrationPath = path.join(__dirname, 'supabase/migrations/20260309130000_fix_pos_sale_inventory_logs.sql');

async function main() {
    try {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const envVars = {};
        envContent.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim();
                envVars[key] = value;
            }
        });

        // Use the remote connection string from .env, or fallback to local
        // Typically Supabase remote DB URL is postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
        // We will just read it from the supabase config or require user input if not available.
        // For testing we assume the local or specific dev db is accessible.
        // Actually, since this is a local Supabase, the default connection string is:
        const dbUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

        console.log('Connecting to', dbUrl);
        const client = new Client({ connectionString: dbUrl });
        await client.connect();

        console.log('Reading migration...');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Executing migration...');
        await client.query(sql);

        console.log('Migration successfully applied via direct connection.');
        await client.end();
    } catch (err) {
        console.error('Error applying migration:', err.message);
        process.exit(1);
    }
}

main();
