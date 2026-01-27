const db = require('./config/db');

async function enableExtension() {
    try {
        const client = await db.getClient();
        await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
        console.log('✅ pg_trgm extension enabled.');
        client.release();
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to enable extension:', err);
        process.exit(1);
    }
}

enableExtension();
