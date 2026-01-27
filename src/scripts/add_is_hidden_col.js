const db = require('../config/db');

async function migrate() {
    const client = await db.getClient();
    try {
        console.log("Starting User & Plan Migration...");

        // 1. Users Table
        // Device ID is unique key for Guest Login
        // 4. Add is_hidden column
        await client.query(`
            ALTER TABLE plans
            ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
        `);
        console.log("✅ Added 'is_hidden' column to 'plans'.");

        // 5. Update index to include is_hidden? Or leave as is.
        // We often query WHERE user_id = X and is_hidden = FALSE
        // Simple index on user_id is usually fine for small datasets.

    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
