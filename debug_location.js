const DealService = require('./src/services/DealService');
const db = require('./src/config/db');

async function debugLocation() {
    try {
        console.log("Starting Debug...");

        // 1. Fetch 5 random stores from DB
        const res = await db.query('SELECT DISTINCT store FROM products LIMIT 5');
        const dbStores = res.rows.map(r => r.store);

        console.log("Sample Stores in DB:", dbStores);

        const service = DealService;
        const validKeys = Object.keys(service.STORE_LOCATIONS);

        // 2. Check Match Status
        dbStores.forEach(store => {
            const hasKey = validKeys.includes(store);
            console.log(`Store "${store}" in keys? ${hasKey ? 'YES ✅' : 'NO ❌'}`);
            if (!hasKey) {
                // Try fuzzy find
                const found = validKeys.find(k => k.toLowerCase() === store.toLowerCase());
                if (found) console.log(`   (Case mismatch! Found: "${found}")`);
            }
        });

        // 3. Simulate Request for a KNOWN valid store
        // Let's pick 'Araz Supermarket Sumgait 9 Microdistrict' if it exists in DB, or use one from sample.

        const testStoreName = "Neptun Supermarket Tbilisi Prospekti";
        const testLoc = service.STORE_LOCATIONS[testStoreName];

        if (!testLoc) {
            console.error(`Cannot test: '${testStoreName}' key missing in DealService!`);
        } else {
            console.log(`\nTesting Location Filter near: ${testStoreName} (${testLoc.lat}, ${testLoc.lon})`);

            // Fetch deals with tight range (1km)
            const deals = await service.getDeals({
                lat: testLoc.lat,
                lon: testLoc.lon,
                range: 1.0,
                limit: 10
            });

            console.log(`Found ${deals.length} deals nearby.`);
            deals.forEach(d => {
                console.log(`- ${d.store}: ${d.name}`);
            });

            if (deals.length === 0) {
                console.log("❌ No deals found! Check if products exist for this store in DB.");
                // Check count in DB
                const countRes = await db.query('SELECT count(*) FROM products WHERE store = $1', [testStoreName]);
                console.log(`DB Count for '${testStoreName}': ${countRes.rows[0].count}`);
            }
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debugLocation();
