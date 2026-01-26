const CsvLoaderService = require('./CsvLoaderService');
const DealMapper = require('../mappers/DealMapper');
const Fuse = require('fuse.js');

class DealService {
    constructor() {
        // Updated to use the new Wolt scraper dataset
        const path = require('path');
        const finalCsvPath = path.join(__dirname, '../../uploads/wolt_products.csv');
        this.csvLoader = new CsvLoaderService(finalCsvPath);

        // Store Locations Map (Updated with real addresses and matching CSV names)
        this.STORE_LOCATIONS = {
            "Araz Supermarket Sumgait 9 Microdistrict": {
                "lat": 40.57076982005887,
                "lon": 49.68842682653826
            },
            "Bravo Supermarket Sumqait Bagcagli": {
                "lat": 40.57486849,
                "lon": 49.64321845
            },
            "Tamstore Sumqayit": {
                "lat": 40.5903875,
                "lon": 49.6757031
            },
            "Araz Novxani Superstore F": {
                "lat": 40.53680402,
                "lon": 49.78270639
            },
            "Bravo Supermarket Sumgait": {
                "lat": 40.57345034,
                "lon": 49.69113244
            },
            "Araz Supermarket Xirdalan": {
                "lat": 40.45565671,
                "lon": 49.74156477
            },
            "Araz Supermarket Masazr 3": {
                "lat": 40.45640868,
                "lon": 49.75773751
            },
            "Bravo Supermarket Khirdalan": {
                "lat": 40.45051581,
                "lon": 49.74488118
            },
            "Neptun Supermarket Khirdalan": {
                "lat": 40.45964974,
                "lon": 49.71981398
            },
            "Neptun Supermarket Xirdalan": {
                "lat": 40.4478363,
                "lon": 49.77720126
            },
            "Oba Market Nerimanov 1": {
                "lat": 40.40429628,
                "lon": 49.86669603
            },
            "Bazar Online Buzovna": {
                "lat": 40.38548717647018,
                "lon": 49.852944708654235
            },
            "Araz Torgovayaa 3": {
                "lat": 40.3728375,
                "lon": 49.8430156
            },
            "Araz Supermarket 28 May": {
                "lat": 40.38066299,
                "lon": 49.85734371
            },
            "Spar Axundov": {
                "lat": 40.36794748,
                "lon": 49.82773351
            },
            "Araz Supermarket Hacibeyli": {
                "lat": 40.39036087,
                "lon": 49.84641351
            },
            "Araz Supermarket Statistika": {
                "lat": 40.38340151,
                "lon": 49.82651327
            },
            "Araz Supermarket Gutgashinli 2 Superstore": {
                "lat": 40.37037324,
                "lon": 49.82043805
            },
            "Araz Khatai 3": {
                "lat": 40.38390777,
                "lon": 49.87095655
            },
            "Araz Supermarket Space Glass Plaza": {
                "lat": 40.36685028,
                "lon": 49.81639325
            },
            "Araz Supermarket Qarabag": {
                "lat": 40.39375792,
                "lon": 49.86079648
            },
            "Araz Yasamal 3 Superstore F": {
                "lat": 40.38016422,
                "lon": 49.81117263
            },
            "Araz Supermarket Azadlig 3": {
                "lat": 40.4009704,
                "lon": 49.83782239
            },
            "Araz Supermarket Bayil 2": {
                "lat": 40.34287525,
                "lon": 49.83848003
            },
            "Araz Nerimanov 6": {
                "lat": 40.39445747,
                "lon": 49.87587413
            },
            "Araz Supermarket Narimanov": {
                "lat": 40.40119619,
                "lon": 49.86415905
            },
            "Araz Supermarket 20 Yanvarr": {
                "lat": 40.39786788,
                "lon": 49.81396058
            },
            "Araz Nerimanov 4": {
                "lat": 40.40299197,
                "lon": 49.87852989
            },
            "Araz Spar 1 3mkr": {
                "lat": 40.40687864,
                "lon": 49.8129986
            },
            "Araz Supermarket Cefer Xendan": {
                "lat": 40.41554919,
                "lon": 49.82923476
            },
            "Araz 9 Mkr 2 Superstore F": {
                "lat": 40.4187773,
                "lon": 49.81094201
            },
            "Araz Supermarket Planet": {
                "lat": 40.41270888,
                "lon": 49.93400061
            },
            "Araz Supermarket Nargile 5": {
                "lat": 40.36210339,
                "lon": 49.95032435
            },
            "Araz Supermarket Ahmadli 9": {
                "lat": 40.38945203,
                "lon": 49.95785363
            },
            "Araz Xezer 2": {
                "lat": 40.36335572,
                "lon": 49.96049095
            },
            "Araz Supermarket Nefilr": {
                "lat": 40.41335326,
                "lon": 49.94969623
            },
            "Araz Supermarket Mehdiabad": {
                "lat": 40.48795217,
                "lon": 49.85458122
            },
            "Araz Supermarket Bine 4": {
                "lat": 40.41762603,
                "lon": 50.10790464
            },
            "Araz Supermarket Mastaga 2": {
                "lat": 40.54021287,
                "lon": 50.00839856
            },
            "Araz Supermarket Qala 2": {
                "lat": 40.46565806,
                "lon": 50.13737492
            },
            "Araz Supermarket Buzovnaa": {
                "lat": 40.51695114,
                "lon": 50.1023277
            },
            "Araz Supermarket Shuvalan": {
                "lat": 40.48672062,
                "lon": 50.17045894
            },
            "Araz Supermarket Zire 2": {
                "lat": 40.37544562,
                "lon": 50.28578711
            },
            "Tamstore Xetai": {
                "lat": 40.38052676,
                "lon": 49.86220961
            },
            "Tamstore Bayil": {
                "lat": 40.3471125,
                "lon": 49.8370781
            },
            "Tamstore Neftchiler 2": {
                "lat": 40.4061625,
                "lon": 49.9463594
            },
            "Tamstore Genclik": {
                "lat": 40.4030375,
                "lon": 49.8523281
            },
            "Tamstore 20 Yanvar": {
                "lat": 40.41264503,
                "lon": 49.80192831
            },
            "Neptun Supermarket 28": {
                "lat": 40.37820743,
                "lon": 49.84615619
            },
            "Neptun Supermarket Ag Sheher": {
                "lat": 40.38322795,
                "lon": 49.89014507
            },
            "Neptun Supermarket Narimanovv": {
                "lat": 40.39807645,
                "lon": 49.8686605
            },
            "Market11": {
                "lat": 40.39673435,
                "lon": 49.81525671
            },
            "Neptun 8 Mkr": {
                "lat": 40.41843034,
                "lon": 49.83849441
            },
            "Neptun Supermarket Keshle": {
                "lat": 40.4159313,
                "lon": 49.86866558
            },
            "Neptun Supermarket Hazi": {
                "lat": 40.37086486,
                "lon": 49.95547303
            },
            "Neptun Kurdakhani": {
                "lat": 40.51675278,
                "lon": 49.93870816
            },
            "Neptun Supermarket Xalqlar": {
                "lat": 40.3938683,
                "lon": 49.95352891
            },
            "Rahat Gourment Nasimi": {
                "lat": 40.37987809,
                "lon": 49.83937981
            },
            "Rahat Gourmet Azerbaijan Pr": {
                "lat": 40.37179717,
                "lon": 49.83351293
            },
            "Rahat Gourmet Nasimi": {
                "lat": 40.38307976,
                "lon": 49.84215851
            },
            "Rahat Gourmet Bayl": {
                "lat": 40.34901228,
                "lon": 49.83548723
            },
            "Rahat Gourmet": {
                "lat": 40.40065151,
                "lon": 49.8414388
            },
            "Rahat Gourmet Tbilisi Avenue": {
                "lat": 40.39593712,
                "lon": 49.8200094
            },
            "Rahat Gourmet Buzovna": {
                "lat": 40.51691578,
                "lon": 50.10147479
            },
            "Rahat Gourmet Mardakan": {
                "lat": 40.49042418,
                "lon": 50.14821443
            },
            "Bravo Supermarket Bulbul ave.": { lat: 40.3746426, lon: 49.84359082 },
            "Bravo Supermarket Tahir 97": { lat: 40.3750623, lon: 49.85010022 },
            "Bravo Superstore 28 Mall": { lat: 40.37904659, lon: 49.84695079 },
            "Bravo Supermarket Winter Park": { lat: 40.37681269, lon: 49.83576922 },
            "Bravo Supermarket Beshir Safaroglu": { lat: 40.3736552, lon: 49.83381511 },
            "Bravo Supermarket Samad Vurgun": { lat: 40.38629697, lon: 49.83748281 },
            "Bravo Supermarket Deniz Mall": { lat: 40.35835573, lon: 49.83777993 },
            "Bravo Supermarket Sabit Orujov str.": { lat: 40.3804833, lon: 49.86636388 },
            "Bravo Supermarket Globus Centre": { lat: 40.38512866, lon: 49.82806238 },
            "Bravo Supermarket Zoopark": { lat: 40.39099055, lon: 49.84960705 },
            "Bravo Supermarket Suleyman Vazirov": { lat: 40.38383648, lon: 49.8702669 },
            "Bravo Supermarket Rifah Plaza": { lat: 40.39486793, lon: 49.83835032 },
            "Bravo Supermarket Azure": { lat: 40.37898277, lon: 49.87536581 },
            "Bravo Supermarket M. Mirqasimov": { lat: 40.39629347812428, lon: 49.84150074167363 },
            "Bravo Hypermarket Babek pr-ti 2004": { lat: 40.3875125, lon: 49.8744219 },
            "Bravo Supermarket Zahid Xalilov": { lat: 40.3793164, lon: 49.81181129 },
            "Bravo Superstore Ganjlik Mall": { lat: 40.39986414, lon: 49.85248439 },
            "Bravo Supermarket Renessance Palace": { lat: 40.38361028, lon: 49.81238784 },
            "Bravo Supermarket Chocolate Tower": { lat: 40.38087491, lon: 49.8090949 },
            "Bravo Supermarket Azadlig Avenue": { lat: 40.40192993, lon: 49.83738654 },
            "Bravo Supermarket 5 Sayli Xestexana": { lat: 40.40281021, lon: 49.86344493 },
            "Bravo Supermarket City Park Mall": { lat: 40.38963521, lon: 49.89147049 },
            "Bravo Supermarket Zefir Mall": { lat: 40.37634104, lon: 49.79397867 },
            "Bravo Supermarket Narimanov": { lat: 40.40655953, lon: 49.87614477 },
            "Bravo Supermarket Sherifzade": { lat: 40.39840189, lon: 49.80116383 },
            "Bravo Supermarket Istanbul Evleri": { lat: 40.4166375, lon: 49.8401094 },
            "Bravo Supermarket Yeni Yasamal": { lat: 40.39397201, lon: 49.79493181 },
            "Bravo Supermarket Oasis": { lat: 40.41979359, lon: 49.84671061 },
            "Bravo Supermarket 20-ci Sahe": { lat: 40.32964967, lon: 49.81835459 },
            "Bravo Supermarket 4 mkr": { lat: 40.41304395, lon: 49.80418862 },
            "Bravo Supermarket Nasimi Metro": { lat: 40.42442688, lon: 49.8230104 },
            "Bravo Supermarket 8 noyabr": { lat: 40.37331946, lon: 49.92598854 },
            "Bravo Hypermarket 20 Yanvar": { lat: 40.4015565, lon: 49.8108211 },
            "Bravo Hypermarket Koroglu": { lat: 40.41837153, lon: 49.91433381 },
            "Bravo Hypermarket Radiozavod": { lat: 40.3750375, lon: 49.9439219 },
            "Bravo Supermarket Hazi Aslanov 3084": { lat: 40.3687625, lon: 49.9480469 },
            "Bravo Supermarket Gara Garayev": { lat: 40.41638767, lon: 49.93311139 },
            "Bravo Supermarket Khatai Park": { lat: 40.36581367, lon: 49.95976764 },
            "Bravo Superstore Bakikhanov": { lat: 40.41239981, lon: 49.95426021 },
            "Bravo Supermarket Babek pr.94": { lat: 40.39482966, lon: 49.96321203 },
            "Bravo Superstore Lokbatan": { lat: 40.32255546, lon: 49.73290318 },
            "Bravo Supermarket Mardakan Highway": { lat: 40.46241858, lon: 50.08225716 },
            "Bravo Supermarket Sea Breeze Premium": { lat: 40.5883751, lon: 49.98710455 },
            "Bravo Supermarket Amburan Mall": { lat: 40.58833163, lon: 50.05820493 },
            "Bravo Supermarket Shuvalan": { lat: 40.4864041, lon: 50.16678907 }
        };
    }

    // Calculate distance in km between two coords
    calculateDistance(lat1, lon1, lat2, lon2) {
        if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity; // Handle missing coords

        const R = 6371; // Radius of the earth in km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    }

    // New Helper for Location Filtering
    filterProductsByLocation(products, options) {
        if (!options || !options.lat || !options.lon) {
            return products;
        }

        const userLat = parseFloat(options.lat);
        const userLon = parseFloat(options.lon);
        const range = parseFloat(options.range) || 5.0; // Default 5km

        if (isNaN(userLat) || isNaN(userLon)) {
            return products;
        }

        console.log(`[DealService] Filtering location: Lat=${userLat}, Lon=${userLon}, Range=${range}km`);

        // Identify stores in range
        const validStores = Object.keys(this.STORE_LOCATIONS).filter(storeName => {
            const loc = this.STORE_LOCATIONS[storeName];

            // If store has no coordinates (e.g. from Bravo JSON), we cannot verify distance.
            // Decision: Exclude from "Nearby" filter, but they remain if no filter active.
            if (!loc || !loc.lat || !loc.lon) return false;

            const dist = this.calculateDistance(userLat, userLon, loc.lat, loc.lon);
            return dist <= range;
        });

        // Filter products
        const filtered = products.filter(p => {
            // Check if product store matches any valid store
            return validStores.some(validStore => p.store.includes(validStore) || validStore.includes(p.store));
        });

        console.log(`[DealService] Location Match: ${filtered.length} / ${products.length} products in range.`);
        return filtered;
    }

    async getGroupedBrandDeals(options = {}) {
        try {
            // 1. Load Raw Data
            const rawRows = await this.csvLoader.loadProducts();

            // 2. Transform to Domain Objects
            const allProducts = rawRows.map(row => DealMapper.mapRowToProduct(row));

            // Location Filtering Logic
            let filteredProducts = this.filterProductsByLocation(allProducts, options);

            // 3. Filter out products with missing category only (brand can be Generic)
            const products = filteredProducts.filter(p => p.name !== "Unknown Product");

            // 4. Group by Product Name with Fuzzy/Keyword matching
            const groupedProducts = this.groupProducts(products);

            // 5. Map to Response Format
            const { lat, lon } = options;
            const lang = options.lang || 'en';

            const responseGroups = Object.keys(groupedProducts).map(categoryName => {
                const categoryProducts = groupedProducts[categoryName];
                return DealMapper.mapToBrandGroup(categoryName, categoryProducts, lang, lat, lon, this.STORE_LOCATIONS);
            });

            return { groups: responseGroups };

        } catch (error) {
            console.error("Error in DealService:", error);
            throw new Error("Failed to fetch brand deals");
        }
    }

    // New helper method to group products Reusably
    groupProducts(products) {
        // Helper to normalize text (remove accents/diacritics)
        const normalize = (str) => (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

        // Helper to check if a word exists as a complete word (not substring)
        const containsWord = (text, word) => {
            // Escape special regex characters in the word
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');
            return regex.test(text);
        };

        return products.reduce((acc, product) => {
            let key = product.name; // Default to existing category

            // Normalize all searchable fields
            const normKey = normalize(key);
            const normDesc = normalize(product.description);
            const normBrand = normalize(product.brand);

            // Advanced Grouping Logic requested by user
            // "if you find differnet 'cay' or 'toyuq' make sure you combine them"
            // Now checking key, description, AND brand as requested
            const keywords = ["cay", "toyuq", "yag", "seker", "un", "duyu", "makaron", "pendir", "sokolad", "yuyucu"];

            // Skip keyword matching for Unknown Product (empty category in CSV)
            // Otherwise "un" keyword would match "Unknown Product"
            if (key !== "Unknown Product") {
                // First check for specific oil types to avoid lumping everything into "Butter"
                if (normDesc.includes("kere yagi") || normDesc.includes("koka yagi") || normKey.includes("kere yagi")) {
                    key = "Kərə Yağı";
                } else if (normDesc.includes("gunabaxan") || normDesc.includes("qargidali") || normDesc.includes("zeytun")) {
                    key = "Duru Yağ"; // Liquid Oil
                } else {
                    for (const word of keywords) {
                        // Use word boundary matching instead of includes
                        if (containsWord(normKey, word) || containsWord(normDesc, word) || containsWord(normBrand, word)) {
                            key = word.charAt(0).toUpperCase() + word.slice(1);
                            // Map specific common variations
                            if (key === "Yag") key = "Kərə Yağı"; // Fallback if just generic "yag" found & not caught above
                            if (key === "Cay") key = "Çay";
                            if (key === "Yuyucu") key = "Yuyucu toz";
                            if (key === "Un") key = "Un";
                            break;
                        }
                    }
                }
            }

            // Normalize the entire key first to lowercase/remove diacritics for comparison
            const fullyNormalizedKey = normalize(key);

            // Find if this normalized key already exists in accumulator (case-insensitive match)
            const existingKey = Object.keys(acc).find(k => normalize(k) === fullyNormalizedKey);

            // Use existing key if found, otherwise use the original key (preserves first occurrence's casing)
            const finalKey = existingKey || key;

            if (!acc[finalKey]) {
                acc[finalKey] = [];
            }
            acc[finalKey].push(product);
            return acc;
        }, {});
    }

    // Get top deals sorted by discount percentage
    // Get deals with Sorting and Filtering
    async getDeals(options = {}) {
        const { limit = 20, offset = 0, sortBy = 'discount_pct', storeFilter = null } = options;

        let products = await this.getAllProducts();

        // 1. Filter by Store if requested
        if (storeFilter) {
            products = products.filter(p => p.store && p.store.includes(storeFilter));
        }

        // 2. Filter valid discounts (always apply for "Deals")
        let deals = products.filter(p => p.discountPercent > 0);

        // 3. Sort
        deals.sort((a, b) => {
            let diff = 0;
            switch (sortBy) {
                case 'price_asc':
                    return a.price - b.price;
                case 'price_desc':
                    return b.price - a.price;
                case 'discount_val': // Savings amount
                    return (b.originalPrice - b.price) - (a.originalPrice - a.price);
                case 'market_name':
                    return a.store.localeCompare(b.store);
                case 'discount_pct':
                default:
                    return b.discountPercent - a.discountPercent;
            }
        });

        // Secondary sort by ID for stability
        deals.sort((a, b) => {
            // If primary sort was equal (diff=0), this keeps stability. 
            // But Array.sort is stable in Node 11+. 
            // We can just append ID check to the main sort if needed, but let's leave it simple.
            return 0;
        });

        // Slice
        return deals.slice(offset, offset + limit);
    }

    // Deprecated wrapper for backward compatibility if needed, using new logic
    async getTopDeals(limit = 20, offset = 0) {
        return this.getDeals({ limit, offset, sortBy: 'discount_pct' });
    }

    // Search products by a list of query strings
    // Search products by a list of query strings (e.g. from scanned text)
    async searchProducts(queries = [], options = {}) {
        let allProducts = await this.getAllProducts();

        // precise location filtering BEFORE search
        allProducts = this.filterProductsByLocation(allProducts, options);
        if (!queries || queries.length === 0) return [];

        const fuseOptions = {
            keys: ['name', 'brand', 'description', 'store'],
            includeScore: true,
            threshold: 0.1, // Stricter: 0.1 requires ~90% similarity (requested by user)
            ignoreLocation: true,
            minMatchCharLength: 3,
            useExtendedSearch: true
        };

        const fuse = new Fuse(allProducts, fuseOptions);
        let results = new Set();

        for (const query of queries) {
            let searchResults = [];

            // Special handling for short queries ("un", "su", "et") to avoid "sabun", "sufle", "kotelet"
            if (query.length <= 3) {
                // Exact word match using regex for higher precision
                // or use Fuse extended search with strict equality
                const strictResults = fuse.search({
                    $or: [
                        { name: `'${query}` }, // ' includes exact match logic in Fuse extended search
                        { description: `'${query}` }
                    ]
                });

                // If Fuse extended search isn't strict enough, filter manually with regex word boundaries
                // This ensures "un" matches "Un 1kq" but NOT "Sabun"
                const regex = new RegExp(`\\b${query}\\b`, 'i');
                const manualMatches = allProducts.filter(p =>
                    regex.test(p.name) ||
                    regex.test(p.description)
                ).map(item => ({ item, score: 0 }));

                searchResults = manualMatches.length > 0 ? manualMatches : strictResults;
            } else {
                // Normal fuzzy search for longer queries
                searchResults = fuse.search(query);
            }

            // Take top 10 matches for each query
            searchResults.slice(0, 10).forEach(result => {
                results.add(result.item);
            });
        }

        return Array.from(results);
    }

    // New method to get flat list of products (for Home/Planning)
    async getAllProducts() {
        const rawRows = await this.csvLoader.loadProducts();
        const allProducts = rawRows.map(row => DealMapper.mapRowToProduct(row));

        // Filter out products with missing category only (brand can be Generic)
        return allProducts.filter(p => p.name !== "Unknown Product");
    }

    // Get random deals for Home Screen
    async getRandomDeals(count = 5) {
        const products = await this.getAllProducts();
        // Filter for items with actual discounts
        const deals = products.filter(p => p.discountPercent > 0);

        // Shuffle and slice
        const shuffled = deals.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    // Get list of all available stores
    getAvailableStores() {
        return Object.keys(this.STORE_LOCATIONS).map(name => ({
            name: name,
            ...this.STORE_LOCATIONS[name]
        }));
    }
}

module.exports = new DealService();
