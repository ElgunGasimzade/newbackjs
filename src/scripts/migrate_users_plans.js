const db = require('../config/db');

async function migrate() {
    const client = await db.getClient();
    try {
        console.log("Starting User & Plan Migration...");

        // 1. Users Table
        // Device ID is unique key for Guest Login
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                device_id TEXT UNIQUE NOT NULL,
                email TEXT,
                phone TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("✅ Created 'users' table.");

        // 2. Plans Table
        // Stores route details as JSONB
        await client.query(`
            CREATE TABLE IF NOT EXISTS plans (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                route_details JSONB,
                status TEXT DEFAULT 'active', -- 'active', 'completed'
                created_at TIMESTAMP DEFAULT NOW(),
                completed_at TIMESTAMP
            );
        `);
        console.log("✅ Created 'plans' table.");

        // 3. Indexes
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);`);
        console.log("✅ Created indexes.");

    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
