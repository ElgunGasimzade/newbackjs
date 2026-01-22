const DealService = require('../services/DealService');

class HomeController {
    async getHomeFeed(req, res) {
        try {
            // Fetch top 50 deals sorted by discount
            const topDeals = await DealService.getTopDeals(50);

            // Transform to Home Product format
            const homeProducts = topDeals.map((p, index) => {
                let name = p.description;
                if (p.details && !name.includes(p.details)) {
                    name = `${name} (${p.details})`;
                }

                return {
                    id: `prod_${index}`,
                    name: name, // Specific Name with Unit
                    brand: p.brandName,
                    category: p.productName, // Generic Category
                    store: p.store,
                    imageUrl: "https://imageproxy.wolt.com/menu/menu-images/68ad527871323d956d4b3edd/55d8c312-8e44-11f0-948b-d6bd7deb8ae0_121920.jpg", // Placeholder
                    price: p.newPrice,
                    originalPrice: p.oldPrice,
                    discountPercent: p.discountPercentage,
                    badge: p.discountPercentage > 20 ? "Great Deal" : null,
                    inStock: true // Required by iOS model
                };
            });

            // Pick one for Hero
            const heroProduct = homeProducts.length > 0 ? homeProducts[0] : null;
            const listProducts = homeProducts.slice(1);

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
