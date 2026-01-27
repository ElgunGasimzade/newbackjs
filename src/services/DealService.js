const CsvLoaderService = require('./CsvLoaderService');
const DealMapper = require('../mappers/DealMapper');
const Fuse = require('fuse.js');
const db = require('../config/db');

class DealService {
    constructor() {
        // Updated to use the new Wolt scraper dataset
        const path = require('path');
        const finalCsvPath = path.join(__dirname, '../../uploads/wolt_products.csv');
        this.csvLoader = new CsvLoaderService(finalCsvPath);

        this.STORE_LOCATIONS = {}; // Temporarily empty until async load
        this.loadStoreLocations(); // Fire and forget load on startup
    }

    // Load stores from DB into memory cache on startup
    async loadStoreLocations() {
        try {
            const client = await db.getClient();
            const res = await client.query('SELECT name, lat, lon FROM stores');

            this.STORE_LOCATIONS = {};
            res.rows.forEach(row => {
                this.STORE_LOCATIONS[row.name] = { lat: row.lat, lon: row.lon };
            });
            console.log(`[DealService] Loaded ${res.rows.length} stores from DB.`);
            client.release();
        } catch (e) {
            console.error("Failed to load stores from DB:", e);
        }
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
        // Since we cached them in memory map, we can check quickly.
        // For larger dataset, we would query DB directly: 
        // SELECT * FROM stores WHERE earth_box(ll_to_earth($1, $2), $3) @> ll_to_earth(lat, lon);
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
            // Optimized: create a Set of valid stores for O(1) lookup if exact match?
            // But names in products might be fuzzy comparisons in future.
            // Current data: "Araz Supermarket..." is exact string in product.store? 
            // Usually yes.
            return validStores.some(validStore => p.store && p.store.includes(validStore));
        });

        console.log(`[DealService] Location Match: ${filtered.length} / ${products.length} products in range.`);
        return filtered;
    }

    async getGroupedBrandDeals(options = {}) {
        try {
            // 1. Load Data from DB (Cached)
            const allProducts = await this.getAllProducts();

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

        // 0. Filter by Location (if enabled in app)
        products = this.filterProductsByLocation(products, options);

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
    // Search products using SQL for performance (replaces in-memory Fuse)
    async searchProducts(queries = [], options = {}) {
        if (!queries || queries.length === 0) return [];

        try {
            // 1. Construct SQL Query with Fuzzy Matching (pg_trgm)
            // We enabled pg_trgm, so we can use SIMILARITY(col, val) > threshold

            // Filter out short queries
            const validQueries = queries.filter(q => q.length >= 2);
            if (validQueries.length === 0) return [];

            const orClauses = validQueries.map((q, i) => {
                const idx = i + 1;
                // Check name OR description
                // SIMILARITY > 0.1 is very loose (good for typos).
                // ILIKE ensures substring matches are always found even if similarity is low due to short length.
                return `(
                    name ILIKE ('%' || $${idx} || '%') OR 
                    SIMILARITY(name, $${idx}) > 0.9 OR
                    description ILIKE ('%' || $${idx} || '%')
                )`;
            });

            const whereClause = orClauses.join(' OR ');

            // Use the first query term as the primary sort score input (approximation)
            const sql = `
                SELECT *, 
                SIMILARITY(name, $1) as score 
                FROM products 
                WHERE ${whereClause}
                ORDER BY score DESC 
                LIMIT 100
            `;

            console.log(`[DealService] Fuzzy DB Search (pg_trgm) for terms: ${validQueries.join(', ')}`);
            const res = await db.query(sql, validQueries);

            let products = res.rows.map(row => DealMapper.mapRowToProductDB(row));

            // 2. Filter by Location
            products = this.filterProductsByLocation(products, options);

            console.log(`[DealService] Found ${products.length} matches.`);
            return products;

            return products;

        } catch (e) {
            console.error("DB Search failed:", e);
            return [];
        }
    }

    async getAllProducts() {
        if (this._cachedProducts) return this._cachedProducts;

        try {
            const res = await db.query('SELECT * FROM products');
            this._cachedProducts = res.rows.map(row => ({
                id: row.id,
                store: row.store,
                name: row.name,
                brand: row.brand,
                description: row.description,
                originalPrice: row.original_price, // map snake_case to camelCase
                price: row.price,
                discountPercent: row.discount_percent,
                details: row.details,
                imageUrl: row.image_url,
                inStock: row.in_stock
            }));

            console.log(`[DealService] Loaded ${this._cachedProducts.length} products from DB.`);
            return this._cachedProducts;
        } catch (e) {
            console.error("Failed to load products from DB", e);
            throw e;
        }
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
    // Get list of all available stores
    getAvailableStores(options = {}) {
        let stores = Object.keys(this.STORE_LOCATIONS).map(name => ({
            name: name,
            ...this.STORE_LOCATIONS[name]
        }));

        const { lat, lon, range = 5.0 } = options;

        if (lat && lon) {
            const userLat = parseFloat(lat);
            const userLon = parseFloat(lon);
            const r = parseFloat(range);

            if (!isNaN(userLat) && !isNaN(userLon)) {
                stores = stores.filter(store => {
                    if (!store.lat || !store.lon) return false;
                    const dist = this.calculateDistance(userLat, userLon, store.lat, store.lon);
                    return dist <= r;
                });
            }
        }

        return stores;
    }
}

module.exports = new DealService();
