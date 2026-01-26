const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const Fuse = require('fuse.js');

// 1. Load DealService Keys (Hardcoded or extracted)
// Since I can't easily require the class and extract properties in a robust way without initializing it (which might fail),
// I will regex extract them from the file content or reconstruct them.
// Actually, I can just copy the keys I know or read the file.
// Better: I will read DealService.js and regex extract the keys inside STORE_LOCATIONS.

const dealServicePath = path.join(__dirname, 'src/services/DealService.js');
const csvPath = path.join(__dirname, 'uploads/wolt_products.csv');
const outPath = path.join(__dirname, 'uploads/wolt_products_fixed.csv');

function extractStoreKeys(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/this\.STORE_LOCATIONS\s*=\s*{([\s\S]*?)};/);
    if (!match) return [];

    const block = match[1];
    const keys = [];
    const lines = block.split('\n');
    lines.forEach(line => {
        // Only match keys that are followed by object start '{'
        const keyMatch = line.match(/"(.*?)":\s*{/);
        if (keyMatch) {
            keys.push(keyMatch[1]);
        }
    });
    return keys;
}

const validStoreNames = extractStoreKeys(dealServicePath);
console.log(`Loaded ${validStoreNames.length} valid store names.`);
console.log('Sample keys:', validStoreNames.slice(0, 10));
// Check specific key presence
const specificKey = "Araz 9 Mkr 2 Superstore F";
console.log(`Key "${specificKey}" present: ${validStoreNames.includes(specificKey)}`);


// Manual mapping for stubborn slugs
const MANUAL_MAP = {
    "araz-9-mkr-2-superstore-f": "Araz 9 Mkr 2 Superstore F",
    "bravo-winter-park": "Bravo Supermarket Winter Park",
    "bravo-tahir-97": "Bravo Supermarket Tahir 97",
    "bravo-sumgait": "Bravo Supermarket Sumgait",
    "bravo-20-yanvar": "Bravo Hypermarket 20 Yanvar" // Hypermarket nuance
};

// 2. Fuzzy Matcher
const fuse = new Fuse(validStoreNames, {
    includeScore: true,
    threshold: 0.4
});

// 3. Process CSV
const rows = [];
const headers = ["id", "Market", "Product Name", "Price", "Original Price", "Discount", "Image URL", "Local Image Path"];

fs.createReadStream(csvPath)
    .pipe(csv())
    .on('data', (row) => {
        let market = row['Market'];
        const originalMarket = market;

        // 1. Manual Map
        if (MANUAL_MAP[market]) {
            market = MANUAL_MAP[market];
        }
        // 2. Exact Match
        else if (validStoreNames.includes(market)) {
            // Good
        }
        // 3. Heuristic & Fuzzy
        else {
            // Basic cleaning
            let cleanMarket = market
                .replace(/-/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase());

            // Heuristic: Inject "Supermarket" if missing for common chains
            const chains = ["Bravo", "Araz", "Neptun", "Tamstore"];
            for (const chain of chains) {
                if (cleanMarket.startsWith(chain) && !cleanMarket.includes("Supermarket") && !cleanMarket.includes("Hypermarket") && !cleanMarket.includes("Superstore")) {
                    cleanMarket = cleanMarket.replace(chain, `${chain} Supermarket`);
                }
            }

            // Fuzzy Search
            const result = fuse.search(cleanMarket);

            if (result.length > 0 && result[0].score < 0.4) {
                market = result[0].item;
            } else {
                // Fallback: Try unmodified slug search
                const resultSlug = fuse.search(market);
                if (resultSlug.length > 0 && resultSlug[0].score < 0.4) {
                    market = resultSlug[0].item;
                } else {
                    // Debug log for unmatched things
                    // console.warn(`Unmatched: ${market} (Best: ${result.length>0?result[0].item:"None"} ${result.length>0?result[0].score:"-"})`);
                }
            }
        }

        row['Market'] = market;
        rows.push(row);
    })
    .on('end', () => {
        // Write new CSV
        const csvWriter = createCsvWriter({
            path: csvPath, // Overwrite original
            header: headers.map(h => ({ id: h, title: h }))
        });

        // The csv-parser uses keys matching the header strings.
        // csv-writer needs extracted objects map.
        // Actually csv-parser keys are property names.

        csvWriter.writeRecords(rows)
            .then(() => {
                console.log('CSV Normalization Completed.');
            });
    });
