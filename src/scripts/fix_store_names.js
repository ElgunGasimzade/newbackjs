const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');

// 1. Extract Valid Store Keys from DealService logic
// We can't require DealService directly easily if it has side effects, but let's try reading the file or just requiring it if safe.
// DealService requires CsvLoader/db which is fine.
// DealService exports an instance
const service = require('../services/DealService');
const validStoreNames = Object.keys(service.STORE_LOCATIONS);

console.log(`Loaded ${validStoreNames.length} valid store locations.`);

// Manual mappings for known stubborn cases
const MANUAL_MAP = {
    "araz-9-mkr-2-superstore-f": "Araz 9 Mkr 2 Superstore F",
    "bravo-winter-park": "Bravo Supermarket Winter Park",
    "bravo-tahir-97": "Bravo Supermarket Tahir 97",
    "bravo-sumgait": "Bravo Supermarket Sumgait",
    "bravo-20-yanvar": "Bravo Hypermarket 20 Yanvar",
    // NEW mappings
    "market11": "Neptun Supermarket Tbilisi Prospekti",
    "Market11": "Neptun Supermarket Tbilisi Prospekti", // Case sensitive fix
    "bravo-hipermarket-hazi-aslanov-3084": "Bravo Supermarket Hazi Aslanov 3084",
    "bravo-supermarket-lighthouse-mall": "Bravo Supermarket Sea Breeze Premium",
    "bravo-supermarket-m-mirqasimov": "Bravo Supermarket M. Mirqasimov",
    "araz-spar-1-3mkr": "Araz Spar 1 3mkr"
};

async function fixStoreNames() {
    const client = await db.getClient();
    try {
        console.log("Fetching distinct store names from DB...");
        const res = await client.query('SELECT DISTINCT store FROM products');
        const dbStores = res.rows.map(r => r.store);

        console.log(`Found ${dbStores.length} distinct stores in DB.`);

        const fuse = new Fuse(validStoreNames, {
            includeScore: true,
            threshold: 0.4
        });

        for (const dbStore of dbStores) {
            let targetStore = null;

            // 1. Check if valid already
            if (validStoreNames.includes(dbStore)) {
                // console.log(`✅ "${dbStore}" is valid.`);
                continue;
            }

            // 2. Manual Map
            if (MANUAL_MAP[dbStore]) {
                targetStore = MANUAL_MAP[dbStore];
            }
            // 3. Heuristic Cleanup & Fuzzy
            else {
                // Basic clean: "araz-sumgait" -> "Araz Sumgait"
                let cleanMarket = dbStore
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, c => c.toUpperCase())
                    .replace(/Hipermarket/gi, 'Hypermarket');

                // Inject "Supermarket" heuristic
                const chains = ["Bravo", "Araz", "Neptun", "Tamstore"];
                for (const chain of chains) {
                    if (cleanMarket.startsWith(chain) && !cleanMarket.includes("Supermarket") && !cleanMarket.includes("Hypermarket") && !cleanMarket.includes("Superstore")) {
                        cleanMarket = cleanMarket.replace(chain, `${chain} Supermarket`);
                    }
                }

                const result = fuse.search(cleanMarket);
                if (result.length > 0 && result[0].score < 0.4) {
                    targetStore = result[0].item;
                } else {
                    // Try raw
                    const resultRaw = fuse.search(dbStore);
                    if (resultRaw.length > 0 && resultRaw[0].score < 0.4) {
                        targetStore = resultRaw[0].item;
                    }
                }
            }

            if (targetStore) {
                console.log(`🔧 Fixing: "${dbStore}" -> "${targetStore}"`);
                await client.query('UPDATE products SET store = $1 WHERE store = $2', [targetStore, dbStore]);
            } else {
                console.warn(`⚠️ Could not match: "${dbStore}"`);
            }
        }

        console.log("Store name standardization complete.");

    } catch (e) {
        console.error("Fix failed:", e);
    } finally {
        client.release();
        db.pool.end();
    }
}

fixStoreNames();
