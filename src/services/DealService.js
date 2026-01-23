const CsvLoaderService = require('./CsvLoaderService');
const DealMapper = require('../mappers/DealMapper');
const Fuse = require('fuse.js');

class DealService {
    constructor() {
        // Updated to use the new Wolt scraper dataset
        const path = require('path');
        const finalCsvPath = path.join(__dirname, '../../uploads/wolt_products.csv');
        this.csvLoader = new CsvLoaderService(finalCsvPath);
    }

    async getGroupedBrandDeals() {
        try {
            // 1. Load Raw Data
            const rawRows = await this.csvLoader.loadProducts();

            // 2. Transform to Domain Objects
            const allProducts = rawRows.map(row => DealMapper.mapRowToProduct(row));

            // 3. Filter out products with missing category only (brand can be Generic)
            const products = allProducts.filter(p => p.name !== "Unknown Product");

            // 4. Group by Product Name with Fuzzy/Keyword matching
            const groupedProducts = this.groupProducts(products);

            // 5. Map to Response Format
            const responseGroups = Object.keys(groupedProducts).map(categoryName => {
                const categoryProducts = groupedProducts[categoryName];
                return DealMapper.mapToBrandGroup(categoryName, categoryProducts);
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
    async getTopDeals(limit = 20, offset = 0) {
        const products = await this.getAllProducts();
        // Filter valid discounts
        const deals = products
            .filter(p => p.discountPercent > 0)
            .sort((a, b) => {
                const diff = b.discountPercent - a.discountPercent;
                if (diff !== 0) return diff;
                // Secondary sort by ID for stability
                return a.id.localeCompare(b.id);
            });

        return deals.slice(offset, offset + limit);
    }

    // Search products by a list of query strings
    // Search products by a list of query strings (e.g. from scanned text)
    async searchProducts(queries = []) {
        const allProducts = await this.getAllProducts(); // Already filtered
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
}

module.exports = new DealService();
