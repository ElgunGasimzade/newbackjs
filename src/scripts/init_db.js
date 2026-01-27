const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const DealMapper = require('../mappers/DealMapper');

const CSV_PATH = path.join(__dirname, '../../../wolt-scraper/wolt_products.csv');

async function initDB() {
    console.log("Initializing Database...");

    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        // 1. Create Table
        console.log("Creating products table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                store TEXT,
                name TEXT,
                brand TEXT,
                description TEXT,
                original_price FLOAT,
                price FLOAT,
                discount_percent FLOAT,
                details TEXT,
                image_url TEXT,
                in_stock BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Index for faster search
        await client.query(`CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_products_store ON products(store);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_products_discount ON products(discount_percent);`);

        // 2. Load CSV
        console.log("Reading CSV from:", CSV_PATH);
        if (!fs.existsSync(CSV_PATH)) {
            throw new Error(`CSV not found at ${CSV_PATH}`);
        }

        const rawRows = [];
        await new Promise((resolve, reject) => {
            fs.createReadStream(CSV_PATH)
                .pipe(csv())
                .on('data', (data) => rawRows.push(data))
                .on('end', resolve)
                .on('error', reject);
        });

        console.log(`Parsed ${rawRows.length} rows.`);

        // 3. Map & Insert
        // Use DealMapper to clean data first
        // We might want to clear the table first? 
        console.log("Clearing existing data...");
        await client.query('TRUNCATE TABLE products');

        console.log("Inserting data...");
        let count = 0;

        // Prepare statement is faster for bulk
        // But for simplicity let's just loop or batch

        for (const row of rawRows) {
            const product = DealMapper.mapRowToProduct(row);

            // mapRowToProduct returns { id, store, name, brand, ... }
            if (!product.id) continue;

            const query = `
                INSERT INTO products (
                    id, store, name, brand, description, 
                    original_price, price, discount_percent, 
                    details, image_url, in_stock
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (id) DO NOTHING
            `;

            const values = [
                product.id,
                product.store,
                product.name,
                product.brand,
                product.description,
                product.originalPrice,
                product.price,
                product.discountPercent,
                product.details,
                product.imageUrl,
                product.inStock
            ];

            await client.query(query, values);
            count++;
            if (count % 100 === 0) process.stdout.write('.');
        }

        await client.query('COMMIT');
        console.log(`\nSuccessfully imported ${count} products.`);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Failed to init DB:", e);
        process.exit(1);
    } finally {
        client.release();
        // Close pool to allow script to exit
        db.pool.end();
    }
}

initDB();
