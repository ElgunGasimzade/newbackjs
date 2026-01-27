const dealService = require('./src/services/DealService');

// Wait for async load
setTimeout(() => {
    const stores = dealService.getAvailableStores();
    console.log(`Loaded ${stores.length} stores.`);
    if (stores.length > 0) {
        console.log("Sample Store:", stores[0]);
    }

    // Test Distance calc
    const filtered = dealService.filterProductsByLocation([{ store: "Bravo Supermarket Sumqait Bagcagli" }], { lat: 40.575, lon: 49.643, range: 1 });
    console.log("Filtered Matches (should be 1):", filtered.length);

    process.exit(0);
}, 2000);
