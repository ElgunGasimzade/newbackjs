const DealService = require('./src/services/DealService');

async function testSearch() {
    try {
        console.log("Loading products...");
        // Ensure CSV is loaded
        const all = await DealService.getAllProducts();
        console.log(`Loaded ${all.length} products.`);

        const query = "Milka";
        console.log(`Searching for '${query}'...`);
        const results = await DealService.searchProducts([query]);

        console.log(`Found ${results.length} results.`);
        results.forEach(p => console.log(`- ${p.name} (${p.price} AZN)`));

    } catch (e) {
        console.error(e);
    }
}

testSearch();
