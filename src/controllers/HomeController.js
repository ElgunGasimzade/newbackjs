const DealService = require('../services/DealService');

const TRANSLATIONS = {
    en: {
        hero_title: "Deal of the Day ⚡️",
        hero_subtitle: "Ends soon",
        cat_all: "All Deals",
        cat_food: "Food",
        cat_home: "Home",
        badge_discount: "OFF"
    },
    az: {
        hero_title: "Günün Təklifi ⚡️",
        hero_subtitle: "Bitmək üzrədir",
        cat_all: "Bütün Təkliflər",
        cat_food: "Qida",
        cat_home: "Ev",
        badge_discount: "ENDİRİM"
    }
};

class HomeController {
    async getHomeFeed(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;
            const sortBy = req.query.sort || 'discount_pct';
            const storeFilter = req.query.store || null;
            // Location params
            const lat = req.query.lat ? parseFloat(req.query.lat) : null;
            const lon = req.query.lon ? parseFloat(req.query.lon) : null;
            const range = req.query.range ? parseFloat(req.query.range) : 5.0;

            const lang = req.headers['accept-language']?.startsWith('az') ? 'az' : 'en'; // Simple check, default EN
            const t = (key) => TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en'][key] || key;

            console.log(`[Home] Fetching feed (Page ${page}, Sort: ${sortBy}, Store: ${storeFilter || 'All'}, Loc: ${lat},${lon})`);

            // Fetch deals with pagination, sorting, and filtering
            const deals = await DealService.getDeals({ limit, offset, sortBy, storeFilter, lat, lon, range });

            // Transform to Home Product format
            const homeProducts = deals.map((p, index) => {
                let name = p.description;
                if (p.details && !name.includes(p.details)) {
                    name = `${name} (${p.details})`;
                }

                return {
                    id: p.id, // Use stable ID instead of index to prevent duplicate IDs on pagination
                    name: name, // Specific Name with Unit
                    brand: p.brand,
                    category: p.name, // Generic Category (was productName)
                    store: require('../mappers/DealMapper').formatStoreName(p.store), // FORMATTED HERE
                    imageUrl: p.imageUrl, // Use the mapped URL (remote or local)
                    price: p.price,
                    originalPrice: p.originalPrice,
                    discountPercent: p.discountPercent,
                    badge: p.discountPercent > 20 ? "Great Deal" : null,
                    inStock: true // Required by iOS model
                };
            });

            // Handle Hero vs List logic
            // Page 1: Find best deal WITH IMAGE for Hero.
            // Page > 1: No Hero (client ignores), just list.

            const isFirstPage = page === 1;
            let heroProduct = null;
            let listProducts = homeProducts;

            if (isFirstPage && homeProducts.length > 0) {
                // specific user request: "never make products without image deal of day"
                // Find first product with a valid image (not placeholder, not "No image", and reasonable length)
                const heroIndex = homeProducts.findIndex(p => {
                    if (!p.imageUrl) return false;
                    const url = p.imageUrl.toLowerCase();
                    return !url.includes("placehold.co") &&
                        !url.includes("no image") &&
                        !url.includes("no_image") &&
                        url.length > 10;
                });

                if (heroIndex !== -1) {
                    heroProduct = homeProducts[heroIndex];
                    // Remove Hero from the list so it doesn't appear twice
                    listProducts = homeProducts.filter((_, i) => i !== heroIndex);
                } else {
                    // Fallback if ALL have no image (rare)
                    heroProduct = homeProducts[0];
                    listProducts = homeProducts.slice(1);
                }
            } else if (!isFirstPage) {
                // For pagination, we don't extract a hero, just return the full list
                // Item 0 is technically "Hero" in JSON structure but frontend appends to list.
                // Wait, frontend pagination logic might expect full list.
                // Current frontend logic: page 1 splits hero/list. Page > 1 appends to list.
                // SO for page > 1, we return all. 
                listProducts = homeProducts;
                // Hero is null or ignored.
                heroProduct = homeProducts.length > 0 ? homeProducts[0] : null;
            }

            res.json({
                hero: heroProduct ? {
                    title: t('hero_title'),
                    subtitle: t('hero_subtitle'),
                    product: {
                        ...heroProduct,
                        badge: `-${heroProduct.discountPercent}% ${t('badge_discount')}`,
                        inStock: true
                    }
                } : null,
                categories: [
                    { id: "cat_all", name: t('cat_all'), selected: true },
                    { id: "cat_food", name: t('cat_food') },
                    { id: "cat_home", name: t('cat_home') },
                ],
                products: listProducts
            });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Failed to load home feed" });
        }
    }

    async getAvailableStores(req, res) {
        try {
            const lat = req.query.lat ? parseFloat(req.query.lat) : null;
            const lon = req.query.lon ? parseFloat(req.query.lon) : null;
            const range = req.query.range ? parseFloat(req.query.range) : 5.0;

            const stores = DealService.getAvailableStores({ lat, lon, range });
            res.json(stores);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Failed to load stores" });
        }
    }
}

module.exports = new HomeController();
