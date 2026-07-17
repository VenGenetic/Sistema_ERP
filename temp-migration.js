import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');

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

        const dbUrl = envVars['DATABASE_URL'];
        if (!dbUrl) {
            console.error("DATABASE_URL not found in .env");
            process.exit(1);
        }

        console.log('Connecting to remote DB');
        const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
        await client.connect();

        const sql = `ALTER TABLE public.product_demands ADD COLUMN IF NOT EXISTS order_flag TEXT DEFAULT NULL;`;
        
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
