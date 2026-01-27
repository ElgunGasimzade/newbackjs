const db = require('../config/db');

async function run() {
    try {
        const client = await db.getClient();
        console.log("Checking if username column exists...");

        // Add username column if not exists
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS username VARCHAR(255);
        `);

        console.log("Successfully ensured 'username' column exists.");
        client.release();
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
}

run();
