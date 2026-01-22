const DealService = require('../services/DealService');

class HomeController {
    async getHomeFeed(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;
            console.log("[Home] Fetching home feed..." + page + " " + limit + " " + offset);

            // Fetch deals with pagination
            const topDeals = await DealService.getTopDeals(limit, offset);

            // Transform to Home Product format
            const homeProducts = topDeals.map((p, index) => {
                let name = p.description;
                if (p.details && !name.includes(p.details)) {
                    name = `${name} (${p.details})`;
                }

                return {
                    id: p.id, // Use stable ID instead of index to prevent duplicate IDs on pagination
                    name: name, // Specific Name with Unit
                    brand: p.brandName,
                    category: p.productName, // Generic Category
                    store: p.store,
                    imageUrl: p.imageUrl, // Use the mapped URL (remote or local)
                    price: p.newPrice,
                    originalPrice: p.oldPrice,
                    discountPercent: p.discountPercentage,
                    badge: p.discountPercentage > 20 ? "Great Deal" : null,
                    inStock: true // Required by iOS model
                };
            });

            // Handle Hero vs List logic
            // Page 1: Item 0 is Hero, Items 1..N are List.
            // Page > 1: Item 0 is reused as "Hero" (ignored by frontend), Items 0..N are List (so we don't lose Item 0).
            const isFirstPage = page === 1;
            const heroProduct = homeProducts.length > 0 ? homeProducts[0] : null;

            // Debug Log for Production Images
            if (heroProduct) {
                console.log("[Home] Sample Image URL:", heroProduct.imageUrl);
            }

            const listProducts = isFirstPage ? homeProducts.slice(1) : homeProducts;

            res.json({
                hero: heroProduct ? {
                    title: "Daily Drop ⚡️",
                    subtitle: "Ends soon",
                    product: {
                        ...heroProduct,
                        badge: `-${heroProduct.discountPercent}% OFF`,
                        inStock: true
                    }
                } : null,
                categories: [
                    { id: "cat_all", name: "All Deals", selected: true },
                    { id: "cat_food", name: "Food" },
                    { id: "cat_home", name: "Home" },
                ],
                products: listProducts
            });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Failed to load home feed" });
        }
    }
}

module.exports = new HomeController();
