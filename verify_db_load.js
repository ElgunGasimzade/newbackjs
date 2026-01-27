const DealService = require('./src/services/DealService');

async function test() {
    try {
        console.log("Testing DB connection and Service...");
        const products = await DealService.getAllProducts();
        console.log("Success! Loaded products:", products.length);

        if (products.length > 0) {
            console.log("Sample Product:", products[0]);
        }

        // Test filtering (which uses getAllProducts underneath)
        console.log("Testing getDeals...");
        const deals = await DealService.getDeals({ limit: 5 });
        console.log("Deals found:", deals.length);

        process.exit(0);
    } catch (e) {
        console.error("Verification Failed:", e);
        process.exit(1);
    }
}

test();
