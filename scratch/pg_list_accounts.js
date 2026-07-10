import pg from 'pg';
const { Client } = pg;

const dbUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function run() {
    const client = new Client({ connectionString: dbUrl });
    try {
        await client.connect();
        console.log("Connected to local PG database.");
        
        const res = await client.query("SELECT * FROM accounts ORDER BY position;");
        console.log("Accounts inside local DB:", res.rows);
    } catch (err) {
        console.error("Connection error:", err.message);
    } finally {
        await client.end();
    }
}

run();
