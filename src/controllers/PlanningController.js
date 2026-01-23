const DealService = require('../services/DealService');
const ScanController = require('./ScanController'); // Require to access shared state

// In-memory store for generated plans (acting as temporary cache for route details)
const planStore = new Map();

class PlanningController {

    async optimizePlan(req, res) {
        try {
            const allProducts = await DealService.getAllProducts();

            // 1. Determine Input Items
            let inputItemNames = req.body.items || [];
            let inputItemIds = req.body.ids || []; // Support for ID-based lookup

            let derivedItems = [];

            if (inputItemIds.length > 0) {
                // Enhanced Flow: Use IDs
                console.log(`[Planning] Optimizing for ${inputItemIds.length} IDs.`);
                // Map IDs to product names/descriptions to "feed" the logic
                // In a real app, we'd pass the actual objects deep into the logic, 
                // but for this refactor I'll map them to "Terms" that the existing logic understands,
                // OR I'll modify the logic to prioritize these specific items.

                // Let's resolve the objects first
                const resolvedProducts = allProducts.filter(p => inputItemIds.includes(p.id));

                // Use their descriptions/names as the "Needed Terms" 
                // We normalize here to ensure the fuzzy matcher finds them (and potential alternatives if that exact ID isn't at a specific store)
                // Wait, if I have a specific ID, I want THAT exact item.
                // But the "Optimization" logic calculates "Basket Price at Store X". 
                // If Item A (ID: 123) is only at Store 1, what do we do for Store 2?
                // Answer: We need the "Equivalent" item at Store 2.
                // So we must derive the "Category" or "Generic Name" from the specific ID.

                derivedItems = resolvedProducts.map(p => {
                    // Use strict description to find the EXACT same product at other stores
                    // User wants "my chosings", not generic substitutions.
                    // So we search for "Sevimli Dad Kərə yağı" instead of just "Kərə yağı".
                    return p.description || p.name;
                });

                console.log(`[Planning] Derived terms from IDs: ${derivedItems.join(', ')}`);
                inputItemNames = derivedItems;
            }

            if (inputItemNames.length === 0) {
                // Try to grab from scan controller's shared memory
                const scanItems = ScanController.getLastScanItems();
                if (scanItems && scanItems.length > 0) {
                    inputItemNames = scanItems.map(i => i.name);
                    console.log(`[Planning] Using ${inputItemNames.length} items from last scan.`);
                } else {
                    // Fallback for demo if no scan
                    inputItemNames = ["Yogurt", "Milk", "Eggs"];
                }
            }

            // Normalize needed items for checking
            const normalize = (str) => (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const neededItems = inputItemNames.map(n => normalize(n));

            console.log(`[Planning] Optimizing for items: ${neededItems.join(', ')}`);

            // Helper: Find matches for a required item name in all products
            // Using fuzzy logic similar to DealService
            const findMatchesForTerm = (term) => {
                const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
                return allProducts.filter(p => {
                    // Check name, category, and brand
                    const normName = normalize(p.name);
                    const normDesc = normalize(p.description);
                    const normBrand = normalize(p.brand);

                    return regex.test(normName) || regex.test(normDesc) || regex.test(normBrand);
                });
            };

            // --- OPTION A: MAX SAVINGS (Multi-Store) ---
            // Concept: For each item on the list, buy it at the store where it matches and is Cheapest.

            const maxSavingsStops = {}; // Store -> [Items]
            let maxSavingsTotalSavings = 0;

            // If we have specific product IDs picked by the user, Option A should respect them EXACTLY.
            // Validating user choices ("I picked this deal") -> Planning ("Okay, get THAT deal").
            if (inputItemIds.length > 0) {
                console.log(`[Planning] Option A: Using ${inputItemIds.length} strict locked items.`);
                const resolvedProducts = allProducts.filter(p => inputItemIds.includes(p.id));

                resolvedProducts.forEach(product => {
                    const savings = (product.originalPrice > product.price) ? (product.originalPrice - product.price) : 0;

                    if (!maxSavingsStops[product.store]) maxSavingsStops[product.store] = [];
                    maxSavingsStops[product.store].push({
                        id: product.id,
                        name: product.description || product.name,
                        price: product.price,
                        savings: savings,
                        aisle: "General",
                        checked: false
                    });

                    maxSavingsTotalSavings += savings;
                });
            } else {
                // Legacy Flow: Search for terms and find cheapest
                neededItems.forEach(term => {
                    const matches = findMatchesForTerm(term);
                    if (matches.length > 0) {
                        matches.sort((a, b) => a.price - b.price);
                        const bestDeal = matches[0];
                        const savings = (bestDeal.originalPrice > bestDeal.price) ? (bestDeal.originalPrice - bestDeal.price) : 0;

                        if (!maxSavingsStops[bestDeal.store]) maxSavingsStops[bestDeal.store] = [];
                        maxSavingsStops[bestDeal.store].push({
                            id: bestDeal.id || `ri_${Date.now()}_${Math.random()}`,
                            name: bestDeal.description || bestDeal.name,
                            price: bestDeal.price,
                            savings: savings,
                            aisle: "General",
                            checked: false
                        });

                        maxSavingsTotalSavings += savings;
                    } else {
                        console.log(`[Planning] No matches found for term: ${term}`);
                    }
                });
            }

            // Convert Option A Map to Route Stops
            // We need to format specific to RouteOption structure
            // RouteStopSummary vs RouteDetails are different. 
            // `optimizePlan` returns options with `stops: [RouteStopSummary]`
            const optionAStopSummaries = Object.keys(maxSavingsStops).map(storeName => ({
                store: storeName,
                summary: `${maxSavingsStops[storeName].length} items to buy`
            }));

            // Save Option A Details for later retrieval
            const optionADetails = {
                totalSavings: maxSavingsTotalSavings,
                estTime: `${Object.keys(maxSavingsStops).length * 15} mins`, // Mock time: 15m per stop
                stops: Object.keys(maxSavingsStops).map((storeName, index) => ({
                    sequence: index + 1,
                    store: storeName,
                    distance: `${(Math.random() * 2).toFixed(1)} km`,
                    color: index % 2 === 0 ? "green" : "blue",
                    items: maxSavingsStops[storeName]
                }))
            };
            planStore.set("opt_max_savings", optionADetails);


            // --- OPTION B: ONE STOP (Single Store) ---
            // Concept: Calculate the "Basket Price" for the user's list at EACH store.
            // Logic: We must find the user's selected items (or identicals) at other stores.
            // Since IDs are unique per deal (Row 1 = Store A, Row 2 = Store B), we cannot look up ID at Store B.
            // We MUST search by Description ("Sevimli Dad Kərə yağı") to find the equivalent at Store B.

            const uniqueStores = [...new Set(allProducts.map(p => p.store))];
            let bestStore = null;
            let bestStoreBasketPrice = Infinity;
            let bestStoreSavings = 0;
            let bestStoreItems = [];

            if (inputItemIds.length > 0) {
                // Strict ID Logic: Find the single store that offers the most savings for the *specific* selected items.
                // We only look at the items the user explicitly selected.

                const selectedProducts = allProducts.filter(p => inputItemIds.includes(p.id));

                // Group by store
                const storeGroups = {};
                selectedProducts.forEach(p => {
                    if (!storeGroups[p.store]) storeGroups[p.store] = [];
                    storeGroups[p.store].push(p);
                });

                // Find store with max savings for these specific items
                let maxSavingsFound = -1; // Start -1 to ensure even 0 savings overwrites null if valid

                Object.keys(storeGroups).forEach(store => {
                    const productsInStore = storeGroups[store];

                    let currentStoreSavings = 0;
                    let currentStorePrice = 0;

                    const mappedItems = productsInStore.map(p => {
                        const savings = (p.originalPrice > p.price) ? (p.originalPrice - p.price) : 0;
                        currentStoreSavings += savings;
                        currentStorePrice += p.price;

                        return {
                            id: p.id,
                            name: p.description || p.name,
                            price: p.price,
                            savings: savings,
                            aisle: "General",
                            checked: false
                        };
                    });

                    // Criteria: Best Market = More Discount
                    if (currentStoreSavings > maxSavingsFound) {
                        maxSavingsFound = currentStoreSavings;
                        bestStore = store;
                        bestStoreSavings = currentStoreSavings;
                        bestStoreBasketPrice = currentStorePrice;
                        bestStoreItems = mappedItems;
                    }
                });

                console.log(`[Planning] Option B (Strict): Best store is ${bestStore} with ${bestStoreSavings} savings.`);

            } else {
                // Legacy Fuzzy Logic
                // Use the same search logic whether we have IDs or Names 
                // (though in this branch we likely only have names if IDs matched nothing or weren't provided)
                uniqueStores.forEach(store => {
                    const storeProducts = allProducts.filter(p => p.store === store);

                    let currentBasketPrice = 0;
                    let currentSavings = 0;
                    let foundItems = [];
                    let itemsFoundCount = 0;

                    neededItems.forEach(term => {
                        // Find matches AT THIS STORE using exactish description match
                        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');

                        const matches = storeProducts.filter(p => {
                            const normName = normalize(p.productName || p.name);
                            const normDesc = normalize(p.description);
                            return regex.test(normDesc) || regex.test(normName);
                        });

                        if (matches.length > 0) {
                            // Pick cheapest match at this store
                            matches.sort((a, b) => a.price - b.price);
                            const match = matches[0];

                            currentBasketPrice += match.price;
                            if (match.originalPrice > match.price) {
                                currentSavings += (match.originalPrice - match.price);
                            }

                            foundItems.push({
                                id: match.id || `ri_${Date.now()}_${Math.random()}`,
                                name: match.description || match.name,
                                price: match.price,
                                savings: (match.originalPrice - match.price) > 0 ? (match.originalPrice - match.price) : 0,
                                aisle: "General",
                                checked: false
                            });
                            itemsFoundCount++;
                        }
                    });

                    if (itemsFoundCount > 0) {
                        if (!bestStore || (itemsFoundCount > bestStoreItems.length) || (itemsFoundCount === bestStoreItems.length && currentBasketPrice < bestStoreBasketPrice)) {
                            bestStore = store;
                            bestStoreBasketPrice = currentBasketPrice;
                            bestStoreSavings = currentSavings;
                            bestStoreItems = foundItems;
                        }
                    }
                });
            }

            // Option B Details
            const optionBStopSummaries = bestStore ? [{
                store: bestStore,
                summary: `All ${bestStoreItems.length} items available here`
            }] : [];

            const optionBDetails = {
                totalSavings: bestStoreSavings,
                estTime: "25 mins",
                stops: bestStore ? [{
                    sequence: 1,
                    store: bestStore,
                    distance: "1.5 km",
                    color: "purple",
                    items: bestStoreItems
                }] : []
            };
            planStore.set("opt_one_stop", optionBDetails);


            // --- Response ---
            res.json({
                options: [
                    {
                        id: "opt_max_savings", // ID used to fetch details
                        type: "MAX_SAVINGS",
                        title: "Max Savings",
                        totalSavings: parseFloat(maxSavingsTotalSavings.toFixed(2)),
                        totalDistance: "",
                        description: "Save more by visiting multiple stores.",
                        stops: optionAStopSummaries
                    },
                    {
                        id: "opt_one_stop",
                        type: "TIME_SAVER",
                        title: "One Stop",
                        totalSavings: parseFloat(bestStoreSavings.toFixed(2)),
                        totalDistance: "",
                        description: bestStore ? `Get everything at ${bestStore}.` : "No single store has these items.",
                        stops: optionBStopSummaries
                    }
                ]
            });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Optimization failed" });
        }
    }

    async getRouteDetails(req, res) {
        try {
            const { optionId } = req.params;

            // Retrieve computed details from memory
            const details = planStore.get(optionId);

            if (details) {
                res.json(details);
            } else {
                // Fallback mock if server restarted or ID invalid
                res.json({
                    totalSavings: 0.00,
                    estTime: "0 mins",
                    stops: []
                });
            }
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Failed to get route details" });
        }
    }
}

module.exports = new PlanningController();
