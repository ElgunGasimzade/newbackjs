const db = require('../config/db');

async function addIndexes() {
    console.log("Adding missing indexes...");
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Brand is used for grouping
        console.log("Indexing 'brand'...");
        await client.query(`CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);`);

        // Description is potential search target
        console.log("Indexing 'description'...");
        // Using GIN index for text search potentially? Or just simple btree for equality/prefix?
        // Let's stick to standard btree for now as it supports = and LIKE 'prefix%'
        await client.query(`CREATE INDEX IF NOT EXISTS idx_products_description ON products(description);`);

        // Price might be useful for sorting
        console.log("Indexing 'price'...");
        await client.query(`CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);`);

        await client.query('COMMIT');
        console.log("Indexes added successfully.");
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Failed to add indexes:", e);
    } finally {
        client.release();
        db.pool.end();
    }
}

addIndexes();
