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

        // 3. Map & Insert (BATCHED)
        console.log("Clearing existing data...");
        await client.query('TRUNCATE TABLE products');

        console.log("Preparing data...");
        const mappedProducts = [];
        for (const row of rawRows) {
            const product = DealMapper.mapRowToProduct(row);
            if (product.id) mappedProducts.push(product);
        }

        console.log(`Inserting ${mappedProducts.length} products in batches...`);

        const BATCH_SIZE = 1000;
        for (let i = 0; i < mappedProducts.length; i += BATCH_SIZE) {
            const batch = mappedProducts.slice(i, i + BATCH_SIZE);
            const values = [];
            const placeholders = [];

            batch.forEach((p, idx) => {
                const offset = idx * 11;
                placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`);
                values.push(
                    p.id, p.store, p.name, p.brand, p.description,
                    p.originalPrice, p.price, p.discountPercent,
                    p.details, p.imageUrl, p.inStock
                );
            });

            const query = `
                INSERT INTO products (
                    id, store, name, brand, description, 
                    original_price, price, discount_percent, 
                    details, image_url, in_stock
                ) VALUES ${placeholders.join(', ')}
                ON CONFLICT (id) DO NOTHING
            `;

            await client.query(query, values);
            process.stdout.write('.');
        }

        await client.query('COMMIT');
        console.log(`\nSuccessfully imported ${mappedProducts.length} products.`);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Failed to init DB:", e);
        process.exit(1);
    } finally {
        client.release();
        db.pool.end();
    }
}

initDB();
