import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationPath = path.join(__dirname, '../supabase/add_local_stock_trigger.sql');

async function main() {
    console.log("==================================================");
    console.log("🛠️ RUNNING DB MIGRATION: ADVANCED STOCK FILTERS");
    console.log("==================================================");

    if (!fs.existsSync(migrationPath)) {
        console.error(`❌ Migration SQL file not found at ${migrationPath}`);
        process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Default local Supabase connection
    const dbUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

    console.log(`Attempting to apply migration to local database: ${dbUrl}...`);
    
    try {
        const client = new Client({ connectionString: dbUrl, connectionTimeoutMillis: 5000 });
        await client.connect();
        console.log('✅ Connected. Executing SQL...');
        await client.query(sql);
        console.log('🎉 Migration applied successfully on local database!');
        await client.end();
    } catch (err) {
        console.warn(`\n⚠️ Local DB Connection Failed (Error: ${err.message})`);
        console.log("--------------------------------------------------");
        console.log("👉 ACTION REQUIRED FOR REMOTE SUPABASE (PRODUCTION):");
        console.log("Please copy and execute the SQL migration below in your");
        console.log("Supabase Dashboard -> SQL Editor:");
        console.log("--------------------------------------------------");
        console.log(sql);
        console.log("--------------------------------------------------");
    }
}

main().catch(err => {
    console.error("❌ Fatal error:", err);
    process.exit(1);
});
