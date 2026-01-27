const db = require('./src/config/db');

async function checkExtensions() {
    try {
        const client = await db.getClient();
        console.log("Connected to DB.");

        // 1. List installed
        const res = await client.query('SELECT * FROM pg_extension');
        console.log("Installed Extensions:", res.rows.map(r => r.extname));

        // 2. Try Enable pg_trgm
        try {
            console.log("Attempting to enable pg_trgm...");
            await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
            console.log("✅ pg_trgm enabled successfully!");
        } catch (e) {
            console.error("❌ pg_trgm failed:", e.message);
        }

        // 3. Try Enable fuzzystrmatch
        try {
            console.log("Attempting to enable fuzzystrmatch...");
            await client.query('CREATE EXTENSION IF NOT EXISTS fuzzystrmatch');
            console.log("✅ fuzzystrmatch enabled successfully!");
        } catch (e) {
            console.error("❌ fuzzystrmatch failed:", e.message);
        }

        client.release();
        db.pool.end();
    } catch (e) {
        console.error("Connection failed:", e);
    }
}

checkExtensions();
